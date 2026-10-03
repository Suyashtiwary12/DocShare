import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { UsersService } from '../../users/users.service.js';
import { JwtPayload } from '../auth.service.js';

function cookieExtractor(request: Request): string | null {
    return request.cookies?.access_token ?? null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(
        configService: ConfigService,
        private readonly usersService: UsersService,
    ) {
        super({
            jwtFromRequest: cookieExtractor,
            secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
            ignoreExpiration: false,
        });
    }

    async validate(payload: JwtPayload) {
        try {
            const user = await this.usersService.findById(payload.sub);
            return { id: user.id, email: user.email, name: user.name };
        } catch {
            throw new UnauthorizedException('Unauthorized');
        }
    }
}