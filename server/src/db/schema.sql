-- A tracked player is just an RSN (no accounts in this app — anyone running
-- it can add/remove players), with a growing history of hiscores snapshots
-- taken on a timer (see jobs/osrsSync.js).
CREATE TABLE IF NOT EXISTS players (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
