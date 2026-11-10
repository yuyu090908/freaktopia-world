# FREAKTOPIA WORLD 8.0: languages, accounts and alien identity

This document covers the 12-language platform, the account system and the one-alien-per-user identity, how they plug into WORLD MAP, LIVE and the FESTIVAL DAO, and what is real versus demo.

## 1. Languages (i18n)

| | |
|---|---|
| Library | `next-intl` 4 (App Router, server and client components) |
| Languages | `en` (fallback), `ja`, `ko`, `zh-CN`, `ru`, `th`, `es`, `pt` (Brazilian Portuguese, `pt-BR` hreflang), `fr`, `de`, `vi`, `id` |
| Dictionaries | `messages/{locale}.json`, 506 keys each, identical structure |
| Config | `i18n/config.ts` (list, native names, hreflang, Accept-Language parser, path helpers) |
| Loading | `i18n/messages.ts`: only the active language is imported (dynamic import), then deep-merged over English so a missing key falls back to English instead of breaking |

### URLs
- `/{locale}/…` (for example `/ja/world`, `/zh-cn/live/bassmutant-tokyo`). The codes in URLs are lowercase.
- Unprefixed URLs (`/world`) keep working. The language comes from the `NEXT_LOCALE` cookie, then the browser's `Accept-Language`, then English.
- `middleware.ts` rewrites `/{locale}/path` to `/path` and passes the language in request headers, so the existing route tree did not have to move under a `[locale]` segment (no migration of 60+ pages).
- Every page sets `<html lang dir>`, a canonical URL, `hreflang` alternates for the 12 languages plus `x-default`, and the Open Graph locale. `app/sitemap.ts` lists every page in every language with alternates.
- Adding `zh-TW` later: add it to `LOCALES` and `LOCALE_META` in `i18n/config.ts`, add a loader in `i18n/messages.ts`, add `messages/zh-TW.json`. The Accept-Language parser already refuses to map `zh-TW` / `zh-HK` to Simplified Chinese.

### Switcher
`components/i18n/LanguageSwitcher.tsx`: a globe with the language code in the header. On desktop it opens a popover; on phones a bottom sheet. Each language is listed in its own script. Switching:
1. saves the choice (to the profile when signed in through `POST /api/locale`, otherwise in the cookie),
2. swaps the URL prefix in place with `history.replaceState` (the current page stays),
3. calls `router.refresh()`, which re-renders server text without remounting client components, so the world map and its data are not fetched again.

### Formatting
`lib/i18n/format.ts` uses `Intl` for money, numbers, compact numbers, relative times and dates. Event dates and times are always formatted in the **venue's time zone** and labelled with it.

### User content
Event names, descriptions, DAO posts and comments are shown as written. `components/i18n/UserContent.tsx` adds a "See translation" button. It calls `POST /api/translate`, which uses DeepL only when `DEEPL_API_KEY` is set and labels the result "Machine translated by DeepL", with "See original". Without a key the endpoint answers `503 TRANSLATION_NOT_CONFIGURED` and the UI says translation isn't connected. Nothing is ever shown as translated when it wasn't.

### Missing keys
- `node scripts/check-i18n.mjs` compares every dictionary with English: missing keys, extra keys, empty values and placeholder mismatches. Exit code 1 on any problem.
- `tests/unit/i18n.test.ts` runs the same checks plus ICU syntax for every message in every language, and plural rules (Russian one/few/many).
- At runtime outside production a missing key is logged; the fallback is the English text.
- The Playwright suite scans pages in ja, ru and th for leaked raw keys.

### Fonts
`next/font` self-hosts Noto Sans JP, KR, SC, Thai and Noto Sans (Cyrillic, Vietnamese, Latin Extended), not preloaded. `html:lang(…)` rules in `app/globals.css` switch the font stacks, so a Japanese visitor downloads only the Japanese font. Non-Latin headings use real weight 900 without fake bold.

### Coverage
Translated in all 12 languages: header, navigation, footer, language switcher, every auth screen and error, all emails, alien Reveal and customizer, profile and privacy settings, account card, WORLD MAP (search, chips, filters, legend, list, panel facts and actions, statuses, levels), DAO vote gate and avatar notes, LIVE identity notes, metadata, accessibility labels of those components.

Still English-first (not yet moved into the dictionaries): the bulk of the older page bodies (home hero copy, events and ticket wizards, DJ Arena, venues, after party, most LIVE room and DAO screens, info pages) and the labels drawn inside map marker SVGs. They render inside the translated shell with the right fonts and fall back cleanly. Moving them is mechanical: replace literals with `useTranslations` keys and add the keys to `messages/en.json`; the check script then lists exactly what each language is missing.

## 2. Accounts (auth)

| Piece | Where |
|---|---|
| Service (sign-up, verify, sign-in, reset, Google, sessions, alien) | `lib/auth/service.ts` |
| Storage interface | `lib/auth/types.ts` (`AuthStore`), memory implementation `lib/auth/memory.ts`, Postgres `lib/auth/pg.ts` |
| HTTP helpers (CSRF, rate limit, cookies) | `lib/auth/http.ts` |
| API | `app/api/auth/[[...path]]/route.ts`, `app/api/me/[[...path]]/route.ts`, `app/api/locale/route.ts` |
| Screens | `/auth/signup`, `/auth/signin`, `/auth/verify`, `/auth/reset`, `/auth/google-demo` (demo only), `/auth/mailbox` (demo only), `/welcome`, `/profile/settings`, `/profile/alien` |
| Database | `db/migrations/0005_identity_i18n.sql` |

Flow: sign up → confirm the email link → alien is created → Reveal → choose a display name → world.

Security:
- Passwords: scrypt (N=2¹⁵, r=8, p=1, 16-byte salt), stored as `scrypt$…`. A database check constraint refuses anything else. 10–128 characters, common passwords refused.
- Sessions: a random 256-bit token in an `httpOnly`, `SameSite=Lax` cookie (`Secure` in production); only its SHA-256 is stored. 30 days. Password reset deletes every session of the account.
- CSRF: every state-changing request must be same-origin (`Origin` and `Sec-Fetch-Site` checked) on top of `SameSite=Lax`.
- Rate limits per IP and per email on sign-up, sign-in, reset, verify and resend.
- No account enumeration: sign-up and reset answer the same whether or not the email exists. The owner of an existing address gets "you already have an account" mail instead; an unknown address gets "no account" mail.
- Verification and reset links: random tokens stored hashed, single use, 24 h and 30 min. The verify page consumes the token with POST so mail scanners can't use it up.
- Google: OAuth 2.0 authorization code flow with PKCE (S256), `state` in an httpOnly cookie, `email_verified` required. Linking an existing address: if that account was never verified, its password and sessions are dropped first (pre-registration hijack defense). Replayed or concurrent callbacks find the same user.
- Wallet: linking signs a message with a server nonce; the signature is checked server-side (viem). A wallet can belong to one account only and linking never creates an account.
- Audit log: sign-up, verify, login success and failure, reset, Google link, logout, alien creation, profile and privacy changes (`auth_audit_log`). No passwords or tokens are logged.
- Unverified accounts: no alien and no DAO vote (`403 EMAIL_NOT_VERIFIED`). In production mode an account is required to vote.

## 3. Alien identity

- Families: SLIME, FUZZ, MUTANT, JELLY. Parts: body colour, accent colour, eyes (6), mouth (6), pattern (6), head accessory (8 + 2 earned), outfit (5) and outfit colour, special detail (6). All original layered SVG in `components/art/Alien.tsx`.
- Generation: `lib/alien/generate.ts`. A 128-bit seed from the OS CSPRNG; the traits are derived from the seed with SHA-256 (`traitsFromSeed`), so the stored `seed` + `asset_version` always re-render the same alien.
- Exactly one per user: `user_alien_identities.user_id` is the primary key, inserts are `ON CONFLICT DO NOTHING`, and `ensureAlien` returns the stored alien on every later call. Logging in again, from any device, any number of times, returns the same alien.
- No reroll: the API refuses changes to family, colours, face, pattern or special (`ALIEN_BASE_IS_PERMANENT`), and a database trigger refuses them too. Only outfit, outfit colour and accessory can change; earned accessories (crown, DAO antenna) need ownership.
- Reveal (`components/alien/AlienReveal.tsx`): black screen, egg, hatch, "YOUR ALIEN IS BORN!" / "WELCOME TO FREAKTOPIA WORLD.", buttons CONTINUE / CUSTOMIZE / ENTER WORLD, about 2.3 s, Skip button, and with reduced motion it shows the result at once.
- Static assets: `public/aliens/{slime,fuzz,mutant,jelly}/{portrait,full,idle,walk,dance,emote}.svg` plus `manifest.json`, generated from the same SVG components by `npx vite-node --config vitest.config.ts scripts/export-aliens.tsx`.

## 4. Profile and privacy

Profile: display name, username, country, preferred language, favourite genres, followed DJs and events, DAO memberships, tickets, achievements, XP, NFT cosmetics (preview only).

Privacy defaults (minimal): profile visible to friends, alien public, activity private, country hidden, World Map presence **off**, LIVE avatar on (it was already part of the LIVE room). Each can be changed in `/profile/settings`.

## 5. Integration

- **WORLD MAP:** your alien appears next to an event's landmark only for events you joined (ticket or support) and only when "Show my alien at events I joined" is on. It is placed at the landmark, never at a GPS position.
- **LIVE:** the room uses the account alien and name. With "Show my alien at LIVE events" off you are counted but not drawn.
- **DAO:** member, author and commenter avatars, your own alien in the vote card and a voter badge. Voting weight still comes only from the staking snapshot (one account, one vote): the alien and cosmetics never change it.
- **Avatar studio:** remains a playground; signed-in users are told their account alien is their identity.

## 6. Configuration: demo vs. production

| Environment variable | Effect | Without it |
|---|---|---|
| `DATABASE_URL` | Postgres store (apply `db/migrations/0005_identity_i18n.sql`). Turns on **production mode**: all demo helpers disappear | In-memory store (**DEMO**, resets on restart) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Real Google sign-in. Redirect URI: `{APP_URL}/api/auth/google/callback` | Demo: a clearly labelled simulator. Production: the Google button says it isn't configured |
| `RESEND_API_KEY`, `MAIL_FROM` | Real emails through Resend | Demo: the demo mailbox page. Production: sign-up reports email isn't configured |
| `DEEPL_API_KEY` | "See translation" works, labelled as machine translation | The button says translation isn't connected |
| `APP_URL` | Base URL for email links and the OAuth redirect (never taken from the Host header in production) | Demo: request origin. Production: the canonical site URL |

The account card and the sign-in pages show the real connection status (`auth-status`), so nothing appears connected when it isn't.

## 7. Tests

- `tests/unit/i18n.test.ts`: language list, Accept-Language, path helpers, key parity and placeholders for all 11 translations, ICU syntax, fallback, Russian plurals, money/number formatting, venue time zones.
- `tests/unit/alien.test.ts`: deterministic seed → traits, uniqueness and coverage, cosmetics rules, scrypt, CSRF, return-path safety.
- `tests/integration/auth-service.test.ts`: the whole account service on the in-memory store **and on Postgres** when `TEST_DATABASE_URL` points at a database with migration 0005: sign-up, verify, no alien before verification, single-use links, re-login keeps the alien, concurrent `ensureAlien` creates one, no enumeration, reset signs out everywhere, logout, Google replay and linking, squatter defense, wallet uniqueness, privacy defaults, no seed in `/me`, permanent base traits, audit log.
- `tests/integration/dao-api.test.ts`: an unverified account gets `403 EMAIL_NOT_VERIFIED` on a ballot.
- `tests/identity.spec.ts` (Playwright): the 18 required end-to-end checks (see the test report).
