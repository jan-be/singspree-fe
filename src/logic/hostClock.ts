// hostClock.ts — a joiner's estimate of the song's clock, which is the host's.
//
// The host tells the party where the song is about three times a second
// (video:time, through the server). A message can arrive late, never early:
// Wi-Fi holds one back for 100 ms, a phone's radio wakes up, TCP resends. Taken
// as it came, the last message's time plus what has passed since put all of
// that into every stamp: against the same pipeline on a host, joiners ran five
// to ten times as jittery (p90 70-90 ms against 8), and it went on into the
// delay estimators (a chunk with stamps 50 ms apart is dropped), into the rate
// of a joiner's own video and into its highway.
//
// So every message is a lower bound of the host's offset (song time − our
// clock), like a report in videoClock.ts: the best one of the last WINDOW
// seconds is the estimate. It takes one good message, so bursts, stalls and a
// frozen tab cost nothing: what they deliver is late and sits below the bound.
// The window, not a fit, also takes care of the two clocks' skew: they part by
// a few hundredths of a ms per second, so a fit would move the estimate by
// less than the window's best message does by chance.
//
// The bound comes down only when the window has none left that high, and then
// gently, so a stamp never steps back. A better message counts at once.
//
// What the song does is read from the times themselves, in order (TCP keeps
// them so, however late they are). A host playing on sends times a third of a
// second apart or more. A time behind the last one is a seek, one that moved
// less than the rhythm allows is the host's clock correcting itself, and one
// that stands still is a video that stands still, whatever else the message
// says. A time far ahead means nothing was said in between (a reload, a lost
// connection), so what the way used to be is no news about the new line.
//
// The best message was still on its way for as long as the two legs take, host
// to server and server to us. Each side knows its own leg from the server's
// pings, so the host sends its time as of the moment it reaches the server
// (songTimeAhead) and the clock adds this side's. That is more than the jitter
// by far: on a shaped link a joiner ran behind the host by the two legs to the
// millisecond, and in real parties phones in the room measured the host's
// speakers some 150 ms earlier than the host did (two legs of 85 ms). Without
// it their lyrics ran that far behind the music in the room.

export const WINDOW = 8;       // s: how long a message counts as the best the way can do
export const SLEW = 0.1;       // s per s: how fast the estimate comes down to a lower bound
const BACK = 0.05;             // s: a time this far behind the last one is a seek, followed at once
const MOVED = 0.02;            // s: a time that moved less than this since the last message stands still
const RHYTHM = 0.3;            // s: less than this since the last message: the host's clock stepped back (it sends every 333 ms at most)
const SILENT = 2.5;            // s: more than this: the host said nothing for a while (a hidden tab still says something every second)
export const PINGS = 12;       // how many pings count for a leg: a minute of them (the server asks every 5 s)

export type HostClockMode = 'unknown' | 'stopped' | 'playing';

/** A message's offset and when it came. */
interface Sample {
  at: number;
  offset: number;
}

/**
 * One leg to the server: half the shortest round trip of the last minute (see
 * PINGS). The shortest, for the same reason as the bound's: a ping can take
 * longer than the way does, never less.
 */
export class Leg {
  declare pings: number[];
  constructor() { this.pings = []; }

  /** The server's ping:ack (half a round trip, in ms). */
  ack(ms: unknown) {
    if (typeof ms !== 'number' || !(ms >= 0)) return;
    this.pings.push(ms / 1000);
    if (this.pings.length > PINGS) this.pings.shift();
  }

  /** The leg in seconds, 0 before the first ping */
  get seconds() { return this.pings.length ? Math.min(...this.pings) : 0; }
}

/** What the host sends as its time: the song's at the moment the message reaches the server. */
export const songTimeAhead = (time: number, playing: boolean, leg: Leg) => (playing ? time + leg.seconds : time);

export class HostClock {
  declare mode: HostClockMode;
  declare frozen: number;
  declare epoch: number;
  declare window: number;
  declare slew: number;
  declare leg: number;
  declare samples: Sample[];
  declare best: number;
  declare offset: number;
  declare offsetAt: number;
  declare lastTime: number | null;
  declare lastAt: number;

  /** `window`, `slew`: see WINDOW and SLEW; `leg`: the one-way way from the server, in seconds */
  constructor({ window = WINDOW, slew = SLEW, leg = 0 } = {}) {
    this.window = window;
    this.slew = slew;
    this.leg = leg;
    this.reset();
  }

  /** A new song: nothing heard of the last one is news about it. */
  reset() {
    this.mode = 'unknown';
    this.frozen = 0;         // where the song stands while stopped
    this.epoch = 0;          // counts the jumps: whatever moved the song other than playing on
    this.samples = [];       // the messages of the last `window` seconds
    this.best = 0;           // the highest offset among them, plus our leg
    this.offset = 0;         // the estimate of (song time − our clock) as of offsetAt
    this.offsetAt = 0;
    this.lastTime = null;    // the last message's time
    this.lastAt = 0;
  }

  /** The song plays on from `time`, seen at `at`. */
  private start(time: number, at: number) {
    this.mode = 'playing';
    this.epoch += 1;
    this.samples = [{ at, offset: time - at }];
    this.best = this.offset = time - at + this.leg;
    this.offsetAt = at;
  }

  private stop(time: number) {
    if (this.mode !== 'stopped') this.epoch += 1;
    this.mode = 'stopped';
    this.frozen = time;
    this.samples = [];
  }

  /** Where the estimate has come by `now`, on its way down to the bound. */
  private offsetBy(now: number) {
    const left = this.offset - this.best;
    if (left <= 0) return this.offset;
    return this.offset - Math.min(left, Math.max(0, now - this.offsetAt) * this.slew);
  }

  /**
   * Takes in a video:time message: the host's `time`, whether it plays, and
   * when the message came (seconds on any steady clock).
   */
  report(time: number, playing: boolean, at: number) {
    if (!Number.isFinite(time) || !Number.isFinite(at)) return;
    const last = this.lastTime;
    this.lastTime = time;
    this.lastAt = at;
    if (!playing) { this.stop(time); return; }
    const moved = last === null ? Infinity : time - last;
    if (this.mode !== 'playing') {
      // Started, or going on after it stood still: from the first time that moved
      if (this.mode === 'stopped' && Math.abs(moved) < MOVED) return;
      this.start(time, at);
      return;
    }
    if (moved < -BACK || moved > SILENT) { this.start(time, at); return; }
    if (moved < MOVED) { this.stop(time); return; }
    this.offset = this.offsetBy(at);
    this.offsetAt = at;
    if (moved < RHYTHM) this.samples = []; // what the host said before this no longer counts
    const { samples } = this;
    samples.push({ at, offset: time - at });
    while (samples[0].at < at - this.window) samples.shift();
    let best = -Infinity;
    for (const s of samples) if (s.offset > best) best = s.offset;
    this.best = best + this.leg;
    if (this.best > this.offset) this.offset = this.best;
  }

  /** The host stopped (it left, or went to the menu): the song stands where it was. */
  halt(now: number) {
    const time = this.timeAt(now);
    if (time !== null) this.stop(time);
  }

  /** The song's time at `now` (the clock of `report`), null before any message. */
  timeAt(now: number): number | null {
    switch (this.mode) {
      case 'unknown': return null;
      case 'stopped': return this.frozen;
      case 'playing': return now + this.offsetBy(now);
    }
  }

  /** For the debug overlay: how far the newest message sat below the bound, how old it is, the leg it is taken to have come. */
  info(now: number) {
    return {
      mode: this.mode, epoch: this.epoch, time: this.timeAt(now), messages: this.samples.length, leg: this.leg,
      lag: this.mode === 'playing' && this.lastTime !== null ? this.best - this.leg - (this.lastTime - this.lastAt) : null,
      age: this.lastTime === null ? null : now - this.lastAt,
    };
  }
}
