import { describe, it, expect, vi } from 'vitest';
import { openMicStream } from './micStream';

const err = (name: string) => Object.assign(new Error(name), { name });
const RAW = { echoCancellation: false, autoGainControl: false, noiseSuppression: false };
const DEFAULT_MIC = { id: 'default microphone' } as unknown as MediaStream;
const USB_MIC = { id: 'usb microphone' } as unknown as MediaStream;

/**
 * A browser's getUserMedia: `byId` is what asking for a device by id gives,
 * `byDefault` what asking for no device in particular gives (an Error rejects)
 */
const browser = ({ byId, byDefault }: { byId?: MediaStream | Error, byDefault?: MediaStream | Error }) =>
  vi.fn(async (constraints: MediaStreamConstraints) => {
    const audio = constraints.audio;
    const answer = typeof audio === 'object' && audio.deviceId ? byId : byDefault;
    if (!answer || answer instanceof Error) throw answer ?? err('TypeError');
    return answer;
  });

describe('openMicStream', () => {
  it('no device chosen: the default microphone, raw, asked for once', async () => {
    const getUserMedia = browser({ byDefault: DEFAULT_MIC });
    const onDeviceGone = vi.fn();
    expect(await openMicStream({ onDeviceGone, getUserMedia })).toBe(DEFAULT_MIC);
    expect(getUserMedia.mock.calls).toEqual([[{ audio: RAW }]]);
    expect(onDeviceGone).not.toHaveBeenCalled();
  });

  it('a chosen device that is there: that one exactly, nothing forgotten', async () => {
    const getUserMedia = browser({ byId: USB_MIC, byDefault: DEFAULT_MIC });
    const onDeviceGone = vi.fn();
    expect(await openMicStream({ deviceId: 'usb', onDeviceGone, getUserMedia })).toBe(USB_MIC);
    expect(getUserMedia.mock.calls).toEqual([[{ audio: { ...RAW, deviceId: { exact: 'usb' } } }]]);
    expect(onDeviceGone).not.toHaveBeenCalled();
  });

  it('a remembered device that is gone: the default microphone opens instead, and the caller hears of it', async () => {
    for (const name of ['OverconstrainedError', 'NotFoundError', 'DevicesNotFoundError']) {
      const getUserMedia = browser({ byId: err(name), byDefault: DEFAULT_MIC });
      const onDeviceGone = vi.fn();
      expect(await openMicStream({ deviceId: 'unplugged', onDeviceGone, getUserMedia })).toBe(DEFAULT_MIC);
      expect(getUserMedia.mock.calls).toEqual([
        [{ audio: { ...RAW, deviceId: { exact: 'unplugged' } } }],
        [{ audio: RAW }],
      ]);
      expect(onDeviceGone).toHaveBeenCalledTimes(1);
    }
  });

  it('the default fails too: its error is the one thrown, after one second try, and the device stays remembered', async () => {
    for (const second of ['NotFoundError', 'NotAllowedError']) {
      const getUserMedia = browser({ byId: err('OverconstrainedError'), byDefault: err(second) });
      const onDeviceGone = vi.fn();
      await expect(openMicStream({ deviceId: 'unplugged', onDeviceGone, getUserMedia })).rejects.toMatchObject({ name: second });
      expect(getUserMedia).toHaveBeenCalledTimes(2);
      expect(onDeviceGone).not.toHaveBeenCalled();
    }
  });

  it('any other failure of the chosen device is no reason to try the default', async () => {
    for (const name of ['NotAllowedError', 'NotReadableError', 'AbortError']) {
      const getUserMedia = browser({ byId: err(name), byDefault: DEFAULT_MIC });
      const onDeviceGone = vi.fn();
      await expect(openMicStream({ deviceId: 'usb', onDeviceGone, getUserMedia })).rejects.toMatchObject({ name });
      expect(getUserMedia).toHaveBeenCalledTimes(1);
      expect(onDeviceGone).not.toHaveBeenCalled();
    }
  });

  it('no microphone at all and none chosen: asked once', async () => {
    const getUserMedia = browser({ byDefault: err('NotFoundError') });
    await expect(openMicStream({ onDeviceGone: vi.fn(), getUserMedia })).rejects.toMatchObject({ name: 'NotFoundError' });
    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });

  it('without onDeviceGone (an extra microphone) a device that is gone fails as it is', async () => {
    const getUserMedia = browser({ byId: err('OverconstrainedError'), byDefault: DEFAULT_MIC });
    await expect(openMicStream({ deviceId: 'unplugged', getUserMedia })).rejects.toMatchObject({ name: 'OverconstrainedError' });
    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });
});
