import { useEffect, useState, type FormEvent } from 'react';
import {
    ArrowLeft,
    Check,
    Copy,
    Link2,
    LoaderCircle,
    LogOut,
    Mail,
    Plus,
    ShieldCheck,
    Trash2,
    Users,
} from 'lucide-react';
import { apiRequest, type User } from './api';

type InviteItem = {
    id: string;
    email: string;
    invitedBy: string;
    createdAt: string;
    updatedAt: string;
    userId: string | null;
};

type DocumentShareProps = {
    document: { id: string; filename: string };
    user: User;
    isSigningOut: boolean;
    signOutError: string;
    onSignOut: () => Promise<void>;
    onBack: () => void;
};

export default function DocumentShare({ document, user, isSigningOut, signOutError, onSignOut, onBack }: DocumentShareProps) {
    const [shareUrl, setShareUrl] = useState('');
    const [email, setEmail] = useState('');
    const [invites, setInvites] = useState<InviteItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isCopying, setIsCopying] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    async function loadShareInfo() {
        setError('');
        setIsLoading(true);
        try {
            const [shareResult, invitesResult] = await Promise.all([
                apiRequest<{ shareUrl: string }>(`/documents/${document.id}/share`, { method: 'POST' }).catch(() => ({ shareUrl: '' })),
                apiRequest<{ invites: InviteItem[] }>(`/documents/${document.id}/invites`),
            ]);
            setShareUrl(shareResult.shareUrl || '');
            setInvites(invitesResult.invites);
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : 'Could not load sharing details.');
        } finally {
            setIsLoading(false);
        }
    }

    useEffect(() => {
        void loadShareInfo();
    }, [document.id]);

    async function createShareLink() {
        setError('');
        setSuccess('');
        setIsSubmitting(true);
        try {
            const result = await apiRequest<{ shareUrl: string }>(`/documents/${document.id}/share`, { method: 'POST' });
            setShareUrl(result.shareUrl);
            setSuccess('Share link generated.');
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : 'Could not create a share link.');
        } finally {
            setIsSubmitting(false);
        }
    }

    async function revokeShareLink() {
        setError('');
        setSuccess('');
        setIsSubmitting(true);
        try {
            await apiRequest(`/documents/${document.id}/share`, { method: 'DELETE' });
            setShareUrl('');
            setSuccess('Share link revoked.');
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : 'Could not revoke the share link.');
        } finally {
            setIsSubmitting(false);
        }
    }

    async function inviteUser(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const trimmedEmail = email.trim();
        if (!trimmedEmail) return;

        setError('');
        setSuccess('');
        setIsSubmitting(true);
        try {
            await apiRequest(`/documents/${document.id}/invite`, {
                method: 'POST',
                body: JSON.stringify({ email: trimmedEmail }),
            });
            setEmail('');
            setSuccess(`${trimmedEmail} was invited.`);
            await loadShareInfo();
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : 'Could not invite the user.');
        } finally {
            setIsSubmitting(false);
        }
    }

    async function revokeInvite(targetEmail: string) {
        setError('');
        setSuccess('');
        setIsSubmitting(true);
        try {
            await apiRequest(`/documents/${document.id}/invite`, {
                method: 'DELETE',
                body: JSON.stringify({ email: targetEmail }),
            });
            setSuccess(`${targetEmail} was removed from shared access.`);
            await loadShareInfo();
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : 'Could not revoke the invite.');
        } finally {
            setIsSubmitting(false);
        }
    }

    async function copyLink() {
        if (!shareUrl) return;
        setError('');
        setIsCopying(true);
        try {
            await navigator.clipboard.writeText(shareUrl);
            setSuccess('Share link copied to your clipboard.');
        } catch {
            setError('Clipboard access was blocked. Copy the link manually below.');
        } finally {
            setIsCopying(false);
        }
    }

    return (
        <main className="document-app share-app">
            <header className="workspace-header">
                <a className="workspace-brand" href="/" aria-label="DocuShare home">
                    <span className="brand-mark"><Users size={18} strokeWidth={2.2} /></span>
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

            <section className="share-content">
                <button className="back-to-documents" type="button" onClick={onBack}><ArrowLeft size={16} /> Your documents</button>

                <div className="share-heading">
                    <p className="eyebrow">DOCUMENT ACCESS</p>
                    <h1>Sharing</h1>
                    <p className="share-document-name"><span className="comment-file-mark">PDF</span>{document.filename}</p>
                </div>

                {(error || signOutError) && <p className="workspace-alert error-alert" role="alert">{error || signOutError}</p>}
                {success && <p className="workspace-alert success-alert" role="status"><Check size={15} /> {success}</p>}

                <section className="share-panel">
                    <div className="share-panel-header">
                        <div><ShieldCheck size={16} /><strong>Share link</strong></div>
                        {shareUrl ? (
                            <button className="share-link-button" type="button" onClick={() => void copyLink()} disabled={isCopying || isSubmitting}>
                                {isCopying ? <LoaderCircle className="spinner" size={14} /> : <Copy size={14} />}
                                {isCopying ? 'Copying…' : 'Copy link'}
                            </button>
                        ) : (
                            <button className="share-link-button" type="button" onClick={() => void createShareLink()} disabled={isSubmitting}>
                                {isSubmitting ? <LoaderCircle className="spinner" size={14} /> : <Plus size={14} />}
                                {isSubmitting ? 'Creating…' : 'Create link'}
                            </button>
                        )}
                    </div>

                    {shareUrl ? (
                        <div className="share-url-box">
                            <Link2 size={14} />
                            <a href={shareUrl} target="_blank" rel="noreferrer">{shareUrl}</a>
                        </div>
                    ) : (
                        <p className="share-empty-text">No public share link is active yet.</p>
                    )}

                    {shareUrl && (
                        <button className="danger-button" type="button" onClick={() => void revokeShareLink()} disabled={isSubmitting}>
                            <Trash2 size={14} /> Revoke share link
                        </button>
                    )}
                </section>

                <form className="invite-form" onSubmit={inviteUser}>
                    <div className="invite-form-header">
                        <span><Users size={15} /> Invite collaborators</span>
                    </div>
                    <div className="invite-form-row">
                        <label className="visually-hidden" htmlFor="invite-email">Collaborator email</label>
                        <span className="input-wrap share-input-wrap"><Mail size={16} /><input id="invite-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="invite@company.com" required /></span>
                        <button className="submit-link-button" type="submit" disabled={isSubmitting || !email.trim()}>
                            {isSubmitting ? <LoaderCircle className="spinner" size={14} /> : <Plus size={14} />}
                            Invite
                        </button>
                    </div>
                </form>

                <section className="invite-list-panel">
                    <div className="invite-list-header">
                        <strong>Shared with</strong>
                        <span>{invites.length} collaborator{invites.length === 1 ? '' : 's'}</span>
                    </div>

                    {isLoading ? (
                        <div className="share-list-state"><LoaderCircle className="spinner" size={16} /> Loading access…</div>
                    ) : invites.length === 0 ? (
                        <div className="share-list-empty">No direct invites yet.</div>
                    ) : (
                        <ul className="invite-list">
                            {invites.map((invite) => (
                                <li key={invite.id}>
                                    <span>{invite.email}</span>
                                    <button className="remove-invite-button" type="button" onClick={() => void revokeInvite(invite.email)} disabled={isSubmitting}>
                                        <Trash2 size={12} /> Remove
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </section>
        </main>
    );
}
