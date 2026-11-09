/**
 * The `t` that logic modules take from a page (useTranslation): i18next's TFunction fits it, and so does a test's
 * stand-in such as `(key) => key`.
 */
export type Translate = {
  (key: string): string;
  // i18next 27's TFunction only takes options as their own overload (with them required), so one optional
  // parameter no longer fits it
  (key: string, options: Record<string, unknown>): string;
};
