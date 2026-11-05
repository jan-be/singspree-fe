import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * What the profile (pages/ProfilePage.tsx) and your settings
 * (pages/SettingsPage.tsx) share: their header, buttons, fields, sections and
 * the second click that deletes.
 *
 * Both pages keep to four text sizes (24 the page's title and the big
 * numbers, 18 a section, 14 text, 12 what goes with it) and two greys
 * (white/60 for what goes with something, white/40 for what is locked), on
 * flat panels: no shadows, no gradients, no bevels.
 */

/** A line under a panel: what worked, or `error` */
export type Note = { text: string; error?: boolean };

export const useDate = () => {
  const { i18n } = useTranslation();
  return (d: string | null) => (d ? new Date(d).toLocaleDateString(i18n.language, { year: 'numeric', month: 'short', day: 'numeric' }) : '');
};

// Row and header buttons: the main action filled, the rest quiet; removing turns red only on hover
export const btn = {
  primary: 'btn btn-primary no-underline shadow-none',
  quiet: 'btn btn-ghost no-underline',
  danger: 'btn btn-ghost hover:text-red-300 hover:bg-red-500/10 hover:border-red-400/30',
};
export const sm = (cls: string) => `${cls} btn-sm text-xs`;
export const input = 'field h-10 px-4 text-sm';
// What every part of the two pages sits on
export const panel = 'rounded-2xl bg-panel border border-white/10';
export const panelBox = `${panel} p-5 sm:p-6`;
// A list in a panel: hairline rows on violet
export const listBox = `${panel} divide-y divide-white/[0.07] overflow-hidden`;
export const rowBox = 'flex items-center justify-between gap-3 px-4 py-2.5';
// A setting's name, its label over a field, and what goes with it
export const name = 'text-sm font-semibold text-white';
export const label = 'text-xs font-medium text-white/60';
export const hint = 'text-xs text-white/60';
/** The picture in the page's header, in px */
export const HEADER_PICTURE = 72;

export const TrashIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
  </svg>
);

/**
 * The top of both pages, the same size on each: the picture, the title, what
 * goes under it, and one action. On a phone the action gets its own row under
 * the name, so the name keeps the width.
 */
export const PageHeader = ({ picture, title, children, action }: { picture: React.ReactNode; title: string; children?: React.ReactNode; action: React.ReactNode }) => (
  <header className={`${panelBox} flex flex-wrap items-center gap-4 sm:gap-5 min-h-50 sm:min-h-32`}>
    {picture}
    <div className="flex-1 min-w-0">
      <h1 className="text-2xl font-bold tracking-[-0.02em] text-white truncate">{title}</h1>
      {children}
    </div>
    <div className="w-full pl-[88px] sm:w-auto sm:pl-0 sm:flex-shrink-0">{action}</div>
  </header>
);

export const Section = ({ id, title, children, aside }: { id?: string; title: React.ReactNode; children?: React.ReactNode; aside?: React.ReactNode }) => (
  <section id={id} className="mt-10 scroll-mt-20">
    <div className="flex items-center justify-between gap-3 mb-3 min-h-8">
      <h2 className="text-lg font-semibold tracking-[-0.02em] text-white">{title}</h2>
      {aside}
    </div>
    {children}
  </section>
);

/**
 * A button that deletes asks for a second click within 3 seconds (as the
 * queue's skip does), instead of the browser's confirm box: `armed` while it
 * waits; press(fn) arms it, or runs fn when armed.
 */
export const useSecondClick = (ms = 3000) => {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const id = setTimeout(() => setArmed(false), ms);
    return () => clearTimeout(id);
  }, [armed, ms]);
  return { armed, press: (fn: () => void) => { if (armed) { setArmed(false); fn(); } else setArmed(true); } };
};
