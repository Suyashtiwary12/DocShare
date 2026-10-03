import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ChatService } from './chat.service.js';
import { IngestionService } from './ingestion.service.js';
import { VectorStoreService } from './vector-store.service.js';

@Module({
    imports: [ConfigModule],
    providers: [VectorStoreService, IngestionService, ChatService],
    exports: [VectorStoreService, IngestionService, ChatService],
})
export class AiModule { }
