import { IsEmail, IsString, Length, MaxLength } from 'class-validator';

export class RegisterDto {
    @IsString()
    @Length(2, 100)
    name!: string;

    @IsEmail()
    @MaxLength(320)
    email!: string;

    @IsString()
    @Length(8, 72)
    password!: string;
}