/**
 * The singers' voices on the host's speakers, for the party page: the
 * singer's side (voiceLink.ts) on a phone, the mixer (voiceMixer.ts) on the
 * host's page, and the settings around them.
 *
 *   - The party has voices on or off (party:settings `voices`: the host's or a
 *     co-host's switch on the QR card); off by default.
 *   - Each singer has a switch of their own ("My voice on the speakers", the
 *     mic panel), on unless they turned it off (singspree_voice_out).
 *   - A phone sends its microphone (and each of its extra microphones its own)
 *     to the host's page; on the host's page its own microphones go into the
 *     mixer directly, except on a phone or tablet acting as the host (opening
 *     the microphone into Web Audio would put it in call mode, see
 *     MicrophoneInput.ts).
 *   - Where two devices cannot reach each other directly (a firewall, a VPN
 *     app, a Wi-Fi that keeps its devices apart), the audio goes through
 *     Cloudflare's TURN relay: the server hands it out while the party has
 *     voices on (rtc:ice), so each page asks again when they come on, and a
 *     phone waits for that (at most ICE_WAIT_MS) before its first try.
 *     ?voicerelay: through the relay only, to try it out.
 *   - The host's page sets the singers' level and the echo effect
 *     (singspree_voices_level, singspree_voices_echo) and each singer's level
 *     (the volume panel), and plays the voices at the page's volume.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createVoiceLink } from './voiceLink';
import { createVoiceMixer } from './voiceMixer';
import { createValueStore } from './valueStore';
import { isAppleMobile } from './youtubeSilence';
import { sendRtcIce, sendRtcReport, sendRtcSignal } from './WebsocketHandling';
import { debugLog } from './debugLog';
import type { VoiceLink, VoiceLinkState, VoiceReport } from './voiceLink';
import type { VoiceMixer, VoiceSingerView } from './voiceMixer';
import type { ValueStore } from './valueStore';
import type { ExtraVoice } from './extraSingers';
import type { PartySocket } from './WebsocketHandling';
import type { PartyServerMessage } from '../types/party-messages';

/** Cloudflare's STUN, until the server named its own (rtc:ice) */
const DEFAULT_ICE: RTCIceServer[] = [{ urls: ['stun:stun.cloudflare.com:3478'] }];
const OUT_KEY = 'singspree_voice_out';
const LEVEL_KEY = 'singspree_voices_level';
const ECHO_KEY = 'singspree_voices_echo';
const VIEW_MS = 400;
const ICE_WAIT_MS = 3_000;
/** Whether ICE servers include a TURN relay */
const hasRelay = (servers: RTCIceServer[]) => servers.some(s => [s.urls].flat().some(u => /^turns?:/.test(u)));

const read = (key: string) => { try { return localStorage.getItem(key); } catch { return null; } };
const write = (key: string, value: string) => { try { localStorage.setItem(key, value); } catch { /* private mode: this page only */ } };

/**
 * Whether this page's own microphones may go into the mixer directly: not on
 * a phone or tablet (Android, Fire OS, iOS, iPadOS), where a microphone in an
 * AudioContext switches the device to call mode.
 */
export function canMixLocally(nav: { userAgent?: string; platform?: string; maxTouchPoints?: number } | undefined = globalThis.navigator): boolean {
  return !/Android/.test(String(nav?.userAgent ?? '')) && !isAppleMobile(nav);
}

export interface PartyVoicesOptions {
  isHost: boolean;
  /** the party has voices on (party:settings) */
  partyVoices: boolean;
  /** the page's socket now (null while it is down) */
  socket: () => Pick<PartySocket, 'sendObj' | 'readyState'> | null;
  /** the page's own singer name: its microphone's voice on the host page */
  myName: string;
  /** the page's AudioContext and the music's mix (the stems), made on demand; null without Web Audio */
  pageAudio: () => { ctx: AudioContext; music: AudioNode } | null;
  /** the page's volume, 0–100 */
  volume: number;
}

export interface PartyVoices {
  /** this singer wants their voice on the speakers (the mic panel's switch) */
  voiceOut: boolean;
  setVoiceOut(on: boolean): void;
  /** the party's voices are on and this page has a way to them */
  available: boolean;
  /** this page's own microphone's connection (a phone's); null on the host's page */
  linkState: VoiceLinkState | null;
  /** the host's page: the voices it plays (refreshed while there are any), and its controls */
  singers: ValueStore<VoiceSingerView[]> | null;
  singersLevel: number;
  setSingersLevel(level: number): void;
  echo: boolean;
  setEcho(on: boolean): void;
  setSingerLevel(name: string, level: number): void;
  /** this page's microphone opened (its track) or closed (null) */
  setMicTrack(track: MediaStreamTrack | null): void;
  /** the song plays or is paused */
  setActive(on: boolean): void;
  /** a party socket opened: ask for the STUN/TURN servers */
  onSocketOpen(ws: Pick<PartySocket, 'sendObj'>): void;
  /** every message of the party socket */
  onMessage(msg: PartyServerMessage): void;
  /** what an extra microphone of this page needs for its voice (createExtraSinger's `voice`) */
  extraVoice(name: string): ExtraVoice;
  /** an extra microphone's voice is wanted now */
  extraWanted: boolean;
  /** lines for the ?debug panel */
  debugLines(): string[];
}

export function usePartyVoices({ isHost, partyVoices, socket, myName, pageAudio, volume }: PartyVoicesOptions): PartyVoices {
  const [voiceOut, setVoiceOutState] = useState(() => read(OUT_KEY) !== '0');
  const [singersLevel, setSingersLevelState] = useState(() => {
    const v = Number(read(LEVEL_KEY));
    return read(LEVEL_KEY) !== null && Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 80;
  });
  const [echo, setEchoState] = useState(() => read(ECHO_KEY) === '1');
  const [linkState, setLinkState] = useState<VoiceLinkState | null>(null);
  const iceRef = useRef<RTCIceServer[]>(DEFAULT_ICE);
  // the servers for a party with voices on are in (with the relay), or waited for long enough
  const [iceReady, setIceReady] = useState(false);
  const relayOnly = useMemo(() => { try { return new URLSearchParams(window.location.search).has('voicerelay'); } catch { return false; } }, []);
  const socketRef = useRef(socket);
  socketRef.current = socket;
  const pageAudioRef = useRef(pageAudio);
  pageAudioRef.current = pageAudio;
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const hostUpRef = useRef(true);
  const localDirect = isHost && canMixLocally();
  const wanted = partyVoices && voiceOut;
  const wantedRef = useRef(wanted);
  wantedRef.current = wanted;

  const send = useCallback((signal: Parameters<typeof sendRtcSignal>[1]) => {
    const ws = socketRef.current();
    return ws ? sendRtcSignal(ws, signal) : false;
  }, []);
  const log = useCallback((line: string) => debugLog('voice', line), []);
  // how each try went, to the server's event log (voice_link events)
  const report = useCallback((r: VoiceReport & { mic?: string; singer?: string }) => {
    const ws = socketRef.current();
    if (ws) sendRtcReport(ws, r);
    debugLog('voice', `${r.side} ${r.singer ?? r.mic ?? ''} ${r.result} after ${r.ms} ms: answered=${r.answered} local=${JSON.stringify(r.local)} remote=${JSON.stringify(r.remote)} ${r.states}${r.pairs ? ` pairs=${JSON.stringify(r.pairs)}` : ''}${r.route ? ` route=${r.route}` : ''}`);
  }, []);

  // A phone: its own microphone's connection to the host's page
  const link = useMemo<VoiceLink | null>(() => (isHost ? null : createVoiceLink({
    send, iceServers: () => iceRef.current, relayOnly, onState: setLinkState, log, report,
  })), [isHost, send, log, report, relayOnly]);
  useEffect(() => () => link?.close(), [link]);

  // The host's page: the mixer, and what it shows
  const singers = useMemo(() => (isHost ? createValueStore<VoiceSingerView[]>([]) : null), [isHost]);
  const mixer = useMemo<VoiceMixer | null>(() => (isHost ? createVoiceMixer({
    send: (to, signal) => send({ ...signal, to }),
    iceServers: () => iceRef.current,
    relayOnly,
    onChange: () => { if (singers && mixerRef.current) singers.set(mixerRef.current.singers()); },
    log,
    report,
  }) : null), [isHost, send, log, report, singers, relayOnly]);
  const mixerRef = useRef(mixer);
  mixerRef.current = mixer;
  useEffect(() => () => mixer?.close(), [mixer]);

  // Voices on: the servers again (now with the relay), and until they are in (or ICE_WAIT_MS) no try
  useEffect(() => {
    setIceReady(false);
    if (!partyVoices) return;
    const ws = socketRef.current();
    if (ws) sendRtcIce(ws);
    const t = setTimeout(() => setIceReady(true), ICE_WAIT_MS);
    return () => clearTimeout(t);
  }, [partyVoices]);

  // The singer's side follows the switches
  useEffect(() => { link?.setWanted(wanted && iceReady); }, [link, wanted, iceReady]);

  // The host's side: on with the party's voices, in the page's AudioContext
  useEffect(() => {
    if (!mixer) return;
    if (partyVoices) {
      const audio = pageAudioRef.current();
      if (audio) {
        mixer.attach(audio.ctx, audio.music);
        if (audio.ctx.state === 'suspended') audio.ctx.resume().catch(() => {});
      }
    }
    mixer.setEnabled(partyVoices);
    if (partyVoices && localDirect) mixer.setLocal(myName, voiceOut ? trackRef.current : null);
  }, [mixer, partyVoices, localDirect, myName, voiceOut]);
  useEffect(() => { mixer?.setLevels(singersLevel / 100, volume / 100); }, [mixer, singersLevel, volume]);
  useEffect(() => { mixer?.setEcho(echo); }, [mixer, echo]);
  // The meters and the measured lag, a few times a second while voices play
  useEffect(() => {
    if (!mixer || !singers || !partyVoices) return;
    const id = setInterval(() => singers.set(mixer.singers()), VIEW_MS);
    return () => clearInterval(id);
  }, [mixer, singers, partyVoices]);

  const setMicTrack = useCallback((track: MediaStreamTrack | null) => {
    trackRef.current = track;
    link?.setTrack(track);
    const m = mixerRef.current;
    if (m && localDirect && m.enabled) {
      const audio = track ? pageAudioRef.current() : null;
      if (audio) m.attach(audio.ctx, audio.music);
      m.setLocal(myName, wantedRef.current ? track : null);
    }
  }, [link, localDirect, myName]);

  const onMessage = useCallback((msg: PartyServerMessage) => {
    if (msg.type === 'rtc:ice' && Array.isArray(msg.data?.iceServers)) {
      iceRef.current = msg.data.iceServers.length ? msg.data.iceServers : DEFAULT_ICE;
      if (hasRelay(iceRef.current)) setIceReady(true);
    } else if (msg.type === 'rtc:signal' && msg.data) {
      const { from, ...signal } = msg.data;
      if (mixerRef.current) mixerRef.current.handleSignal(from, signal);
      else link?.handleSignal(signal);
    } else if (msg.type === 'party:host_status' && link) {
      // the host's page came back: the connection it had went with the old one
      const up = msg.data?.connected !== false;
      if (up && !hostUpRef.current) link.hostBack();
      hostUpRef.current = up;
    } else if (msg.type === 'party:player_left' && msg.data?.username) {
      mixerRef.current?.drop(msg.data.username);
    }
  }, [link]);

  const extraVoice = useCallback((name: string): ExtraVoice => (isHost
    ? { onTrack: track => { if (localDirect) mixerRef.current?.setLocal(name, track); } }
    : { link: (sendSignal, onState) => createVoiceLink({ send: sendSignal, iceServers: () => iceRef.current, relayOnly, onState, log: line => log(`${name}: ${line}`), report: r => report({ ...r, mic: name }) }) }
  ), [isHost, localDirect, log, report, relayOnly]);

  return {
    voiceOut,
    setVoiceOut: useCallback((on: boolean) => { setVoiceOutState(on); write(OUT_KEY, on ? '1' : '0'); }, []),
    available: partyVoices && (!isHost || localDirect),
    linkState: link ? linkState : null,
    singers,
    singersLevel,
    setSingersLevel: useCallback((level: number) => { setSingersLevelState(level); write(LEVEL_KEY, String(level)); }, []),
    echo,
    setEcho: useCallback((on: boolean) => { setEchoState(on); write(ECHO_KEY, on ? '1' : '0'); }, []),
    setSingerLevel: useCallback((name: string, level: number) => mixerRef.current?.setSingerLevel(name, level), []),
    setMicTrack,
    setActive: useCallback((on: boolean) => link?.setActive(on), [link]),
    onSocketOpen: useCallback((ws: Pick<PartySocket, 'sendObj'>) => sendRtcIce(ws), []),
    onMessage,
    extraVoice,
    extraWanted: wanted && (isHost ? localDirect : iceReady),
    debugLines: useCallback(() => {
      const m = mixerRef.current;
      if (m) {
        if (!m.enabled) return ['voices: off'];
        const list = m.singers();
        if (!list.length) return ['voices: on, nobody yet'];
        return list.map(s => `voice ${s.name}: ${s.kind} ${s.phase}${s.route ? ` ${s.route}` : ''} lag=${s.lagMs ?? '?'}ms back=${s.couplingDb ?? '?'}dB gain=${s.gainDb.toFixed(1)}dB${s.capped ? ' capped' : ''} jitter=${s.jitterMs ?? '?'}ms loss=${s.lossPct ?? '?'}% pkt=${s.packetsPerSec ?? '?'}/s${s.howls ? ` howls=${s.howls}` : ''}${s.ducked ? ' ducked' : ''} rms=${s.rms.toFixed(4)}${s.open ? ' open' : ''}`);
      }
      const st = link?.state;
      return [`voice: ${wantedRef.current ? st?.phase ?? 'off' : 'not wanted'}${st?.route ? ` ${st.route}` : ''}${st?.rttMs != null ? ` rtt=${st.rttMs}ms` : ''}${st?.reason ? ` last failure: ${st.reason}` : ''}`];
    }, [link]),
  };
}
