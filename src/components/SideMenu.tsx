import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import FooterMenuItems from './FooterMenuItems';
import { PlaylistsDialog } from './PlaylistsButton';
import { PlaylistIcon } from './Icons';
import Wordmark from './Wordmark';
import { inTvApp } from '../logic/tvApp';

/** Where the top bar has room for the footer and Playlists (Tailwind's sm) */
const WIDE = '(min-width: 640px)';

/**
 * The phone's menu: a ☰ at the start of the top bar (only on a phone-sized
 * screen, below sm) that slides a panel in from the left with Playlists
 * (PlaylistsDialog) and the footer (FooterMenuItems: the language, the
 * privacy policy, terms and contact, SingSpree elsewhere), which a phone's
 * screen has no room for. From sm on there is the footer and the top bar's
 * Playlists, and the panel closes when a window grows that wide.
 *
 * The panel is a modal dialog: it takes the focus, Escape or a tap beside it
 * closes it, the focus goes back to the ☰, and the page under it stays still.
 * (In document.body: the top bar's blur would hold a fixed panel inside it.)
 */
const SideMenu = () => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [playlists, setPlaylists] = useState(false);
  const [tv] = useState(() => inTvApp());
  const buttonRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    closeRef.current?.focus();
    const escape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    const wide = window.matchMedia(WIDE);
    const grown = () => { if (wide.matches) setOpen(false); };
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', escape);
    wide.addEventListener('change', grown);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', escape);
      wide.removeEventListener('change', grown);
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    if (panelRef.current?.contains(document.activeElement)) buttonRef.current?.focus();
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={t('footer.menu')}
        title={t('footer.menu')}
        className="btn-icon sm:hidden -ml-1.5"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      {createPortal(
        <div className="sm:hidden">
          <div
            aria-hidden="true"
            onClick={close}
            className={`fixed inset-0 z-[60] bg-black/55 transition-opacity duration-200 motion-reduce:transition-none ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          />
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={t('footer.menu')}
            inert={!open}
            className={`fixed inset-y-0 left-0 z-[61] w-72 max-w-[85vw] flex flex-col bg-stage border-r border-white/[0.08] shadow-2xl transition-[translate,visibility] duration-200 ease-out motion-reduce:transition-none ${open ? 'translate-x-0 visible' : '-translate-x-full invisible'}`}
          >
            <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-white/[0.06]">
              <Wordmark height={32} className="-my-1" />
              <button ref={closeRef} type="button" onClick={close} aria-label={t('footer.closeMenu')} title={t('footer.closeMenu')} className="btn-icon -mr-1.5">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto overscroll-contain p-2">
              <button
                type="button"
                onClick={() => { setOpen(false); setPlaylists(true); }}
                aria-haspopup="dialog"
                className="menu-item gap-2.5"
              >
                <PlaylistIcon size={16} className="text-white/55" />
                {t('playlists.title')}
              </button>
              <div className="mt-1 pt-1 border-t border-white/10">
                <FooterMenuItems onNavigate={close} out={tv ? undefined : 'side-menu'} />
              </div>
            </nav>
          </div>
        </div>,
        document.body,
      )}
      {playlists && <PlaylistsDialog onClose={() => { setPlaylists(false); buttonRef.current?.focus(); }} />}
    </>
  );
};

export default SideMenu;
