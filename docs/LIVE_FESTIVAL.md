# FREAKTOPIA WORLD 6.0 · LIVE FESTIVAL EXPERIENCE

Status: **demo**. No stream provider, payment provider or door-staff system is connected. The demo event
BASSMUTANT TOKYO runs as a labelled **DEMO LIVE** simulation and is never shown as LIVE NOW.

## Pages

| Route | Contents |
|---|---|
| `/live` | Header (logo, LIVE NOW, "THE WORLD IS LIVE."), featured festival (a real LIVE only when a licensed stream is connected; otherwise a notice, the demo simulation and the next festival), category chips (All / Live Now / Upcoming / Tech House / House / Techno / Afro House / Bass House / After Party), search, sort, event cards, live world map with pin types LIVE NOW / DEMO LIVE / UPCOMING / AFTER PARTY / DJ AUDITION and a bottom sheet |
| `/live/[eventId]` | Tabs **Watch / Map / Schedule / Community / More**. Sticky tab bar plus a sticky mini player on mobile |

Entry points: the bottom nav "Live", the home strip, the World map sheet ("Enter festival") and the event detail page.

## Features

| Area | Demo behaviour | Production needs |
|---|---|---|
| Player | Visualizer with the current DJ, stage switch, play/pause, mute/volume, quality (auto/1080p/720p/480p/audio), fullscreen, follow, like, share, viewers, set times, rights panel. Data saver or 2G starts in audio-only mode | A provider (`LIVE_STREAM_PROVIDER=mux|livekit`) plus recorded broadcast consent and music licence per stage |
| Festival map | Isometric SVG, 10 zones, drag to pan, wheel/pinch/buttons to zoom, keyboard-accessible zones, zone bottom sheets, walking animation, dancing on dance zones, other public avatars, reaction floats (max 12), energy-driven lights | Same UI; realtime transport instead of polling |
| Avatars | 8 original characters (4 starters + 4 new), colors, outfit, accessory, name, dance, emote. Visibility Public / Friends / Hidden. Opt-in toggle; no GPS | Accounts and a friends graph |
| Timetable | Stage tabs, now/next, duration, genres, DJ profile link, follow, reminder, venue time or your time (DST-safe via `Intl`) | Push or email for reminders |
| Chat | Latest 60 messages, replies, emoji, DJ/organizer/moderator badges, report (auto-hide at 3), block, word/link/spam filter, rate limit, duplicate check | Moderator console, persistent storage |
| Reactions & energy | FIRE / LOVE / BASS / ALIEN / HANDS UP. Energy is labelled a game metric. Each person counts for 6 reactions a minute; the meter moves at most 6 points per update | Same formula server-side, snapshots in `live_energy_snapshots` |
| Quests | Watch a DJ set, Visit Main Stage, Explore Lounge, React to a set, Discover After Party, Festival tour (online) and Be there for real (on-site). XP, badges and cosmetics | On-site quest needs a real check-in |
| Check-in | Issue a demo ticket QR, scan once, reuse refused, cancelled refused, organizer scan / manual refused without a staff session | Door-staff accounts (`LIVE_DOOR_STAFF_SECRET` is only a placeholder), real tickets |
| Attendance | Tickets sold, unique checked-in, verified currently present, online viewers, public avatars, always separate | `live_attendance` view (production rows only) |
| After party portal | Name, venue, time, lineup, price, spots left, entry conditions, buy link (demo order), "not confirmed" state | Ticketing |
| DAO | Membership, development level, roadmap, current proposals, decisions, updates, stage design (approved, or a clearly labelled unapproved concept vs. the venue photo) | — (reads the FESTIVAL DAO API; all actions stay on the DAO pages with server checks) |
| Ranking | Event, checked-in, community, trending and live-viewer rank with scope, period and update time | — |

## Rules the code enforces

- **No fake LIVE.** `isRealLive()` needs a non-demo provider, a playback id, broadcast consent and a music licence. Everything else is `demo_live`, `upcoming` or `ended`. Site-wide, demo events show "Demo live".
- **No GPS.** The map position is the zone the person picks. It is never attendance.
- **Watching is not attending.** On-site quests need a non-demo check-in (`ONSITE_REQUIRED`).
- **Demo ≠ production.** Demo check-ins carry `demo: true` and are excluded from attendance. `LIVE_DATA_MODE=production` returns `503 DATA_SOURCE_NOT_CONFIGURED` instead of demo data. In SQL, child rows reference `(session_id, is_demo)`, so demo rows can't attach to a production session.

## API (demo)

`app/api/live/[[...path]]/route.ts` → `lib/live/api.ts`

| Method & path | Purpose |
|---|---|
| `GET /api/live` | Discovery list |
| `GET /api/live/:eventId` | Detail: sets, stages, streams + rights, after party, attendance, quests |
| `GET /api/live/:eventId/room?zone&since` | Room sync |
| `POST …/presence`, `…/leave` | Join or update the avatar; leave |
| `POST …/chat`, `…/chat/:id/report`, `…/block` | Chat and safety |
| `POST …/reactions`, `…/quests` | Reactions; quest completion |
| `POST …/demo-ticket[?sample=cancelled]`, `…/checkin` | Door demo |
| `GET …/rankings` | Rank summary |

Identity is an anonymous signed cookie (`fk_live`). The browser waits for the first response before sending more requests, so parallel calls can't create several identities.

## Realtime design

Rooms are per event. The demo polls every 2.5 s (15 s when the tab is hidden), backs off exponentially on errors up to 30 s, reconnects on `online`, and passes `since` so only new events come back. State is synced **per zone**: full avatars for the viewer's zone (first) and counts for the other zones, never every position every second.

Events: `participant_joined`, `participant_left`, `avatar_zone_changed`, `reaction_added`, `chat_message_created`, `dj_set_started`, `dj_set_ended`, `energy_updated`, `event_status_changed`, `checkin_confirmed`.

Production: a WebSocket service (or a LiveKit data channel) with one channel per event and a sub-channel per zone, authenticated with the session token, a presence TTL of about 90 s, and resume from the last `seq` after reconnecting. `lib/live/client.ts#useLiveRoom` hides the transport, so the UI doesn't change.

## Streaming: Mux vs LiveKit

| | Mux Live | LiveKit |
|---|---|---|
| Ingest | RTMP/SRT from the venue | WebRTC (or RTMP ingress) |
| Latency | ~3–5 s low-latency HLS, 8–20 s standard | < 1 s |
| Scale | CDN, very large audiences | SFU; HLS egress for large audiences |
| Recording | Assets per stream, on/off per set | Egress recording |
| Best for | Watching a stage set | Interactive rooms, remote B2B, talk-back |

Recommendation: Mux for stage playback and LiveKit only where interaction needs sub-second latency. Both sit behind `StreamProvider` (`lib/live/streaming.ts`). Never expose ingest keys to the client. Record performer consent and music licensing (per territory) before a stream may go live, and recording rights before replays are kept.

## Database

`db/migrations/0003_live_festival.sql` (PostgreSQL 15+): `live_sessions`, `live_stages`, `live_streams`, `live_participants`, `live_avatar_states`, `live_chat_messages`, `live_reactions`, `live_energy_snapshots`, `live_quests`, `user_live_quest_progress`, `live_checkins`, `live_stage_schedules`, `live_notifications`, `live_moderation_logs`, plus helper tables for reports, blocks and check-outs, and the `live_attendance` view.

Applied and checked on PostgreSQL 16. These constraints were tested:
- a demo session can't be live
- a demo stage can't attach to a production session
- sets on one stage can't overlap
- a started production stream needs a provider, a licence and consent
- a ticket is accepted only once
- staff methods need a scanner
- demo check-ins stay out of `live_attendance`
- moderation logs are append-only

## Performance

- Lazy-loaded maplibre on `/live`; images through `next/image`.
- The festival map is static SVG layers plus avatars. The walking avatar is moved with `requestAnimationFrame` writing the transform directly, so React doesn't re-render each frame.
- Avatar count is capped (36 on phones, 60 on desktop) and floats are capped at 12.
- Chat rows use `content-visibility`.
- Animations are CSS-only and switched off under `prefers-reduced-motion`.
- Polling slows down in background tabs; data saver starts audio-only; a connection badge shows reconnecting or offline.

## Files

- `lib/live/`: `types`, `time`, `energy`, `quests`, `checkin`, `zones`, `streaming`, `store`, `api`, `client`
- `app/live/`: `page.tsx`, `LiveDiscovery.tsx`, `[eventId]/page.tsx`, `[eventId]/LiveEvent.tsx`
- `components/live/`: `FestivalMap`, `Player`, `Schedule`, `Chat`, `Energy`, `Panels`, `AvatarSheet`
- Tests: `tests/unit/live-domain.test.ts`, `tests/integration/live-api.test.ts`, `tests/live.spec.ts`
