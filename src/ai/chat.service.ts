import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { PrismaService } from '../prisma/prisma.service.js';
import { VectorStoreService } from './vector-store.service.js';

export type ChatHistoryItem = {
    role: 'user' | 'assistant';
    content: string;
};

@Injectable()
export class ChatService {
    constructor(
        private readonly configService: ConfigService,
        private readonly prisma: PrismaService,
        private readonly vectorStoreService: VectorStoreService,
    ) { }

    async createConversation(documentId: string, userId: string) {
        return this.prisma.conversation.create({
            data: {
                documentId,
                userId,
                title: 'New chat',
            },
        });
    }

    async listConversations(documentId: string, userId: string) {
        const conversations = await this.prisma.conversation.findMany({
            where: { documentId, userId },
            orderBy: { updatedAt: 'desc' },
            select: {
                id: true,
                title: true,
                createdAt: true,
                updatedAt: true,
                _count: { select: { messages: true } },
                messages: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    select: { role: true, content: true, createdAt: true },
                },
            },
        });

        return conversations.map(({ _count, messages, ...conversation }) => ({
            ...conversation,
            messageCount: _count.messages,
            lastMessage: messages[0] ?? null,
        }));
    }

    async getConversationHistory(conversationId: string, userId: string, documentId?: string): Promise<ChatHistoryItem[]> {
        const conversation = await this.prisma.conversation.findFirst({
            where: { id: conversationId, userId, ...(documentId ? { documentId } : {}) },
            select: { id: true },
        });


        if (!conversation) {
            throw new NotFoundException('Conversation not found');
        }

        const messages = await this.prisma.conversationMessage.findMany({
            where: { conversationId },
            orderBy: { createdAt: 'asc' },
        });

        return messages.map((message) => ({
            role: message.role === 'USER' ? 'user' : 'assistant',
            content: message.content,
        }));
    }

    async getLatestGeminiContext(conversationId: string, userId: string, documentId?: string): Promise<ChatHistoryItem[]> {
        const conversation = await this.prisma.conversation.findFirst({
            where: { id: conversationId, userId, ...(documentId ? { documentId } : {}) },
            select: { id: true },
        });

        if (!conversation) {
            throw new NotFoundException('Conversation not found');
        }

        const messages = await this.prisma.conversationMessage.findMany({
            where: { conversationId },
            orderBy: { createdAt: 'desc' },
            take: 5,
        });

        return messages
            .slice()
            .reverse()
            .map((message) => ({
                role: message.role === 'USER' ? 'user' : 'assistant',
                content: message.content,
            }));
    }

    async answerQuestion(
        documentId: string,
        userId: string,
        question: string,
        conversationId?: string,
        chatHistory: ChatHistoryItem[] = [],
    ) {
        let activeConversationId = conversationId;
        if (activeConversationId) {
            const existingConversation = await this.prisma.conversation.findFirst({
                where: { id: activeConversationId, documentId, userId },
                select: { id: true },
            });

            if (!existingConversation) {
                throw new NotFoundException('Conversation not found');
            }
        } else {
            const conversation = await this.createConversation(documentId, userId);
            activeConversationId = conversation.id;
        }

        const userMessage = await this.prisma.conversationMessage.create({
            data: {
                conversationId: activeConversationId,
                role: 'USER',
                content: question,
            },
        });
        await this.prisma.conversation.update({
            where: { id: activeConversationId },
            data: { updatedAt: userMessage.createdAt },
        });

        const previousMessages = await this.prisma.conversationMessage.findMany({
            where: {
                conversationId: activeConversationId,
                id: { not: userMessage.id },
            },
            orderBy: { createdAt: 'desc' },
            take: 5,
        });

        const historyForGemini = previousMessages
            .slice()
            .reverse()
            .map((message) => ({
                role: message.role === 'USER' ? 'user' : 'assistant',
                content: message.content,
            }));

        const results = await this.vectorStoreService.similaritySearch(documentId, question, 4);
        const sourceChunks = results.map((result) => result.pageContent);
        const context = sourceChunks.join('\n\n---\n\n');

        const model = new ChatGoogleGenerativeAI({
            apiKey: this.configService.getOrThrow<string>('GOOGLE_API_KEY'),
            model: 'gemini-3.5-flash-lite',
        });

        const messages = [
            // new SystemMessage('Answer only using the provided context. If the answer is not in the context, say you do not know based on the document content.'),
            ...historyForGemini.map((entry) =>
                entry.role === 'assistant' ? new AIMessage(entry.content) : new HumanMessage(entry.content),
            ),
            new HumanMessage(`Context:\n${context}\n\nQuestion: ${question}`),
        ];

        const response = await model.invoke(messages);
        const answer =
            typeof response.content === 'string'
                ? response.content
                : Array.isArray(response.content)
                    ? response.content
                        .map((item) => (typeof item === 'string' ? item : item.text ?? ''))
                        .join('')
                    : String(response.content);

        await this.prisma.conversationMessage.create({
            data: {
                conversationId: activeConversationId,
                role: 'ASSISTANT',
                content: answer,
            },
        });

        return { answer, sourceChunks, conversationId: activeConversationId };
    }
}
