/**
 * Fixed UI labels that live in lib/ (ranking categories, DAO states, alert types…) are written in English there and
 * translated where they are shown, through the "labels" namespace keyed by a slug of the English text.
 * This keeps lib/ free of React and lets server code keep using the English text (logs, audit, API answers).
 */
export const labelKey = (english: string) =>
  english
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60) || "_";
