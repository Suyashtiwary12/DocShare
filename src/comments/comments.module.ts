import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthModule } from '../auth/auth.module.js';
import { DocumentsModule } from '../documents/documents.module.js';
import { CommentsController } from './comments.controller.js';
import { CommentsService } from './comments.service.js';

@Module({
    imports: [PassportModule.register({ defaultStrategy: 'jwt' }), AuthModule, DocumentsModule],
    controllers: [CommentsController],
    providers: [CommentsService],
})
export class CommentsModule { }