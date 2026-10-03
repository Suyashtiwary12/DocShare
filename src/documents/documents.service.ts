import {
    BadRequestException,
    Injectable,
    Logger,
    NotFoundException,
    UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PDFParse } from 'pdf-parse';
import { randomUUID } from 'node:crypto';
import type { Express } from 'express';
import type { Document } from '@prisma/client';
import { IngestionService } from '../ai/ingestion.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from './storage.service.js';

const DEFAULT_MAX_UPLOAD_SIZE_MB = 20;
const DEFAULT_MIN_EXTRACTABLE_TEXT_CHARS = 50;
const PDF_HEADER = Buffer.from('%PDF-');

@Injectable()
export class DocumentsService {
    private readonly logger = new Logger(DocumentsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly storageService: StorageService,
        private readonly configService: ConfigService,
        private readonly ingestionService: IngestionService,
    ) { }

    async uploadDocument(file: Express.Multer.File | undefined, ownerId: string): Promise<Document> {
        if (!file) {
            throw new BadRequestException('A PDF file is required');
        }

        const maxUploadSize = this.getMaxUploadSizeBytes();
        if (file.size > maxUploadSize) {
            throw new BadRequestException('File exceeds the maximum upload size');
        }
        if (file.mimetype !== 'application/pdf' || !file.buffer.subarray(0, PDF_HEADER.length).equals(PDF_HEADER)) {
            throw new BadRequestException('Only valid PDF files are allowed');
        }

        const extractedText = await this.extractTextFromPdf(file.buffer);
        const minExtractableChars = this.getMinExtractableTextChars();
        if (extractedText.trim().length < minExtractableChars) {
            throw new UnprocessableEntityException(
                'This PDF has no extractable text — it looks like a scanned image or photo rather than a text-based document. Please upload a PDF with selectable text.',
            );
        }

        const filename = this.sanitizeFilename(file.originalname);
        const s3Key = `documents/${ownerId}/${randomUUID()}-${filename}`;

        await this.storageService.uploadFile(file.buffer, s3Key, 'application/pdf');
        try {
            const savedDocument = await this.prisma.document.create({
                data: {
                    filename,
                    s3Key,
                    fileSize: file.size,
                    mimeType: 'application/pdf',
                    ownerId,
                    embeddingStatus: 'PENDING',
                },
            });

            void this.ingestionService.processDocument(savedDocument.id, extractedText).catch((error: unknown) => {
                this.logger.error(
                    `Document embedding failed for document ${savedDocument.id}`,
                    error instanceof Error ? error.stack : undefined,
                );
            });

            return { ...savedDocument };
        } catch (error) {
            await this.storageService.deleteFile(s3Key);
            throw error;
        }
    }

    async findAllForUser(ownerId: string, searchQuery?: string): Promise<Document[]> {
        return this.prisma.document.findMany({
            where: {
                ownerId,
                ...(searchQuery?.trim()
                    ? { filename: { contains: searchQuery.trim(), mode: 'insensitive' } }
                    : {}),
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async findOneForUser(documentId: string, userId: string, userEmail: string): Promise<Document> {
        const normalizedEmail = userEmail.trim().toLowerCase();
        const document = await this.prisma.document.findFirst({
            where: {
                id: documentId,
                OR: [
                    { ownerId: userId },
                    { shares: { some: { OR: [{ userId }, { email: normalizedEmail }] } } },
                ],
            },
        });
        // Return 404 for non-owners and non-invitees so document existence is not disclosed.
        if (!document) {
            throw new NotFoundException('Document not found');
        }
        return document;
    }

    async findByShareToken(token: string): Promise<Document> {
        const document = await this.prisma.document.findUnique({ where: { shareToken: token } });
        if (!document?.shareToken) {
            throw new NotFoundException('Shared document not found');
        }
        return document;
    }

    async createShareLink(documentId: string, ownerId: string): Promise<string> {
        const document = await this.findOneForUser(documentId, ownerId, '');
        if (!document.shareToken) {
            document.shareToken = randomUUID();
            await this.prisma.document.update({
                where: { id: document.id },
                data: { shareToken: document.shareToken },
            });
        }

        const frontendUrl = this.configService.getOrThrow<string>('FRONTEND_URL').replace(/\/$/, '');
        return `${frontendUrl}/shared/${document.shareToken}`;
    }

    async revokeShareLink(documentId: string, ownerId: string): Promise<void> {
        const document = await this.findOneForUser(documentId, ownerId, '');
        document.shareToken = null;
        await this.prisma.document.update({
            where: { id: document.id },
            data: { shareToken: null },
        });
    }

    async getDownloadUrl(documentId: string, userId: string, userEmail: string): Promise<string> {
        const document = await this.findOneForUser(documentId, userId, userEmail);
        if (!document) {
            throw new NotFoundException('Document not found');
        }
        return this.storageService.getDownloadUrl(document.s3Key);
    }

    async getDownloadUrlByShareToken(token: string): Promise<string> {
        const document = await this.findByShareToken(token);
        return this.storageService.getDownloadUrl(document.s3Key);
    }

    async inviteByEmail(documentId: string, ownerId: string, email: string) {
        const normalizedEmail = email.trim().toLowerCase();
        const document = await this.prisma.document.findFirst({
            where: { id: documentId, ownerId },
            select: { id: true, ownerId: true },
        });
        if (!document) {
            throw new NotFoundException('Document not found');
        }

        const owner = await this.prisma.user.findUnique({
            where: { id: ownerId },
            select: { email: true },
        });
        if (owner?.email.trim().toLowerCase() === normalizedEmail) {
            throw new BadRequestException('You cannot invite yourself');
        }

        const invitedUser = await this.prisma.user.findUnique({
            where: { email: normalizedEmail },
            select: { id: true },
        });

        return this.prisma.documentShare.upsert({
            where: { documentId_email: { documentId, email: normalizedEmail } },
            create: {
                documentId,
                email: normalizedEmail,
                userId: invitedUser?.id,
                invitedBy: ownerId,
            },
            update: { userId: invitedUser?.id ?? null },
        });
    }

    async revokeInvite(documentId: string, ownerId: string, email: string): Promise<void> {
        await this.assertDocumentOwner(documentId, ownerId);
        await this.prisma.documentShare.deleteMany({
            where: { documentId, email: email.trim().toLowerCase() },
        });
    }

    async listInvitedEmails(documentId: string, ownerId: string) {
        await this.assertDocumentOwner(documentId, ownerId);
        return this.prisma.documentShare.findMany({
            where: { documentId },
            orderBy: { createdAt: 'asc' },
        });
    }

    async getSharedWithMe(userId: string) {
        const shares = await this.prisma.documentShare.findMany({
            where: { userId },
            include: {
                document: {
                    include: {
                        owner: { select: { name: true, email: true } },
                    },
                },
            },
        });
        return shares.map(({ document }) => document);
    }

    private async assertDocumentOwner(documentId: string, ownerId: string): Promise<void> {
        const document = await this.prisma.document.findFirst({
            where: { id: documentId, ownerId },
            select: { id: true },
        });
        if (!document) {
            throw new NotFoundException('Document not found');
        }
    }

    private getMaxUploadSizeBytes(): number {
        const configuredMb = Number(this.configService.get<string>('MAX_UPLOAD_SIZE_MB'));
        const maxMb = Number.isFinite(configuredMb) && configuredMb > 0
            ? configuredMb
            : DEFAULT_MAX_UPLOAD_SIZE_MB;
        return maxMb * 1024 * 1024;
    }

    private getMinExtractableTextChars(): number {
        const configuredChars = Number(this.configService.get<string>('MIN_EXTRACTABLE_TEXT_CHARS'));
        return Number.isFinite(configuredChars) && configuredChars >= 0
            ? configuredChars
            : DEFAULT_MIN_EXTRACTABLE_TEXT_CHARS;
    }

    private async extractTextFromPdf(buffer: Buffer): Promise<string> {
        const parser = new PDFParse({ data: buffer });
        const result = await parser.getText();
        return result.text ?? '';
    }

    private sanitizeFilename(originalFilename: string): string {
        const filename = originalFilename.split(/[\\/]/).pop() ?? 'document.pdf';
        const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200);
        if (!sanitized || sanitized === '.' || sanitized === '..') {
            throw new BadRequestException('Invalid filename');
        }
        return sanitized;
    }
}
