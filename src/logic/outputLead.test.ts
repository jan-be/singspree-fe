import { describe, it, expect } from 'vitest';
import { contextLatency, nextLead, leadEstimate, isFireTv, FIRE_TV_UNCOUNTED } from './outputLead';

const STICK_APP = 'Mozilla/5.0 (Linux; Android 9; AFTKA Build/PS7713.5443N; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/138.0.7204.168 Mobile Safari/537.36 SingSpreeTV/1.0.1';
const STICK_SILK = 'Mozilla/5.0 (Linux; Android 9; AFTMM) AppleWebKit/537.36 (KHTML, like Gecko) Silk/112.3.1 like Chrome/112.0.5615.213 Safari/537.36';
const PHONE = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36';
const PC = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';

describe('contextLatency', () => {
  it('adds the context buffer and the device after it', () => {
    expect(contextLatency({ baseLatency: 0.043, outputLatency: 0.512 })).toBeCloseTo(0.555, 6); // the stick on Bluetooth
    expect(contextLatency({ baseLatency: 0.01, outputLatency: 0.04 })).toBeCloseTo(0.05, 6);    // a desktop
  });
  it('is 0 where the browser gives nothing, and capped where it gives nonsense', () => {
    expect(contextLatency(undefined)).toBe(0);
    expect(contextLatency({})).toBe(0);
    expect(contextLatency({ baseLatency: 0.01, outputLatency: 5 })).toBe(1);
    expect(contextLatency({ outputLatency: -1 })).toBe(0);
  });
});

describe('isFireTv', () => {
  it('knows a Fire TV by its model code, in our app and in Silk', () => {
    expect(isFireTv(STICK_APP)).toBe(true);
    expect(isFireTv(STICK_SILK)).toBe(true);
    expect(isFireTv(PHONE)).toBe(false);
    expect(isFireTv(PC)).toBe(false);
    expect(isFireTv('Mozilla/5.0 (Linux; Android 11; SM-A515F) AFTERGLOW')).toBe(false);
  });
});

describe('leadEstimate', () => {
  const stick = { baseLatency: 0.043, outputLatency: 0.248 };
  it('adds what a Fire TV leaves out', () => {
    expect(leadEstimate(stick, STICK_APP)).toBeCloseTo(0.291 + FIRE_TV_UNCOUNTED, 6);
    expect(leadEstimate(stick, PC)).toBeCloseTo(0.291, 6);
  });
  it('is 0 without an estimate, so the last lead stays (nextLead)', () => {
    expect(leadEstimate(undefined, STICK_APP)).toBe(0);
    expect(leadEstimate({}, STICK_APP)).toBe(0);
  });
  it('stays under the cap', () => {
    expect(leadEstimate({ baseLatency: 0.043, outputLatency: 0.95 }, STICK_APP)).toBe(1);
  });
});

describe('nextLead', () => {
  it('takes the first estimate at once and follows later ones slowly', () => {
    let lead = nextLead(0, 0.3);
    expect(lead).toBe(0.3);
    lead = nextLead(lead, 0.55);
    expect(lead).toBeCloseTo(0.35, 6);
    for (let i = 0; i < 30; i++) lead = nextLead(lead, 0.55); // 15 s of updates
    expect(lead).toBeCloseTo(0.55, 2);
  });
  it('keeps the last lead when there is no estimate', () => {
    expect(nextLead(0.3, 0)).toBe(0.3);
    expect(nextLead(0, 0)).toBe(0);
  });
});
