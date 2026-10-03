import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pinecone } from '@pinecone-database/pinecone';

const TEXT_FIELD = 'chunk_text';

@Injectable()
export class VectorStoreService {
    private readonly logger = new Logger(VectorStoreService.name);
    private readonly pinecone: Pinecone;
    private readonly pineconeIndex: ReturnType<Pinecone['Index']>;

    constructor(configService: ConfigService) {

        const apiKey = configService.getOrThrow<string>('PINECONE_API_KEY');
        const indexName = configService.getOrThrow<string>('PINECONE_INDEX_NAME');
        this.pinecone = new Pinecone({ apiKey });
        this.pineconeIndex = this.pinecone.Index(indexName);
    }

    async upsertChunks(documentId: string, chunks: string[]): Promise<void> {
        if (chunks.length === 0) {
            return;
        }
        await this.deleteDocumentVectors(documentId);

        const namespace = this.pineconeIndex.namespace(documentId);
        const records = chunks.map((chunk, chunkIndex) => ({
            id: `chunk-${chunkIndex}`,
            [TEXT_FIELD]: chunk,
            documentId,
            chunkIndex,
        }));

        this.logger.log(`Upserting ${records.length} records into namespace ${documentId}`);

        await namespace.upsertRecords(records);

        const stats = await this.pineconeIndex.describeIndexStats();

        this.logger.log(`Pinecone stats: ${JSON.stringify(stats, null, 2)}`);
    }

    async similaritySearch(documentId: string, query: string, k = 4) {
        const namespace = this.pineconeIndex.namespace(documentId);
        const response = await namespace.searchRecords({
            query: {
                topK: k,
                inputs: { text: query },
            },
            fields: [TEXT_FIELD],
        });

        const hits = response?.result?.hits ?? [];
        if (hits.length === 0) {
            this.logger.warn(`No Pinecone hits for document ${documentId}. The namespace may be empty or the index is not configured for integrated embedding.`);
            return [];
        }

        return hits.map((hit) => {
            const fields = (hit.fields ?? {}) as Record<string, unknown>;
            const pageContent = typeof fields[TEXT_FIELD] === 'string'
                ? fields[TEXT_FIELD]
                : String(fields[TEXT_FIELD] ?? '');

            return {
                pageContent,
                score: hit._score,
                metadata: { ...fields, _id: hit._id },
            };
        });
    }

    async deleteDocumentVectors(documentId: string): Promise<void> {
        try {
            await this.pineconeIndex.namespace(documentId).deleteAll();
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            const isNotFound = /404|not found/i.test(message);

            if (isNotFound) {
                return;
            }

            throw error;
        }
    }
}
