import { de } from './locales/de';
import type { Messages } from './types';

export type { Messages } from './types';

/** UI locale. German-only in v1 — add locales/en.ts and a switch here later. */
export const t: Messages = de;
