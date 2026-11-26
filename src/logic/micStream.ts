// Opening the microphone's stream for the pitch pipeline (MicrophoneInput.ts).
// On its own so the rule for a remembered device that is gone can be tested
// without the pitch workers.

/** The voice as it is: the pitch detector wants no echo cancellation, gain control or noise suppression */
const RAW_AUDIO = { echoCancellation: false, autoGainControl: false, noiseSuppression: false };

/**
 * A device asked for by its id is not there. Chrome says OverconstrainedError
 * while another microphone is plugged in and NotFoundError with none at all
 * (DevicesNotFoundError: the same, in old spelling).
 */
export const isDeviceGone = (e: unknown): boolean => {
  const name = typeof e === 'object' && e !== null && 'name' in e ? e.name : undefined;
  return name === 'OverconstrainedError' || name === 'NotFoundError' || name === 'DevicesNotFoundError';
};

/**
 * The microphone's stream: the device asked for, the browser's default without one.
 *   onDeviceGone: with it, a device that is gone (unplugged, the id of another
 *     browser profile) is no reason to fail: the default microphone is asked
 *     for once instead, and when that opens this is called, for the caller to
 *     forget the id. A second failure is the one thrown. Without it there is
 *     no second try (an extra microphone must not turn into a copy of the
 *     default one).
 *   getUserMedia: for tests.
 */
export async function openMicStream({ deviceId, onDeviceGone, getUserMedia = constraints => navigator.mediaDevices.getUserMedia(constraints) }: {
  deviceId?: string,
  onDeviceGone?: () => void,
  getUserMedia?: (constraints: MediaStreamConstraints) => Promise<MediaStream>,
} = {}): Promise<MediaStream> {
  if (!deviceId) return getUserMedia({ audio: RAW_AUDIO });
  try {
    return await getUserMedia({ audio: { ...RAW_AUDIO, deviceId: { exact: deviceId } } });
  } catch (e) {
    if (!onDeviceGone || !isDeviceGone(e)) throw e;
  }
  const stream = await getUserMedia({ audio: RAW_AUDIO });
  onDeviceGone();
  return stream;
}
