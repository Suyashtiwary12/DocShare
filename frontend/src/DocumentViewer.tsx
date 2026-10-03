import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, FileText, LoaderCircle, LogOut, MessageCircle, Send } from 'lucide-react';
import { apiRequest, type User } from './api';

type CommentNode = {
    id: string;
    userId: string;
    parentId: string | null;
    content: string;
    createdAt: string;
    updatedAt: string;
    user: { id: string; name: string };
    replies: CommentNode[];
};

type DocumentViewerProps = {
    document: { id: string; filename: string };
    user: User;
    isSigningOut: boolean;
    signOutError: string;
    onSignOut: () => Promise<void>;
    onBack: () => void;
};

function formatCommentDate(value: string): string {
    return new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    }).format(new Date(value));
}

function countComments(comments: CommentNode[]): number {
    return comments.reduce((total, comment) => total + 1 + countComments(comment.replies), 0);
}

export default function DocumentViewer({ document, user, isSigningOut, signOutError, onSignOut, onBack }: DocumentViewerProps) {
    const [viewerUrl, setViewerUrl] = useState('');
    const [comments, setComments] = useState<CommentNode[]>([]);
    const [draft, setDraft] = useState('');
    const [isLoadingViewer, setIsLoadingViewer] = useState(true);
    const [isLoadingComments, setIsLoadingComments] = useState(true);
    const [isPosting, setIsPosting] = useState(false);
    const [error, setError] = useState('');

    async function loadViewerUrl() {
        try {
            const result = await apiRequest<{ url: string }>(`/documents/${document.id}/download`);
            setViewerUrl(result.url);
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : 'Could not open the PDF.');
        } finally {
            setIsLoadingViewer(false);
        }
    }

    async function loadComments() {
        setIsLoadingComments(true);
        try {
            const result = await apiRequest<{ comments: CommentNode[] }>(`/documents/${document.id}/comments`);
            setComments(result.comments);
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : 'Could not load comments.');
        } finally {
            setIsLoadingComments(false);
        }
    }

    useEffect(() => {
        void loadViewerUrl();
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
        <main className="document-app viewer-app">
            <header className="workspace-header">
                <a className="workspace-brand" href="/" aria-label="DocuShare home">
                    <span className="brand-mark"><FileText size={18} strokeWidth={2.2} /></span>
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

            <section className="viewer-content">
                <button className="back-to-documents" type="button" onClick={onBack}><ArrowLeft size={16} /> Your documents</button>

                <div className="viewer-header">
                    <div>
                        <p className="eyebrow">DOCUMENT VIEW</p>
                        <h1>{document.filename}</h1>
                    </div>
                </div>

                {error && <p className="workspace-alert error-alert" role="alert">{error}</p>}
                {signOutError && <p className="workspace-alert error-alert" role="alert">{signOutError}</p>}

                <div className="viewer-shell">
                    <div className="pdf-panel">
                        {isLoadingViewer ? (
                            <div className="viewer-loading"><LoaderCircle className="spinner" size={22} /> Loading PDF…</div>
                        ) : viewerUrl ? (
                            <iframe title={document.filename} src={viewerUrl} className="pdf-frame" />
                        ) : (
                            <div className="viewer-empty">The PDF could not be loaded.</div>
                        )}
                    </div>

                    <aside className="viewer-comments-panel">
                        <div className="viewer-comments-header">
                            <span><MessageCircle size={15} /> Comments</span>
                            <strong>{countComments(comments)}</strong>
                        </div>

                        <form className="viewer-comment-form" onSubmit={addComment}>
                            <textarea
                                value={draft}
                                onChange={(event) => setDraft(event.target.value)}
                                placeholder="Add a comment…"
                                rows={3}
                                maxLength={10000}
                            />
                            <button className="comment-submit" type="submit" disabled={isPosting || !draft.trim()}>
                                {isPosting ? <LoaderCircle className="spinner" size={14} /> : <Send size={14} />}
                                {isPosting ? 'Posting…' : 'Comment'}
                            </button>
                        </form>

                        {isLoadingComments ? (
                            <div className="comments-state"><LoaderCircle className="spinner" size={18} /><span>Loading comments…</span></div>
                        ) : comments.length === 0 ? (
                            <div className="comments-empty">No comments yet.</div>
                        ) : (
                            <div className="thread-list">
                                {comments.map((comment) => (
                                    <CommentNodeItem key={comment.id} comment={comment} documentId={document.id} onReplyComplete={loadComments} />
                                ))}
                            </div>
                        )}
                    </aside>
                </div>
            </section>
        </main>
    );
}

type CommentNodeItemProps = {
    comment: CommentNode;
    documentId: string;
    onReplyComplete: () => Promise<void>;
};

function CommentNodeItem({ comment, documentId, onReplyComplete }: CommentNodeItemProps) {
    const [isReplying, setIsReplying] = useState(false);
    const [replyDraft, setReplyDraft] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [replyError, setReplyError] = useState('');

    async function submitReply(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const content = replyDraft.trim();
        if (!content) return;

        setIsSubmitting(true);
        setReplyError('');
        try {
            await apiRequest(`/documents/${documentId}/comments/${comment.id}/replies`, {
                method: 'POST',
                body: JSON.stringify({ content }),
            });
            setReplyDraft('');
            setIsReplying(false);
            await onReplyComplete();
        } catch (requestError) {
            setReplyError(requestError instanceof Error ? requestError.message : 'Could not post the reply.');
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <article className="comment-thread-item">
            <div className="comment-thread-avatar">{comment.user.name.slice(0, 1).toUpperCase()}</div>
            <div className="comment-thread-body">
                <div className="comment-thread-meta">
                    <strong>{comment.user.name}</strong>
                    <time>{formatCommentDate(comment.createdAt)}</time>
                </div>
                <p>{comment.content}</p>

                <div className="comment-thread-actions">
                    <button type="button" className="reply-trigger" onClick={() => setIsReplying((current) => !current)}>
                        Reply
                    </button>
                </div>

                {isReplying && (
                    <form className="reply-form" onSubmit={submitReply}>
                        <textarea
                            value={replyDraft}
                            onChange={(event) => setReplyDraft(event.target.value)}
                            rows={2}
                            placeholder="Write a reply…"
                            maxLength={10000}
                        />
                        {replyError && <p className="reply-error">{replyError}</p>}
                        <div className="reply-form-actions">
                            <button type="button" className="secondary-text-button" onClick={() => { setIsReplying(false); setReplyDraft(''); setReplyError(''); }}>
                                Cancel
                            </button>
                            <button type="submit" className="small-submit-button" disabled={isSubmitting || !replyDraft.trim()}>
                                {isSubmitting ? 'Posting…' : 'Post reply'}
                            </button>
                        </div>
                    </form>
                )}

                {comment.replies.length > 0 && (
                    <div className="comment-thread-replies">
                        {comment.replies.map((reply) => (
                            <CommentNodeItem key={reply.id} comment={reply} documentId={documentId} onReplyComplete={onReplyComplete} />
                        ))}
                    </div>
                )}
            </div>
        </article>
    );
}
