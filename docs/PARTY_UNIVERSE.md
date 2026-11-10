# Personal Party Universe (9.0)

Every account can have an organizer **party world**: a small planet that grows only from parties that really happened and were checked in at the door. Attendees appear in it as their aliens if they choose to, and as an anonymous crowd if they don't. No new accounts, no new social network and no second database: it reuses the accounts, aliens, event-operations events and the existing `ops_*` document store.

## Where it lives

| Path | What it is |
|---|---|
| `/u/[FREAK-…]` | Public profile by alien ID. Shows only what the person allowed, plus a link to their world. |
| `/u/[FREAK-…]/world` | The world: 3D or Lite view, dashboard, Party Impact, next party with RSVP, follow / notify / block, community, growth, history. "Back to profile" is the exit. |
| `/u/[FREAK-…]/world/[eventId]` | One party's memories: verified figures, DJs, reviews, official media and attendee media, RSVP and QR pass. |
| `/profile/parties` | The attendee's own page: passes, history with visit counts per organizer, new-party notes, privacy switches, follows and blocks, delete my party data. |
| `/events/manage/[id]?tab=door` | Organizer: "Show in my world", door check-in (camera QR scan or code entry), RSVP list, manual confirm / revoke with a reason, guest-list count. |
| `/world/universes` | Directory of organizer worlds and upcoming community parties (also linked from the WORLD map and `/events`). |
| `/world/audit` | Admins only (`OPS_ADMIN_EMAILS`): anomaly signals and the audit log. |
| `/u/demo/world` | Memory-only demo world, labelled DEMO everywhere. It does not exist when a real database is connected. |

## Attendance states

One row per (party, person) in `ops_attendance`, with a history of every change.

| State | Counts? |
|---|---|
| Viewing the page | never |
| RSVP (`going`) | never. It only creates the QR pass. |
| Ticket | there is no ticket purchase. The QR pass is the entry credential. |
| Checked in by QR at the door | yes, once the party is verified |
| Checked in manually by the owner or a manager | yes, but only with a reason (≥ 5 characters) and confirmation. It is recorded in the row history and the audit log, and shown as "manual". |
| Cancelled / revoked | never. Revoking needs a reason and is audited. |

Scanning the same pass again, or two scanners at once, is logged as a duplicate and never counted twice. Scans outside the entry window (start −6 h to end +6 h), unknown codes and cancelled passes are logged and rejected. Team members never count as attendees and cannot review their own party.

A party is **verified** when it has ended, was not cancelled, and has at least 3 QR check-ins from different people outside the team. Only verified parties appear in the dashboard figures, the growth stage and Party Impact. Very small parties (fewer than 3 scanned guests) therefore cannot be verified. This is intentional.

## Dashboard definitions

- **Total events**: verified parties.
- **Total attendance**: counted check-ins, one per person per party.
- **Unique visitors**: distinct people across all verified parties.
- **Returning visitors**: people at 2 or more different verified parties.
- **Average rating**: reviews from counted attendees only, one per person per party.
- **Guests** entered by the organizer are shown separately and never counted.
- **Rankings are unchanged.** The world has its own figures, so there are no duplicate metrics.

## Party Impact (0–100, an estimate)

The weights are satisfaction 35, returning crowd 25, engagement 15, consistency 15, scale 10.

- Satisfaction is a Bayesian average (prior 3.5, weight 5), so a few 5-star reviews don't produce a perfect score.
- Returning crowd needs at least two parties. With only one, the weight is spread over the other parts.
- Scale is logarithmic and only 10% of the score: a small party people love can beat a huge one that is merely tolerated (there is a unit test for this).
- With fewer than 5 reviews or fewer than 10 unique visitors, there is **no score**. The page says 「評価データ不足」 / "Not enough rating data".
- Confidence is low, medium or high, based on the amount of data. The page labels the score as an estimate.

## Growth stages (presentation only)

| Stage | Condition |
|---|---|
| 0 | no verified party |
| 1 | 1 verified party |
| 2 | 2 or more |
| 3 | 2 or more, with 5 or more returning people |
| 4 | stage 3, plus a party with 500 or more verified people |
| 5 | stage 4, plus 10 or more parties in at least 2 cities |

Milestones and genre areas (Tech House, Afro House, Melodic Techno, Festival) are listed under the world. Nothing can be bought, and RSVPs don't count.

## Visuals

- **3D** (three.js, loaded only in this mode): toon-shaded planets with black outlines in FREAKTOPIA neon, no realistic globe. The home planet grows with the stage, and the venue on top gains towers and a festival roof.
- Each genre is a different combination of the same shared geometries:
  - Tech House: cube satellites.
  - Afro House: a low-poly planet with a sun.
  - Melodic Techno: an icy ring.
  - Festival: tents and a ring.
  - Upcoming parties have a spinning ring. Unverified and cancelled parties are dimmed.
- **Aliens** are drawn from the same SVG aliens used across the site. Visit tiers:
  - 1 visit: plain.
  - 2–4: purple aura.
  - 5–9: acid glow.
  - 10+: orange "regular" glow and a star badge in the list.
  - Effects stay subtle. Tapping an alien opens its public profile.
- **Per-device caps** for drawn aliens and crowd dots: 120 aliens and 1,500 dots on capable devices, 40 and 400 on low-power devices. Everyone not drawn is still counted, and the totals are printed under the world.
- **Level of detail:** aliens hide when the camera is far away, and the crowd dots stay.
- **Lite** (SVG): chosen automatically with reduced motion, no WebGL, `saveData`, ≤ 2 GB memory or ≤ 2 cores. The visitor's choice is remembered.
- **Controls and performance:** drag, pinch/scroll zoom, tap. The animation pauses when the tab is hidden or the world is scrolled away, and there is no auto-rotate with reduced motion. If WebGL fails, the page falls back to Lite.
- **Accessible links:** in both modes every planet is a real link with an accessible name.

## Privacy

- **Two switches, both off by default:**
  - "Show my alien in organizers' worlds".
  - "Show my party history on my profile".
- **A person is drawn by name only if:**
  - they turned the first switch on, **and**
  - their account avatar visibility (existing privacy setting) is public.
  - Otherwise they are part of the anonymous count.
- **The door team** sees names only for the party's own RSVP list. Viewers see them nowhere else.
- **Delete my party data** removes RSVPs, check-ins, reviews, attendee posts, follows, blocks and the privacy row. Worlds recalculate without the person, and the account stays.
- **Media:**
  - Official media (owner and managers) and attendee media are separate.
  - Authors choose public, attendees-only or only-me, and can delete their own posts.
  - Organizers can hide attendee posts but cannot delete them.
  - Only-me posts are visible to nobody else.
  - Files are checked by magic bytes: images up to 5 MB, MP4/WebM up to 8 MB.
  - Media are served with `nosniff` and `CSP: sandbox`.
- **No AI highlight reels** and no generated footage.

## Follow and notifications

- **Following** sends one note per newly published upcoming party: a dedupe key per party, and only to followers with "notify" on who haven't blocked the organizer.
- **No direct messages.** Mute turns notify off. Block removes the follow and stops everything.
- **Rate limits:** 120 writes per minute per person and 240 door scans per minute. Every POST is same-origin checked.
- **Where notes appear:** in `/profile/parties` ("New parties") and in the existing notifications list in `/events/manage`.

## Anti-fraud

- **Checks applied on every action:**
  - One attendance row per person per party, with a unique pass code.
  - Duplicate scans are not counted.
  - The entry window is enforced.
  - The team is excluded.
  - Verification needs at least 3 QR scans.
  - Only attendees can review.
  - Reviews are one per person, and editing replaces the old one.
  - Manual changes need a reason and are audited.
  - Demo data never mixes with Postgres.
- **Anomaly signals** on `/world/audit`:
  - share of manual check-ins over 50 %
  - more check-ins than planned capacity
  - many scans outside party time
  - many repeat scans
  - review bursts
  - crowds of accounts younger than a week
  - the same people checked in at overlapping parties
- **Signals are prompts for review, not verdicts.** Nothing is removed automatically.

## Data

`db/migrations/0008_party_universe.sql` adds 10 `ops_*` tables to the existing event-operations store:

- attendance
- checkins
- guests
- event_reviews
- media
- follows
- blocks
- world_privacy
- world_settings
- party_audit

They have foreign keys to `users` and `ops_events` with cascade, a unique pass-code index, GIN indexes and RLS. The migration is additive and re-runnable (applied twice in testing). Nothing existing is changed or dropped.

## Not built

- Ticket sales or payments. The QR pass is the entry credential.
- Links to LIVE stream archives. There is no real archive to link.
- DJ entries come from agreed bookings in event operations; demo DJs are not accounts.
- AI highlight reels.
- Push or email delivery of notifications. They are in-app only.
- Camera scanning needs the browser's `BarcodeDetector` (Chrome/Edge on Android, and others). Elsewhere the page says so and code entry is used.
