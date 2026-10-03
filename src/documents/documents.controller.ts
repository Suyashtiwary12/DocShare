import {
    Body,
    ConflictException,
    Controller,
    Delete,
    Get,
    Param,
    Post,
    Query,
    UploadedFile,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import multer from 'multer';
import { ChatService } from '../ai/chat.service.js';
import { GetUser } from '../auth/decorators/get-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { DocumentsService } from './documents.service.js';
import { AskDocumentQuestionDto } from './dto/ask-document.dto.js';
import { InviteUserDto } from './dto/invite-user.dto.js';
import type { ShareLinkResponseDto } from './dto/share-link-response.dto.js';

const DEFAULT_MAX_UPLOAD_SIZE_BYTES = 20 * 1024 * 1024;

@Controller('documents')
export class DocumentsController {
    constructor(
        private readonly documentsService: DocumentsService,
        private readonly chatService: ChatService,
    ) { }

    @UseGuards(JwtAuthGuard)
    @Post()
    @UseInterceptors(FileInterceptor('file', {
        storage: multer.memoryStorage(),
        limits: { fileSize: DEFAULT_MAX_UPLOAD_SIZE_BYTES },
    }))
    async upload(
        @UploadedFile() file: Express.Multer.File | undefined,
        @GetUser('id') userId: string,
    ) {
        const document = await this.documentsService.uploadDocument(file, userId);
        return { document: this.toMetadata(document) };
    }

    @UseGuards(JwtAuthGuard)
    @Get()
    async findAll(@GetUser('id') userId: string, @Query('search') search?: string) {
        const documents = await this.documentsService.findAllForUser(userId, search);
        return { documents: documents.map((document) => this.toMetadata(document)) };
    }

    @UseGuards(JwtAuthGuard)
    @Get('shared-with-me')
    async sharedWithMe(@GetUser('id') userId: string) {
        const documents = await this.documentsService.getSharedWithMe(userId);
        return { documents: documents.map((document) => this.toMetadata(document, true)) };
    }

    @UseGuards(JwtAuthGuard)
    @Post(':id/ask')
    async askQuestion(
        @Param('id') documentId: string,
        @Body() askDocumentQuestionDto: AskDocumentQuestionDto,
        @GetUser() user: { id: string; email: string; name: string },
    ) {
        const document = await this.documentsService.findOneForUser(documentId, user.id, user.email);
        // if (document.embeddingStatus !== 'COMPLETED') {
        //     throw new ConflictException('Document is still processing');
        // }

        const conversationId = askDocumentQuestionDto.conversationId
            ?? (await this.chatService.createConversation(documentId, user.id)).id;

        return this.chatService.answerQuestion(
            documentId,
            user.id,
            askDocumentQuestionDto.question,
            conversationId,
            askDocumentQuestionDto.history ?? [],
        );
    }

    @UseGuards(JwtAuthGuard)
    @Post(':id/chats/:conversationId/ask')
    async continueConversation(
        @Param('id') documentId: string,
        @Param('conversationId') conversationId: string,
        @Body() askDocumentQuestionDto: AskDocumentQuestionDto,
        @GetUser() user: { id: string; email: string; name: string },
    ) {
        await this.documentsService.findOneForUser(documentId, user.id, user.email);

        return this.chatService.answerQuestion(
            documentId,
            user.id,
            askDocumentQuestionDto.question,
            conversationId,
        );
    }

    @UseGuards(JwtAuthGuard)
    @Get(':id/chats')
    async listConversations(
        @Param('id') documentId: string,
        @GetUser() user: { id: string; email: string; name: string },
    ) {
        await this.documentsService.findOneForUser(documentId, user.id, user.email);
        return {
            conversations: await this.chatService.listConversations(documentId, user.id),
        };
    }

    @UseGuards(JwtAuthGuard)
    @Get(':id/chats/:conversationId/messages')
    async getConversationHistory(
        @Param('id') documentId: string,
        @Param('conversationId') conversationId: string,
        @GetUser('id') userId: string,
    ) {
        await this.documentsService.findOneForUser(documentId, userId, '');
        return {
            conversationId,
            messages: await this.chatService.getConversationHistory(conversationId, userId, documentId),
        };
    }

    @UseGuards(JwtAuthGuard)
    @Get(':id')
    async findOne(
        @Param('id') documentId: string,
        @GetUser('id') userId: string,
        @GetUser('email') userEmail: string,
    ) {
        const document = await this.documentsService.findOneForUser(documentId, userId, userEmail);
        return { document: this.toMetadata(document) };
    }

    @UseGuards(JwtAuthGuard)
    @Get(':id/download')
    async download(
        @Param('id') documentId: string,
        @GetUser('id') userId: string,
        @GetUser('email') userEmail: string,
    ) {
        const url = await this.documentsService.getDownloadUrl(documentId, userId, userEmail);
        return { url };
    }

    @UseGuards(JwtAuthGuard)
    @Post(':id/invite')
    async invite(
        @Param('id') documentId: string,
        @Body() inviteUserDto: InviteUserDto,
        @GetUser('id') ownerId: string,
    ) {
        return this.documentsService.inviteByEmail(documentId, ownerId, inviteUserDto.email);
    }

    @UseGuards(JwtAuthGuard)
    @Delete(':id/invite')
    async revokeInvite(
        @Param('id') documentId: string,
        @Body() inviteUserDto: InviteUserDto,
        @GetUser('id') ownerId: string,
    ) {
        await this.documentsService.revokeInvite(documentId, ownerId, inviteUserDto.email);
        return { message: 'Invite revoked successfully' };
    }

    @UseGuards(JwtAuthGuard)
    @Get(':id/invites')
    async listInvites(@Param('id') documentId: string, @GetUser('id') ownerId: string) {
        return { invites: await this.documentsService.listInvitedEmails(documentId, ownerId) };
    }

    @UseGuards(JwtAuthGuard)
    @Post(':id/share')
    async createShareLink(
        @Param('id') documentId: string,
        @GetUser('id') userId: string,
    ): Promise<ShareLinkResponseDto> {
        return { shareUrl: await this.documentsService.createShareLink(documentId, userId) };
    }

    @UseGuards(JwtAuthGuard)
    @Delete(':id/share')
    async revokeShareLink(@Param('id') documentId: string, @GetUser('id') userId: string) {
        await this.documentsService.revokeShareLink(documentId, userId);
        return { message: 'Share link revoked successfully' };
    }

    @Get('shared/:token')
    async getSharedDocument(@Param('token') token: string) {
        const document = await this.documentsService.findByShareToken(token);
        return { document: this.toMetadata(document) };
    }

    @Get('shared/:token/download')
    async downloadSharedDocument(@Param('token') token: string) {
        const url = await this.documentsService.getDownloadUrlByShareToken(token);
        return { url };
    }

    private toMetadata(document: {
        id: string;
        filename: string;
        fileSize: number;
        mimeType: string;
        summary: string | null;
        ownerId: string;
        createdAt: Date;
        updatedAt: Date;
        owner?: { name: string; email: string };
    }, includeOwner = false) {
        const metadata = {
            id: document.id,
            filename: document.filename,
            fileSize: document.fileSize,
            mimeType: document.mimeType,
            summary: document.summary,
            ownerId: document.ownerId,
            createdAt: document.createdAt,
            updatedAt: document.updatedAt,
        };
        return includeOwner && document.owner
            ? { ...metadata, owner: document.owner }
            : metadata;
    }
}
