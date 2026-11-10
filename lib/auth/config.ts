/**
 * What is really connected. Everything that isn't configured runs as a labelled DEMO,
 * and nothing in the UI may claim a provider is connected unless it is here.
 */
export function authConfig() {
  const db = Boolean(process.env.DATABASE_URL);
  const google = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  const email = Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);
  const translation = Boolean(process.env.DEEPL_API_KEY);
  // Demo helpers (in-memory store, demo mailbox, Google simulator) only exist without a real database.
  const demo = !db;
  return {
    mode: demo ? ("demo" as const) : ("production" as const),
    store: db ? ("postgres" as const) : ("memory" as const),
    google: google ? ("connected" as const) : demo ? ("demo-simulator" as const) : ("not-configured" as const),
    email: email ? ("connected" as const) : demo ? ("demo-mailbox" as const) : ("not-configured" as const),
    translation: translation ? ("connected" as const) : ("not-configured" as const),
  };
}
export type AuthConfig = ReturnType<typeof authConfig>;

export const SESSION_COOKIE = "fk_session";
export const SESSION_TTL_MS = 30 * 24 * 3600 * 1000;
export const VERIFY_TTL_MS = 24 * 3600 * 1000;
export const RESET_TTL_MS = 30 * 60 * 1000;
export const DEMO_INBOX_COOKIE = "fk_demo_inbox";
