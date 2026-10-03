import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { VectorStoreService } from './vector-store.service.js';

function splitTextIntoChunks(text: string, chunkSize = 1000, chunkOverlap = 150): string[] {
    const normalizedText = text.replace(/\s+/g, ' ').trim();
    if (!normalizedText) {
        return [];
    }

    if (normalizedText.length <= chunkSize) {
        return [normalizedText];
    }

    const chunks: string[] = [];
    let start = 0;

    while (start < normalizedText.length) {
        let end = Math.min(start + chunkSize, normalizedText.length);

        if (end < normalizedText.length) {
            const lastSpace = normalizedText.lastIndexOf(' ', end);
            if (lastSpace > start + Math.floor(chunkSize * 0.6)) {
                end = lastSpace;
            }
        }

        const chunk = normalizedText.slice(start, end).trim();
        if (chunk) {
            chunks.push(chunk);
        }

        if (end >= normalizedText.length) {
            break;
        }

        start = Math.max(start + chunkSize - chunkOverlap, end);
    }

    return chunks;
}

@Injectable()
export class IngestionService {
    private readonly logger = new Logger(IngestionService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly vectorStoreService: VectorStoreService,
    ) { }

    async processDocument(documentId: string, extractedText: string): Promise<void> {
        const document = await this.prisma.document.findUnique({
            where: { id: documentId },
        });

        if (!document) {
            this.logger.warn(`Document ${documentId} was not found when starting embedding.`);
            return;
        }

        try {
            await this.prisma.document.update({
                where: { id: documentId },
                data: { embeddingStatus: 'PROCESSING' },
            });

            if (!extractedText?.trim()) {
                await this.prisma.document.update({
                    where: { id: documentId },
                    data: { embeddingStatus: 'FAILED' },
                });
                return;
            }

            const chunks = splitTextIntoChunks(extractedText, 1000, 150);

            await this.vectorStoreService.upsertChunks(documentId, chunks);

            await this.prisma.document.update({
                where: { id: documentId },
                data: { embeddingStatus: 'COMPLETED' },
            });
        } catch (error) {
            this.logger.error(
                `Failed to embed document ${documentId}`,
                error instanceof Error ? error.stack : undefined,
            );

            await this.prisma.document.update({
                where: { id: documentId },
                data: { embeddingStatus: 'FAILED' },
            }).catch((updateError) => {
                this.logger.error(
                    `Could not mark document ${documentId} as failed`,
                    updateError instanceof Error ? updateError.stack : undefined,
                );
            });
        }
    }
}
