import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CommentDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(10000)
    content!: string;
}