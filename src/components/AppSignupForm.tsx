import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../logic/AuthContext";
import { signUpForApp, type AppPlatform } from "../logic/authApi";

export interface AppSignupFormProps {
  platform: AppPlatform;
  /** the field's label */
  label: string;
  /** the button's words */
  button: string;
  /** what the form turns into once the address is in, with that address */
  done: (email: string) => string;
  /** what the address is used for, before the link to the privacy policy */
  privacy: string;
  /** in a small card over another page, opened by a press: smaller, ready to type, and the privacy policy opens in a tab of its own, so that page stays */
  compact?: boolean;
  /** the form was touched */
  onTouched?: () => void;
  /** the address went in */
  onDone?: () => void;
}

/**
 * An address and a button, on the /android and /ios pages and in the card
 * that suggests the Android test (backend appSignups.ts). An account's
 * address is filled in, to be changed if it should be another one.
 */
const AppSignupForm = ({ platform, label, button, done, privacy, compact = false, onTouched, onDone }: AppSignupFormProps) => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [typed, setTyped] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'failed'>('idle');
  const email = typed ?? user?.email ?? "";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState('sending');
    try {
      await signUpForApp(platform, email.trim(), i18n.language);
      setState('done');
      onDone?.();
    } catch {
      setState('failed');
    }
  };

  if (state === 'done') {
    return <p role="status" className={`rounded-2xl bg-white/[0.06] px-4 py-3 text-white break-words ${compact ? 'text-sm' : ''}`}>{done(email.trim())}</p>;
  }
  const policyLink = "text-white/60 hover:text-white underline underline-offset-4 decoration-white/25 transition-colors";
  return (
    <form onSubmit={submit} onFocus={onTouched} className={compact ? 'space-y-2.5' : 'space-y-3'}>
      <div>
        <label htmlFor="app-signup-email" className="block text-xs font-medium text-white/55 mb-1.5">{label}</label>
        <input id="app-signup-email" type="email" required value={email} onChange={e => setTyped(e.target.value)}
          autoFocus={compact} autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} maxLength={254} className={`field ${compact ? 'h-10 px-3 text-sm' : 'h-12 px-4'}`} />
      </div>
      <button type="submit" disabled={state === 'sending'} className={`btn btn-primary w-full ${compact ? '' : 'btn-lg'}`}>
        {state === 'sending' ? t('feedback.sending') : button}
      </button>
      {state === 'failed' && <p role="alert" className="text-sm text-red-300">{t('feedback.failed')}</p>}
      <p className={`text-white/45 ${compact ? 'text-[11px] leading-snug' : 'text-xs'}`}>
        {privacy}{" "}
        {compact
          ? <a href="/privacy-policy" target="_blank" rel="noopener noreferrer" className={policyLink}>{t('footer.privacyPolicy')}</a>
          : <Link to="/privacy-policy" className={policyLink}>{t('footer.privacyPolicy')}</Link>}
      </p>
    </form>
  );
};

export default AppSignupForm;
