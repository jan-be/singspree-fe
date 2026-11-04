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
}

/**
 * An address and a button, on the /android and /ios pages (backend
 * appSignups.ts). An account's address is filled in, to be changed if it
 * should be another one.
 */
const AppSignupForm = ({ platform, label, button, done, privacy }: AppSignupFormProps) => {
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
    } catch {
      setState('failed');
    }
  };

  if (state === 'done') {
    return <p role="status" className="rounded-2xl bg-white/[0.06] px-4 py-3 text-white break-words">{done(email.trim())}</p>;
  }
  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label htmlFor="app-signup-email" className="block text-xs font-medium text-white/55 mb-1.5">{label}</label>
        <input id="app-signup-email" type="email" required value={email} onChange={e => setTyped(e.target.value)}
          autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} maxLength={254} className="field h-12 px-4" />
      </div>
      <button type="submit" disabled={state === 'sending'} className="btn btn-primary btn-lg w-full">
        {state === 'sending' ? t('feedback.sending') : button}
      </button>
      {state === 'failed' && <p role="alert" className="text-sm text-red-300">{t('feedback.failed')}</p>}
      <p className="text-xs text-white/45">
        {privacy}{" "}
        <Link to="/privacy-policy" className="text-white/60 hover:text-white underline underline-offset-4 decoration-white/25 transition-colors">{t('footer.privacyPolicy')}</Link>
      </p>
    </form>
  );
};

export default AppSignupForm;
