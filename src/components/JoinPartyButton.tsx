import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import JoinGameBox from "./JoinGameBox";
import { PartyIcon } from "./Icons";

/** One way the button can look: its icon, its words, or both */
interface Face {
  icon: boolean;
  label: string | null;
}

// A little tighter than .btn-sm on a phone: those few pixels decide whether words fit at all
const faceClass = ({ label }: Face) => `btn btn-sm btn-ghost ${label ? 'max-md:px-2.5' : 'w-8 px-0'}`;

const FaceContent = ({ icon, label }: Face) => <>{icon && <PartyIcon size={16} />}{label}</>;

/**
 * "Join Party" in the front page's top bar, left of the account: the party
 * code box (JoinGameBox) drops down under the bar. It is anchored to the
 * bar's right-hand cluster (WrapperPage), not to this button, so it lines up
 * with the page's edge on a phone as well.
 *
 * How much fits depends on the language and on what else is in the bar
 * ("Присоединиться к вечеринке" next to "Iniciar sesión" would not), so the
 * button takes the first face that fits the room it has: words before the
 * icon, the full words before the short ones, and just the icon when even
 * those do not fit.
 */
const JoinPartyButton = () => {
  const { t } = useTranslation();
  const full = t('hero.joinParty');
  const short = t('join.joinButton');
  const faces: Face[] = [
    { icon: true, label: full },
    { icon: false, label: full },
    { icon: true, label: short },
    { icon: false, label: short },
    { icon: true, label: null },
  ];
  const [fit, setFit] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const roomRef = useRef<HTMLDivElement>(null);
  const sizesRef = useRef<HTMLDivElement>(null);

  // The faces' sizes change too, when the font arrives
  useLayoutEffect(() => {
    const room = roomRef.current;
    const sizes = sizesRef.current;
    if (!room || !sizes) return undefined;
    const measure = () => {
      const { width } = room.getBoundingClientRect();
      const i = [...sizes.children].findIndex(el => el.getBoundingClientRect().width <= width);
      setFit(i === -1 ? sizes.children.length - 1 : i);
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(room);
    for (const el of sizes.children) ro?.observe(el);
    return () => ro?.disconnect();
  }, [full, short]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !(e.target instanceof Node && ref.current.contains(e.target))) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <div ref={roomRef} className="flex flex-1 min-w-0 justify-end">
      {/* Every face at its natural size, unseen, to measure */}
      <div ref={sizesRef} aria-hidden="true" className="invisible absolute top-0 right-0 h-0 w-max overflow-hidden flex flex-col items-end">
        {faces.map((face, i) => <span key={i} className={faceClass(face)}><FaceContent {...face} /></span>)}
      </div>
      <div ref={ref}>
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          aria-label={full}
          title={full}
          className={faceClass(faces[fit])}
        >
          <FaceContent {...faces[fit]} />
        </button>
        {open && (
          <div className="absolute right-0 top-full mt-2 w-[22rem] max-w-[calc(100vw-2rem)] z-50">
            <JoinGameBox autoFocus />
          </div>
        )}
      </div>
    </div>
  );
};

export default JoinPartyButton;
