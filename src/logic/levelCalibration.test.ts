import { describe, it, expect } from 'vitest';
import { createLevelCalibration, VOICE_TARGET, MAX_GAIN } from './levelCalibration';

const sure = (volume: number) => ({ volume, pitchHz: 220, confidence: 0.98 });
const unsure = (volume: number) => ({ volume, pitchHz: 220, confidence: 0.3 });

describe('createLevelCalibration', () => {
  it('starts without a boost', () => {
    expect(createLevelCalibration().gain()).toBe(1);
  });

  it('brings the loudest sound lately to the voice level at once, sure or not', () => {
    const c = createLevelCalibration({ stepSeconds: 0.03 });
    c.update(unsure(0.02));            // a quiet microphone's voice, which the model is not sure of at that level
    expect(c.gain()).toBeCloseTo(VOICE_TARGET / 0.02, 6);
    expect(c.voiceLevel()).toBeCloseTo(0.02, 6);
    c.update(unsure(0.005));           // quieter sounds change nothing
    expect(c.gain()).toBeLessThan(1.01 * VOICE_TARGET / 0.02);
    c.update(unsure(0.05));            // a louder one turns it down again
    expect(c.gain()).toBeCloseTo(VOICE_TARGET / 0.05, 6);
  });

  it('lets the loudest sound fade: half a minute of quiet singing is turned up to its own level', () => {
    const c = createLevelCalibration({ stepSeconds: 0.03 });
    c.update(unsure(0.1));             // a cough
    for (let i = 0; i < 1000; i++) c.update(sure(0.01)); // 30 s of a quiet voice
    expect(c.gain()).toBeGreaterThan(0.9 * VOICE_TARGET / 0.01);
    expect(c.gain()).toBeLessThan(1.05 * VOICE_TARGET / 0.01);
  });

  it('holds on to the voice level it is sure of while louder sounds are gone', () => {
    const c = createLevelCalibration({ stepSeconds: 0.03 });
    for (let i = 0; i < 1200; i++) c.update(sure(0.02));    // the voice: turned up to its level
    for (let i = 0; i < 2000; i++) c.update(unsure(0.004)); // a minute of the room alone: the loudest fades to the room's level
    // (the room is then the loudest lately and is brought up, as far as the cap allows)
    expect(c.gain()).toBe(MAX_GAIN);
    c.update(sure(0.02));                                    // the voice again: back at once
    expect(c.gain()).toBeCloseTo(VOICE_TARGET / 0.02, 1);
  });

  it('never turns a loud mic down, nor boosts beyond the cap', () => {
    const loud = createLevelCalibration({ stepSeconds: 0.03 });
    for (let i = 0; i < 600; i++) loud.update(sure(0.6));
    expect(loud.gain()).toBe(1);
    const faint = createLevelCalibration({ stepSeconds: 0.03 });
    for (let i = 0; i < 3000; i++) faint.update(sure(0.0005));
    expect(faint.gain()).toBe(MAX_GAIN);
  });

  it('learns nothing from silence or a failed inference', () => {
    const c = createLevelCalibration({ stepSeconds: 0.03 });
    for (let i = 0; i < 600; i++) {
      c.update({ volume: 0, pitchHz: 220, confidence: 0.99 });           // silence
      c.update({ volume: 0, pitchHz: undefined, confidence: undefined }); // the inference failed
    }
    expect(c.gain()).toBe(1);
  });

  it('follows the sure windows, not the loudest, once the two differ: an unsure bang is forgotten', () => {
    const c = createLevelCalibration({ stepSeconds: 0.03 });
    for (let i = 0; i < 1200; i++) c.update(sure(0.03));
    c.update(unsure(0.3));             // a door: for a moment the loudest
    expect(c.gain()).toBeCloseTo(VOICE_TARGET / 0.03, 1); // the sure level asks for more than the loudest: it stands
  });

  it('adapts at the same speed per second whatever the window step', () => {
    const fast = createLevelCalibration({ stepSeconds: 0.015 });
    const slow = createLevelCalibration({ stepSeconds: 0.03 });
    for (let i = 0; i < 400; i++) fast.update(sure(0.03));
    for (let i = 0; i < 200; i++) slow.update(sure(0.03));
    expect(slow.gain()).toBeCloseTo(fast.gain(), 6);
  });
});
