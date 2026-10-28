import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { markPopoverClosed } from '../logic/popoverGuard';

/**
 * A choice of one in the site's own style, in place of a native <select>,
 * whose picker is the system's (a full-screen sheet on phones): a button that
 * opens a small list (.pop + .menu-item) anchored to it. The entry page's
 * sort and the microphone panel's input device use it.
 *
 * Keyboard as a select's: Enter, Space or an arrow key opens it on the current
 * choice; the arrows, Home, End and typing a name move, Enter or Space picks,
 * Escape and Tab close. A press anywhere outside closes it.
 *
 * The list goes to <body> with fixed coordinates, so a scrolling panel (the
 * microphone panel) cannot clip it and a blurred band (the entry page's pinned
 * filters) cannot become what it is positioned against. It opens below the
 * button, or above when there is more room there, follows the button while
 * the page scrolls, and stays inside the screen.
 */
export interface DropdownOption<T extends string> {
  value: T;
  label: string;
}

interface DropdownProps<T extends string> {
  value: T;
  options: DropdownOption<T>[];
  onChange: (value: T) => void;
  /** what is being chosen ("Sort by"), for screen readers */
  label: string;
  title?: string;
  disabled?: boolean;
  /** the button's look (.chip, .field …) */
  className?: string;
  /** what the button shows (given whether the list is open); the chosen option and a chevron when left out */
  children?: (open: boolean) => ReactNode;
  /** the button's edge the list lines up with */
  align?: 'start' | 'end';
  /** the list exactly as wide as the button (else at least as wide) */
  matchWidth?: boolean;
}

const MARGIN = 8; // from the screen's edges
const GAP = 6; // between the button and the list
const MAX_HEIGHT = 288;

export const DropdownChevron = ({ open, className = '' }: { open: boolean; className?: string }) => (
  <svg className={`w-3.5 h-3.5 shrink-0 text-white/50 transition-transform ${open ? 'rotate-180' : ''} ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
  </svg>
);

export default function Dropdown<T extends string>({
  value, options, onChange, label, title, disabled = false, className = '', children, align = 'start', matchWidth = false,
}: DropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const typed = useRef({ text: '', at: 0 });
  const id = useId();
  // A value the list does not hold shows the first option, as a select does
  const chosenIndex = Math.max(0, options.findIndex(o => o.value === value));
  const chosen = options[chosenIndex];

  const show = () => {
    if (disabled || !options.length) return;
    setActive(chosenIndex);
    setOpen(true);
  };
  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) buttonRef.current?.focus({ preventScroll: true });
  };
  const choose = (i: number) => {
    const option = options[i];
    close(true);
    if (option && option.value !== value) onChange(option.value);
  };

  // Where the list goes: written straight to its style, before it is painted
  const place = useCallback(() => {
    const button = buttonRef.current, list = listRef.current;
    if (!button || !list) return;
    const b = button.getBoundingClientRect();
    const vw = document.documentElement.clientWidth, vh = window.innerHeight;
    const widest = vw - 2 * MARGIN;
    list.style.maxWidth = `${widest}px`;
    list.style.minWidth = `${Math.min(b.width, widest)}px`;
    if (matchWidth) list.style.width = `${Math.min(b.width, widest)}px`;
    const below = vh - b.bottom - GAP - MARGIN, above = b.top - GAP - MARGIN;
    // Its own height first, then capped by the room on the side it goes to (a
    // cap at that very height, rounded, could cut a pixel and show a scrollbar)
    list.style.maxHeight = `${MAX_HEIGHT}px`;
    const wanted = list.getBoundingClientRect().height;
    const down = wanted <= below || below >= above;
    list.style.maxHeight = `${Math.max(0, Math.min(MAX_HEIGHT, down ? below : above))}px`;
    const height = list.getBoundingClientRect().height;
    const top = down ? b.bottom + GAP : b.top - GAP - height;
    list.style.top = `${Math.min(Math.max(top, MARGIN), vh - MARGIN - height)}px`;
    const width = list.offsetWidth;
    const left = align === 'end' ? b.right - width : b.left;
    list.style.left = `${Math.min(Math.max(left, MARGIN), vw - MARGIN - width)}px`;
  }, [align, matchWidth]);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    listRef.current?.focus({ preventScroll: true });
  }, [open, place, options.length]);

  // The active option stays in view while the keys move through a long list
  useLayoutEffect(() => {
    if (open) document.getElementById(`${id}-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active, id]);

  useEffect(() => {
    if (open && disabled) setOpen(false);
  }, [open, disabled]);

  useEffect(() => {
    if (!open) return;
    let frame = 0;
    // The page or a panel scrolled, or the window changed size: follow the
    // button, and close once it is off the screen
    const follow = (e: Event) => {
      if (e.target === listRef.current) return; // the list's own scrolling
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const b = buttonRef.current?.getBoundingClientRect();
        if (!b || b.bottom < 0 || b.top > window.innerHeight) setOpen(false);
        else place();
      });
    };
    // (a press in the list never gets here: the list stops it, see below)
    const outside = (e: PointerEvent) => {
      if (e.target instanceof Node && buttonRef.current?.contains(e.target)) return;
      setOpen(false);
      markPopoverClosed();
    };
    window.addEventListener('resize', follow);
    window.addEventListener('scroll', follow, true);
    document.addEventListener('pointerdown', outside);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', follow);
      window.removeEventListener('scroll', follow, true);
      document.removeEventListener('pointerdown', outside);
    };
  }, [open, place]);

  const onButtonKey = (e: KeyboardEvent) => {
    if (open || !['ArrowDown', 'ArrowUp'].includes(e.key)) return;
    e.preventDefault();
    show();
  };

  const onListKey = (e: KeyboardEvent) => {
    const last = options.length - 1;
    const move = (i: number) => setActive(Math.min(Math.max(i, 0), last));
    switch (e.key) {
      case 'ArrowDown': move(active + 1); break;
      case 'ArrowUp': move(active - 1); break;
      case 'Home': case 'PageUp': move(0); break;
      case 'End': case 'PageDown': move(last); break;
      case 'Enter': case ' ': choose(active); break;
      case 'Escape': close(true); break;
      case 'Tab': close(true); break;
      default: {
        // Typing jumps to the option it starts (the same letter again: to the next one)
        if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;
        const now = Date.now();
        const text = (now - typed.current.at < 700 ? typed.current.text : '') + e.key.toLowerCase();
        typed.current = { text, at: now };
        const again = text.length > 1 && [...text].every(c => c === text[0]);
        const wanted = again ? text[0] : text;
        const from = wanted.length === 1 ? active + 1 : active;
        for (let k = 0; k <= last; k++) {
          const i = (from + k) % options.length;
          if (options[i].label.toLowerCase().startsWith(wanted)) { setActive(i); break; }
        }
      }
    }
    // The keys are the list's: neither the page nor a panel around it acts on them too
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={() => (open ? close(false) : show())}
        onKeyDown={onButtonKey}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={chosen ? `${label}: ${chosen.label}` : label}
        title={title}
        className={className}
      >
        {children ? children(open) : <><span className="min-w-0 truncate">{chosen?.label}</span><DropdownChevron open={open} /></>}
      </button>
      {open && createPortal(
        <div
          ref={listRef}
          id={id}
          role="listbox"
          tabIndex={-1}
          aria-label={label}
          aria-activedescendant={`${id}-${active}`}
          onKeyDown={onListKey}
          // A press in the list is not outside whatever opened it: it never
          // reaches the document, where the microphone panel would close. Nor
          // does its click go on up the component tree (React carries a
          // portal's events to its owners): on the sing page the bar takes a
          // click from anywhere outside its buttons for one on the free stage
          // and would pause the song
          onPointerDown={e => e.stopPropagation()}
          onClick={e => e.stopPropagation()}
          className="pop fixed top-0 left-0 z-[70] p-1.5 overflow-y-auto overscroll-contain outline-none"
        >
          {options.map((o, i) => (
            <div
              key={o.value}
              id={`${id}-${i}`}
              role="option"
              aria-selected={o.value === chosen?.value}
              onClick={() => choose(i)}
              onPointerMove={() => { if (i !== active) setActive(i); }}
              className={`menu-item justify-between gap-3 select-none ${i === active ? 'bg-white/10 text-white' : ''} ${o.value === chosen?.value ? 'font-medium text-white' : ''}`}
            >
              <span className="min-w-0 break-words">{o.label}</span>
              {o.value === chosen?.value && (
                <svg className="w-4 h-4 shrink-0 text-hot" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
              )}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}
