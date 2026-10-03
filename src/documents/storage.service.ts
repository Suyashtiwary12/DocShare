import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
    DeleteObjectCommand,
    GetObjectCommand,
    PutObjectCommand,
    S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class StorageService {
    private readonly client: S3Client;
    private readonly bucketName: string;

    constructor(configService: ConfigService) {
        this.bucketName = configService.getOrThrow<string>('S3_BUCKET_NAME');
        this.client = new S3Client({
            region: configService.getOrThrow<string>('S3_REGION'),
            endpoint: configService.get<string>('S3_ENDPOINT') || undefined,
            credentials: {
                accessKeyId: configService.getOrThrow<string>('AWS_ACCESS_KEY_ID'),
                secretAccessKey: configService.getOrThrow<string>('AWS_SECRET_ACCESS_KEY'),
            },
        });
    }

    async uploadFile(buffer: Buffer, key: string, mimeType: string): Promise<string> {
        await this.client.send(new PutObjectCommand({
            Bucket: this.bucketName,
            Key: key,
            Body: buffer,
            ContentType: mimeType,
        }));
        return key;
    }

    async getDownloadUrl(key: string): Promise<string> {
        // Presigned URLs provide temporary access without making the bucket public.
        return getSignedUrl(
            this.client,
            new GetObjectCommand({ Bucket: this.bucketName, Key: key }),
            { expiresIn: 15 * 60 },
        );
    }

    async downloadBuffer(key: string): Promise<Buffer> {
        const response = await this.client.send(new GetObjectCommand({
            Bucket: this.bucketName,
            Key: key,
        }));

        const body = response.Body;
        if (!body) {
            throw new Error(`No content found for object: ${key}`);
        }

        if (Buffer.isBuffer(body)) {
            return body;
        }

        const chunks: Buffer[] = [];
        for await (const chunk of body as AsyncIterable<Uint8Array | Buffer | string>) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }

        return Buffer.concat(chunks);
    }

    async deleteFile(key: string): Promise<void> {
        await this.client.send(new DeleteObjectCommand({
            Bucket: this.bucketName,
            Key: key,
        }));
    }
}
