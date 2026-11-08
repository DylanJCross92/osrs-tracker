-- A tracked player is just an RSN (no accounts in this app — anyone running
-- it can add/remove players), with a growing history of hiscores snapshots
-- taken on a timer (see jobs/osrsSync.js).
CREATE TABLE IF NOT EXISTS players (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Legacy-history backfill from Wise Old Man runs in the background, either
-- automatically when a player is added or on demand via the "Check Wise Old
-- Man" button for a player who hasn't been checked yet (see
-- players.service.js) — this tracks its progress/outcome so the UI can show
-- "still importing" without blocking, and knows when to hide that button.
-- 'none' = never checked, 'pending'/'running' = in progress, 'done'/'failed'
-- = checked (done may still mean "found nothing" — wom_imported_count tells
-- you which).
ALTER TABLE players ADD COLUMN IF NOT EXISTS wom_import_status TEXT NOT NULL DEFAULT 'none';
ALTER TABLE players ADD COLUMN IF NOT EXISTS wom_imported_count INTEGER;

-- One-time fix for players added before wom_imported_count existed: an
-- earlier migration defaulted them to 'done', which is indistinguishable
-- from "checked, found nothing" — wom_imported_count IS NULL is exactly the
-- players that were never actually checked, so re-flag them as 'none'.
UPDATE players SET wom_import_status = 'none' WHERE wom_import_status = 'done' AND wom_imported_count IS NULL;

-- overall_xp/level/rank are denormalized out of `skills` so the player list
-- and the "Overall" chart series never have to unpack JSONB just to sort or plot.
CREATE TABLE IF NOT EXISTS snapshots (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  overall_xp BIGINT NOT NULL,
  overall_level INTEGER NOT NULL,
  overall_rank INTEGER,
  skills JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS snapshots_player_captured_idx ON snapshots (player_id, captured_at);

-- A "frozen" shareable progress card — the computed numbers are captured
-- once at share time and never recomputed, so a link someone shares today
-- still shows the same numbers next week (see cards.service.js). A "live"
-- share skips this table entirely and always reflects the current period.
CREATE TABLE IF NOT EXISTS shared_cards (
  slug TEXT PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  card_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Profile badge shown next to a player's name (e.g. "Admin Founder"). Set
-- directly in the database; there is deliberately no public API to edit it.
ALTER TABLE players ADD COLUMN IF NOT EXISTS badge TEXT;
UPDATE players SET badge = 'Admin / Founder' WHERE lower(username) = 'dylanz297' AND badge IS NULL;
UPDATE players SET badge = 'Admin / Founder' WHERE badge = 'Admin Founder';

-- Achievement/timeline milestones detected from snapshots (see
-- milestones.service.js). One row per (player, kind, skill, value); the
-- unique key makes detection idempotent. occurred_at is the first snapshot
-- that showed the milestone — NULL means it was already achieved when the
-- player's earliest data begins, so the real date is unknown (never guessed).
CREATE TABLE IF NOT EXISTS player_milestones (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  milestone_type TEXT NOT NULL,
  skill TEXT NOT NULL DEFAULT '',
  value BIGINT NOT NULL,
  occurred_at TIMESTAMPTZ,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT NOT NULL DEFAULT 'snapshot',
  UNIQUE (player_id, milestone_type, skill, value)
);
CREATE INDEX IF NOT EXISTS player_milestones_player_idx ON player_milestones (player_id, occurred_at);
CREATE INDEX IF NOT EXISTS player_milestones_recent_idx ON player_milestones (milestone_type, value, occurred_at DESC);

-- Last time the hiscores were successfully fetched for this player, even when
-- nothing changed (an unchanged fetch saves no snapshot, so snapshots alone
-- can't say when we last checked).
ALTER TABLE players ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ;
