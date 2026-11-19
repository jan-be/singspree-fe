import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import FooterMenuItems from './FooterMenuItems';
import { inTvApp } from '../logic/tvApp';

/**
 * Our apps' menu (Fire TV, Google Play; logic/androidApp.ts inOurApp) at the
 * end of the top bar, in place of the website's footer (FooterMenuItems): the
 * language, the privacy policy, terms and contact, and in the phone app
 * SingSpree elsewhere (on a TV such a link could only say "open it on your
 * phone"). Under the endless song list a TV remote's arrows never reached the
 * footer, and an app keeps such things in a menu. On a phone-sized screen the
 * side menu (SideMenu) has all of it instead.
 *
 * Both toggles carry aria-expanded: the TV app's Back presses the open one
 * again (the language list first, then the menu).
 */
const AppMenu = () => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [tv] = useState(() => inTvApp());
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return undefined;
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
          <FooterMenuItems onNavigate={() => setOpen(false)} out={tv ? undefined : 'app-menu'} />
        </div>
      )}
    </div>
  );
};

export default AppMenu;
