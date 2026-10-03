import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import {
    ArrowLeft,
    ArrowUp,
    Bot,
    FileText,
    LoaderCircle,
    LogOut,
    MessageSquareText,
    Plus,
    Sparkles,
} from 'lucide-react';
import { apiRequest, type User } from './api';

type ChatRole = 'user' | 'assistant';

type ChatMessage = {
    id: string;
    role: ChatRole;
    content: string;
    sources?: string[];
    pending?: boolean;
};

type ConversationSummary = {
    id: string;
    title: string | null;
    createdAt: string;
    updatedAt: string;
    messageCount: number;
    lastMessage: { role: string; content: string; createdAt: string } | null;
};

type DocumentChatProps = {
    document: { id: string; filename: string };
    user: User;
    isSigningOut: boolean;
    signOutError: string;
    onSignOut: () => Promise<void>;
    onBack: () => void;
};

function getConversationLabel(conversation: ConversationSummary): string {
    const text = conversation.lastMessage?.content.trim();
    if (text) return text.length > 58 ? `${text.slice(0, 58)}…` : text;
    return conversation.title || 'New conversation';
}

export default function DocumentChat({ document, user, isSigningOut, signOutError, onSignOut, onBack }: DocumentChatProps) {
    const [conversations, setConversations] = useState<ConversationSummary[]>([]);
    const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [draft, setDraft] = useState('');
    const [isLoadingConversations, setIsLoadingConversations] = useState(true);
    const [isLoadingMessages, setIsLoadingMessages] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [error, setError] = useState('');
    const [messageSequence, setMessageSequence] = useState(0);
    const endOfMessagesRef = useRef<HTMLDivElement>(null);

    async function loadConversations(showLoading = false) {
        if (showLoading) setIsLoadingConversations(true);
        try {
            const result = await apiRequest<{ conversations: ConversationSummary[] }>(`/documents/${document.id}/chats`);
            setConversations(result.conversations);
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : 'Could not load saved conversations.');
        } finally {
            if (showLoading) setIsLoadingConversations(false);
        }
    }

    useEffect(() => {
        void loadConversations(true);
    }, [document.id]);

    useEffect(() => {
        endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, [messages, isLoadingMessages]);

    async function openConversation(conversationId: string) {
        if (isSending || conversationId === activeConversationId) return;
        setActiveConversationId(conversationId);
        setMessages([]);
        setError('');
        setIsLoadingMessages(true);
        try {
            const result = await apiRequest<{ conversationId: string; messages: Array<{ role: ChatRole; content: string }> }>(
                `/documents/${document.id}/chats/${conversationId}/messages`,
            );
            setMessages(result.messages.map((message, index) => ({ ...message, id: `${conversationId}-${index}` })));
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : 'Could not load this conversation.');
            setActiveConversationId(null);
        } finally {
            setIsLoadingMessages(false);
        }
    }

    function startNewConversation() {
        if (isSending) return;
        setActiveConversationId(null);
        setMessages([]);
        setDraft('');
        setError('');
    }

    async function sendQuestion(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const question = draft.trim();
        if (!question || isSending) return;

        setError('');
        setDraft('');
        setIsSending(true);
        const questionSequence = messageSequence + 1;
        setMessageSequence(questionSequence + 1);
        const pendingId = `pending-${questionSequence}`;
        setMessages((current) => [
            ...current,
            { id: `question-${questionSequence}`, role: 'user', content: question },
            { id: pendingId, role: 'assistant', content: '', pending: true },
        ]);

        try {
            const path = activeConversationId
                ? `/documents/${document.id}/chats/${activeConversationId}/ask`
                : `/documents/${document.id}/ask`;
            const result = await apiRequest<{ answer: string; sourceChunks: string[]; conversationId: string }>(path, {
                method: 'POST',
                body: JSON.stringify({ question }),
            });
            setActiveConversationId(result.conversationId);
            setMessages((current) => current.map((message) => message.id === pendingId
                ? { ...message, content: result.answer, sources: result.sourceChunks, pending: false }
                : message));
            await loadConversations();
        } catch (requestError) {
            setMessages((current) => current.filter((message) => message.id !== pendingId));
            setDraft(question);
            setError(requestError instanceof Error ? requestError.message : 'The assistant could not answer. Try again.');
        } finally {
            setIsSending(false);
        }
    }

    function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
        }
    }

    return (
        <main className="document-app ai-chat-app">
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

            <div className="ai-page-toolbar">
                <button className="back-to-documents" type="button" onClick={onBack}><ArrowLeft size={16} /> Your documents</button>
                <div className="ai-document-title"><FileText size={15} /><span title={document.filename}>{document.filename}</span></div>
            </div>

            <section className="ai-chat-layout">
                <aside className="conversation-sidebar" aria-label="Saved conversations">
                    <button className="new-conversation-button" type="button" onClick={startNewConversation} disabled={isSending}>
                        <Plus size={16} /> New conversation
                    </button>
                    <div className="conversation-list-heading"><span>RECENT CHATS</span><MessageSquareText size={14} /></div>
                    {isLoadingConversations ? (
                        <div className="conversation-list-state"><LoaderCircle className="spinner" size={16} /> Loading…</div>
                    ) : conversations.length === 0 ? (
                        <p className="conversation-list-empty">Your document conversations will appear here.</p>
                    ) : (
                        <div className="conversation-list">
                            {conversations.map((conversation) => (
                                <button
                                    className={`conversation-item${activeConversationId === conversation.id ? ' active' : ''}`}
                                    key={conversation.id}
                                    type="button"
                                    onClick={() => void openConversation(conversation.id)}
                                    disabled={isSending}
                                >
                                    <span className="conversation-item-title">{getConversationLabel(conversation)}</span>
                                    <span className="conversation-item-meta">{conversation.messageCount} messages</span>
                                </button>
                            ))}
                        </div>
                    )}
                    <div className="conversation-sidebar-footer"><Sparkles size={14} /> Answers grounded in this PDF</div>
                </aside>

                <section className="ai-chat-main" aria-label="Ask this document">
                    <div className="ai-chat-heading">
                        <span className="assistant-mark"><Bot size={18} /></span>
                        <div><strong>Ask this document</strong><span>Responses use relevant passages from the PDF.</span></div>
                    </div>

                    {error && <p className="workspace-alert error-alert ai-chat-error" role="alert">{error}</p>}
                    {signOutError && <p className="workspace-alert error-alert ai-chat-error" role="alert">{signOutError}</p>}

                    <div className="chat-scroll-area">
                        {isLoadingMessages ? (
                            <div className="ai-chat-state"><LoaderCircle className="spinner" size={20} /><span>Opening conversation…</span></div>
                        ) : messages.length === 0 ? (
                            <div className="ai-empty-state">
                                <span className="ai-empty-icon"><Sparkles size={21} /></span>
                                <h1>What would you like to know?</h1>
                                <p>Ask a question about the content, details, or conclusions in this document.</p>
                                <div className="suggested-questions">
                                    {['Summarize the key points', 'What conclusions does it reach?', 'Find important dates or numbers'].map((suggestion) => (
                                        <button key={suggestion} type="button" onClick={() => setDraft(suggestion)} disabled={isSending}>{suggestion}<ArrowUp size={13} /></button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="chat-messages">
                                {messages.map((message) => (
                                    <article className={`chat-message ${message.role}`} key={message.id}>
                                        {message.role === 'assistant' && <span className="message-avatar"><Bot size={15} /></span>}
                                        <div className="message-content">
                                            {message.pending ? (
                                                <div className="thinking-indicator"><span /><span /><span /> Reading the document…</div>
                                            ) : (
                                                <p>{message.content}</p>
                                            )}
                                            {message.sources && message.sources.length > 0 && (
                                                <details className="source-details">
                                                    <summary>{message.sources.length} source {message.sources.length === 1 ? 'passage' : 'passages'}</summary>
                                                    <div className="source-list">
                                                        {message.sources.map((source, index) => <blockquote key={`${message.id}-source-${index}`}>{source}</blockquote>)}
                                                    </div>
                                                </details>
                                            )}
                                        </div>
                                    </article>
                                ))}
                                <div ref={endOfMessagesRef} />
                            </div>
                        )}
                    </div>

                    <form className="ai-composer" onSubmit={sendQuestion}>
                        <label className="visually-hidden" htmlFor="ai-question">Ask a question about this document</label>
                        <textarea
                            id="ai-question"
                            value={draft}
                            onChange={(event) => setDraft(event.target.value)}
                            onKeyDown={handleComposerKeyDown}
                            placeholder="Ask a question about this PDF…"
                            rows={2}
                            maxLength={10000}
                            disabled={isSending || isLoadingMessages}
                        />
                        <div className="ai-composer-footer">
                            <span>Enter to send · Shift + Enter for a new line</span>
                            <button className="send-question-button" type="submit" disabled={isSending || !draft.trim() || isLoadingMessages} aria-label="Send question" title="Send question">
                                {isSending ? <LoaderCircle className="spinner" size={17} /> : <ArrowUp size={17} />}
                            </button>
                        </div>
                    </form>
                </section>
            </section>
        </main>
    );
}