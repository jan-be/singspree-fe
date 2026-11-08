import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import WrapperPage from './WrapperPage';
import Avatar from '../components/Avatar';
import { useAvatarEditor } from '../components/AvatarEditor';
import { useAuth } from '../logic/AuthContext';
import {
  lookupEmail, startEmailCode, verifyEmailCode, loginPassword, loginPasskey, registerPasskey, uploadAvatar,
  passkeysSupported, passkeyAutofillSupported, isCancelled, thrownField,
  getSignInProviders, startGoogle, getGoogleSignup, finishGoogleSignup,
} from '../logic/authApi';
import { staysAfterSignIn, uploadSignupPicture } from '../logic/signupPicture';
import { inTvApp } from '../logic/tvApp';
import type { Me } from '../logic/authApi';
import type { Translate } from '../types/i18n';

/**
 * Translated message for an ApiError (falls back to the server's English text). It reads an ApiError's code and
 * message, or any Error's message.
 */
export const errorMessage = (t: Translate, e: unknown) => {
  const message = thrownField(e, 'message');
  return t(`auth.errors.${thrownField(e, 'code') ?? 'network'}`, { defaultValue: (typeof message === 'string' && message) || t('auth.errors.network') });
};

const CameraIcon = ({ size = 11 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" />
  </svg>
);

const PasskeyIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="10" cy="7" r="4" />
    <path d="M3 21v-2a5 5 0 0 1 5-5h3" />
    <circle cx="17.5" cy="15.5" r="2.5" />
    <path d="M19.5 17.5 22 20l-1.5 1.5L19 20" />
  </svg>
);

/** Google's own mark, in its own colours (their branding rules want it as it is) */
const GoogleLogo = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59A14.5 14.5 0 0 1 9.5 24c0-1.59.28-3.14.76-4.59l-7.98-6.19A23.9 23.9 0 0 0 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
);

const inputClass = 'field h-12 px-4';
// The six digits: big and spaced; the extra left padding makes up for the spacing after the last digit
const codeInputClass = 'field h-14 pl-[calc(1rem+0.4em)] pr-4 text-center font-mono text-2xl font-semibold tracking-[0.4em]';
const labelClass = 'block text-xs font-medium text-white/55 mb-1.5';
const hintClass = 'text-xs text-white/45 mt-1.5';
const primaryClass = 'btn btn-primary btn-lg w-full';
const secondaryClass = 'btn btn-ghost w-full';
const linkClass = 'text-sm text-white/55 hover:text-white underline decoration-white/20 underline-offset-4 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
const smallLinkClass = linkClass.replace('text-sm', 'text-xs');
const looksLikeEmail = (s: string) =>/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim());

/**
 * Sign in or sign up (/login and /register are the same page): the address
 * and one button. After the click the account decides what comes next: a
 * passkey prompt when it has one, the password field when it set one (with
 * "send me a code instead"), otherwise a mailed six-digit code, which signs
 * in or, for a new address, asks for a display name and creates the account.
 * A profile picture can be picked next to the name: held here until the
 * account exists, then uploaded (logic/signupPicture.ts). Links from the mail
 * (/login#email=…&code=…, in the fragment so that no server's log has them; the
 * link's old form still reads) fill in the code and wait for the button: opened by
 * itself, a link someone else sent would sign this browser in to their
 * account and hand them what it sang as a guest. A new account made with an
 * address is offered a passkey before leaving, one made with Google is not.
 *
 * Or Google, where the server has it (backend googleSignIn.ts): the browser
 * goes there and comes back to the page it was headed for, or here at
 * ?google=name when that person needs a display name first, or at
 * ?google_error=… when it did not work.
 */
const AuthPage = () => {
  const { t, i18n } = useTranslation();
  const { user: me, setUser } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const nextParam = params.get('next');
  const next = nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/';

  const supported = passkeysSupported();
  const googleName = params.get('google') === 'name'; // back from Google, with no account yet
  // After signing up: one tap on Google is all a Google account needs next time, the offer is for typing a code
  const offerPasskey = supported && !googleName;
  const [mailed] = useState(() => {
    const link = new URLSearchParams(window.location.hash.slice(1));
    return { email: link.get('email') ?? params.get('email'), code: link.get('code') ?? params.get('code') };
  });
  const [step, setStep] = useState(mailed.code ? 'code' : googleName ? 'name' : 'start'); // start | password | code | name | passkey
  const [email, setEmail] = useState(mailed.email ?? '');
  const [username, setUsername] = useState('');
  const [code, setCode] = useState(mailed.code ?? '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(() => {
    const google = params.get('google_error');
    return google ? t(`auth.errors.google_${google}`, { defaultValue: t('auth.errors.google_failed') }) : null;
  });
  const [notice, setNotice] = useState<string | null>(null);
  const [googleOffered, setGoogleOffered] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  // The new account's picture, picked next to the name: { blob, url } until the account exists
  const [picture, setPicture] = useState<{ blob: Blob; url: string } | null>(null);
  const [pictureFailed, setPictureFailed] = useState(false);
  const doneRef = useRef(false);

  // The preview's object URL of a picture replaced, removed or left behind is let go
  useEffect(() => () => { if (picture) URL.revokeObjectURL(picture.url); }, [picture]);
  const editor = useAvatarEditor({
    onPicked: (blob: Blob) => setPicture({ blob, url: URL.createObjectURL(blob) }),
    onError: (text: string) => setError(text),
  });

  const leave = () => { if (!doneRef.current) { doneRef.current = true; navigate(next, { replace: true }); } };
  const done = (user: Me, created: boolean, pictureLost = false) => {
    setUser(user);
    setPictureFailed(pictureLost);
    // A new account: offer the shortcut for next time, and say so if its picture did not save
    if (staysAfterSignIn({ created, passkeys: offerPasskey, pictureFailed: pictureLost })) setStep('passkey');
    else leave();
  };
  const fail = (e: unknown) => { if (!isCancelled(e)) setError(errorMessage(t, e)); };
  const run = async (fn: () => Promise<unknown>) => {
    setError(null); setBusy(true);
    try { await fn(); } catch (e) { fail(e); } finally { setBusy(false); }
  };

  // (not in the Fire TV app: Google refuses to sign in inside a WebView)
  useEffect(() => { getSignInProviders().then(p => setGoogleOffered(p.google && !inTvApp())).catch(() => {}); }, []);

  // The code has been read: it does not stay in the address bar and the browser's history
  useEffect(() => {
    if (window.location.hash.includes('code=')) window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
  }, []);

  // Back from Google without an account: the address it vouches for and a name to start from
  useEffect(() => {
    if (!googleName) return;
    getGoogleSignup()
      .then(signup => { setEmail(signup.email); setUsername(signup.name); })
      .catch(e => { setStep('start'); fail(e); });
  }, [googleName]); // eslint-disable-line react-hooks/exhaustive-deps

  // Let the browser offer saved passkeys inside the e-mail field
  useEffect(() => {
    if (!supported || step !== 'start') return;
    let active = true;
    passkeyAutofillSupported().then(ok => {
      if (!ok || !active) return;
      loginPasskey({ useBrowserAutofill: true }).then(user => { if (active) done(user, false); }).catch(() => { /* aborted by a manual attempt or navigation */ });
    });
    return () => { active = false; };
  }, [supported, step]); // eslint-disable-line react-hooks/exhaustive-deps

  const sendCode = async () => {
    const r = await startEmailCode(email.trim(), i18n.language);
    setDevCode(r.devCode ?? null);
    setCode('');
    setNotice(step === 'code' ? t('auth.codeResent') : null);
    setStep('code');
  };

  /** The one button: passkey → password → code, whichever the account has. */
  const proceed = (e: React.FormEvent) => {
    e.preventDefault();
    if (!looksLikeEmail(email)) return;
    run(async () => {
      const account = await lookupEmail(email.trim());
      if (account.hasPasskey && supported) {
        try { done(await loginPasskey({ email: email.trim() }), false); return; }
        catch (err) { if (!(isCancelled(err) || thrownField(err, 'code') === 'no_passkeys')) throw err; } // dismissed: fall through
      }
      if (account.hasPassword) { setPassword(''); setStep('password'); return; }
      await sendCode();
    });
  };

  const verify = (name?: string) => {
    if (!/^\d{6}$/.test(code.trim())) return;
    run(async () => {
      try {
        const r = await verifyEmailCode(email.trim(), code.trim(), name);
        if (r.needsUsername) { setStep('name'); return; }
        // Signed in from here on, whatever the picture does
        const { user, failed } = r.created ? await uploadSignupPicture(r.user, picture?.blob ?? null, uploadAvatar) : { user: r.user, failed: null };
        done(user, r.created, Boolean(failed));
      } catch (err) {
        const why = thrownField(err, 'code');
        if (why === 'username_taken' || why === 'username_invalid') { setStep('name'); setError(errorMessage(t, err)); return; }
        throw err;
      }
    });
  };

  /** The name step's button: makes the account the address or Google stands for */
  const createAccount = (name: string) => {
    if (!googleName) { verify(name); return; }
    run(async () => {
      try {
        const r = await finishGoogleSignup(name);
        const { user, failed } = await uploadSignupPicture(r.user, picture?.blob ?? null, uploadAvatar);
        done(user, true, Boolean(failed));
      } catch (err) {
        if (thrownField(err, 'code') === 'username_taken' || thrownField(err, 'code') === 'username_invalid') { setError(errorMessage(t, err)); return; }
        throw err;
      }
    });
  };

  const title = step === 'passkey' ? (offerPasskey ? t('auth.passkeyOfferTitle') : t('auth.welcome', { name: me?.username ?? username.trim() })) : (step === 'name' ? t('auth.createAccount') : t('auth.title'));
  const errorLine = error && <div className="rounded-xl bg-red-500/10 border border-red-500/25 px-3.5 py-2.5 text-red-300 text-sm text-center" role="alert">{error}</div>;
  const changeAddress = (
    <button type="button" onClick={() => { setStep('start'); setCode(''); setPassword(''); setError(null); setNotice(null); }} className={linkClass}>
      {t('auth.changeEmail')}
    </button>
  );

  return (
    <WrapperPage>
      <div className="max-w-md mx-auto sm:py-6">
        <div className="relative overflow-hidden rounded-3xl bg-panel border border-white/10 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.8)]">
          {/* stage light from above */}
          <div className="absolute inset-x-0 top-0 h-48 pointer-events-none bg-[radial-gradient(360px_180px_at_50%_0%,rgba(255,79,216,0.16),transparent_70%)]" aria-hidden="true" />
          <div className="relative p-6 sm:p-8">
            <h1 className="text-[1.75rem] sm:text-3xl font-bold tracking-[-0.02em] text-white text-center mb-2 leading-tight text-balance">
              {title}
            </h1>

            {/* ── Start: the address and one button ── */}
            {step === 'start' && (
              <form onSubmit={proceed} className="space-y-5 mt-6">
                <div>
                  <label htmlFor="auth-email" className={labelClass}>{t('auth.email')}</label>
                  <input id="auth-email" type="email" value={email} onChange={e => { setEmail(e.target.value); setError(null); }}
                    autoComplete="email webauthn" inputMode="email" autoCapitalize="none" spellCheck={false} maxLength={254} autoFocus className={inputClass} />
                  <p className={hintClass}>{t('auth.oneButtonHint')}</p>
                </div>
                {errorLine}
                <button type="submit" disabled={busy || !looksLikeEmail(email)} className={primaryClass}>
                  {busy ? t('auth.working') : t('auth.continue')}
                </button>
                {googleOffered && (
                  <>
                    <div className="flex items-center gap-3 text-xs text-white/45" aria-hidden="true">
                      <span className="h-px flex-1 bg-white/10" />{t('auth.or')}<span className="h-px flex-1 bg-white/10" />
                    </div>
                    <button type="button" onClick={() => run(() => startGoogle({ next }))} disabled={busy} data-google-signin="" className="btn btn-lg w-full bg-white text-[#1f1f1f] hover:bg-white/90 hover:text-[#1f1f1f]">
                      <GoogleLogo />{t('auth.continueWithGoogle')}
                    </button>
                  </>
                )}
              </form>
            )}

            {/* ── Password: the account set one; a code is one click away ── */}
            {step === 'password' && (
              <form onSubmit={(e) => { e.preventDefault(); if (password) run(async () => done(await loginPassword(email.trim(), password), false)); }} className="space-y-4 mt-4">
                <p className="text-sm text-white/65 text-center truncate">{email.trim()}</p>
                <div>
                  <label htmlFor="auth-password" className={labelClass}>{t('auth.password')}</label>
                  <input id="auth-password" type="password" value={password} onChange={e => { setPassword(e.target.value); setError(null); }}
                    autoComplete="current-password" autoFocus className={inputClass} />
                </div>
                {errorLine}
                <button type="submit" disabled={busy || !password} className={primaryClass}>
                  {busy ? t('auth.working') : t('auth.signIn')}
                </button>
                <button type="button" onClick={() => run(sendCode)} disabled={busy} className={secondaryClass}>
                  {t('auth.sendCodeInstead')}
                </button>
                <div className="flex justify-center pt-1">{changeAddress}</div>
              </form>
            )}

            {/* ── Code: six digits from the mail ── */}
            {step === 'code' && (
              <form onSubmit={(e) => { e.preventDefault(); verify(); }} className="space-y-4 mt-4">
                <p className="text-sm text-white/65 text-center break-words">{t('auth.codeSentTo', { email: email.trim() })}</p>
                {devCode && <p className="text-xs text-amber-300/80 text-center">{t('auth.devCode', { code: devCode })}</p>}
                <div>
                  <label htmlFor="auth-code" className={labelClass}>{t('auth.code')}</label>
                  <input id="auth-code" type="text" value={code} onChange={e => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(null); }}
                    inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={6} autoFocus
                    className={codeInputClass} />
                </div>
                {notice && <div className="rounded-xl bg-emerald-400/10 border border-emerald-400/20 px-3.5 py-2.5 text-emerald-200 text-sm text-center">{notice}</div>}
                {errorLine}
                <button type="submit" disabled={busy || code.trim().length !== 6} className={primaryClass}>
                  {busy ? t('auth.working') : t('auth.continue')}
                </button>
                <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 pt-1">
                  <button type="button" onClick={() => run(sendCode)} disabled={busy} className={linkClass}>{t('auth.sendAgain')}</button>
                  {changeAddress}
                </div>
              </form>
            )}

            {/* ── Name: a new address (or a taken name) ── */}
            {step === 'name' && (
              <form onSubmit={(e) => { e.preventDefault(); if (username.trim()) createAccount(username.trim()); }} className="space-y-4 mt-4">
                <p className="text-sm text-white/65 text-center break-words">{t('auth.noAccountForEmail', { email: email.trim() })}</p>
                <div>
                  <label htmlFor="auth-username" className={labelClass}>{t('auth.displayName')}</label>
                  <div className="flex items-center gap-3">
                    {/* The picture, optional: the initial (in the name's colour) until one is picked */}
                    <button type="button" onClick={editor.choose} disabled={busy || editor.busy} className="relative flex rounded-full flex-shrink-0 group"
                      aria-label={picture ? t('avatar.change') : t('avatar.add')} title={picture ? t('avatar.change') : t('avatar.add')}>
                      <Avatar username={username.trim()} preview={picture?.url} size={48} className="text-xl transition-opacity group-hover:opacity-85" />
                      <span aria-hidden="true" className="absolute -right-1 -bottom-1 w-5 h-5 rounded-full fill-hot grid place-items-center ring-2 ring-panel">
                        <CameraIcon />
                      </span>
                    </button>
                    <input id="auth-username" type="text" value={username} onChange={e => { setUsername(e.target.value); setError(null); }}
                      autoComplete="nickname" autoCapitalize="none" spellCheck={false} maxLength={20} autoFocus className={`${inputClass} min-w-0 flex-1`} />
                  </div>
                  <p className={hintClass}>{t('auth.usernameHint')}</p>
                  <button type="button" onClick={picture ? () => setPicture(null) : editor.choose} disabled={busy || editor.busy}
                    className={`${smallLinkClass} mt-1.5`} data-testid="signup-picture">
                    {picture ? t('auth.removePicture') : t('auth.addPicture')}
                  </button>
                </div>
                {errorLine}
                <button type="submit" disabled={busy || !username.trim()} className={primaryClass}>
                  {busy ? t('auth.working') : t('auth.createAccount')}
                </button>
                {/* Creating the account is agreeing to the terms: said here, linked in a new tab so the form stays */}
                <p className="text-xs text-white/45 text-center leading-relaxed" data-testid="signup-terms">
                  <Trans
                    i18nKey="auth.agreeTerms"
                    components={{
                      tos: <Link to="/tos" target="_blank" rel="noopener" className="text-white/70 hover:text-white underline decoration-white/25 underline-offset-2" />,
                      privacy: <Link to="/privacy-policy" target="_blank" rel="noopener" className="text-white/70 hover:text-white underline decoration-white/25 underline-offset-2" />,
                    }}
                  />
                </p>
              </form>
            )}

            {/* ── After creating the account: the passkey offer, and word of a picture that did not save ── */}
            {step === 'passkey' && (
              <div className="space-y-4 mt-4 text-center">
                {pictureFailed && (
                  <div className="rounded-xl bg-amber-400/10 border border-amber-400/25 px-3.5 py-2.5 text-amber-100 text-sm" role="status" data-testid="picture-not-saved">
                    {t('auth.pictureNotSaved')}
                  </div>
                )}
                {offerPasskey ? (
                  <>
                    <p className="text-sm text-white/70">{t('auth.passkeyOfferText')}</p>
                    <p className="text-xs text-white/45">{t('auth.passkeyHint')}</p>
                    {errorLine}
                    <button type="button" onClick={() => run(async () => { setUser(await registerPasskey()); leave(); })} disabled={busy} className={primaryClass}>
                      <PasskeyIcon />{busy ? t('auth.working') : t('profile.addPasskey')}
                    </button>
                    <button type="button" onClick={leave} disabled={busy} className={linkClass}>{t('auth.notNow')}</button>
                  </>
                ) : (
                  <button type="button" onClick={leave} className={primaryClass}>{t('auth.continue')}</button>
                )}
              </div>
            )}
          </div>
        </div>
        {step === 'name' && editor.ui}
      </div>
    </WrapperPage>
  );
};

export default AuthPage;
