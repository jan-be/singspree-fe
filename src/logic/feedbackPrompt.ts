import { songPrompt } from './songPrompt';

export { SONGS_BEFORE_ASKING, SONGS_BETWEEN_ASKS, MAX_SHOWN } from './songPrompt';
export type { PromptPlace as FeedbackPlace } from './songPrompt';

/** When to ask "How do you like SingSpree?" (FeedbackPrompt.tsx): logic/songPrompt.ts */
export const {
  noteSongFinished, mayAsk, ask, moveOn, engage, markAnswered, closePrompt,
  counts: feedbackCounts, usePrompt: useFeedbackPrompt, reset: _resetFeedbackPrompt,
} = songPrompt('singspree_feedback');
