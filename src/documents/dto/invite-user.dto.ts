import { IsEmail } from 'class-validator';

export class InviteUserDto {
    @IsEmail()
    email!: string;
}