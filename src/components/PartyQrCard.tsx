import React, { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import Avatar from "./Avatar";
import QrCode from "./QrCode";
import { LockIcon } from "./Icons";
import { TOUR_CAP } from "./PartyTour";
import { useSecondClick } from "./ProfileParts";
import { playerHue, type PlayerColors } from "../logic/playerColor";
import type { AvatarPaths } from "../logic/avatar";

/** One person of the card (cardPeople, logic/partyRoles.ts) */
export interface PartyCardPerson {
  name: string;
  host: boolean;
  cohost: boolean;
  me: boolean;
  away: boolean;
}

export interface PartyQrCardProps {
  /** what the code says */
  qrUrl: string;
  /** the link as written under the code */
  joinUrl: string;
  /** the link the button copies */
  linkUrl: string;
  joiningOpen?: boolean;
  /** the host's or a co-host's card: with the joining switch and the co-host switches */
  controls?: boolean;
  people?: PartyCardPerson[];
  playerAvatars?: AvatarPaths;
  playerColors?: PlayerColors;
  onSetCohost?: (name: string, cohost: boolean) => void;
  /** send someone away for this party */
  onKick?: (name: string) => void;
  onSetJoiningOpen?: (open: boolean) => void;
  /** the singers' microphones on the host's speakers (usePartyVoices.ts), and its switch */
  voices?: boolean;
  onSetVoices?: (on: boolean) => void;
  /** the code to scan, on top: only where the bar shows none already (phones; sm up the QR card is always there) */
  showCode?: boolean;
  /** opened by the party page's tour (PartyTour.tsx): kept clear of its card on a phone */
  tourOpen?: boolean;
}

/** The party's link, for those who would rather send it than show the code; the button copies it */
const LinkRow = ({ joinUrl, linkUrl }: { joinUrl: string; linkUrl: string }) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return undefined;
    const id = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(id);
  }, [copied]);
  return (
    <div className="flex items-center gap-1 rounded-xl bg-white/[0.06] ring-1 ring-white/10 ps-3 pe-1 py-1" data-party-link="">
      <span dir="ltr" className="flex-1 min-w-0 truncate font-mono text-[0.8125rem] text-white/85 select-all">{joinUrl.replace(/^https?:\/\//, '')}</span>
      <button
        type="button"
        onClick={() => { navigator.clipboard.writeText(linkUrl).then(() => setCopied(true), () => {}); }}
        title={t('party.copyLink')}
        aria-label={t('party.copyLink')}
        className={`btn-icon w-8 h-8 flex-shrink-0 ${copied ? 'text-neon-green' : ''}`}
      >
        {copied ? (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        )}
      </button>
    </div>
  );
};

/**
 * The enlarged QR code of the party bar: the code to scan and the link to
 * copy, on white so a phone across the room reads it. While joining is
 * closed they say so, for everyone (a phone held up to a newcomer too).
 *
 * The host and co-hosts get the party's door underneath: the switch for
 * joining by the code or the link, and everyone in the party with a co-host
 * switch (people from cardPeople, logic/partyRoles.ts). The host's own role
 * has no switch: nobody takes it. And the switch for the singers' voices on
 * the host's speakers (each phone sends its microphone to the host's page).
 * Beside a person, the button that sends them away for this party.
 *
 * From sm up the bar's QR card is always in sight, and it is what opens this:
 * there (showCode false) the code is not repeated, only the link to copy.
 */
/** Sends someone away: the first tap asks, as a slip would keep a friend out of the party */
const KickButton = ({ name, onKick }: { name: string; onKick: (name: string) => void }) => {
  const { t } = useTranslation();
  const confirm = useSecondClick();
  return (
    <button
      type="button"
      data-kick={name}
      aria-label={t('party.kick', { name })}
      title={t('party.kick', { name })}
      onClick={() => confirm.press(() => onKick(name))}
      className={confirm.armed ? 'text-xs font-semibold text-red-300 whitespace-nowrap px-1' : 'btn-icon w-7 h-7 text-white/45 flex-shrink-0'}
    >
      {confirm.armed ? t('party.kickConfirm') : '✕'}
    </button>
  );
};

const PartyQrCard = ({ qrUrl, joinUrl, linkUrl, joiningOpen = true, controls = false, people = [], playerAvatars, playerColors, onSetCohost, onKick, onSetJoiningOpen,
  voices = false, onSetVoices, showCode = true, tourOpen = false }: PartyQrCardProps) => {
  const { t } = useTranslation();
  const labelId = useId(); // the bar renders the card twice (laptop and phone layout), one of them hidden
  const voicesId = useId();
  // Where the bar's own QR card is in sight, the code again would only repeat it: the link stays
  const closed = (
    <div className="px-1" data-joining-closed="">
      <div className="text-white font-semibold text-sm">{t('party.joiningClosed')}</div>
      <div className="mt-1 text-white/55 text-xs leading-snug">{t('party.joiningClosedHint')}</div>
    </div>
  );
  const link = joiningOpen ? <LinkRow joinUrl={joinUrl} linkUrl={linkUrl} /> : closed;
  const code = (
    <>
      <div className="relative">
        <QrCode value={qrUrl} size={168} className={joiningOpen ? undefined : 'opacity-[0.12]'} />
        {!joiningOpen && (
          <span className="absolute inset-0 grid place-items-center text-ink"><LockIcon size={46} strokeWidth={1.8} /></span>
        )}
      </div>
      {joiningOpen ? (
        <div className="text-gray-900 font-mono text-sm text-center break-all select-all leading-tight">{joinUrl}</div>
      ) : (
        <div className="text-center leading-tight max-w-[13rem]" data-joining-closed="">
          <div className="text-gray-900 font-semibold text-sm">{t('party.joiningClosed')}</div>
          <div className="mt-1 text-gray-500 text-xs leading-snug">{t('party.joiningClosedHint')}</div>
        </div>
      )}
      <button
        type="button"
        onClick={() => { navigator.clipboard.writeText(linkUrl); }}
        disabled={!joiningOpen}
        className="btn btn-sm bg-ink text-white hover:bg-black"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="9" y="9" width="13" height="13" rx="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
        {t('party.copyLink')}
      </button>
    </>
  );

  if (!controls) {
    if (!showCode) {
      return (
        <div className="pop absolute top-full right-0 mt-2.5 p-2 z-50 w-[17.5rem]" data-tour-pop="">
          {joiningOpen ? link : <div className="p-2">{closed}</div>}
        </div>
      );
    }
    return (
      <div className="absolute top-full right-0 mt-2.5 bg-white rounded-2xl p-5 shadow-[0_24px_60px_-16px_rgba(0,0,0,0.85)] flex flex-col items-center gap-3 z-50" style={{ minWidth: 220 }} data-tour-pop="">
        {code}
      </div>
    );
  }

  return (
    // A popover with the white code on top (or the link alone, the code being in sight); scrolls when a
    // phone held sideways has no room for it all
    <div
      className="pop absolute top-full right-0 mt-2.5 p-2 z-50 w-[17.5rem] max-h-[calc(100dvh-5rem)] overflow-y-auto overscroll-contain"
      style={tourOpen ? TOUR_CAP(5) : undefined}
      data-party-door=""
      data-tour-pop=""
    >
      {showCode ? (
        <div className="bg-white rounded-[0.9rem] p-4 flex flex-col items-center gap-3">
          {code}
        </div>
      ) : link}
      <div className="px-2 pt-3 pb-1">
        <div className="flex items-center justify-between gap-3">
          <span id={labelId} className="text-sm font-medium text-white">{t('party.joiningSwitch')}</span>
          <button
            type="button"
            role="switch"
            aria-checked={joiningOpen}
            aria-labelledby={labelId}
            data-joining-switch=""
            onClick={() => onSetJoiningOpen?.(!joiningOpen)}
            className="switch"
          />
        </div>

        {onSetVoices && (
          <div className="mt-3">
            <div className="flex items-center justify-between gap-3">
              <span id={voicesId} className="text-sm font-medium text-white">{t('voices.partySwitch')}</span>
              <button
                type="button"
                role="switch"
                aria-checked={voices}
                aria-labelledby={voicesId}
                data-voices-switch=""
                onClick={() => onSetVoices(!voices)}
                className="switch"
              />
            </div>
          </div>
        )}

        <div className="pop-label mt-4">{t('party.cohosts')}</div>
        <p className="mt-1 text-xs text-white/55 leading-snug">{t('party.cohostsHint')}</p>
        <ul className="mt-1.5" aria-label={t('party.cohosts')}>
          {people.map(p => (
            <li key={p.name} className="flex items-center gap-2.5 py-1.5" data-person={p.name}>
              <Avatar username={p.name} src={playerAvatars?.[p.name]} hue={playerHue(playerColors, p.name)} size={26} className={p.away ? 'opacity-50' : ''} />
              <span className={`flex-1 min-w-0 truncate text-sm ${p.away ? 'text-white/50' : 'text-white'}`}>
                {p.name}
                {p.me && <span className="text-white/45"> · {t('queue.you')}</span>}
                {p.away && <span className="text-white/40"> · {t('party.away')}</span>}
              </span>
              {p.host ? (
                <span className="text-xs font-semibold text-white/55 pr-0.5">{t('party.hostRole')}</span>
              ) : (<>
                {!p.me && onKick && <KickButton name={p.name} onKick={onKick} />}
                <button
                  type="button"
                  role="switch"
                  aria-checked={p.cohost}
                  aria-label={t('party.cohostSwitch', { name: p.name })}
                  title={t('party.cohostSwitch', { name: p.name })}
                  onClick={() => onSetCohost?.(p.name, !p.cohost)}
                  className="switch"
                />
              </>)}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default PartyQrCard;
