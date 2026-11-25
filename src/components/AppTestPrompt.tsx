import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import AppSignupForm from "./AppSignupForm";
import { GooglePlayIcon } from "./SocialLinks";
import { ask, closePrompt, engage, markAnswered, moveOn, useAppTestPrompt } from "../logic/appTestPrompt";
import { useCardRoom, type PromptPlace } from "../logic/songPrompt";

/** The home page asks a moment after it has settled, not as it appears */
const HOME_DELAY_MS = 2500;
/** The thanks names the address, for checking it */
const THANKS_MS = 6000;

export interface AppTestPromptProps {
  where: PromptPlace;
  /** party page: the score screen is up (between songs) */
  between?: boolean;
}

/**
 * "Try the Android app": a small card at the bottom suggesting the Android
 * app's closed test, on Android devices in the place of the feedback question
 * (AfterSongsPrompt.tsx), at the same moments.
 *
 * It stays a slim bar until its button is pressed, because on a phone it
 * shares the score screen with the scores and the buttons (the score screen
 * leaves it room, useCardRoom). The button opens the form of /android in the
 * card, so nobody has to leave a running party to sign up. The addresses go to
 * the admins' inbox (/admin).
 */
const AppTestPrompt = ({ where, between = false }: AppTestPromptProps) => {
  const { t } = useTranslation();
  const { open } = useAppTestPrompt();
  const room = useCardRoom(open);
  const [form, setForm] = useState(false);
  const [signedUp, setSignedUp] = useState(false);

  // The party page asks when the score screen comes up; the next song takes an untouched card away
  useEffect(() => {
    if (where !== 'party') return;
    if (between) ask('party'); else moveOn();
  }, [where, between]);

  // The home page asks once it has settled
  useEffect(() => {
    if (where !== 'home') return undefined;
    const timer = setTimeout(() => ask('home'), HOME_DELAY_MS);
    return () => clearTimeout(timer);
  }, [where]);

  // Leaving the page takes the card along, touched or not
  useEffect(() => () => moveOn(true), []);

  useEffect(() => {
    if (!signedUp) return undefined;
    const timer = setTimeout(closePrompt, THANKS_MS);
    return () => clearTimeout(timer);
  }, [signedUp]);

  if (!open) return null;

  const place = where === 'party'
    ? 'z-[60] bottom-2 inset-x-2 mx-auto max-w-sm lg:bottom-4 lg:inset-x-auto lg:right-4 lg:mx-0 lg:w-80'
    : 'z-50 bottom-14 inset-x-3 sm:inset-x-auto sm:right-4 sm:w-80';

  return (
    <section
      ref={room}
      aria-labelledby="app-test-title"
      className={`pop fixed rounded-2xl p-3.5 shadow-[0_12px_40px_rgba(0,0,0,0.45)] animate-slide-up ${place}`}
    >
      <div className="flex items-start gap-3">
        <span className="flex-shrink-0 w-10 h-10 grid place-items-center rounded-xl bg-white/10 text-white [&>svg]:w-[22px] [&>svg]:h-[22px]">{GooglePlayIcon}</span>
        <div className="flex-1 min-w-0">
          <div id="app-test-title" className="text-white text-[15px] font-semibold tracking-[-0.01em] leading-snug">
            {t('android.askTitle')}
          </div>
          <p className="mt-0.5 text-[13px] leading-snug text-white/70">{t('android.askText')}</p>
        </div>
        <button
          type="button"
          onClick={closePrompt}
          title={t('feedback.close')}
          aria-label={t('feedback.close')}
          className="btn-icon w-7 h-7 -mr-1.5 -mt-1 text-white/50 text-xs flex-shrink-0"
        >
          &#10005;
        </button>
      </div>

      <div className="mt-3">
        {form ? (
          <AppSignupForm
            platform="android"
            compact
            label={t('android.email')}
            button={t('android.join')}
            done={email => t('android.done', { email })}
            privacy={t('android.privacy')}
            onTouched={engage}
            onDone={() => { markAnswered(); setSignedUp(true); }}
          />
        ) : (
          <button type="button" onClick={() => { engage(); setForm(true); }} className="btn btn-sm btn-primary w-full">
            {t('android.join')}
          </button>
        )}
      </div>
    </section>
  );
};

export default AppTestPrompt;
