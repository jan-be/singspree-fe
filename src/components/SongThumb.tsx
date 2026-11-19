import AiBadge from "./AiBadge";

/**
 * A song's small picture in a list (the queue, the pickers' results, a
 * playlist): its video's thumbnail, the AI badge on a song the AI charted
 * (a chart still being made counts too: `ai`), dimmed while it is not ready.
 * `className` sets the width (w-16 in the queue).
 */
const SongThumb = ({ videoId, generated = false, beta, ai = false, dim = false, className = 'w-12' }: {
  videoId?: string | null;
  generated?: boolean;
  beta?: boolean;
  ai?: boolean;
  dim?: boolean;
  className?: string;
}) => (
  <span className={`relative block flex-shrink-0 ${className}`}>
    {videoId
      ? <img src={`https://i.ytimg.com/vi/${videoId}/default.jpg`} alt="" loading="lazy" className={`block w-full aspect-video rounded-md object-cover ${dim ? 'opacity-70' : ''}`} />
      : <span className="block w-full aspect-video rounded-md bg-white/10" />}
    {(ai || generated) && <AiBadge beta={beta} />}
  </span>
);

export default SongThumb;
