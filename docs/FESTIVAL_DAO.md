# FREAKTOPIA WORLD 5.0 · FESTIVAL DAO × AI STAGE DESIGN

Each event can have its own community DAO. Fans stake to join. They can discuss ideas, write proposals and vote one account = one vote. They can also design the stage over real venue photos with AI. A wallet alone is not enough to join, and staking more never adds voting weight.

> **This build runs in demo mode.** DAOs, members, stakes, budgets and payments are fictional sample data held in server memory, and they can reset. No blockchain, token or payment rail is connected. The demo wallet is a throwaway key in the browser. It only signs the sign-in message and never authorizes moving assets. AI stage images are concepts, not construction plans.

## Pages

| Route | Purpose |
|---|---|
| `/dao` | All event DAOs with status, members, open votes and participation. It also lists events that don't have a DAO yet |
| `/dao/[eventId]` | DAO home: your next step, open votes, latest stage designs, discussion, membership, stats, progress and the build game |
| `/dao/[eventId]/discussion` | Threads in 10 categories with public, members and private visibility. Includes search, reactions, replies, image attachments, reports (auto-hide after 3) and moderation |
| `/dao/[eventId]/proposals` | Proposals grouped by state, plus a new-proposal sheet (options, concepts, DJs, documents, images). Links prefill the sheet with `?new=1&cat=&dj=&title=` |
| `/dao/[eventId]/proposals/[proposalId]` | Lifecycle tracker, vote, feasibility report and sign-offs, organizer actions, versions, history and audit |
| `/dao/[eventId]/votes` | Open and closed votes with snapshot, quorum, threshold, receipts and result hash |
| `/dao/[eventId]/stage-designer` | 5 steps: venue photo and stage zone (with rights attestation), theme (8), 3–5 concepts with compare and before/after, publish, and edit in words with version history and restore |
| `/dao/[eventId]/gallery` | Published concepts with AI estimates, proposal or vote status, and a compare table for 2–3 concepts |
| `/dao/[eventId]/treasury` | Staking escrow kept separate, event funds, budget lines, approval tiers, and payment requests with approvals and evidence |
| `/dao/[eventId]/roadmap` | Festival Build Game LV1–5, production milestones (the organizer can edit) and an XP leaderboard |
| `/dao/[eventId]/members` | Search, roles, badges, flagged accounts (staff only) and the one-person-one-vote explanation |
| `/dao/[eventId]/settings` | Config, organizer edit, demo role switcher, unstake, sign out and the production checklist |

### Integrations with existing features
- **Event detail:** a COMMUNITY DAO section with status, stats, the active vote and links to join or to the AI Stage Designer.
- **WORLD RANKING:** a `DAO active` chip and filter (`?dao=1`), and a DAO line on each card (members, proposals, participation).
- **World map:** a purple `DAO` badge on pins. The pin sheet shows the DAO status and the active vote.
- **Venue detail:** an AI Stage Designer card for the next event at that venue.
- **DJ profile:** a "Nominate in … DAO" button that prefills a DJ lineup proposal.
- **After party:** a "Propose in the event DAO" button that prefills an after-party proposal.
- **My tickets:** DAO decisions the organizer confirmed, plus the active vote.
- **Alien avatar:** the `DAO Antenna` accessory, unlocked by the 100 DAO XP badge.
- **Nav and alerts:** a Festival DAO entry in the menu, and DAO notifications (new vote, reply, proposal moved, result) in `/alerts`.

## Architecture

```
app/api/dao/[[...path]]/route.ts   → handleDao(req, segments)      lib/dao/api.ts
lib/dao/types.ts                     domain types
lib/dao/meta.ts                      rules, labels, demo chain/contract placeholders (client-safe)
lib/dao/auth.ts, auth-message.ts     sign-in message, nonce, signature verification, session cookie
lib/dao/voting.ts                    snapshot, ballots (hash chain), tally (single, yes/no/abstain, multiple, ranked IRV)
lib/dao/lifecycle.ts                 proposal state machine
lib/dao/permissions.ts               who can do what
lib/dao/sybil.ts                     duplicate-person heuristics
lib/dao/stage.ts                     concept generation, instruction editor (JP/EN), estimates, prompt builder
lib/dao/feasibility.ts               10-item advisory check
lib/dao/treasury.ts                  separation of stake vs. funds, approval tiers
lib/dao/game.ts                      XP anti-spam, badges, build-game level
lib/dao/upload.ts                    magic-byte image validation
lib/dao/store.ts                     demo in-memory store + seed (6 DAOs)
lib/dao/providers.ts                 production adapters (on-chain stake, image model): env-gated
components/dao/**                    UI (shell, views, VoteCard, ConceptRender, JoinDao…)
db/migrations/0002_festival_dao.sql  PostgreSQL schema for production
```

## Rules the code enforces

**Membership and sign-in**
- Sign-in is an EIP-4361 style message with the domain, chain id, a single-use nonce (HMAC-signed, 5 minute TTL, replay-blocked) and an expiry. The server verifies the signature with viem.
- The session is an HMAC-signed, HttpOnly, SameSite=Lax cookie (Secure in production) that lasts 7 days.
- One wallet belongs to one account. Joining needs a stake of at least the minimum on the configured chain and staking contract.
- Signing never authorizes a transfer. In production, stakes would be read from the audited staking contract (`DAO_RPC_URL` with `DAO_STAKING_AUDITED=true`).

**Voting**
- Each vote takes an eligibility snapshot when it opens. That snapshot is the locked stakes at that moment, summed per account and hashed. Accounts that join later can't vote in that vote.
- 1 account = 1 vote. Stake size never adds weight, and a second ballot is rejected (`ALREADY_VOTED`).
- Ballots are hash-chained receipts. Flagged accounts' ballots are held and not counted. The result includes a reproducible `resultHash`, and `/votes/:id/audit` re-verifies the chain.
- If quorum isn't met the vote ends `EXPIRED`. Ranked votes use instant runoff.
- Only the system moves a proposal out of `VOTING`.

**Sybil heuristics**
- Accounts are flagged when they share a wallet, a device, a funding source, or when 3 or more join from one network within 10 minutes.
- Flagged accounts can still take part, but their ballots are held and their XP is frozen until a moderator reviews them.
- Without identity verification or proof of personhood this **cannot guarantee** one human = one vote. The UI says so.

**Proposal lifecycle**
- The full path is `DRAFT → DISCUSSION → REVIEW → VOTING → APPROVED/REJECTED/EXPIRED → FEASIBILITY_CHECK → ORGANIZER_CONFIRMATION → EXECUTION → COMPLETED`, plus `CANCELLED` and `RE_REVIEW`.
- Authors must wait out the discussion period. Organizers can fast-track, and that is logged.
- Cancelling or sending back needs a reason of 10 or more characters. If an organizer can't carry out an approved result, a public "cannot execute" report and a pinned comment are required.

**Feasibility**
- There are 10 items: budget, capacity, structure, electrical, fire, exits, sound, permits, suppliers and schedule. Each has a status and an alternative.
- The check is **advisory only**. Moving on needs a result that isn't `not_feasible`, plus sign-offs from the organizer, the venue manager and a specialist. In demo mode the organizer can record the last two as labelled "demo stand-ins".

**AI Stage Designer**
- Upload rules:
  - Only JPEG, PNG or WebP, checked by magic bytes, so SVG and spoofed types are rejected.
  - At least 320×200, at most 8 MB, and at most 8 files at a time.
  - Uploading needs the organizer or venue owner role plus an attestation of usage rights. The organizer then verifies the rights.
  - Media is served with access checks, `nosniff` and a sandbox CSP.
- The demo renderer is a compositor. It layers original SVG stage elements (LED walls, beams, lasers, aliens, booth, haze and more) inside the marked stage zone. The photo's walls, ceiling, pillars, floor and camera angle are left unchanged.
- Concepts fit the ceiling with 0.5 m clearance and respect haze or flame restrictions.
- Every image carries **AI CONCEPT / NOT A CONSTRUCTION PLAN**. Budgets are labelled `ai_reference_estimate`.
- The prompt for a production image model includes "KEEP UNCHANGED: building shape, walls…".
- The editor understands Japanese and English requests, for example 「宇宙人をもっと大きく」 (make the aliens bigger) or "add LED screens left and right". It lists what it applied and what it ignored, and every edit is a new version that can be restored.

**Treasury**
- Staking escrow is member principal. It is never spendable, so `STAKE_FUNDS_LOCKED` is returned and the DB enforces the same check.
- Approval tiers:

  | Amount | Approvals | Roles |
  |---|---|---|
  | Under $2k | 1 | Organizer |
  | Under $10k | 2 | Organizer, treasurer |
  | $10k and over | 3 | Organizer, treasurer, moderator |

- Approvals must come from different people with different roles, and the requester can never approve their own payment. A payment can't be recorded without an invoice or quote attached.
- In demo mode, executing a payment only records `executed_demo` with `fundsMoved: false`. With `DAO_PAYMENTS_ENABLED` set the API returns 501, because no payment rail is implemented.

**Build game and XP**
- XP is not awarded for short posts, duplicate content, a second award for the same target, actions inside a cooldown, or flagged accounts. There is a daily cap of 150.
- Badges: Community, Designer, Voter, Festival Founder, and DAO Antenna (cosmetic, at 100 XP).
- Levels:

  | Level | Name | Reached when |
  |---|---|---|
  | 1 | IDEA | The DAO is formed |
  | 2 | VENUE | A venue photo with rights is registered |
  | 3 | DESIGN | A design wins a vote |
  | 4 | BUILD | Execution has started and milestones are moving |
  | 5 | FESTIVAL | The festival is live |

  This is a game view and is not a record of real construction.

**Other security**
- Writes are rate-limited.
- A moderation blocklist covers seed-phrase or private-key scams and posts with more than 3 links.
- Every state change is written to a hash-chained activity log (`/activity` verifies it).
- Private threads, members-only threads, payment details and flagged accounts are hidden from people who aren't allowed to see them.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `DAO_DATA_MODE` | `demo` | `production` makes every DAO endpoint return **503 DATA_SOURCE_NOT_CONFIGURED** until a DB adapter is implemented. It never falls back to demo data |
| `DAO_SESSION_SECRET` | — | Required in production (32+ chars). Demo mode uses a fixed demo secret |
| `DAO_ALLOWED_CHAIN_IDS` | `31337` (demo) | Comma-separated chain allowlist for sign-in and settings |
| `DAO_RPC_URL`, `DAO_STAKING_AUDITED` | — | Read stakes from an audited staking contract (`stakedBalance`, `lockedUntil`) |
| `STAGE_AI_PROVIDER`, `STAGE_AI_API_KEY` | — | Production image model for renders. The adapter returns 501 until it is implemented |
| `DAO_PAYMENTS_ENABLED`, `DAO_PAYMENT_RAIL` | off | Payment rail. Returns 501, because none is implemented. Keep it off until legal review |

## Database
`db/migrations/0002_festival_dao.sql` holds the production schema, with 38 tables and 9 enums. It was applied to PostgreSQL 16 to check it, and these constraints were tested against it:
- one ballot per account per vote
- one wallet per account
- append-only ballots, transitions and activity log
- no payment from staking escrow
- no self-approval of payments

The demo build doesn't use a database.

## Not implemented (needs production work)
- A database adapter for the store. The schema is ready.
- The on-chain stake indexer and audited staking contract. The verifier skeleton exists in `lib/dao/providers.ts`.
- A real image-generation model for photo-realistic renders. The demo uses the SVG compositor.
- A payment rail for USDT or fiat, which also needs legal and compliance review.
- Identity verification or proof of personhood for a stronger one-human-one-vote guarantee.
- Real people for the venue-manager and specialist sign-offs, plus email or push notifications.
- Virus or content scanning of uploads and object storage. Uploads are currently held in memory.

## Tests
- `tests/unit/dao-domain.test.ts` has 27 tests covering the snapshot, ballots, hash chain, tally (including IRV, quorum and ties), lifecycle, permissions, feasibility, treasury tiers, XP anti-spam, badges, sybil heuristics, upload validation, concept generation, the JP/EN instruction parser and estimates.
- `tests/integration/dao-api.test.ts` has 16 tests against the API with real viem signatures. They cover replay, chain and domain checks, forged signatures and cookies, privacy, moderation, the full vote lifecycle, held ballots, uploads, stage generation and edits, the treasury, settings, audit chains and production 503.
- `tests/dao.spec.ts` has 12 Playwright tests. They cover joining with the demo wallet, posting with an image upload and a fake-image rejection, commenting, creating a proposal, voting, the double-vote block, stage designer and gallery compare, the event, ranking and map integrations, the treasury, all DAO pages at 375, 390, 430, 768 and 1440 px with no horizontal overflow, and 44 px tap targets.
