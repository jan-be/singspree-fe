import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supportedLanguages, languageNames, chooseLanguage } from '../i18n/i18n';
import SocialLinks from './SocialLinks';

/** language code -> its own name; i18next's language may be one without a name here */
const NAMES: Record<string, string | undefined> = languageNames;

const PAGES = [
  { to: '/privacy-policy', label: 'footer.privacyPolicy' },
  { to: '/tos', label: 'footer.termsOfService' },
  { to: '/contact', label: 'footer.contact' },
];

/**
 * The footer as a menu's items (our apps' AppMenu, the phone's SideMenu): the
 * language (a list that opens under it), the privacy policy, terms and
 * contact, and SingSpree elsewhere (`out`: the outbound clicks' place, see
 * data-out; none: not shown, as on a TV, where such a link could only say
 * "open it on your phone").
 *
 * The language toggle carries aria-expanded: the TV app's Back closes the
 * open list first.
 */
const FooterMenuItems = ({ onNavigate, out }: { onNavigate: () => void; out?: string }) => {
  const { t, i18n } = useTranslation();
  const [languages, setLanguages] = useState(false);
  const languageRef = useRef<HTMLButtonElement>(null);
  const current = i18n.language || 'en';

  return (
    <>
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
          <Link key={to} to={to} onClick={onNavigate} className="menu-item no-underline">
            {t(label)}
          </Link>
        ))}
      </div>
      {out && (
        <div data-out={out} className="mt-1 pt-1 border-t border-white/10 flex justify-center">
          <SocialLinks />
        </div>
      )}
    </>
  );
};

export default FooterMenuItems;
