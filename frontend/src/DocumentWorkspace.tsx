import { useEffect, useRef, useState, type DragEvent, type ChangeEvent } from 'react';
import {
    ArrowDownToLine,
    Check,
    FileText,
    LoaderCircle,
    LogOut,
    Plus,
    RefreshCw,
    Share2,
    Sparkles,
    Upload,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiRequest, type User } from './api';

type DocumentItem = {
    id: string;
    filename: string;
    fileSize: number;
    mimeType: string;
    summary: string | null;
    createdAt: string;
    updatedAt: string;
};

type DocumentWorkspaceProps = {
    user: User;
    isSigningOut: boolean;
    signOutError: string;
    onSignOut: () => Promise<void>;
};

function formatFileSize(bytes: number): string {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string): string {
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

export default function DocumentWorkspace({ user, isSigningOut, signOutError, onSignOut }: DocumentWorkspaceProps) {
    const [documents, setDocuments] = useState<DocumentItem[]>([]);
    const [sharedDocuments, setSharedDocuments] = useState<DocumentItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loadError, setLoadError] = useState('');
    const [selectedTab, setSelectedTab] = useState<'mine' | 'shared'>('mine');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const navigate = useNavigate();

    async function loadDocuments() {
        setLoadError('');
        setIsLoading(true);
        try {
            const [ownedResult, sharedResult] = await Promise.all([
                apiRequest<{ documents: DocumentItem[] }>('/documents'),
                apiRequest<{ documents: DocumentItem[] }>('/documents/shared-with-me'),
            ]);
            setDocuments(ownedResult.documents);
            setSharedDocuments(sharedResult.documents);
        } catch (requestError) {
            setLoadError(requestError instanceof Error ? requestError.message : 'Could not load your documents.');
        } finally {
            setIsLoading(false);
        }
    }

    useEffect(() => {
        void loadDocuments();
    }, []);

    const visibleDocuments = selectedTab === 'mine' ? documents : sharedDocuments;
    const visibleTitle = selectedTab === 'mine' ? 'Your documents' : 'Shared with me';
    const visibleSubtitle = selectedTab === 'mine' ? 'Keep the important things close.' : 'Files others have shared with you.';

    async function uploadFile(file: File | undefined) {
        if (!file) return;
        setError('');
        setSuccess('');

        if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
            setError('Choose a PDF file to upload.');
            return;
        }

        const formData = new FormData();
        formData.append('file', file);
        setIsUploading(true);

        try {
            await apiRequest<{ document: DocumentItem }>('/documents', {
                method: 'POST',
                body: formData,
            });
            setSuccess(`${file.name} uploaded successfully.`);
            await loadDocuments();
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : 'Upload failed. Please try again.');
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    }

    function handleFileSelection(event: ChangeEvent<HTMLInputElement>) {
        void uploadFile(event.currentTarget.files?.[0]);
    }

    function handleDrop(event: DragEvent<HTMLLabelElement>) {
        event.preventDefault();
        setIsDragging(false);
        void uploadFile(event.dataTransfer.files[0]);
    }

    async function downloadDocument(documentId: string) {
        setError('');
        try {
            const result = await apiRequest<{ url: string }>(`/documents/${documentId}/download`);
            window.open(result.url, '_blank', 'noopener,noreferrer');
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : 'Could not open this document.');
        }
    }

    return (
        <main className="document-app">
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

            <section className="document-content">
                <div className="document-heading-row">
                    <div>
                        <p className="eyebrow">YOUR LIBRARY</p>
                        <h1>{visibleTitle}</h1>
                        <p className="document-subtitle">{visibleSubtitle}</p>
                    </div>
                    {selectedTab === 'mine' && (
                        <button className="new-upload-button" type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                            <Plus size={17} /> Add document
                        </button>
                    )}
                </div>

                <div className="document-tabs" role="tablist" aria-label="Document library view">
                    <button
                        type="button"
                        role="tab"
                        aria-selected={selectedTab === 'mine'}
                        className={selectedTab === 'mine' ? 'document-tab active' : 'document-tab'}
                        onClick={() => setSelectedTab('mine')}
                    >
                        My files
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={selectedTab === 'shared'}
                        className={selectedTab === 'shared' ? 'document-tab active' : 'document-tab'}
                        onClick={() => setSelectedTab('shared')}
                    >
                        Shared with me
                    </button>
                </div>

                <label
                    className={`upload-zone${isDragging ? ' is-dragging' : ''}${isUploading ? ' is-uploading' : ''}`}
                    onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                >
                    <input
                        ref={fileInputRef}
                        className="file-input"
                        type="file"
                        accept="application/pdf,.pdf"
                        aria-label="Choose a PDF document"
                        disabled={isUploading}
                        onChange={handleFileSelection}
                    />
                    <span className="upload-icon">{isUploading ? <LoaderCircle className="spinner" size={21} /> : <Upload size={21} />}</span>
                    <span className="upload-copy">
                        <strong>{isUploading ? 'Uploading your document…' : 'Drop a PDF to add it'}</strong>
                        <span>{isUploading ? 'This may take a moment' : 'or choose a file from your device'}</span>
                    </span>
                    {!isUploading && <span className="browse-files">Browse files</span>}
                </label>

                {error && <p className="workspace-alert error-alert" role="alert">{error}</p>}
                {signOutError && <p className="workspace-alert error-alert" role="alert">{signOutError}</p>}
                {success && <p className="workspace-alert success-alert" role="status"><Check size={15} /> {success}</p>}

                <div className="documents-list-heading">
                    <div><h2>{selectedTab === 'mine' ? 'All documents' : 'Received documents'}</h2><span className="document-count">{visibleDocuments.length}</span></div>
                    <button className="icon-button" type="button" onClick={() => void loadDocuments()} disabled={isLoading} aria-label="Refresh documents" title="Refresh">
                        <RefreshCw size={16} className={isLoading ? 'spinner' : ''} />
                    </button>
                </div>

                {loadError ? (
                    <div className="list-state">
                        <p>{loadError}</p>
                        <button className="retry-button" type="button" onClick={() => void loadDocuments()}>Try again</button>
                    </div>
                ) : isLoading ? (
                    <div className="list-state"><LoaderCircle className="spinner" size={20} /><span>Loading documents…</span></div>
                ) : visibleDocuments.length === 0 ? (
                    <div className="empty-library">
                        <span className="empty-icon"><FileText size={21} /></span>
                        <strong>{selectedTab === 'mine' ? 'No documents yet' : 'Nothing shared with you yet'}</strong>
                        <span>{selectedTab === 'mine' ? 'Upload your first PDF to get started.' : 'Shared files will appear here.'}</span>
                    </div>
                ) : (
                    <div className="document-list">
                        {visibleDocuments.map((document) => (
                            <article className="document-row" key={document.id}>
                                <span className="pdf-icon"><FileText size={19} /></span>
                                <div className="document-info">
                                    <strong title={document.filename}>{document.filename}</strong>
                                    <span>{formatFileSize(document.fileSize)} <i /> {selectedTab === 'mine' ? `Added ${formatDate(document.createdAt)}` : `Shared ${formatDate(document.createdAt)}`}</span>
                                </div>
                                <span className="pdf-type">PDF</span>
                                <button className="icon-button" type="button" onClick={() => navigate(`/documents/${document.id}`)} aria-label={`Open ${document.filename}`} title="Open PDF">
                                    <FileText size={17} />
                                </button>
                                {selectedTab === 'mine' && (
                                    <>
                                        <button className="icon-button" type="button" onClick={() => navigate(`/documents/${document.id}?tab=chat`)} aria-label={`Ask AI about ${document.filename}`} title="Ask AI">
                                            <Sparkles size={17} />
                                        </button>
                                        <button className="icon-button" type="button" onClick={() => navigate(`/documents/${document.id}?tab=share`)} aria-label={`Share ${document.filename}`} title="Share">
                                            <Share2 size={17} />
                                        </button>
                                    </>
                                )}
                                <button className="icon-button download-button" type="button" onClick={() => void downloadDocument(document.id)} aria-label={`Download ${document.filename}`} title="Download">
                                    <ArrowDownToLine size={17} />
                                </button>
                            </article>
                        ))}
                    </div>
                )}

                <footer className="workspace-footer"><span><ShieldCheckIcon /> Private to you unless shared</span><span>PDF documents</span></footer>
            </section>
        </main>
    );
}

function ShieldCheckIcon() {
    return <Check size={14} aria-hidden="true" />;
}