# DJ ARENA 2.0 (12.0)

DJ profiles, MP3 uploads, a global player, playlists, booking requests, an availability calendar, audio on
event applications, measured analytics, DJ rankings and copyright claims. Built on the accounts, work
profiles, applications, messages, notifications, blocks and audit log that already existed.

## What is real and what needs setup

| Part | State |
|---|---|
| DJ profile, calendar, booking, playlists, likes/saves, rankings, claims, admin | Work with the existing database (migration `0012_dj_music.sql`) |
| File uploads | **Need object storage.** No storage → uploads are switched off and the studio says so (`storage-off`). |
| `MUSIC_STORAGE=local` | Test/dev only: files go to `ops_blobs` through the same signed-URL flow, 25 MB cap, refused on Vercel. All E2E tests use this mode. |
| Virus scanning | **Not connected.** Files are checked by signature (programs, archives, scripts, other audio containers are refused) and by parsing the MP3 frames. This is not an antivirus engine. |
| Transcoding | **Not connected.** The playback file is the verified master itself (read-only, never altered). A separate streaming rendition needs a transcoder (e.g. a queue + ffmpeg worker) writing `playbackKey`. |
| Copyright recognition | **Not connected.** No audio fingerprinting. The UI never says "copyright checked"; it says "rights reviewed by staff (not an automatic copyright check)". |
| Profile views | Not measured, shown as "Not measured". |

### Enabling real uploads (S3-compatible storage: Cloudflare R2, AWS S3, Backblaze B2, MinIO…)

Set on the server (never in the browser):

```
MUSIC_S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com   # or https://s3.<region>.amazonaws.com
MUSIC_S3_BUCKET=freaktopia-music
MUSIC_S3_ACCESS_KEY_ID=...
MUSIC_S3_SECRET_ACCESS_KEY=...
MUSIC_S3_REGION=auto            # R2: auto; S3: the bucket region
```

The bucket must stay **private** and allow browser uploads from the site (CORS):

```json
[{ "AllowedOrigins": ["https://<your-domain>"], "AllowedMethods": ["PUT", "GET", "HEAD"], "AllowedHeaders": ["content-type"], "MaxAgeSeconds": 3600 }]
```

`/admin/music` shows the storage mode and which variables are missing.

## Upload flow (7 steps)

1. **File** – MP3 only (name and type), size limit from settings.
2. **Check** – in the browser: dangerous signatures, other containers, ID3v2 skip, 6 consecutive MPEG Layer III
   frames, Xing/Info/VBRI, duration. Waveform peaks are computed here (files ≤ 60 MB).
3. **Details** – title, type, genre, BPM, key, dates, cover (own art only).
4. **Rights** – answers depend on the type (DJ set, remix, mashup and live recording require licensor,
   reference or document, territories). Ticking a box is never treated as proof.
5. **Upload** – `PUT` straight to storage with a signed URL (15 min, content-type and length signed, key under
   the uploader's own prefix `music/<userId>/<trackId>/master.mp3`). Progress, cancel, retry with a fresh URL;
   the draft keeps the details.
6. **Verify** – the server reads the first 512 KB and last 64 KB of the stored object and checks size, frames,
   corruption/truncation and duration again. Failed files are deleted from storage.
7. **Publish** – *private* is immediate (owner only). *Public, unlisted, audition* go to **staff review**;
   nothing is published automatically. Changing the rights answers later sends the track back to review.

Limits (admin-configurable, `ops_music_settings`): 300 MB, 180 min, 3000 MB per DJ, 20 uploads a day,
3 upheld claims → uploads suspended.

## Visibility and access

| Visibility | Who can play |
|---|---|
| Public | Everyone; listed in search, profiles, rankings, public playlists |
| Unlisted | Anyone with the link; never listed |
| Audition | Only reviewers (`decide_applications`) of events the DJ applied to with this track |
| Private | Owner only |

Private/unpublished tracks answer 404 to everyone else (page, API and stream). Downloads are **off** by
default and need both the owner's switch and the "may offer downloads" rights answer. Play URLs are signed
and expire after 10 minutes.

## Player

One `<audio>` element in the root layout (`components/music/PlayerProvider.tsx`): playback continues across
client navigation, no autoplay, mini player above the mobile bottom navigation (`--player-bottom`), full player
sheet (waveform, seek, queue, repeat, shuffle, like/save/add/share), Media Session controls, buffering and a
"slow connection" message after 4 s, one automatic retry on network errors.

## Plays, analytics, rankings

A play counts only after **30 s of listening** (or half a track shorter than a minute). Not counted: page
views, the owner's own plays, bots (user agent), more listening than wall-clock time, more than 60 starts an
hour, repeats within 30 minutes. Excluded plays are shown by reason in analytics. Anonymous listeners are a
salted daily hash of IP + user agent.

Rankings (`/rankings#dj-rankings`), last 30 days, public tracks only, no paid placement:

- **Trending** = listeners×3 + √plays×2 + likes×2 + saves×3 + confirmed bookings×5, × growth vs the previous
  30 days (max ×2)
- **Most liked / Most saved / Most booked** – counts in the window (bookings: CONFIRMED by both sides)
- **Rising** – first public track less than 90 days old, by the trending score

## Booking

Statuses DRAFT → SENT → VIEWED → NEGOTIATING → ACCEPTED → CONFIRMED, plus DECLINED, EXPIRED (14 days without an
answer, computed on read) and CANCELLED. **ACCEPTED ≠ CONFIRMED**: the DJ accepts one exact version of the
terms; only the organizer's explicit confirmation of that version confirms the date (`TERMS_CHANGED` otherwise).
Booking requests need an organizer (an event they manage); messages ("inquiries") follow the DJ's contact
setting. Conversation uses the existing `ops_messages` (booking thread), notifications use `ops_notifications`.
Blocks, reports, 10 requests a day and 2 open requests per DJ.

Calendar: AVAILABLE, TENTATIVE, BOOKED, UNAVAILABLE, PRIVATE. Others only see available / tentative / not
available; notes and private days are never shown. Conflicts (other confirmed bookings including the DJ's
buffer hours, blocked days) are warned before sending and checked again on accept and confirm.

## Applications with audio

Event open calls (existing ops openings/applications) accept up to 3 of the DJ's reviewed tracks. Statuses add
UNDER REVIEW and INTERVIEW to the existing ones (submitted, shortlisted, accepted = hired, rejected).

## Copyright

Claims can be filed without an account. Staff uphold (track taken down, a strike), dismiss, or restore after a
counter-notice. Repeat infringers lose uploads at the strike limit. Every review, claim decision, upload
rejection, rights change and deletion is written to `party_audit` (`music.*`).

## Data

Migration `db/migrations/0012_dj_music.sql` (additive, re-runnable, keeps existing data): makes
`ops_messages.event_id` nullable and adds `booking_id`; new tables `ops_dj_profiles`, `ops_audio_tracks`,
`ops_playlists`, `ops_playlist_items`, `ops_track_likes`, `ops_saved_tracks`, `ops_track_plays`,
`ops_dj_availability`, `ops_dj_booking_requests`, `ops_booking_offers`, `ops_copyright_claims`,
`ops_music_reports`, `ops_music_settings`, `ops_music_images` (RLS on, server access only).

## Pages

`/profile/dj` (studio: profile, tracks, calendar, bookings, analytics), `/djs` (arena + search), `/djs/u/[slug]`,
`/music/tracks/[id]`, `/music/playlists/[id]`, `/music/library`, `/admin/music`.

## Not done

- Phase 5 recommendations beyond a genre-fit suggestion endpoint for organizers.
- Background processing queue (verification runs inside the "complete" request).
- Antivirus, transcoding and audio fingerprinting (see the table above).
