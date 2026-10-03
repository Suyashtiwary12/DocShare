import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { AiModule } from '../ai/ai.module.js';
import { DocumentsController } from './documents.controller.js';
import { DocumentsService } from './documents.service.js';
import { StorageService } from './storage.service.js';

@Module({
    imports: [ConfigModule, PassportModule.register({ defaultStrategy: 'jwt' }), AiModule],
    controllers: [DocumentsController],
    providers: [DocumentsService, StorageService],
    exports: [DocumentsService, StorageService],
})
export class DocumentsModule { }
