import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { sendFeedback } from "../logic/authApi";
import { platformHints } from "../logic/platformHints";
import { ask, closePrompt, engage, feedbackCounts, markAnswered, moveOn, useFeedbackPrompt, type FeedbackPlace } from "../logic/feedbackPrompt";

const MAX_COMMENT = 1000;
/** The home page asks a moment after it has settled, not as it appears */
const HOME_DELAY_MS = 2500;
const THANKS_MS = 2500;

/** Who is asked, as the party page knows it */
export interface FeedbackAskContext {
  host?: boolean;
  nickname?: string | null;
  partyId?: string | null;
}

export interface FeedbackPromptProps {
  where: FeedbackPlace;
  /** party page: the score screen is up (between songs) */
  between?: boolean;
  getContext?: () => FeedbackAskContext;
}

type Phase = 'ask' | 'rated' | 'sending' | 'thanks';

/**
 * "How do you like SingSpree?": one to five stars and, after a star, a few
 * words if they like, in a small card in the corner. When it may show is
 * logic/feedbackPrompt.ts (after a few songs, between songs or on the home
 * page); the answers go to the admins (backend feedback.ts, /admin).
 *
 * The stars are sent at once and the words with Send, as a change to the
 * same answer. On the party page the card sits at the top on phones (the
 * score screen's buttons are at the bottom) and in the bottom right corner
 * on wide screens; on the home page above its footer bar. Solid tint, no
 * backdrop blur: it may float over the playing video while someone types.
 */
const FeedbackPrompt = ({ where, between = false, getContext }: FeedbackPromptProps) => {
  const { t, i18n } = useTranslation();
  const { open } = useFeedbackPrompt();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [phase, setPhase] = useState<Phase>('ask');
  const [failed, setFailed] = useState(false);
  const saved = useRef<{ id: number; token: string } | null>(null);
  const contextRef = useRef(getContext);
  contextRef.current = getContext;

  // The party page asks when the score screen comes up; the next song takes an untouched card away
  useEffect(() => {
    if (where !== 'party') return;
    if (between) ask('party'); else moveOn();
  }, [where, between]);

  // The home page asks once it has settled
  useEffect(() => {
    if (where !== 'home') return undefined;
    const timer = setTimeout(() => ask('home'), HOME_DELAY_MS);
    return () => clearTimeout(timer);
  }, [where]);

  // Leaving the page takes the card along, touched or not (the stars are sent already)
  useEffect(() => () => moveOn(true), []);

  // A new card starts empty
  useEffect(() => {
    if (!open) return;
    setRating(0); setHover(0); setComment(''); setPhase('ask'); setFailed(false);
    saved.current = null;
  }, [open]);

  useEffect(() => {
    if (phase !== 'thanks') return undefined;
    const timer = setTimeout(closePrompt, THANKS_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  if (!open) return null;

  const send = async (stars: number, words = '') => {
    const ctx = contextRef.current?.() ?? {};
    const answer = await sendFeedback({
      rating: stars,
      comment: words.trim() || undefined,
      context: { ...feedbackCounts(), host: ctx.host ?? null, page: where, lang: i18n.language, platform: await platformHints() },
      nickname: ctx.nickname ?? null,
      partyId: ctx.partyId ?? null,
      ...(saved.current ?? {}),
    });
    saved.current = { id: answer.id, token: answer.token };
    markAnswered();
  };

  const pick = (stars: number) => {
    engage();
    setRating(stars);
    setFailed(false);
    if (phase === 'ask') setPhase('rated');
    send(stars, comment).catch(() => setFailed(true));
  };

  const submit = async () => {
    if (!rating || !comment.trim() || phase === 'sending') return;
    setPhase('sending');
    setFailed(false);
    try {
      await send(rating, comment);
      setPhase('thanks');
    } catch {
      setPhase('rated');
      setFailed(true);
    }
  };

  const shown = hover || rating;
  const place = where === 'party'
    ? 'z-[60] top-2 inset-x-2 mx-auto max-w-sm lg:top-auto lg:bottom-4 lg:inset-x-auto lg:right-4 lg:mx-0 lg:w-80'
    : 'z-50 bottom-14 inset-x-3 sm:inset-x-auto sm:right-4 sm:w-80';

  return (
    <section
      aria-labelledby="feedback-title"
      data-feedback-prompt=""
      className={`pop fixed rounded-2xl p-4 shadow-[0_12px_40px_rgba(0,0,0,0.45)] animate-slide-up ${place}`}
    >
      <div className="flex items-start gap-2">
        <div id="feedback-title" className="flex-1 min-w-0 text-white text-[15px] font-semibold tracking-[-0.01em] leading-snug">
          {phase === 'thanks' ? t('feedback.thanks') : t('feedback.title')}
        </div>
        <button
          type="button"
          onClick={closePrompt}
          title={t('feedback.close')}
          aria-label={t('feedback.close')}
          className="btn-icon w-7 h-7 -mr-1.5 -mt-1 text-white/50 text-xs flex-shrink-0"
        >
          &#10005;
        </button>
      </div>

      {phase !== 'thanks' && (
        <>
          <div className="mt-2 flex gap-0.5" role="group" aria-label={t('feedback.title')} onMouseLeave={() => setHover(0)}>
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                type="button"
                onClick={() => pick(n)}
                onMouseEnter={() => setHover(n)}
                onFocus={() => setHover(n)}
                onBlur={() => setHover(0)}
                aria-label={t('feedback.stars', { n })}
                aria-pressed={rating === n}
                className={`w-10 h-10 -my-0.5 grid place-items-center rounded-lg text-[28px] leading-none transition-[color,transform] duration-150 hover:scale-110 focus-visible:outline-2 focus-visible:outline-[#ff5cd6] ${
                  n <= shown ? 'text-yellow-400 drop-shadow-[0_0_6px_rgba(250,204,21,0.55)]' : 'text-white/25'
                }`}
              >
                ★
              </button>
            ))}
          </div>

          {phase !== 'ask' && (
            <div className="mt-2.5">
              <div className="text-xs text-white/60 mb-2">{t('feedback.rated')}</div>
              <textarea
                value={comment}
                onChange={(e) => { engage(); setComment(e.target.value.slice(0, MAX_COMMENT)); }}
                placeholder={rating <= 3 ? t('feedback.placeholderLow') : t('feedback.placeholderHigh')}
                rows={3}
                className="field px-3 py-2 text-sm resize-none"
              />
              {failed && <div className="mt-1 text-[11px] text-[#ff8a97]">{t('feedback.failed')}</div>}
              <div className="mt-2.5 flex justify-end">
                <button
                  type="button"
                  onClick={submit}
                  disabled={!comment.trim() || phase === 'sending'}
                  className="btn btn-sm btn-primary"
                >
                  {phase === 'sending' ? t('feedback.sending') : t('feedback.send')}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default FeedbackPrompt;
