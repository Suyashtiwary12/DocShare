# DocuShare

> A modern, full-stack document sharing, collaboration, and AI-powered document interaction platform built with NestJS, React, PostgreSQL, Prisma, AWS S3, Pinecone, and Google Gemini.

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Architecture & Tech Stack](#architecture--tech-stack)
- [Database Schema & Models](#database-schema--models)
- [Project Directory Structure](#project-directory-structure)
- [Prerequisites](#prerequisites)
- [Environment Variables](#environment-variables)
- [Step-by-Step Setup Guide](#step-by-step-setup-guide)
  - [1. Clone Repository](#1-clone-repository)
  - [2. Backend Setup](#2-backend-setup)
  - [3. Frontend Setup](#3-frontend-setup)
- [API Reference](#api-reference)
  - [Authentication](#authentication)
  - [Documents & Storage](#documents--storage)
  - [Sharing & Collaborators](#sharing--collaborators)
  - [AI Document Chat (RAG)](#ai-document-chat-rag)
  - [Threaded Comments](#threaded-comments)
- [Running Tests & Linting](#running-tests--linting)
- [Production Deployment](#production-deployment)
- [License](#license)

---

## Overview

**DocuShare** allows users to securely upload, view, manage, and collaborate on PDF documents. Beyond standard document storage, DocuShare features a **Retrieval-Augmented Generation (RAG)** pipeline that indexes document text into a Pinecone vector database and leverages Google Gemini to answer questions grounded in the document's content with source passage citations.

Collaboration is built-in with email-based collaborator invites, revocable public sharing links, and nested threaded comments on documents.

---

## Key Features

- **Document Management & Storage**:
  - Upload text-based PDF files with size and extractable content validation.
  - Secure storage in AWS S3 with temporary presigned download URLs.
  - Search documents by filename and filter by owned vs. shared documents.

- **AI-Powered Document Interaction (RAG)**:
  - Automated PDF text extraction using `pdf-parse` and chunking.
  - Semantic vector embeddings generated and stored in **Pinecone**.
  - Multi-turn conversation support powered by **Google Gemini** via LangChain.
  - Rich Markdown-rendered AI responses (`react-markdown` + `remark-gfm`) with support for headings, bullet points, tables, code blocks, and blockquotes.
  - Grounded answers with clickable/collapsible source passage citations.

- **Collaborative Threaded Discussions**:
  - Hierarchical, nested comment threads on documents.
  - Real-time author controls: users can edit and delete their own comments (with cascading deletion of child replies).

- **Granular Sharing & Access Control**:
  - Private document ownership model.
  - Direct collaborator invitations by email with grant/revoke controls.
  - Tokenized public shareable links that can be created and revoked at any time.

- **Authentication & Security**:
  - Secure authentication using JWT stored in HTTP-only, SameSite cookies.
  - Password hashing with bcrypt.
  - Strict input validation using NestJS `ValidationPipe` and `class-validator`.
  - CORS configuration tailored for credentialed requests.

---

## Architecture & Tech Stack

### Backend
- **Framework**: [NestJS](https://nestjs.com/) (Node.js & TypeScript, ES Modules)
- **Database & ORM**: PostgreSQL with [Prisma ORM](https://www.prisma.io/)
- **Vector Database**: [Pinecone](https://www.pinecone.io/) (`@pinecone-database/pinecone`, `@langchain/pinecone`)
- **LLM & Embeddings**: [Google Gemini](https://ai.google.dev/) via [LangChain](https://js.langchain.com/) (`@langchain/google-genai`)
- **Cloud Storage**: [AWS S3](https://aws.amazon.com/s3/) (`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`)
- **Document Processing**: `pdf-parse` for server-side text extraction
- **Authentication**: Passport JWT (`@nestjs/passport`, `passport-jwt`, `cookie-parser`, `bcrypt`)

### Frontend
- **Framework & Build Tool**: [React 19](https://react.dev/), [Vite](https://vitejs.dev/), TypeScript
- **Styling**: Vanilla CSS Design System with custom typography (`DM Sans`, `DM Mono`, `Newsreader`)
- **Markdown & Code Rendering**: `react-markdown`, `remark-gfm`
- **Routing**: `react-router-dom`
- **Icons**: `lucide-react`

---

## Database Schema & Models

DocuShare's PostgreSQL database is modeled with Prisma (`prisma/schema.prisma`):

| Model | Description |
|---|---|
| **`User`** | Stores user identity (`id`, `name`, `email`, hashed `password`, timestamps). |
| **`Document`** | Document metadata (`filename`, `s3Key`, `fileSize`, `mimeType`, `summary`, `shareToken`, `embeddingStatus`, `ownerId`). |
| **`DocumentShare`** | Collaborator invitations linked by `documentId` and collaborator `email`. |
| **`DocumentComment`** | Threaded comments supporting nested replies via self-referential `parentId`. |
| **`Conversation`** | AI chat sessions tied to a user and a document. |
| **`ConversationMessage`** | Individual chat messages with role (`USER` or `ASSISTANT`) and content. |

---

## Project Directory Structure

```text
Document-sharing/
├── project/
│   ├── docs/
│   │   └── frontend-user-stories.md    # Detailed frontend user stories & API notes
│   ├── frontend/                       # Vite + React 19 Frontend
│   │   ├── public/                     # Static assets (favicons, icons)
│   │   ├── src/
│   │   │   ├── assets/                 # Icons and image assets
│   │   │   ├── api.ts                  # Centralized API fetch utility & API_URL
│   │   │   ├── App.tsx                 # Authentication & root view router
│   │   │   ├── DocumentChat.tsx        # AI document Q&A chat (Markdown rendered)
│   │   │   ├── DocumentComments.tsx    # Nested threaded discussion component
│   │   │   ├── DocumentShare.tsx       # Collaborator invites & public link modal
│   │   │   ├── DocumentViewer.tsx      # In-app document viewer & tab controller
│   │   │   ├── DocumentViewerPage.tsx  # Shared document view wrapper
│   │   │   ├── DocumentWorkspace.tsx   # Document list, upload, search workspace
│   │   │   ├── main.tsx                # React root entry point
│   │   │   ├── style.css               # Design system & responsive styles
│   │   │   └── vite-env.d.ts           # Vite client environment types
│   │   ├── .env                        # Frontend environment configuration
│   │   ├── .env.example                # Frontend environment template
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── vite.config.ts
│   ├── prisma/
│   │   └── schema.prisma               # Prisma data models & migrations
│   ├── src/                            # NestJS Backend Application
│   │   ├── ai/                         # RAG pipeline, Pinecone vector store, Gemini LLM
│   │   │   ├── ai.module.ts
│   │   │   ├── chat.service.ts         # Multi-turn Q&A logic & source citation
│   │   │   ├── ingestion.service.ts    # PDF text extraction & chunking
│   │   │   └── vector-store.service.ts # Pinecone embedding indexer & retriever
│   │   ├── auth/                       # JWT authentication, guards, cookies
│   │   ├── comments/                   # Threaded document comments service & controller
│   │   ├── documents/                  # PDF upload, download URLs, sharing, invites
│   │   ├── prisma/                     # Prisma service client wrapper
│   │   ├── users/                      # User profile & registration service
│   │   ├── app.module.ts               # Root NestJS module
│   │   └── main.ts                     # Server bootstrap, CORS, cookie middleware
│   ├── .env                            # Backend environment configuration
│   ├── .env.example                    # Backend environment template
│   ├── package.json
│   ├── tsconfig.json
│   └── README.md
```

---

## Prerequisites

Before starting, ensure you have the following installed and configured:

- **Node.js**: `v18.x` or `v20.x+`
- **npm** or **pnpm**
- **PostgreSQL**: A running PostgreSQL instance (local or hosted, e.g., Supabase, Neon, AWS RDS, Prisma Accelerate)
- **AWS S3**: An S3 bucket with AWS credentials having `PutObject`, `GetObject`, and `DeleteObject` permissions
- **Google Gemini API Key**: API key from [Google AI Studio](https://aistudio.google.com/)
- **Pinecone Account**: Serverless Pinecone index configured with 768 dimensions (or matching your Gemini embedding model)

---

## Environment Variables

### Backend Configuration (`project/.env`)

Create `project/.env` from the provided template:

```bash
cp project/.env.example project/.env
```

Populate the required environment variables:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/document_sharing"

# Authentication
JWT_SECRET="replace-with-a-long-random-secret"
NODE_ENV="development"
PORT=3000
FRONTEND_URL="http://localhost:5173"

# AWS S3 Storage
S3_BUCKET_NAME="your-s3-bucket-name"
S3_REGION="us-east-1"
S3_ENDPOINT="" # Optional: for MinIO or custom S3-compatible endpoints
AWS_ACCESS_KEY_ID="your-aws-access-key-id"
AWS_SECRET_ACCESS_KEY="your-aws-secret-access-key"

# Document Constraints
MAX_UPLOAD_SIZE_MB=20
MIN_EXTRACTABLE_TEXT_CHARS=50

# AI & Vector Database
GOOGLE_API_KEY="your-gemini-api-key"
PINECONE_API_KEY="your-pinecone-api-key"
PINECONE_INDEX_NAME="your-pinecone-index-name"

# Frontend API URL (for Vite build/proxy)
VITE_API_URL="http://localhost:3000"
```

### Frontend Configuration (`project/frontend/.env`)

Create `project/frontend/.env`:

```env
# URL where the NestJS backend is accessible
VITE_API_URL="http://localhost:3000"
```

*(In production, set `VITE_API_URL` to your deployed backend domain, e.g., `https://api.yourdomain.com` or `https://docshare-x8xr.onrender.com`).*

---

## Step-by-Step Setup Guide

### 1. Clone Repository

```bash
git clone <repository-url>
cd Document-sharing/project
```

### 2. Backend Setup

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your PostgreSQL, AWS S3, Google Gemini, and Pinecone credentials
   ```

3. **Run Prisma Migrations & Generate Client**:
   ```bash
   npx prisma generate
   npx prisma db push
   ```
   *(Or `npx prisma migrate dev` if maintaining strict migration files).*

4. **Start the Backend Server**:
   ```bash
   # Development mode with live reload
   npm run start:dev

   # Or standard start
   npm start
   ```
   The backend API will start at `http://localhost:3000`.

### 3. Frontend Setup

1. **Navigate to the frontend directory**:
   ```bash
   cd frontend
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Configure Frontend Environment**:
   ```bash
   # Ensure .env exists with your backend URL
   echo "VITE_API_URL=http://localhost:3000" > .env
   ```

4. **Start the Vite Development Server**:
   ```bash
   npm run dev
   ```
   The frontend will be available at `http://localhost:5173`.

---

## API Reference

All authenticated endpoints require the HTTP-only JWT cookie provided upon login or registration. Set `credentials: 'include'` on client fetch requests.

### Authentication

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/auth/register` | Register a new user account | No |
| `POST` | `/auth/login` | Log in and receive HTTP-only authentication cookie | No |
| `GET` | `/auth/me` | Fetch currently authenticated user profile | Yes |
| `POST` | `/auth/logout` | Clear authentication cookie and invalidate session | Yes |

### Documents & Storage

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/documents` | List owned documents (supports `?search=` query) | Yes |
| `GET` | `/documents/shared-with-me` | List documents shared with the user | Yes |
| `POST` | `/documents` | Upload a PDF (`multipart/form-data`, field: `file`) | Yes |
| `GET` | `/documents/:documentId` | Fetch metadata for a specific document | Yes |
| `GET` | `/documents/:documentId/download` | Generate presigned temporary S3 download URL | Yes |

### Sharing & Collaborators

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/documents/:documentId/share` | Generate or retrieve public shareable link token | Yes (Owner) |
| `DELETE` | `/documents/:documentId/share` | Revoke public share link token | Yes (Owner) |
| `GET` | `/documents/shared/:token` | View public shared document metadata | No |
| `GET` | `/documents/shared/:token/download` | Download public shared document | No |
| `GET` | `/documents/:documentId/invites` | List invited collaborators by email | Yes (Owner) |
| `POST` | `/documents/:documentId/invite` | Invite a collaborator by email | Yes (Owner) |
| `DELETE` | `/documents/:documentId/invite` | Revoke collaborator invitation by email | Yes (Owner) |

### AI Document Chat (RAG)

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/documents/:documentId/ask` | Start a new AI chat and ask a question about the PDF | Yes |
| `GET` | `/documents/:documentId/chats` | List past conversation summaries for the document | Yes |
| `GET` | `/documents/:documentId/chats/:conversationId/messages` | Load message history for a conversation | Yes |
| `POST` | `/documents/:documentId/chats/:conversationId/ask` | Continue an existing conversation thread | Yes |

*Sample Ask Response:*
```json
{
  "conversationId": "uuid-here",
  "answer": "### Summary\nThe document establishes two primary methodologies...",
  "sourceChunks": [
    "Relevant excerpt 1 extracted from page 3 of the PDF...",
    "Relevant excerpt 2 extracted from page 7 of the PDF..."
  ]
}
```

### Threaded Comments

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/documents/:documentId/comments` | Fetch all comments and nested replies | Yes |
| `POST` | `/documents/:documentId/comments` | Post a new top-level comment | Yes |
| `POST` | `/documents/:documentId/comments/:commentId/replies` | Reply to an existing comment | Yes |
| `PATCH` | `/documents/:documentId/comments/:commentId` | Edit comment content | Yes (Author) |
| `DELETE` | `/documents/:documentId/comments/:commentId` | Delete comment and all its child replies | Yes (Author) |

---

## Running Tests & Linting

### Backend

```bash
cd project

# Run unit tests
npm test

# Run e2e tests
npm run test:e2e

# Run test coverage
npm run test:cov

# Run linter
npm run lint
```

### Frontend

```bash
cd project/frontend

# Typecheck and build production bundle
npm run build

# Preview production build locally
npm run preview
```

---

## Production Deployment

### Backend Deployment (Render, Railway, AWS ECS)
1. Set `NODE_ENV=production`.
2. Configure all environment variables in your hosting provider's dashboard.
3. Build command: `npm run build`
4. Start command: `node dist/main.js` (or `npm run start:prod`).
5. Ensure `FRONTEND_URL` matches your deployed frontend origin so credentialed CORS requests succeed.

### Frontend Deployment (Vercel, Netlify, Render Static Site)
1. Set the root/base directory to `project/frontend`.
2. Build command: `npm run build`
3. Output directory: `dist`
4. Set environment variable: `VITE_API_URL=https://your-backend-api.com`

---

## License

This project is licensed under the [MIT License](LICENSE).
