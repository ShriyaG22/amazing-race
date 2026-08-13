/**
 * Feature flags.
 *
 * AI generation works, but the routes it produces don't reliably match the
 * theme or difficulty selected, and that's not something prompting alone can
 * fix — the model can't verify whether a challenge actually works at a given
 * doorway. Hidden until there's curated content to stand on.
 *
 * Flip SHOW_AI_GENERATE back to true to restore it everywhere at once.
 */
export const SHOW_AI_GENERATE = false;
