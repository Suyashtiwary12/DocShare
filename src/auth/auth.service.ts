import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Response } from 'express';
import type { User } from '@prisma/client';

export interface JwtPayload {
    sub: string;
    email: string;
}

const ACCESS_TOKEN_COOKIE = 'access_token';
const ACCESS_TOKEN_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
    constructor(
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
    ) { }

    async setAccessTokenCookie(response: Response, user: Pick<User, 'id' | 'email'>): Promise<string> {
        const payload: JwtPayload = { sub: user.id, email: user.email };
        const token = await this.jwtService.signAsync(payload);

        response.cookie(ACCESS_TOKEN_COOKIE, token, this.getCookieOptions());
        return token;
    }

    clearAccessTokenCookie(response: Response): void {
        response.clearCookie(ACCESS_TOKEN_COOKIE, this.getCookieOptions());
    }

    unauthorized(): never {
        throw new UnauthorizedException('Invalid email or password');
    }

    private getCookieOptions() {
        return {
            httpOnly: true,
            secure: true,
            sameSite: 'none' as const,
            maxAge: ACCESS_TOKEN_MAX_AGE,
            path: '/',
        };
    }
}