import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import JoinGameBox from "./JoinGameBox";

/**
 * "Join Party" in the front page's top bar, left of the account: the party
 * code box (JoinGameBox) drops down under the bar. It is anchored to the
 * bar's right-hand cluster (WrapperPage), not to this button, so it lines up
 * with the page's edge on a phone as well.
 */
const JoinPartyButton = () => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !(e.target instanceof Node && ref.current.contains(e.target))) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <div ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        title={t('hero.joinParty')}
        // Below md just the icon: "Присоединиться к вечеринке" next to the wordmark and the account does not fit
        className="btn btn-sm btn-ghost max-md:w-8 max-md:px-0"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
        <span className="max-md:sr-only">{t('hero.joinParty')}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-[22rem] max-w-[calc(100vw-2rem)] z-50">
          <JoinGameBox autoFocus />
        </div>
      )}
    </div>
  );
};

export default JoinPartyButton;
