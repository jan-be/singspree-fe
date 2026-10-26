import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { SpeakerIcon, MicIcon, MicOffIcon, NoteIcon } from './Icons';
import { markPopoverClosed } from '../logic/popoverGuard';
import { useStoreValue } from '../logic/valueStore';
import type { ValueStore } from '../logic/valueStore';
import type { VoiceSingerView } from '../logic/voiceMixer';

/** The host page's voices on the speakers (usePartyVoices.ts): the singers' level, the echo, each singer */
export interface SingerVoicesControl {
  singers: ValueStore<VoiceSingerView[]>;
  /** 0–100 */
  level: number;
  onLevelChange: (level: number) => void;
  echo: boolean;
  onEchoChange: (on: boolean) => void;
  /** 0–1 */
  onSingerLevelChange: (name: string, level: number) => void;
}

/** A voice this late is heard behind the music (a Bluetooth speaker alone adds half a second) */
const LATE_MS = 250;

export interface VolumeControlProps {
  volume: number;
  restoreVolume: number;
  vocalsLevel: number;
  instrumentalLevel?: number;
  onVolumeChange: (volume: number) => void;
  onVocalsLevelChange: (level: number) => void;
  onInstrumentalLevelChange?: (level: number) => void;
  hasStems: boolean;
  volumeTooltip: boolean;
  stemsHint?: boolean;
  onDismissStemsHint?: () => void;
  /** the host's page while the party has voices on */
  singerVoices?: SingerVoicesControl;
}

/**
 * Volume popover for PartyBar.
 *
 *   volume             0–100  master volume — always what you hear (YouTube
 *                             volume without stems, both stem GainNodes with stems)
 *   instrumentalLevel  0–100  how much of the instrumental is mixed in; stems only
 *   vocalsLevel        0–100  how much of the original vocals is mixed in; stems only
 *
 * Each row is a horizontal slider (vertical range inputs are unreliable on
 * WebKit) with the icon+label acting as a one-tap mute toggle that restores
 * the previous level when tapped again.
 *
 * restoreVolume: the level a mute toggle brings back when the control starts
 *   at 0 (a joiner whose sound is off by default); 100 without one.
 * volumeTooltip: nudge shown when the user tried the YouTube iframe's own
 *   volume while stems are active (that player is muted on purpose).
 * stemsHint / onDismissStemsHint: one-time callout explaining the Vocals
 *   slider on the first song with stems; dismissed by its button or by
 *   opening the control.
 * singerVoices: the host's page while the party has voices on: the singers'
 *   level, the echo effect, and each voice with its level, how late it comes
 *   out and whether feedback held it down.
 */
const VolumeControl = ({
  volume, restoreVolume, vocalsLevel, instrumentalLevel = 100, onVolumeChange, onVocalsLevelChange, onInstrumentalLevelChange,
  hasStems, volumeTooltip, stemsHint = false, onDismissStemsHint, singerVoices,
}: VolumeControlProps) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const lastVolumeRef = useRef(volume > 0 ? volume : restoreVolume > 0 ? restoreVolume : 100);
  const lastVocalsRef = useRef(vocalsLevel > 0 ? vocalsLevel : 100);
  const lastInstrumentalRef = useRef(instrumentalLevel > 0 ? instrumentalLevel : 100);
  const lastSingersRef = useRef(singerVoices && singerVoices.level > 0 ? singerVoices.level : 80);
  useEffect(() => { if (singerVoices && singerVoices.level > 0) lastSingersRef.current = singerVoices.level; }, [singerVoices]);

  useEffect(() => { if (volume > 0) lastVolumeRef.current = volume; }, [volume]);
  useEffect(() => { if (vocalsLevel > 0) lastVocalsRef.current = vocalsLevel; }, [vocalsLevel]);
  useEffect(() => { if (instrumentalLevel > 0) lastInstrumentalRef.current = instrumentalLevel; }, [instrumentalLevel]);

  // Auto-open when the nudge fires so the user sees where the controls are,
  // and close again with it unless they were used meanwhile: on a TV there is
  // no pointer to click it away with
  const nudgedRef = useRef(false);
  useEffect(() => {
    if (volumeTooltip) {
      setOpen(true);
      nudgedRef.current = true;
    } else if (nudgedRef.current) {
      nudgedRef.current = false;
      setOpen(false);
    }
  }, [volumeTooltip]);
  const used = () => { nudgedRef.current = false; };

  useEffect(() => {
    if (!open) return;
    const handler = (e: PointerEvent) => {
      if (ref.current && !(e.target instanceof Node && ref.current.contains(e.target))) { setOpen(false); markPopoverClosed(); }
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [open]);

  const toggleMute = () => onVolumeChange(volume > 0 ? 0 : lastVolumeRef.current);
  const toggleVocals = () => onVocalsLevelChange(vocalsLevel > 0 ? 0 : lastVocalsRef.current);
  const toggleInstrumental = () => onInstrumentalLevelChange?.(instrumentalLevel > 0 ? 0 : lastInstrumentalRef.current);

  return (
    <div className="relative" ref={ref} onPointerDown={used} onKeyDown={used}>
      <button
        onClick={() => {
          used();
          if (stemsHint) onDismissStemsHint?.();
          setOpen(p => !p);
        }}
        title={t('volume.title')}
        aria-expanded={open}
        className={`btn-icon ${hasStems ? 'text-neon-purple hover:text-neon-purple' : ''}`}
      >
        <SpeakerIcon size={18} strokeWidth={1.8} level={volume} />
      </button>

      {/* First-time callout: this song has a separate vocal track */}
      {stemsHint && hasStems && !open && (
        <div
          role="note"
          className="pop absolute top-full left-1/2 -translate-x-1/2 mt-2.5 w-72 p-4 z-50 text-sm"
        >
          <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-[#251e48] border-l border-t border-white/[0.14]" aria-hidden="true" />
          <div className="flex items-start gap-3">
            <span className="grid place-items-center w-8 h-8 rounded-full bg-neon-purple/15 text-neon-purple flex-shrink-0">
              <MicIcon size={16} />
            </span>
            <p className="text-white/85 leading-snug">{t('volume.stemsHint', { vocals: t('volume.vocals') })}</p>
          </div>
          <div className="mt-3 flex justify-end">
            <button type="button" onClick={onDismissStemsHint} className="btn btn-sm btn-primary">
              {t('volume.gotIt')}
            </button>
          </div>
        </div>
      )}

      {open && (
        <div className="pop absolute top-full left-1/2 -translate-x-1/2 mt-2.5 w-64 p-4 z-50 space-y-4">
          {volumeTooltip && hasStems && (
            <div className="text-xs text-neon-purple text-center animate-pulse">
              {t('volume.useTheseControls')}
            </div>
          )}

          <SliderRow
            icon={<SpeakerIcon size={16} level={volume} />}
            label={t('volume.title')}
            value={volume}
            onChange={onVolumeChange}
            onToggle={toggleMute}
            accent="#ffffff"
          />

          {hasStems && (
            <>
              <SliderRow
                icon={<NoteIcon size={16} />}
                label={t('volume.instrumental')}
                value={instrumentalLevel}
                onChange={onInstrumentalLevelChange!}
                onToggle={toggleInstrumental}
                accent="var(--color-neon-purple)"
              />
              <SliderRow
                icon={vocalsLevel > 0 ? <MicIcon size={16} /> : <MicOffIcon size={16} />}
                label={t('volume.vocals')}
                value={vocalsLevel}
                onChange={onVocalsLevelChange}
                onToggle={toggleVocals}
                accent="var(--color-neon-purple)"
              />
            </>
          )}

          {singerVoices && (
            <div className="border-t border-white/10 pt-3 space-y-3" data-singer-voices="">
              <SliderRow
                icon={<MicIcon size={16} />}
                label={t('voices.singers')}
                value={singerVoices.level}
                onChange={singerVoices.onLevelChange}
                onToggle={() => singerVoices.onLevelChange(singerVoices.level > 0 ? 0 : lastSingersRef.current)}
                accent="var(--color-neon-green)"
              />
              <SingerRows control={singerVoices} />
              <div className="flex items-center justify-between gap-3 text-xs">
                <span id="voices-echo" className="text-white/70">{t('voices.echo')}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={singerVoices.echo}
                  aria-labelledby="voices-echo"
                  onClick={() => singerVoices.onEchoChange(!singerVoices.echo)}
                  className="switch"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/** Each voice the host's page plays: its level, a meter, how late it is and what the feedback guard did */
const SingerRows = ({ control }: { control: SingerVoicesControl }) => {
  const { t } = useTranslation();
  const singers = useStoreValue(control.singers);
  if (!singers.length) return <p className="text-xs text-white/45 leading-snug">{t('voices.nobody')}</p>;
  return (
    <ul className="space-y-2.5">
      {singers.map(s => {
        const pct = Math.min(100, Math.round(Math.sqrt(Math.min(1, s.rms / 0.25)) * 100));
        const notes = [
          s.phase === 'connecting' ? t('voices.connecting') : null,
          s.lagMs != null ? t('voices.lag', { ms: s.lagMs }) : null,
          s.route === 'relay' ? t('voices.relayed') : null,
        ].filter(Boolean).join(' · ');
        const warning = s.ducked ? t('voices.howled')
          : s.lagMs != null && s.lagMs > LATE_MS ? t('voices.late')
            : s.capped && s.open ? t('voices.capped') : null;
        return (
          <li key={s.name} data-voice={s.name}>
            <div className="flex items-center justify-between text-xs mb-1 gap-2">
              <span className="truncate text-white/85 font-medium">{s.name}</span>
              <span className="text-white/45 tabular-nums shrink-0">{Math.round(s.level * 100)}%</span>
            </div>
            <input
              type="range" min="0" max="100" step="1" value={Math.round(s.level * 100)}
              onChange={e => control.onSingerLevelChange(s.name, Number(e.target.value) / 100)}
              aria-label={t('voices.singerLevel', { name: s.name })}
              className="range"
              style={{ '--v': `${Math.round(s.level * 100)}%`, '--accent': 'var(--color-neon-green)' }}
            />
            <div className="mt-1 h-1 rounded-full bg-white/10 overflow-hidden">
              <div className={`h-full rounded-full transition-[width] duration-100 ${s.open ? 'bg-neon-green' : 'bg-white/30'}`} style={{ width: `${pct}%` }} />
            </div>
            {notes && <p className="mt-1 text-[11px] text-white/45">{notes}</p>}
            {warning && <p className="mt-0.5 text-[11px] text-amber-300 leading-snug">{warning}</p>}
          </li>
        );
      })}
    </ul>
  );
};

interface SliderRowProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  onChange: (value: number) => void;
  onToggle: () => void;
  accent: string;
}

const SliderRow = ({ icon, label, value, onChange, onToggle, accent }: SliderRowProps) => (
  <div>
    <div className="flex items-center justify-between text-xs mb-1">
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={value === 0}
        title={label}
        className={`flex items-center gap-2 cursor-pointer transition-colors ${
          value > 0 ? 'text-white/85 hover:text-white' : 'text-white/40 hover:text-white/70'
        }`}
      >
        {icon}
        <span className="font-medium">{label}</span>
      </button>
      <span className="text-white/45 tabular-nums">{value}%</span>
    </div>
    <input
      type="range" min="0" max="100" step="1" value={value}
      onChange={e => onChange(Number(e.target.value))}
      aria-label={label}
      className="range"
      style={{ '--v': `${value}%`, '--accent': accent }}
    />
  </div>
);

export default VolumeControl;
