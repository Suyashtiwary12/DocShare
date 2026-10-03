import { useEffect, useState, type FormEvent } from 'react';
import {
    ArrowLeft,
    Check,
    LoaderCircle,
    LogOut,
    MessageCircle,
    Pencil,
    RefreshCw,
    Send,
    Trash2,
} from 'lucide-react';
import { apiRequest, type User } from './api';

type ThreadComment = {
    id: string;
    userId: string;
    parentId: string | null;
    content: string;
    createdAt: string;
    updatedAt: string;
    user: { id: string; name: string };
    replies: ThreadComment[];
};

type DocumentSummary = {
    id: string;
    filename: string;
};

type DocumentCommentsProps = {
    document: DocumentSummary;
    user: User;
    isSigningOut: boolean;
    signOutError: string;
    onSignOut: () => Promise<void>;
    onBack: () => void;
};

function countComments(comments: ThreadComment[]): number {
    return comments.reduce((total, comment) => total + 1 + countComments(comment.replies), 0);
}

function formatCommentDate(value: string): string {
    return new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    }).format(new Date(value));
}

export default function DocumentComments({
    document,
    user,
    isSigningOut,
    signOutError,
    onSignOut,
    onBack,
}: DocumentCommentsProps) {
    const [comments, setComments] = useState<ThreadComment[]>([]);
    const [draft, setDraft] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isPosting, setIsPosting] = useState(false);
    const [error, setError] = useState('');

    async function loadComments() {
        setError('');
        setIsLoading(true);
        try {
            const result = await apiRequest<{ comments: ThreadComment[] }>(`/documents/${document.id}/comments`);
            setComments(result.comments);
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : 'Could not load comments.');
        } finally {
            setIsLoading(false);
        }
    }

    useEffect(() => {
        void loadComments();
    }, [document.id]);

    async function addComment(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const content = draft.trim();
        if (!content) return;

        setError('');
        setIsPosting(true);
        try {
            await apiRequest(`/documents/${document.id}/comments`, {
                method: 'POST',
                body: JSON.stringify({ content }),
            });
            setDraft('');
            await loadComments();
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : 'Could not add the comment.');
        } finally {
            setIsPosting(false);
        }
    }

    return (
        <main className="document-app comments-app">
            <header className="workspace-header">
                <a className="workspace-brand" href="/" aria-label="DocuShare home">
                    <span className="brand-mark"><MessageCircle size={18} strokeWidth={2.2} /></span>
                    <span>DocuShare</span>
                </a>
                <div className="workspace-user">
                    <span className="workspace-user-name">{user.name}</span>
                    <span className="workspace-avatar" aria-hidden="true">{user.name.slice(0, 1).toUpperCase()}</span>
                    <button className="header-action" type="button" onClick={() => void onSignOut()} disabled={isSigningOut} aria-label="Sign out" title="Sign out">
                        <LogOut size={17} />
                    </button>
                </div>
            </header>

            <section className="comments-content">
                <button className="back-to-documents" type="button" onClick={onBack}>
                    <ArrowLeft size={16} /> Your documents
                </button>

                <div className="comments-heading">
                    <p className="eyebrow">DOCUMENT DISCUSSION</p>
                    <h1>Comments</h1>
                    <p className="comments-document-name"><span className="comment-file-mark">PDF</span>{document.filename}</p>
                </div>

                <form className="new-comment-form" onSubmit={addComment}>
                    <label htmlFor="new-comment">Add to the conversation</label>
                    <textarea
                        id="new-comment"
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        placeholder="Share a thought about this document…"
                        maxLength={10000}
                        rows={3}
                    />
                    <div className="composer-footer">
                        <span>{draft.length.toLocaleString()} / 10,000</span>
                        <button className="comment-submit" type="submit" disabled={isPosting || !draft.trim()}>
                            {isPosting ? <LoaderCircle className="spinner" size={15} /> : <Send size={15} />}
                            {isPosting ? 'Posting…' : 'Post comment'}
                        </button>
                    </div>
                </form>

                {(error || signOutError) && <p className="workspace-alert error-alert" role="alert">{error || signOutError}</p>}

                <div className="thread-heading">
                    <div><h2>Thread</h2><span className="document-count">{countComments(comments)}</span></div>
                    <button className="back-to-documents refresh-comments" type="button" onClick={() => void loadComments()} disabled={isLoading}>
                        <RefreshCw size={14} className={isLoading ? 'spinner' : undefined} /> Refresh
                    </button>
                </div>

                {isLoading ? (
                    <div className="comments-state"><LoaderCircle className="spinner" size={20} /><span>Loading comments…</span></div>
                ) : comments.length === 0 ? (
                    <div className="comments-empty">
                        <span className="empty-icon"><MessageCircle size={20} /></span>
                        <strong>Start the discussion</strong>
                        <span>There are no comments on this document yet.</span>
                    </div>
                ) : (
                    <div className="comment-thread">
                        {comments.map((comment) => (
                            <CommentItem
                                key={comment.id}
                                comment={comment}
                                documentId={document.id}
                                currentUserId={user.id}
                                onMutated={loadComments}
                                onError={setError}
                            />
                        ))}
                    </div>
                )}

                <footer className="workspace-footer"><span><Check size={14} /> Shared with people who can access this document</span></footer>
            </section>
        </main>
    );
}

type CommentItemProps = {
    comment: ThreadComment;
    documentId: string;
    currentUserId: string;
    onMutated: () => Promise<void>;
    onError: (message: string) => void;
};

function CommentItem({ comment, documentId, currentUserId, onMutated, onError }: CommentItemProps) {
    const [isReplying, setIsReplying] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
    const [replyDraft, setReplyDraft] = useState('');
    const [editDraft, setEditDraft] = useState(comment.content);
    const [isSaving, setIsSaving] = useState(false);
    const isAuthor = comment.userId === currentUserId;

    async function saveReply(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const content = replyDraft.trim();
        if (!content) return;

        setIsSaving(true);
        onError('');
        try {
            await apiRequest(`/documents/${documentId}/comments/${comment.id}/replies`, {
                method: 'POST',
                body: JSON.stringify({ content }),
            });
            setReplyDraft('');
            setIsReplying(false);
            await onMutated();
        } catch (requestError) {
            onError(requestError instanceof Error ? requestError.message : 'Could not post the reply.');
        } finally {
            setIsSaving(false);
        }
    }

    async function saveEdit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const content = editDraft.trim();
        if (!content) return;

        setIsSaving(true);
        onError('');
        try {
            await apiRequest(`/documents/${documentId}/comments/${comment.id}`, {
                method: 'PATCH',
                body: JSON.stringify({ content }),
            });
            setIsEditing(false);
            await onMutated();
        } catch (requestError) {
            onError(requestError instanceof Error ? requestError.message : 'Could not update the comment.');
        } finally {
            setIsSaving(false);
        }
    }

    async function deleteComment() {
        setIsSaving(true);
        onError('');
        try {
            await apiRequest(`/documents/${documentId}/comments/${comment.id}`, { method: 'DELETE' });
            await onMutated();
        } catch (requestError) {
            onError(requestError instanceof Error ? requestError.message : 'Could not delete the comment.');
        } finally {
            setIsSaving(false);
            setIsConfirmingDelete(false);
        }
    }

    return (
        <article className="comment-item">
            <div className="comment-avatar" aria-hidden="true">{comment.user.name.slice(0, 1).toUpperCase()}</div>
            <div className="comment-body">
                <header className="comment-meta">
                    <strong>{comment.user.name}</strong>
                    <time dateTime={comment.createdAt}>{formatCommentDate(comment.createdAt)}</time>
                </header>

                {isEditing ? (
                    <form className="inline-comment-form" onSubmit={saveEdit}>
                        <label className="visually-hidden" htmlFor={`edit-${comment.id}`}>Edit your comment</label>
                        <textarea id={`edit-${comment.id}`} value={editDraft} onChange={(event) => setEditDraft(event.target.value)} maxLength={10000} rows={3} />
                        <div className="inline-form-actions">
                            <button className="quiet-button" type="button" onClick={() => { setEditDraft(comment.content); setIsEditing(false); }}>Cancel</button>
                            <button className="comment-submit" type="submit" disabled={isSaving || !editDraft.trim()}>{isSaving ? 'Saving…' : 'Save edit'}</button>
                        </div>
                    </form>
                ) : (
                    <p className="comment-content">{comment.content}</p>
                )}

                <div className="comment-actions">
                    <button className="quiet-button" type="button" onClick={() => { setIsReplying(!isReplying); setIsEditing(false); }}>
                        <MessageCircle size={14} /> Reply
                    </button>
                    {isAuthor && !isEditing && (
                        <button className="quiet-button" type="button" onClick={() => { setEditDraft(comment.content); setIsEditing(true); setIsReplying(false); }}>
                            <Pencil size={13} /> Edit
                        </button>
                    )}
                    {isAuthor && !isConfirmingDelete && (
                        <button className="quiet-button delete-action" type="button" onClick={() => setIsConfirmingDelete(true)}>
                            <Trash2 size={13} /> Delete
                        </button>
                    )}
                </div>

                {isConfirmingDelete && (
                    <div className="delete-confirmation">
                        <span>Delete this comment and all its replies?</span>
                        <button className="quiet-button" type="button" onClick={() => setIsConfirmingDelete(false)}>Cancel</button>
                        <button className="confirm-delete-button" type="button" onClick={() => void deleteComment()} disabled={isSaving}>{isSaving ? 'Deleting…' : 'Delete thread'}</button>
                    </div>
                )}

                {isReplying && (
                    <form className="inline-comment-form reply-form" onSubmit={saveReply}>
                        <label className="visually-hidden" htmlFor={`reply-${comment.id}`}>Reply to {comment.user.name}</label>
                        <textarea id={`reply-${comment.id}`} autoFocus value={replyDraft} onChange={(event) => setReplyDraft(event.target.value)} placeholder="Write a reply…" maxLength={10000} rows={2} />
                        <div className="inline-form-actions">
                            <button className="quiet-button" type="button" onClick={() => { setIsReplying(false); setReplyDraft(''); }}>Cancel</button>
                            <button className="comment-submit" type="submit" disabled={isSaving || !replyDraft.trim()}>{isSaving ? 'Posting…' : 'Post reply'}</button>
                        </div>
                    </form>
                )}

                {comment.replies.length > 0 && (
                    <div className="comment-replies">
                        {comment.replies.map((reply) => (
                            <CommentItem
                                key={reply.id}
                                comment={reply}
                                documentId={documentId}
                                currentUserId={currentUserId}
                                onMutated={onMutated}
                                onError={onError}
                            />
                        ))}
                    </div>
                )}
            </div>
        </article>
    );
}