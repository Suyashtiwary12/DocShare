-- CreateEnum
CREATE TYPE "public"."EmbeddingStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "public"."documents" ADD COLUMN     "embeddingStatus" "public"."EmbeddingStatus" NOT NULL DEFAULT 'PENDING';
