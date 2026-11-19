import { describe, test, expect } from 'vitest';
import { readVoiceWindow, writeVoiceWindow, windowOf, endsOf, sameWindow, noteName, VOICE_MIN, VOICE_MAX } from './voiceWindow';

describe('the voice window', () => {
  test('in the address: both sides or one; anything else is none', () => {
    expect(readVoiceWindow('55-62')).toEqual({ min: 55, max: 62 });
    expect(readVoiceWindow('62-55')).toEqual({ min: 55, max: 62 });
    expect(readVoiceWindow('-63')).toEqual({ min: null, max: 63 });
    expect(readVoiceWindow('64-')).toEqual({ min: 64, max: null });
    for (const bad of [null, '', '-', 'low', '60', 'a-b', '1-2-3']) expect(readVoiceWindow(bad)).toBeNull();
    for (const w of [{ min: 55, max: 62 }, { min: null, max: 63 }, { min: 64, max: null }]) expect(readVoiceWindow(writeVoiceWindow(w))).toEqual(w);
  });

  test('the slider: a thumb at its end leaves that side open, both there is no window', () => {
    expect(windowOf(VOICE_MIN, VOICE_MAX)).toBeNull();
    expect(windowOf(VOICE_MIN, 63)).toEqual({ min: null, max: 63 });
    expect(windowOf(64, VOICE_MAX)).toEqual({ min: 64, max: null });
    expect(endsOf(null)).toEqual([VOICE_MIN, VOICE_MAX]);
    expect(endsOf({ min: 30, max: 100 })).toEqual([VOICE_MIN, VOICE_MAX]);  // past the ends: at the ends
    expect(endsOf({ min: 55, max: null })).toEqual([55, VOICE_MAX]);
    expect(sameWindow(windowOf(...endsOf({ min: 55, max: 62 })), { min: 55, max: 62 })).toBe(true);
    expect(sameWindow(null, null)).toBe(true);
    expect(sameWindow(null, { min: null, max: 63 })).toBe(false);
  });

  test('note names: C4 is 60; H where B natural is written so', () => {
    expect(noteName(60)).toBe('C4');
    expect(noteName(61)).toBe('C#4');
    expect(noteName(71, 'en')).toBe('B4');
    expect(noteName(71, 'de')).toBe('H4');
    expect(noteName(48)).toBe('C3');
  });
});
