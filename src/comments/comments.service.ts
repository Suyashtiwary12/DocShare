import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export type CommentTreeNode = {
    id: string;
    userId: string;
    parentId: string | null;
    content: string;
    createdAt: Date;
    updatedAt: Date;
    user: { id: string; name: string };
    replies: CommentTreeNode[];
};

@Injectable()
export class CommentsService {
    constructor(private readonly prisma: PrismaService) { }

    async listThread(documentId: string): Promise<CommentTreeNode[]> {
        const comments = await this.prisma.documentComment.findMany({
            where: { documentId },
            orderBy: { createdAt: 'asc' },
            include: { user: { select: { id: true, name: true } } },
        });

        const nodes = new Map<string, CommentTreeNode>();
        for (const comment of comments) {
            nodes.set(comment.id, {
                id: comment.id,
                userId: comment.userId,
                parentId: comment.parentId,
                content: comment.content,
                createdAt: comment.createdAt,
                updatedAt: comment.updatedAt,
                user: comment.user,
                replies: [],
            });
        }

        const roots: CommentTreeNode[] = [];
        for (const comment of comments) {
            const node = nodes.get(comment.id)!;
            const parent = comment.parentId ? nodes.get(comment.parentId) : undefined;
            if (parent) {
                parent.replies.push(node);
            } else {
                roots.push(node);
            }
        }

        return roots;
    }

    async create(documentId: string, userId: string, content: string) {
        return this.prisma.documentComment.create({
            data: { documentId, userId, content: this.normalizeContent(content) },
            include: { user: { select: { id: true, name: true } } },
        });
    }

    async reply(documentId: string, parentId: string, userId: string, content: string) {
        const parent = await this.prisma.documentComment.findFirst({
            where: { id: parentId, documentId },
            select: { id: true },
        });
        if (!parent) {
            throw new NotFoundException('Comment not found');
        }

        return this.prisma.documentComment.create({
            data: {
                documentId,
                userId,
                parentId,
                content: this.normalizeContent(content),
            },
            include: { user: { select: { id: true, name: true } } },
        });
    }

    async update(documentId: string, commentId: string, userId: string, content: string) {
        await this.assertCommentAuthor(documentId, commentId, userId);
        return this.prisma.documentComment.update({
            where: { id: commentId },
            data: { content: this.normalizeContent(content) },
            include: { user: { select: { id: true, name: true } } },
        });
    }

    async remove(documentId: string, commentId: string, userId: string): Promise<void> {
        await this.assertCommentAuthor(documentId, commentId, userId);
        await this.prisma.documentComment.delete({ where: { id: commentId } });
    }

    private async assertCommentAuthor(documentId: string, commentId: string, userId: string): Promise<void> {
        const comment = await this.prisma.documentComment.findFirst({
            where: { id: commentId, documentId, userId },
            select: { id: true },
        });
        if (!comment) {
            throw new NotFoundException('Comment not found');
        }
    }

    private normalizeContent(content: string): string {
        const normalized = content.trim();
        if (!normalized) {
            throw new BadRequestException('Comment cannot be empty');
        }
        return normalized;
    }
}