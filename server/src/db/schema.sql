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
