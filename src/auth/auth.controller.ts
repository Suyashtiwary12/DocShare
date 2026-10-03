import {
    Body,
    Controller,
    Get,
    Post,
    Res,
    UnauthorizedException,
    UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import type { User } from '@prisma/client';
import { UsersService } from '../users/users.service.js';
import { AuthService } from './auth.service.js';
import { GetUser } from './decorators/get-user.decorator.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';

@Controller('auth')
export class AuthController {
    constructor(
        private readonly authService: AuthService,
        private readonly usersService: UsersService,
    ) { }

    @Post('register')
    async register(@Body() registerDto: RegisterDto, @Res({ passthrough: true }) response: Response) {
        const user = await this.usersService.create(
            registerDto.name,
            registerDto.email,
            registerDto.password,
        );
        await this.authService.setAccessTokenCookie(response, user);
        return { status: 201, message: "user created successfully", user: this.toPublicUser(user) };
    }

    @Post('login')
    async login(@Body() loginDto: LoginDto, @Res({ passthrough: true }) response: Response) {
        let user: User | null;
        try {
            user = await this.usersService.findByEmailWithPassword(loginDto.email);
            if (!user || !(await this.usersService.validatePassword(loginDto.password, user.password))) {
                throw new UnauthorizedException('Invalid email or password');
            }
        } catch {
            throw new UnauthorizedException('Invalid email or password');
        }

        const token = await this.authService.setAccessTokenCookie(response, user);
        return { user: this.toPublicUser(user), token };
    }

    @UseGuards(JwtAuthGuard)
    @Post('logout')
    logout(@Res({ passthrough: true }) response: Response) {
        this.authService.clearAccessTokenCookie(response);
        return { message: 'Logged out successfully' };
    }

    @UseGuards(JwtAuthGuard)
    @Get('me')
    me(@GetUser() user: { id: string; email: string; name: string }) {
        return { user };
    }

    private toPublicUser(user: { id: string; name: string; email: string }) {
        return { id: user.id, name: user.name, email: user.email };
    }
}