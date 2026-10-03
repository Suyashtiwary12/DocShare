# Frontend User Stories and API Guide

## API Setup

- Local API base URL: `http://localhost:3000` (use HTTPS only when the API is actually configured for TLS).
- Authenticated routes use an HTTP-only cookie. Browser requests must include credentials: `fetch(url, { credentials: 'include' })`.
- The API allows credentialed CORS requests only from the configured `FRONTEND_URL` origin.
- Do not set `Content-Type` manually when sending `FormData` for uploads; let the browser add the multipart boundary.
- JSON endpoints use `Content-Type: application/json`.

Example browser helper:

```ts
const API_BASE = 'http://localhost:3000';

async function apiFetch(path: string, init: RequestInit = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...init.headers,
    },
  });

  if (!response.ok) {
    throw await response.json();
  }

  return response.status === 204 ? undefined : response.json();
}
```

## User Stories

### 1. Create an account or sign in

As a visitor, I want to register or sign in so that I can access my documents and collaborations.

- Register form submit → `POST /auth/register`
- Login form submit → `POST /auth/login`
- App startup/session restore → `GET /auth/me`
- Sign out click → `POST /auth/logout`

Register body:

```json
{ "name": "Ada Lovelace", "email": "ada@example.com", "password": "password123" }
```

Login body:

```json
{ "email": "ada@example.com", "password": "password123" }
```

Login and registration set the authentication cookie. Treat `401 Unauthorized` from `/auth/me` as a signed-out session and show the login screen.

### 2. Browse and search my documents

As a signed-in user, I want to see documents I own and quickly find one by filename.

- Open My Documents or refresh the list → `GET /documents`
- Search submission → `GET /documents?search=<URL-encoded query>`
- Open a document → `GET /documents/:documentId`
- Open Shared with Me → `GET /documents/shared-with-me`

List response shape: `{ "documents": [...] }`. Document metadata currently includes `id`, `filename`, `fileSize`, `mimeType`, `summary`, `ownerId`, `createdAt`, and `updatedAt`.

### 3. Upload a PDF

As a signed-in user, I want to upload a text-based PDF so that I can view, share, comment on, and ask questions about it.

- Upload form submit → `POST /documents`
- Send `multipart/form-data` with a file field named `file`.
- On success, use `response.document.id` for subsequent document routes.
- Show validation errors such as unsupported/invalid PDF, oversized file, or PDF without enough extractable text.

### 4. Download a document

As a user with document access, I want to download or open the PDF.

- Download button → `GET /documents/:documentId/download`
- Open the returned `url` in a browser tab or start a download.

The endpoint returns `{ "url": "<temporary signed URL>" }`; the URL is not a permanent document URL.

### 5. Ask a question about a document

As a user viewing a document, I want to ask the AI a question and see its answer and cited source chunks.

- First question / New Chat submit → `POST /documents/:documentId/ask`
- Body:

```json
{ "question": "What are the main conclusions?" }
```

- Save `conversationId` from the response. The response also contains `answer` and `sourceChunks`.
- Subsequent question in the same chat → `POST /documents/:documentId/chats/:conversationId/ask`
- Body:

```json
{ "question": "Can you explain the second conclusion?" }
```

The conversation is stored by the backend. Do not submit or maintain a client-provided copy of the full history for model context.

### 6. Resume an earlier AI conversation

As a user, I want to reopen a previous chat and continue it without starting over.

- Open the chat list → `GET /documents/:documentId/chats`
- Render each returned conversation and its `lastMessage`.
- Select a conversation → `GET /documents/:documentId/chats/:conversationId/messages`
- Render its `messages` in the order returned.
- Send another question → `POST /documents/:documentId/chats/:conversationId/ask`

The conversation list response is `{ "conversations": [...] }`; each item includes `id`, `title`, timestamps, `messageCount`, and `lastMessage` (or `null` if empty).

### 7. Comment on a document and participate in threads

As a user with document access, I want to leave comments, reply to others, and manage my own comments.

- Open/reload comments panel → `GET /documents/:documentId/comments`
- Add top-level comment → `POST /documents/:documentId/comments`
- Reply to any comment, including a reply → `POST /documents/:documentId/comments/:commentId/replies`
- Edit my comment → `PATCH /documents/:documentId/comments/:commentId`
- Delete my comment → `DELETE /documents/:documentId/comments/:commentId`

Create/reply/update body:

```json
{ "content": "This section is important because..." }
```

The list response is `{ "comments": [...] }`. Each item has `replies`, so render it recursively. Users can edit or delete only their own comments. Deleting a comment deletes its descendant replies as well.

### 8. Invite a collaborator

As a document owner, I want to grant or revoke access for someone by email.

- Invite submit → `POST /documents/:documentId/invite`
- List invites → `GET /documents/:documentId/invites`
- Revoke invite → `DELETE /documents/:documentId/invite`

Invite and revoke body:

```json
{ "email": "collaborator@example.com" }
```

These endpoints are owner-only. A collaborator needs an account with the invited email to access the document.

### 9. Share a public link

As a document owner, I want to create or revoke a link that allows public document viewing/download.

- Create link → `POST /documents/:documentId/share`
- Revoke link → `DELETE /documents/:documentId/share`
- Open shared document page → `GET /documents/shared/:token`
- Download shared document → `GET /documents/shared/:token/download`

The create route returns `{ "shareUrl": "..." }`. Public shared-document routes do not use the authenticated cookie.

## Current API Notes

- `GET /documents/:documentId` metadata does not currently include `embeddingStatus`. The frontend cannot reliably poll indexing readiness from that response.
- The `embeddingStatus === 'COMPLETED'` guard is currently commented out in the ask controller. Handle AI/indexing errors from the ask response until the backend exposes an explicit readiness field or endpoint.
- Document and comment routes require an authenticated user who owns the document or has been invited to it. Public share-token routes are the exception.
- Validation failures use standard NestJS error responses; display the returned `message` to the user where appropriate.