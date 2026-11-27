import raw from "../wordmark.svg?raw";
import { createInlineSvg } from "./inlineSvg";

/**
 * The SingSpree wordmark (src/wordmark.svg): the icon's neon S with its mic,
 * then "ing" in the same pink and "Spree" in the mic's cyan, in the neon tube
 * letters. The drawing leaves room above for the mic and below for the g,
 * so it is taller than its letters: about 2.2 × the capital height. The
 * letters' glow is wider than the room left around them and reaches a little
 * past the box (the file asks for overflow visible), so the box, and with it
 * every layout, is the size it was with the narrower glow before.
 */
const Wordmark = createInlineSvg(raw, { label: "SingSpree" });
export default Wordmark;
