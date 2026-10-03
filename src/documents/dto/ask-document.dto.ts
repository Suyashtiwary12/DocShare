import { Type } from 'class-transformer';
import { IsArray, IsIn, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';

export class ChatHistoryMessageDto {
    @IsString()
    @IsIn(['user', 'assistant'])
    role!: 'user' | 'assistant';

    @IsString()
    @IsNotEmpty()
    content!: string;
}

export class AskDocumentQuestionDto {
    @IsString()
    @IsNotEmpty()
    question!: string;

    @IsOptional()
    @IsString()
    conversationId?: string;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ChatHistoryMessageDto)
    history?: ChatHistoryMessageDto[];
}
