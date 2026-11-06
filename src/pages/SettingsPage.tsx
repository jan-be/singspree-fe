import React, { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import WrapperPage from './WrapperPage';
import Avatar from '../components/Avatar';
import { useAvatarEditor } from '../components/AvatarEditor';
import { GlobeIcon, LockIcon, DuetIcon as FriendsIcon } from '../components/Icons';
import { HEADER_PICTURE, PageHeader, Section, TrashIcon, btn, hint, input, label, name as settingName, panelBox, sm, useDate, useSecondClick, type Note } from '../components/ProfileParts';
import { PRIVACY_SECTIONS, STATS_VISIBILITY, privacyOf } from '../logic/statsPrivacy';
import { useAuth } from '../logic/AuthContext';
import { renamePartySession } from '../logic/partySession';
import {
  registerPasskey, deletePasskey, updateAccount, deleteAccount, isCancelled, startEmailChange, verifyEmailChange,
  getSignInProviders, startGoogle, disconnectGoogle,
} from '../logic/authApi';
import { appDomain } from '../GlobalConsts';
import { deleteAllTakes, loadSaveRecordings, storeSaveRecordings } from '../logic/takes';
import { errorMessage } from './AuthPage';
import type { Me } from '../logic/authApi';
import type { PrivacySection as PrivacyPart, Visibility } from '../logic/statsPrivacy';

/**
 * Your settings (/settings): who sees which part of your profile and your
 * recordings, your account, and what is still being tried out. The profile
 * itself (/u/<you>, ProfilePage) looks the way others see it.
 */

type AvatarEditor = ReturnType<typeof useAvatarEditor>;

// ── Privacy ────────────────────────────────────────────────────────────

const PRIVACY_ICONS = { public: GlobeIcon, friends: FriendsIcon, private: LockIcon };
// The privacy panel's rows: the names the profile itself gives those parts
const SECTION_LABELS: Record<PrivacyPart, string> = { stats: 'privacy.numbers', best: 'profile.bestSongs', achievements: 'achievements.title', recent: 'profile.recent', recordings: 'privacy.recordingsLabel' };

/**
 * Who sees each part of your profile: everyone, friends, or only you
 * (logic/statsPrivacy.ts). Saved as soon as one is picked. The score you
 * sing in a party is the party's either way, which the note under the
 * choice says. Then your recordings: whether this browser keeps them (the
 * microphone panel's switch, logic/takes.ts) and deleting all of them.
 */
const PrivacySection = () => {
  const { t } = useTranslation();
  const { user, setUser } = useAuth();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note | null>(null); // { text, error? }
  const [takesNote, setTakesNote] = useState<Note | null>(null); // { text, error? }
  const [saveRecordings, setSaveRecordings] = useState(loadSaveRecordings);
  const confirmAll = useSecondClick();
  const settings = privacyOf(user);

  // Every recording of yours, also those of plays that saved no score (too short to count)
  const deleteRecordings = async () => {
    setBusy(true); setTakesNote(null);
    try {
      const count = await deleteAllTakes();
      setTakesNote({ text: t('privacy.recordingsDeleted', { count }) });
    } catch (e) {
      setTakesNote({ text: errorMessage(t, e), error: true });
    } finally { setBusy(false); }
  };

  const choose = async (section: PrivacyPart, value: Visibility) => {
    if (settings[section] === value) return;
    setBusy(true); setNote(null);
    try {
      setUser(await updateAccount({ privacy: { [section]: value } }));
      setNote({ text: t('privacy.saved') });
    } catch (e) {
      setNote({ text: errorMessage(t, e), error: true });
    } finally { setBusy(false); }
  };

  return (
    <Section id="privacy" title={t('privacy.title')}>
      <div className={panelBox}>
        <div className="flex items-center justify-between gap-3 mb-3 min-h-5">
          <div className={label}>{t('privacy.whoSees')}</div>
          {note && <span role={note.error ? 'alert' : 'status'} className={`text-xs ${note.error ? 'text-red-300' : 'text-emerald-200'}`}>{note.text}</span>}
        </div>
        {/* Each part of the profile on its own: everyone, friends, or you alone */}
        <div className="divide-y divide-white/[0.07]">
          {PRIVACY_SECTIONS.map(({ key }) => (
            <div key={key} data-privacy-section={key} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 py-3 first:pt-1 last:pb-1">
              <div className="min-w-0">
                <div id={`privacy-${key}`} className={settingName}>{t(SECTION_LABELS[key])}</div>
                <div className={`${hint} mt-0.5`}>{t(`privacy.sectionHint.${key}`)}</div>
              </div>
              <div role="radiogroup" aria-labelledby={`privacy-${key}`} className="inline-flex self-start sm:self-auto flex-shrink-0 rounded-full bg-white/[0.06] border border-white/10 p-0.5">
                {STATS_VISIBILITY.map(v => {
                  const Icon = PRIVACY_ICONS[v];
                  const on = settings[key] === v;
                  return (
                    <label key={v} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-white/70 ${
                      on ? 'fill-hot shadow-none text-white' : 'text-white/60 hover:text-white'} ${busy ? 'opacity-60' : 'cursor-pointer'}`}>
                      <input type="radio" name={`privacy-${key}`} value={v} checked={on} disabled={busy} onChange={() => choose(key, v)} className="sr-only" />
                      <Icon size={13} />{t(`privacy.${v}`)}
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <p className={`${hint} mt-3`}>{t('privacy.partyNote')}</p>

        {/* This browser's switch, the same as the microphone panel's */}
        <div className="mt-5 pt-4 border-t border-white/10 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div id="settings-save-recordings" className={settingName}>{t('mic.saveRecordings')}</div>
            <p id="settings-save-recordings-hint" className={`${hint} mt-0.5`}>{t('settings.saveRecordingsHint')}</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={saveRecordings}
            aria-labelledby="settings-save-recordings"
            aria-describedby="settings-save-recordings-hint"
            data-save-recordings=""
            onClick={() => { storeSaveRecordings(!saveRecordings); setSaveRecordings(!saveRecordings); }}
            className="switch flex-shrink-0 mt-0.5"
          />
        </div>

        <div className="mt-5 pt-4 border-t border-white/10">
          <div className="flex items-start justify-between gap-3">
            <p className={hint}>{t('privacy.recordingsHint', { setting: t('mic.saveRecordings'), best: t('profile.bestSongs'), recent: t('profile.recent') })}</p>
            {takesNote && <span role={takesNote.error ? 'alert' : 'status'} className={`text-xs flex-shrink-0 ${takesNote.error ? 'text-red-300' : 'text-emerald-200'}`}>{takesNote.text}</span>}
          </div>
          <button type="button" onClick={() => confirmAll.press(deleteRecordings)} disabled={busy} data-delete-all-takes="" aria-pressed={confirmAll.armed}
            className={`${sm(btn.danger)} mt-3 ${confirmAll.armed ? 'text-red-200 bg-red-500/15 border-red-400/40 animate-pulse' : ''}`}>
            <TrashIcon />{confirmAll.armed ? t('privacy.deleteRecordingsConfirm') : t('privacy.deleteRecordings')}
          </button>
        </div>
      </div>
    </Section>
  );
};

// ── Account ────────────────────────────────────────────────────────────

/**
 * Your picture in the account panel: the circle as others see it, and the
 * buttons to add, change or remove it (the profile's header opens the same
 * editor from its picture).
 */
const PictureRow = ({ user, editor, note }: { user: Me; editor: AvatarEditor; note: Note | null }) => {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-4">
      <Avatar username={user.username} src={user.avatar} size={56} />
      <div className="min-w-0 flex-1">
        <div className={label}>{t('avatar.title')}</div>
        <div className="flex flex-wrap gap-2 mt-2">
          <button type="button" disabled={editor.busy} onClick={editor.choose} className={sm(user.avatar ? btn.quiet : btn.primary)}>
            {user.avatar ? t('avatar.change') : t('avatar.add')}
          </button>
          {user.avatar && <button type="button" disabled={editor.busy} onClick={editor.remove} className={sm(btn.danger)}>{t('avatar.remove')}</button>}
        </div>
        <p className={`${hint} mt-1.5`}>{t('avatar.hint')}</p>
        {note && <p className={`text-xs mt-1.5 ${note.error ? 'text-red-300' : 'text-emerald-200'}`} role={note.error ? 'alert' : undefined}>{note.text}</p>}
      </div>
    </div>
  );
};

const rowTop = 'pt-6 border-t border-white/[0.07]';
/** A note under a row: what worked, or what did not */
const RowNote = ({ note }: { note: Note | null }) => (note
  ? <p className={`text-xs mt-1.5 ${note.error ? 'text-red-300' : 'text-emerald-200'}`} role={note.error ? 'alert' : 'status'}>{note.text}</p>
  : null);

/**
 * Your address, and changing it: the new one counts once the code mailed to it
 * is typed in here. The old one hears of it, and other devices are signed out.
 */
const EmailRow = ({ user }: { user: Me }) => {
  const { t, i18n } = useTranslation();
  const { setUser } = useAuth();
  const [step, setStep] = useState<'shown' | 'address' | 'code'>('shown');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note | null>(null);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setNote(null);
    try { await fn(); } catch (e) { setNote({ text: errorMessage(t, e), error: true }); } finally { setBusy(false); }
  };
  const back = () => { setStep('shown'); setEmail(''); setCode(''); setDevCode(null); setNote(null); };
  const cancel = <button type="button" onClick={back} disabled={busy} className={btn.quiet}>{t('avatar.cancel')}</button>;
  return (
    <div className={rowTop} data-email-row="">
      <div className={label}>{t('auth.email')}</div>
      {step === 'shown' && (
        <div className="flex items-center justify-between gap-3 mt-1">
          <div className="text-sm text-white truncate">{user.email ?? t('settings.noEmail')}</div>
          <button type="button" onClick={() => { setNote(null); setStep('address'); }} className={sm(btn.quiet)}>{t('settings.changeEmail')}</button>
        </div>
      )}
      {step === 'address' && (
        <form className="mt-1.5" onSubmit={e => { e.preventDefault(); run(async () => { setDevCode((await startEmailChange(email.trim(), i18n.language)).devCode ?? null); setStep('code'); }); }}>
          <div className="flex flex-wrap gap-2">
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={t('settings.newEmail')} aria-label={t('settings.newEmail')} autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} maxLength={254} autoFocus className={`${input} flex-1 min-w-48`} />
            <button type="submit" disabled={busy || !email.trim()} className={btn.quiet}>{t('settings.sendCode')}</button>
            {cancel}
          </div>
          <p className={`${hint} mt-1.5`}>{t('settings.emailHint')}</p>
        </form>
      )}
      {step === 'code' && (
        <form className="mt-1.5" onSubmit={e => { e.preventDefault(); run(async () => { const updated = await verifyEmailChange(email.trim(), code, i18n.language); setUser(updated); back(); setNote({ text: t('settings.emailChanged') }); }); }}>
          <p className="text-sm text-white">{t('auth.codeSentTo', { email: email.trim() })}</p>
          {devCode && <p className="text-xs text-amber-300/80 mt-1">{t('auth.devCode', { code: devCode })}</p>}
          <div className="flex flex-wrap gap-2 mt-2">
            <input type="text" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder={t('auth.code')} aria-label={t('auth.code')} inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus className={`${input} flex-1 min-w-32 font-mono tracking-[0.3em]`} />
            <button type="submit" disabled={busy || code.length !== 6} className={btn.quiet}>{t('settings.confirmEmail')}</button>
            {cancel}
          </div>
        </form>
      )}
      <RowNote note={note} />
    </div>
  );
};

/** The Google account that signs in here, where the server has that (backend googleSignIn.ts) */
const GoogleRow = ({ user }: { user: Me }) => {
  const { t } = useTranslation();
  const { setUser } = useAuth();
  const [offered, setOffered] = useState(false);
  const [busy, setBusy] = useState(false);
  const [params, setParams] = useSearchParams();
  const [note, setNote] = useState<Note | null>(null);
  useEffect(() => { getSignInProviders().then(p => setOffered(p.google)).catch(() => {}); }, []);
  // Back from Google: how it went, once, and off the address
  useEffect(() => {
    const why = params.get('google_error');
    if (!why && !params.get('google')) return;
    setNote(why ? { text: t(`auth.errors.google_${why}`, { defaultValue: t('auth.errors.google_failed') }), error: true } : { text: t('settings.googleConnected') });
    setParams(p => { const n = new URLSearchParams(p); n.delete('google'); n.delete('google_error'); return n; }, { replace: true });
  }, [params, setParams, t]);
  if (!offered && !user.google) return null;
  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setNote(null);
    try { await fn(); } catch (e) { setNote({ text: errorMessage(t, e), error: true }); } finally { setBusy(false); }
  };
  return (
    <div className={rowTop} data-google-row="">
      <div className={label}>Google</div>
      <div className="flex items-center justify-between gap-3 mt-1">
        <div className={`text-sm truncate ${user.google ? 'text-white' : 'text-white/60'}`}>{user.google ? (user.google.email ?? t('settings.googleOn')) : t('settings.googleOff')}</div>
        {user.google
          ? <button type="button" disabled={busy} onClick={() => run(async () => { setUser(await disconnectGoogle()); })} className={sm(btn.danger)}>{t('settings.googleDisconnect')}</button>
          : <button type="button" disabled={busy} onClick={() => run(() => startGoogle({ next: '/settings', link: true }))} className={sm(btn.quiet)}>{t('settings.googleConnect')}</button>}
      </div>
      <RowNote note={note} />
    </div>
  );
};

/** `user`: the signed-in account */
const AccountSection = ({ user, editor, avatarNote }: { user: Me; editor: AvatarEditor; avatarNote: Note | null }) => {
  const { t } = useTranslation();
  const fmt = useDate();
  const navigate = useNavigate();
  const { setUser, refresh, logout } = useAuth();
  const [keyName, setKeyName] = useState('');
  const [busy, setBusy] = useState(false);
  const confirmDelete = useSecondClick();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [next, setNext] = useState('');
  const [name, setName] = useState(user.username);
  const inviteUrl = `https://${appDomain}/u/${encodeURIComponent(user.username)}?add=1`;

  const rename = (e: React.FormEvent) => {
    e.preventDefault();
    const wanted = name.trim();
    if (!wanted || wanted === user.username) return;
    run(async () => {
      const updated = await updateAccount({ username: wanted });
      renamePartySession(user.username, updated.username); // a party this tab is in comes back under the new name
      setUser(updated);
      setMsg(t('profile.displayNameSaved'));
    });
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setErr(null); setMsg(null);
    try { await fn(); } catch (e) { if (!isCancelled(e)) setErr(errorMessage(t, e)); } finally { setBusy(false); }
  };

  const copyInvite = async () => {
    try { await navigator.clipboard.writeText(inviteUrl); setMsg(t('profile.inviteCopied')); }
    catch { window.prompt(t('profile.inviteLink'), inviteUrl); }
  };

  return (
    <Section id="account" title={t('profile.account')} aside={<button type="button" onClick={async () => { await logout(); navigate('/'); }} className={sm(btn.quiet)}>{t('auth.signOut')}</button>}>
      <div className={`${panelBox} space-y-6`}>
        <PictureRow user={user} editor={editor} note={avatarNote} />

        <form className={`space-y-2 ${rowTop}`} onSubmit={rename}>
          <div className={label}>{t('auth.displayName')}</div>
          <div className="flex gap-2">
            <input type="text" value={name} onChange={e => setName(e.target.value)} autoComplete="nickname" autoCapitalize="none" spellCheck={false} maxLength={20} className={input} />
            <button type="submit" disabled={busy || !name.trim() || name.trim() === user.username} className={btn.quiet}>{t('profile.save')}</button>
          </div>
          <p className={hint}>{t('auth.usernameHint')}</p>
        </form>

        <EmailRow user={user} />
        <GoogleRow user={user} />

        <div className={rowTop}>
          <div className={`${label} mb-2`}>{t('profile.passkeys')}</div>
          {user.passkeys.length === 0
            ? <p className="text-sm text-white/60">{t('profile.noPasskeys')}</p>
            : (
              <ul className="rounded-xl border border-white/10 divide-y divide-white/[0.07] overflow-hidden">
                {user.passkeys.map(k => (
                  <li key={k.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm">
                    <div className="min-w-0">
                      <div className="text-white font-medium truncate">{k.name || t('profile.unnamedPasskey')}{k.backedUp ? ' ☁' : ''}</div>
                      <div className={hint}>{k.lastUsedAt ? t('profile.lastUsed', { date: fmt(k.lastUsedAt) }) : t('profile.neverUsed')}</div>
                    </div>
                    <button type="button" disabled={busy} onClick={() => run(async () => { await deletePasskey(k.id); await refresh(); })} className={sm(btn.danger)}>{t('profile.remove')}</button>
                  </li>
                ))}
              </ul>
            )}
          <form className="flex gap-2 mt-3" onSubmit={e => { e.preventDefault(); run(async () => { setUser(await registerPasskey({ name: keyName.trim() })); setKeyName(''); }); }}>
            <input type="text" value={keyName} onChange={e => setKeyName(e.target.value)} placeholder={t('profile.passkeyName')} maxLength={60} className={input} />
            <button type="submit" disabled={busy} className={btn.quiet}>{t('profile.addPasskey')}</button>
          </form>
        </div>

        <form className={`space-y-2 ${rowTop}`} onSubmit={e => { e.preventDefault(); run(async () => { setUser(await updateAccount({ newPassword: next })); setNext(''); setMsg(t('profile.passwordSaved')); }); }}>
          <div className={label}>{user.hasPassword ? t('profile.changePassword') : t('profile.setPassword')}</div>
          <div className="flex gap-2">
            <input type="password" value={next} onChange={e => setNext(e.target.value)} placeholder={t('auth.newPassword')} autoComplete="new-password" minLength={8} className={input} />
            <button type="submit" disabled={busy || next.length < 8} className={btn.quiet}>{t('profile.save')}</button>
          </div>
          <p className={hint}>{t('auth.passwordHint')}</p>
        </form>

        <div className={`${rowTop} flex flex-wrap items-center justify-between gap-x-6 gap-y-2`}>
          <div className="min-w-0">
            <div className={settingName}>{t('profile.inviteLink')}</div>
            <div className={`${hint} mt-0.5`}>{t('profile.inviteHint')}</div>
          </div>
          <button type="button" onClick={copyInvite} className={btn.quiet}>{t('settings.copyInvite')}</button>
        </div>

        {msg && <div className="rounded-xl bg-emerald-400/10 border border-emerald-400/20 px-3.5 py-2.5 text-sm text-emerald-200">{msg}</div>}
        {err && <div className="rounded-xl bg-red-500/10 border border-red-500/25 px-3.5 py-2.5 text-sm text-red-300" role="alert">{err}</div>}

        {/* A second click within 3 seconds deletes; meanwhile it says what that does */}
        <div className={`${rowTop} flex flex-wrap items-center gap-x-3 gap-y-2`}>
          <button
            type="button"
            disabled={busy}
            onClick={() => confirmDelete.press(() => run(async () => { await deleteAccount(); setUser(null); navigate('/'); }))}
            aria-pressed={confirmDelete.armed}
            aria-describedby={confirmDelete.armed ? 'delete-account-warning' : undefined}
            data-delete-account=""
            className={`${sm('btn btn-stop')} ${confirmDelete.armed ? 'animate-pulse' : ''}`}
          >
            {confirmDelete.armed ? t('profile.deleteRecordingConfirm') : t('profile.deleteAccount')}
          </button>
          {confirmDelete.armed && <p id="delete-account-warning" role="alert" className="text-xs text-red-300">{t('profile.deleteConfirm')}</p>}
        </div>
      </div>
    </Section>
  );
};

// ── Experimental ───────────────────────────────────────────────────────

const CameraIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="6" width="14" height="12" rx="2" /><path d="M16 10l6-3v10l-6-3z" />
  </svg>
);

const ChipIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="6" y="6" width="12" height="12" rx="2" /><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" />
  </svg>
);

/** One switch of the section: its name, what it does, and whether it is on */
const ExperimentalSwitch = ({ id, icon, on, busy, onToggle, first }: {
  /** the names' element ids (`<id>`, `<id>-hint`) and the settings keys (`settings.<camelId>`) */
  id: 'influencer-mode' | 'rust-party-page';
  icon: React.ReactNode;
  on: boolean;
  busy: boolean;
  onToggle: () => void;
  first?: boolean;
}) => {
  const { t } = useTranslation();
  const key = id === 'influencer-mode' ? 'influencerMode' : 'rustPartyPage';
  return (
    <div className={`flex items-start justify-between gap-4 pt-3 border-t border-white/[0.07] ${first ? '' : 'mt-3'}`}>
      <div className="min-w-0">
        <div id={id} className={`${settingName} inline-flex items-center gap-2`}>{icon}{t(`settings.${key}`)}</div>
        <p id={`${id}-hint`} className={`${hint} mt-0.5`}>{t(`settings.${key}Hint`)}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-labelledby={id}
        aria-describedby={`${id}-hint`}
        disabled={busy}
        data-influencer-mode={id === 'influencer-mode' ? '' : undefined}
        data-rust-party-page={id === 'rust-party-page' ? '' : undefined}
        onClick={onToggle}
        className="switch flex-shrink-0 mt-0.5"
      />
    </div>
  );
};

/**
 * What is still being tried out, each on its own switch. Influencer mode:
 * the party's camera button (PartyPage, logic/cameraClip.ts), for share
 * videos with you in them; on for admins until they turn it off. The Rust
 * party page: parties open in the party page's Rust version instead of this
 * app's (logic/rustPartyPage.ts); off for everyone, admins too. Voices on the
 * speakers: a party of yours allows it, and each singer who turns theirs on
 * sends their microphone to the host's page, for its speakers
 * (usePartyVoices.ts); on for admins until they turn it off, and only for
 * them and the accounts let in, as a party of theirs uses a relay the site pays for.
 */
const ExperimentalSection = ({ user }: { user: Me }) => {
  const { t } = useTranslation();
  const { setUser } = useAuth();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note | null>(null);
  const save = async (changes: { influencerMode?: boolean; rustPartyPage?: boolean }) => {
    setBusy(true); setNote(null);
    try {
      setUser(await updateAccount(changes));
      setNote({ text: t('privacy.saved') });
    } catch (e) {
      setNote({ text: errorMessage(t, e), error: true });
    } finally { setBusy(false); }
  };
  return (
    <Section id="experimental" title={t('settings.experimental')}>
      <div className={panelBox}>
        <div className="flex items-center justify-between gap-3 mb-3 min-h-5">
          <p className={hint}>{t('settings.experimentalHint')}</p>
          {note && <span role={note.error ? 'alert' : 'status'} className={`text-xs flex-shrink-0 ${note.error ? 'text-red-300' : 'text-emerald-200'}`}>{note.text}</span>}
        </div>
        <ExperimentalSwitch id="influencer-mode" icon={<CameraIcon />} on={user.influencerMode} busy={busy}
          onToggle={() => save({ influencerMode: !user.influencerMode })} first />
        <ExperimentalSwitch id="rust-party-page" icon={<ChipIcon />} on={user.rustPartyPage} busy={busy}
          onToggle={() => save({ rustPartyPage: !user.rustPartyPage })} />
      </div>
    </Section>
  );
};

// ── Page ───────────────────────────────────────────────────────────────

const SettingsPage = () => {
  const { t } = useTranslation();
  const { user, loading, refresh: refreshMe } = useAuth();
  const [avatarNote, setAvatarNote] = useState<Note | null>(null);
  const editor = useAvatarEditor({
    onChange: () => { refreshMe(); },
    onMessage: (text) => setAvatarNote({ text }),
    onError: (text) => setAvatarNote({ text, error: true }),
  });
  const { hash } = useLocation();

  useEffect(() => { document.title = `${t('settings.title')} | SingSpree`; }, [t]);
  // The account menu links to #privacy and #account: there once the account is loaded
  useEffect(() => {
    if (!user || !hash) return;
    document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [user, hash]);

  if (loading) {
    return <WrapperPage><div className="text-white/40 text-sm text-center py-20 animate-pulse">{t('sections.loading')}</div></WrapperPage>;
  }
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(`/settings${hash}`)}`} replace />;

  return (
    <WrapperPage>
      <PageHeader
        picture={<Avatar username={user.username} src={user.avatar} size={HEADER_PICTURE} />}
        title={t('settings.title')}
        action={<Link to={`/u/${encodeURIComponent(user.username)}`} className={btn.quiet}>{t('settings.viewProfile')}</Link>}
      >
        <div className="text-sm text-white/60 mt-0.5 truncate">{user.username}</div>
      </PageHeader>

      <PrivacySection />
      <AccountSection user={user} editor={editor} avatarNote={avatarNote} />
      <ExperimentalSection user={user} />
      {editor.ui}
    </WrapperPage>
  );
};

export default SettingsPage;
