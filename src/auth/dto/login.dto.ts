import { IsEmail, IsString, Length, MaxLength } from 'class-validator';

export class LoginDto {
    @IsEmail()
    @MaxLength(320)
    email!: string;

    @IsString()
    @Length(8, 72)
    password!: string;
}