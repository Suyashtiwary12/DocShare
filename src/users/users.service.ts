import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.js';

const SALT_ROUNDS = 12;
const PUBLIC_USER_SELECT = {
    id: true,
    name: true,
    email: true,
    createdAt: true,
    updatedAt: true,
} as const;

@Injectable()
export class UsersService {
    constructor(private readonly prisma: PrismaService) { }

    async create(name: string, email: string, password: string) {
        const normalizedEmail = email.trim().toLowerCase();
        const existingUser = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
        if (existingUser) {
            throw new ConflictException('An account with this email already exists');
        }

        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
        const user = await this.prisma.user.create({
            data: { name, email: normalizedEmail, password: hashedPassword },
            select: PUBLIC_USER_SELECT,
        });

        void this.prisma.documentShare.updateMany({
            where: { email: user.email, userId: null },
            data: { userId: user.id },
        }).catch((error: unknown) => {
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.error('Unable to resolve pending document shares:', message);
        });

        return user;
    }

    // This is the only user lookup that returns the password hash, solely for login comparison.
    async findByEmailWithPassword(email: string) {
        return this.prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    }

    async findById(id: string) {
        const user = await this.prisma.user.findUnique({
            where: { id },
            select: PUBLIC_USER_SELECT,
        });
        if (!user) {
            throw new NotFoundException('User not found');
        }
        return user;
    }

    validatePassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
        return bcrypt.compare(plainPassword, hashedPassword);
    }
}