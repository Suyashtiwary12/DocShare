import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    UseGuards,
} from '@nestjs/common';
import { GetUser } from '../auth/decorators/get-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { DocumentsService } from '../documents/documents.service.js';
import { CommentDto } from './dto/comment.dto.js';
import { CommentsService } from './comments.service.js';

@Controller('documents/:documentId/comments')
@UseGuards(JwtAuthGuard)
export class CommentsController {
    constructor(
        private readonly commentsService: CommentsService,
        private readonly documentsService: DocumentsService,
    ) { }

    @Get()
    async list(
        @Param('documentId') documentId: string,
        @GetUser() user: { id: string; email: string },
    ) {
        await this.documentsService.findOneForUser(documentId, user.id, user.email);
        return { comments: await this.commentsService.listThread(documentId) };
    }

    @Post()
    async create(
        @Param('documentId') documentId: string,
        @Body() commentDto: CommentDto,
        @GetUser() user: { id: string; email: string },
    ) {
        await this.documentsService.findOneForUser(documentId, user.id, user.email);
        return this.commentsService.create(documentId, user.id, commentDto.content);
    }

    @Post(':commentId/replies')
    async reply(
        @Param('documentId') documentId: string,
        @Param('commentId') commentId: string,
        @Body() commentDto: CommentDto,
        @GetUser() user: { id: string; email: string },
    ) {
        await this.documentsService.findOneForUser(documentId, user.id, user.email);
        return this.commentsService.reply(documentId, commentId, user.id, commentDto.content);
    }

    @Patch(':commentId')
    async update(
        @Param('documentId') documentId: string,
        @Param('commentId') commentId: string,
        @Body() commentDto: CommentDto,
        @GetUser() user: { id: string; email: string },
    ) {
        await this.documentsService.findOneForUser(documentId, user.id, user.email);
        return this.commentsService.update(documentId, commentId, user.id, commentDto.content);
    }

    @Delete(':commentId')
    async remove(
        @Param('documentId') documentId: string,
        @Param('commentId') commentId: string,
        @GetUser() user: { id: string; email: string },
    ) {
        await this.documentsService.findOneForUser(documentId, user.id, user.email);
        await this.commentsService.remove(documentId, commentId, user.id);
        return { message: 'Comment deleted' };
    }
}