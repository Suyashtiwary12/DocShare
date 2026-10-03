import { useEffect, useState, type FormEvent } from 'react';
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  FileText,
  LockKeyhole,
  Mail,
  MessageCircle,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { apiRequest, type User } from './api';
import DocumentViewerPage from './DocumentViewerPage';
import DocumentWorkspace from './DocumentWorkspace';

type AuthMode = 'login' | 'register';

export default function App() {
  const location = useLocation();
  const [mode, setMode] = useState<AuthMode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [error, setError] = useState('');
  const isSharedRoute = location.pathname.startsWith('/shared/');

  useEffect(() => {
    let isCurrent = true;

    apiRequest<{ user: User }>('/auth/me')
      .then(({ user: currentUser }) => {
        if (isCurrent) setUser(currentUser);
      })
      .catch(() => undefined)
      .finally(() => {
        if (isCurrent) setIsCheckingSession(false);
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError('');
  }

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    const endpoint = mode === 'login' ? '/auth/login' : '/auth/register';
    const body = mode === 'login'
      ? { email: email.trim(), password }
      : { name: name.trim(), email: email.trim(), password };

    try {
      const result = await apiRequest<{ user: User }>(endpoint, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setUser(result.user);
      setPassword('');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function signOut() {
    setError('');
    setIsSubmitting(true);
    try {
      await apiRequest<{ message: string }>('/auth/logout', { method: 'POST' });
      setUser(null);
      setMode('login');
      setPassword('');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not sign out. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isCheckingSession) {
    return <main className="auth-page"><section className="form-panel"><div className="form-content"><p className="session-note">Checking your session…</p></div></section></main>;
  }

  if (!user && !isSharedRoute) {
    return (
      <main className="auth-page">
        <section className="story-panel" aria-label="DocuShare workspace">
          <header className="brand-lockup">
            <span className="brand-mark"><FileText size={18} strokeWidth={2.2} /></span>
            <span>DocuShare</span>
          </header>

          <div className="story-copy">
            <p className="eyebrow"><Sparkles size={14} /> DOCUMENTS, IN GOOD COMPANY</p>
            <h1>Make room for<br /><em>better thinking.</em></h1>
            <p className="story-description">
              Your documents, conversations, and collaborators in one considered workspace.
            </p>
          </div>

          <div className="workspace-preview" aria-hidden="true">
            <div className="preview-toolbar">
              <div className="preview-dots"><i /><i /><i /></div>
              <span>Q3 strategy brief.pdf</span>
              <span className="preview-page">08 / 24</span>
            </div>
            <div className="preview-body">
              <div className="paper-page">
                <span className="paper-kicker">FIELD NOTES · 2026</span>
                <div className="paper-title">A clearer way<br />to work together</div>
                <div className="paper-rule" />
                <div className="paper-line line-long" />
                <div className="paper-line line-mid" />
                <div className="paper-highlight">Good work gets better<br />when it is shared.</div>
                <div className="paper-line line-long" />
                <div className="paper-line line-short" />
              </div>
              <div className="comment-note">
                <span className="note-avatar">AM</span>
                <div><strong>Alex Morgan</strong><p>This is the part we should build around.</p></div>
                <MessageCircle size={15} />
              </div>
              <div className="preview-stamp"><Check size={13} /> SHARED WITH YOU</div>
            </div>
          </div>

          <footer className="story-footer">
            <span><ShieldCheck size={15} /> Private by default</span>
            <span>© 2026 DocuShare</span>
          </footer>
        </section>

        <section className="form-panel">
          <div className="form-topline">
            <span className="mobile-brand"><span className="brand-mark"><FileText size={17} /></span> DocuShare</span>
            <p>{mode === 'login' ? 'New to DocuShare?' : 'Already have an account?'}{' '}
              <button className="text-action" type="button" onClick={() => changeMode(mode === 'login' ? 'register' : 'login')}>
                {mode === 'login' ? 'Create an account' : 'Sign in'}
              </button>
            </p>
          </div>

          <div className="form-content">
            <div className="form-heading">
              <p className="eyebrow">YOUR WORKSPACE AWAITS</p>
              <h2>{mode === 'login' ? 'Welcome back.' : 'Start with a clean page.'}</h2>
              <p className="form-intro">
                {mode === 'login'
                  ? 'Sign in to pick up where your documents left off.'
                  : 'Create an account to bring your documents together.'}
              </p>
            </div>

            <div className="mode-switch" role="tablist" aria-label="Authentication mode">
              <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'active' : ''} onClick={() => changeMode('login')}>Sign in</button>
              <button type="button" role="tab" aria-selected={mode === 'register'} className={mode === 'register' ? 'active' : ''} onClick={() => changeMode('register')}>Create account</button>
            </div>

            <form className="auth-form" onSubmit={submitAuth}>
              {mode === 'register' && (
                <label className="field-group">
                  <span className="field-label">Full name</span>
                  <span className="input-wrap"><input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" minLength={2} maxLength={100} required /></span>
                  <span className="field-hint">As it should appear to collaborators</span>
                </label>
              )}

              <label className="field-group">
                <span className="field-label">Email address</span>
                <span className="input-wrap input-with-icon"><Mail size={17} /><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" maxLength={320} required /></span>
              </label>

              <label className="field-group">
                <span className="field-label">Password</span>
                <span className="input-wrap input-with-icon"><LockKeyhole size={17} /><input type={showPassword ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" minLength={8} maxLength={72} required /><button className="icon-action" type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></span>
                {mode === 'register' && <span className="field-hint">Use 8 or more characters</span>}
              </label>

              {error && <p className="form-error" role="alert">{error}</p>}

              <button className="submit-button" type="submit" disabled={isSubmitting}>
                <span>{isSubmitting ? 'Please wait…' : mode === 'login' ? 'Sign in to workspace' : 'Create your account'}</span>
                <ArrowRight size={18} />
              </button>
            </form>

            <p className="secure-note"><LockKeyhole size={13} /> Secure, private access to your documents</p>
          </div>

          <footer className="form-footer">
            <span>Thoughtful work deserves a thoughtful space.</span>
            <a href="mailto:support@example.com">Need help?</a>
          </footer>
        </section>
      </main>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<DocumentWorkspace user={user ?? { id: '', name: 'Guest', email: '' }} isSigningOut={isSubmitting} signOutError={error} onSignOut={signOut} />} />
      <Route path="/documents/:documentId" element={<DocumentViewerPage user={user ?? { id: '', name: 'Guest', email: '' }} isSigningOut={isSubmitting} signOutError={error} onSignOut={signOut} />} />
      <Route path="/shared/:token" element={<DocumentViewerPage user={user ?? { id: '', name: 'Guest', email: '' }} isSigningOut={isSubmitting} signOutError={error} onSignOut={signOut} isSharedView />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}