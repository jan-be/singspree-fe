import { describe, expect, it } from 'vitest';
import { errorKey, jobTimes, qaReason, busyReason, gigabytes, whyKey } from './chartJobAdmin';

describe('jobTimes', () => {
  const now = Date.parse('2026-10-04T10:10:00Z');
  it('waited for a slot, then ran until it finished', () => {
    expect(jobTimes({ status: 'done', createdAt: '2026-10-04T10:00:00Z', startedAt: '2026-10-04T10:00:12Z', finishedAt: '2026-10-04T10:02:00Z' }, now))
      .toEqual({ waited: 12, took: 108, total: 120 });
  });
  it('counts up to now while it runs or waits', () => {
    expect(jobTimes({ status: 'generating', createdAt: '2026-10-04T10:09:00Z', startedAt: '2026-10-04T10:09:30Z', finishedAt: null }, now))
      .toEqual({ waited: 30, took: 30, total: 60 });
    expect(jobTimes({ status: 'queued', createdAt: '2026-10-04T10:09:20Z', startedAt: null, finishedAt: null }, now)).toEqual({ waited: 40, took: null, total: 40 });
  });
  it('a job from before the start time was kept knows only its total', () => {
    expect(jobTimes({ status: 'done', createdAt: '2026-10-02T18:47:11Z', startedAt: null, finishedAt: '2026-10-02T18:49:13Z' }, now))
      .toEqual({ waited: null, took: null, total: 122 });
  });
});

describe('qaReason: the QA gate in words', () => {
  it('the flags by their signal, with the value as a share', () => {
    expect(qaReason('Whisper hears almost no words (instrumental / no vocals in the stem) (w_words_per_min=12.34)'))
      .toEqual({ key: 'fewWords', values: { value: 12.3, pct: 1234 } });
    expect(qaReason('no singing pitch found for a third of the words: the notes are unplayable (unseparated mix, shouted or whispered vocals) (p_freestyle=0.41)'))
      .toEqual({ key: 'noPitch', values: { value: 0.4, pct: 41 } });
    expect(qaReason('no lyrics text found: the words are what Whisper heard (l_has_lyrics=0.00)').key).toBe('noLyrics');
  });
  it('the lyrics match: hardly at all (held) or in part (beta)', () => {
    expect(qaReason('the lyrics text does not match what is sung (wrong song, version or language, or no singing): regenerate without it (Whisper text) and publish as beta (m_match_share=0.12)'))
      .toEqual({ key: 'lyricsMismatch', values: { value: 0.1, pct: 12 } });
    expect(qaReason('only part of what is sung matches the lyrics text (other version / partial lyrics) (m_match_share=0.45)').key).toBe('lyricsPartial');
    // nothing matches: both flags fire, each keeps its own words
    expect(qaReason('only part of what is sung matches the lyrics text (other version / partial lyrics) (m_match_share=0.00)').key).toBe('lyricsPartial');
  });
  it('the predicted score and a remade chart', () => {
    expect(qaReason('predicted score 0.35 < 0.4')).toEqual({ key: 'predicted', values: { score: '0.35', limit: '0.40' } });
    expect(qaReason('the lyrics found did not match the singing: words are what Whisper heard').key).toBe('regenerated');
  });
  it('one it does not know stays as the generator wrote it', () => {
    expect(qaReason('something new (x_new=0.5)')).toEqual({ text: 'something new (x_new=0.5)' });
    expect(qaReason(null)).toEqual({ text: '' });
  });
});

describe('errorKey', () => {
  it('known codes as they are, anything else is an error', () => {
    expect(errorKey('download')).toBe('download');
    expect(errorKey('qa_hold')).toBe('qa_hold');
    expect(errorKey('weird')).toBe('error');
    expect(errorKey(null)).toBe('error');
  });
});

describe('where songs are made', () => {
  it('busy reasons with their values, memory in gigabytes in the page language', () => {
    expect(busyReason({ code: 'gpu', value: 88, limit: 25 })).toEqual({ key: 'gpu', values: { value: 88, limit: 25 } });
    expect(busyReason({ code: 'vram', value: 4012, limit: 2500 })).toEqual({ key: 'vram', values: { value: '4', limit: '2.5' } });
    expect(busyReason({ code: 'memory', value: 2450, limit: 3000 }, 'de')).toEqual({ key: 'memory', values: { value: '2,5', limit: '3' } });
    expect(busyReason({ code: 'offline' })).toEqual({ key: 'offline', values: { value: 0, limit: 0 } });
    expect(gigabytes(null)).toBe('?');
  });
  it('the reasons a job went where it went, as far as there are words for them', () => {
    expect(whyKey('pc_busy')).toBe('pc_busy');
    expect(whyKey('resume')).toBe(null);
    expect(whyKey(null)).toBe(null);
  });
});
