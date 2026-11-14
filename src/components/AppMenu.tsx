import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supportedLanguages, languageNames, chooseLanguage } from '../i18n/i18n';
import SocialLinks from './SocialLinks';
import { inTvApp } from '../logic/tvApp';

/** language code -> its own name; i18next's language may be one without a name here */
const NAMES: Record<string, string | undefined> = languageNames;

const PAGES = [
  { to: '/privacy-policy', label: 'footer.privacyPolicy' },
  { to: '/tos', label: 'footer.termsOfService' },
  { to: '/contact', label: 'footer.contact' },
];

/**
 * Our apps' menu (Fire TV, Google Play; logic/androidApp.ts inOurApp) at the
 * end of the top bar, in place of the website's footer: the language, the
 * privacy policy, terms and contact, and in the phone app SingSpree elsewhere
 * (on a TV such a link could only say "open it on your phone"). Under the
 * endless song list a TV remote's arrows never reached the footer, and an
 * app keeps such things in a menu.
 *
 * Both toggles carry aria-expanded: the TV app's Back presses the open one
 * again (the language list first, then the menu).
 */
const AppMenu = () => {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [languages, setLanguages] = useState(false);
  const [tv] = useState(() => inTvApp());
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const languageRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) { setLanguages(false); return undefined; }
    const away = (e: MouseEvent) => { if (ref.current && !(e.target instanceof Node && ref.current.contains(e.target))) setOpen(false); };
    const escape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  const current = i18n.language || 'en';

  return (
    <div className="relative" ref={ref}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-label={t('footer.more')}
        title={t('footer.more')}
        className="btn-icon"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" />
        </svg>
      </button>
      {open && (
        <div className="pop absolute right-0 top-full mt-2 w-60 max-h-[calc(100vh-5rem)] overflow-y-auto overscroll-contain p-1.5 z-50">
          <button
            ref={languageRef}
            type="button"
            onClick={() => setLanguages(l => !l)}
            aria-expanded={languages}
            className="menu-item justify-between"
          >
            <span className="flex items-center gap-2.5">
              <svg className="w-4 h-4 text-white/55" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <path d="M2 12h20" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              {t('footer.language')}
            </span>
            {' '/* (a screen reader's "Language English", not one word; a flex box drops it) */}
            <span className="flex items-center gap-1 text-white/55">
              {NAMES[current] || current}
              <svg className={`w-3 h-3 transition-transform ${languages ? 'rotate-180' : ''}`} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M3 5l3 3 3-3" />
              </svg>
            </span>
          </button>
          {languages && (
            <div className="ml-4 pl-1 border-l border-white/10">
              {supportedLanguages.map(lang => (
                <button
                  key={lang}
                  type="button"
                  lang={lang}
                  onClick={() => {
                    chooseLanguage(lang);
                    setLanguages(false);
                    languageRef.current?.focus(); // (the list goes, the focus stays in the menu)
                  }}
                  aria-current={lang === current ? 'true' : undefined}
                  className={`menu-item py-1.5 ${lang === current ? 'bg-white/10 text-white' : ''}`}
                >
                  {NAMES[lang] || lang}
                </button>
              ))}
            </div>
          )}
          <div className="mt-1 pt-1 border-t border-white/10">
            {PAGES.map(({ to, label }) => (
              <Link key={to} to={to} onClick={() => setOpen(false)} className="menu-item no-underline">
                {t(label)}
              </Link>
            ))}
          </div>
          {!tv && (
            <div data-out="app-menu" className="mt-1 pt-1 border-t border-white/10 flex justify-center">
              <SocialLinks />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AppMenu;
