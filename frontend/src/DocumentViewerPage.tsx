import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { apiRequest, type User } from './api';
import DocumentViewer from './DocumentViewer';
import DocumentChat from './DocumentChat';
import DocumentComments from './DocumentComments';
import DocumentShare from './DocumentShare';

type ViewerPageProps = {
    user: User;
    isSigningOut: boolean;
    signOutError: string;
    onSignOut: () => Promise<void>;
    isSharedView?: boolean;
};

type DocumentItem = {
    id: string;
    filename: string;
    fileSize: number;
    mimeType: string;
    summary: string | null;
    createdAt: string;
    updatedAt: string;
};

export default function DocumentViewerPage({ user, isSigningOut, signOutError, onSignOut, isSharedView = false }: ViewerPageProps) {
    const navigate = useNavigate();
    const { documentId, token } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();
    const [document, setDocument] = useState<DocumentItem | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState<'viewer' | 'chat' | 'comments' | 'share'>('viewer');

    const routeKey = useMemo(() => (token ? `shared:${token}` : `document:${documentId}`), [documentId, token]);

    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab === 'chat' || tab === 'share') {
            setActiveTab(tab);
        } else {
            setActiveTab('viewer');
        }
    }, [searchParams]);

    useEffect(() => {
        let active = true;

        async function loadDocument() {
            setError('');
            setIsLoading(true);

            try {
                const result = isSharedView
                    ? await apiRequest<{ document: DocumentItem }>(`/documents/shared/${token}`)
                    : await apiRequest<{ document: DocumentItem }>(`/documents/${documentId}`);

                if (active) setDocument(result.document);
            } catch (requestError) {
                if (active) setError(requestError instanceof Error ? requestError.message : 'Document not found.');
            } finally {
                if (active) setIsLoading(false);
            }
        }

        void loadDocument();
        return () => { active = false; };
    }, [documentId, isSharedView, token, routeKey]);

    if (isLoading) {
        return <main className="document-app"><section className="viewer-content"><div className="viewer-loading">Loading document…</div></section></main>;
    }

    if (!document) {
        return <main className="document-app"><section className="viewer-content"><div className="viewer-empty">{error || 'Document not found.'}</div></section></main>;
    }

    const onBack = () => navigate('/');

    const sharedTabs = [
        { key: 'viewer', label: 'Preview' },
        { key: 'chat', label: 'AI chat' },
        { key: 'share', label: 'Share' },
    ];

    return (
        <div>
            <div className="document-route-tabs" role="tablist" aria-label="Document detail tabs">
                {sharedTabs.map((tab) => (
                    <button
                        key={tab.key}
                        type="button"
                        role="tab"
                        aria-selected={activeTab === tab.key}
                        className={activeTab === tab.key ? 'document-route-tab active' : 'document-route-tab'}
                        onClick={() => {
                            setActiveTab(tab.key as 'viewer' | 'chat' | 'comments' | 'share');
                            const next = new URLSearchParams(searchParams);
                            if (tab.key === 'viewer') next.delete('tab');
                            else next.set('tab', tab.key);
                            setSearchParams(next, { replace: true });
                        }}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {activeTab === 'viewer' && (
                <DocumentViewer
                    document={document}
                    user={user}
                    isSigningOut={isSigningOut}
                    signOutError={signOutError}
                    onSignOut={onSignOut}
                    onBack={onBack}
                />
            )}

            {activeTab === 'chat' && (
                <DocumentChat
                    document={document}
                    user={user}
                    isSigningOut={isSigningOut}
                    signOutError={signOutError}
                    onSignOut={onSignOut}
                    onBack={onBack}
                />
            )}

            {activeTab === 'comments' && (
                <DocumentComments
                    document={document}
                    user={user}
                    isSigningOut={isSigningOut}
                    signOutError={signOutError}
                    onSignOut={onSignOut}
                    onBack={onBack}
                />
            )}

            {activeTab === 'share' && (
                <DocumentShare
                    document={document}
                    user={user}
                    isSigningOut={isSigningOut}
                    signOutError={signOutError}
                    onSignOut={onSignOut}
                    onBack={onBack}
                />
            )}
        </div>
    );
}
