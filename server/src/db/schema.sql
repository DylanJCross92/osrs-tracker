-- A tracked player is just an RSN (no accounts in this app, anyone running
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
-- players.service.js), this tracks its progress/outcome so the UI can show
-- "still importing" without blocking, and knows when to hide that button.
-- 'none' = never checked, 'pending'/'running' = in progress, 'done'/'failed'
-- = checked (done may still mean "found nothing", wom_imported_count tells
-- you which).
ALTER TABLE players ADD COLUMN IF NOT EXISTS wom_import_status TEXT NOT NULL DEFAULT 'none';
ALTER TABLE players ADD COLUMN IF NOT EXISTS wom_imported_count INTEGER;

-- One-time fix for players added before wom_imported_count existed: an
-- earlier migration defaulted them to 'done', which is indistinguishable
-- from "checked, found nothing", wom_imported_count IS NULL is exactly the
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

-- A "frozen" shareable progress card, the computed numbers are captured
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
-- that showed the milestone, NULL means it was already achieved when the
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

-- Weekly "Player Spotlight": picked once per period and stored, so the
-- featured player stays stable all week and isn't repeated back-to-back.
CREATE TABLE IF NOT EXISTS discover_spotlights (
  period_key TEXT PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Last time we observed this player gain xp. Drives the sync tiers: players
-- with no gain for a few days are only re-checked daily (see jobs/sync.js).
-- Backfilled once from snapshot history; NULL = never seen gaining (falls
-- back to created_at).
ALTER TABLE players ADD COLUMN IF NOT EXISTS last_xp_gain_at TIMESTAMPTZ;
UPDATE players p
SET last_xp_gain_at = sub.t
FROM (
  SELECT player_id, MAX(captured_at) FILTER (WHERE overall_xp > prev_xp) AS t
  FROM (
    SELECT player_id, captured_at, overall_xp,
           LAG(overall_xp) OVER (PARTITION BY player_id ORDER BY captured_at) AS prev_xp
    FROM snapshots
  ) x
  GROUP BY player_id
) sub
WHERE p.id = sub.player_id AND p.last_xp_gain_at IS NULL AND sub.t IS NOT NULL;


-- "Congratulate" clicks on a recent 99 or 200M milestone. One per visitor per milestone; the visitor is stored only
-- as a salted hash of their IP address (never the address itself), purely to stop repeat clicks.
CREATE TABLE IF NOT EXISTS milestone_cheers (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  milestone_type TEXT NOT NULL,
  skill TEXT NOT NULL DEFAULT '',
  value BIGINT NOT NULL,
  visitor_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (player_id, milestone_type, skill, value, visitor_hash)
);
CREATE INDEX IF NOT EXISTS milestone_cheers_lookup_idx ON milestone_cheers (player_id, milestone_type, skill, value);


-- People who asked to hear about news and new features (for example profile claiming). Only an email address and
-- where they signed up from; nothing else. unsub_token goes in the link of every email we send so anyone can leave
-- with one click. Rows are never sent to anyone, and unsubscribed rows stay (flagged) so we do not email them again.
CREATE TABLE IF NOT EXISTS email_subscribers (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT '',
  unsub_token TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  unsubscribed_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS email_subscribers_email_idx ON email_subscribers (lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS email_subscribers_token_idx ON email_subscribers (unsub_token);

-- Accounts. Email and password only for now; the account is how someone keeps their settings across devices. Profile
-- claiming will hang off users.id later, so nothing about OSRS names lives here beyond the synced preferences.
-- password_hash is "scrypt$salt$hash" (see utils/password.js). settings is a small JSON object of preferences.
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  email_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users (lower(email));

-- Only a SHA-256 of the session token is stored, so a copy of this table cannot be used to sign in.
CREATE TABLE IF NOT EXISTS user_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS user_sessions_user_idx ON user_sessions (user_id);

-- One-hour, single-use links for choosing a new password (token stored hashed, like sessions).
CREATE TABLE IF NOT EXISTS password_resets (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS password_resets_user_idx ON password_resets (user_id);

-- A new account cannot be used until its email address is confirmed. The link in the confirmation email carries a
-- token (stored hashed); newsletter remembers the "email me news" box from the sign-up form until then.
CREATE TABLE IF NOT EXISTS email_verifications (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  newsletter BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS email_verifications_user_idx ON email_verifications (user_id);

-- Account roles. Everyone starts as a plain "user"; "admin" and "owner" are only ever granted on the server (the owner's
-- email is set in the OWNER_EMAIL environment variable), never from anything a visitor sends.
ALTER TABLE users ADD COLUMN IF NOT EXISTS roles TEXT[] NOT NULL DEFAULT '{user}';

-- Profile claims. A signed-in account asks to claim a tracked OSRS name, gets a short code, and sends it in game to the
-- site owner, who types it in to approve. The one 'verified' row for a player IS the ownership record (the unique index
-- below allows only one owner per profile). Codes are only unique among pending claims, so they can be short.
CREATE TABLE IF NOT EXISTS profile_claims (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected', 'cancelled', 'revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  decided_at TIMESTAMPTZ,
  decided_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS profile_claims_code_pending_idx ON profile_claims (code) WHERE status = 'pending';
CREATE UNIQUE INDEX IF NOT EXISTS profile_claims_user_player_pending_idx ON profile_claims (user_id, player_id) WHERE status = 'pending';
CREATE UNIQUE INDEX IF NOT EXISTS profile_claims_player_owner_idx ON profile_claims (player_id) WHERE status = 'verified';
CREATE INDEX IF NOT EXISTS profile_claims_user_idx ON profile_claims (user_id);

-- The notification inbox. Unlike the live items on the avatar (waiting claims, codes still to send), these are stored
-- events with a read state: "your claim was approved", "a player you follow reached 99". dedupe_key stops the same
-- event from being added twice for one account.
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  text TEXT NOT NULL,
  link TEXT NOT NULL DEFAULT '',
  dedupe_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS notifications_dedupe_idx ON notifications (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications (user_id, created_at DESC);

-- Players an account follows. The Following strip on the homepage and the "a player you follow reached 99" notices
-- both read from this.
CREATE TABLE IF NOT EXISTS follows (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, player_id)
);
CREATE INDEX IF NOT EXISTS follows_player_idx ON follows (player_id);

-- The last record values we told a profile's owner about (see recordsNotify.service.js), so a new personal record can
-- be spotted after each snapshot. NULL until the first check, which only records the starting values.
ALTER TABLE players ADD COLUMN IF NOT EXISTS records_state JSONB;
-- The records already announced today ({ day, headlines: { recordKey: text } }), so a day's new records are one notice.
ALTER TABLE players ADD COLUMN IF NOT EXISTS records_day JSONB;

-- Browser data kept with the account so it follows the person to other devices: saved planner plans, the planner's
-- working goals, recent searches, and which congratulations were already sent or hidden. One JSON object, each key
-- { value, updatedAt } (see utils/userData.js for the shape and size limits).
ALTER TABLE users ADD COLUMN IF NOT EXISTS data JSONB NOT NULL DEFAULT '{}'::jsonb;

-- What the owner of a claimed profile has added to it: a short bio, a "currently training" line, a few links, which
-- tabs to hide from visitors, and an uploaded picture. The picture is stored here (small, resized by the browser
-- before upload) because the host's disk does not survive a redeploy.
CREATE TABLE IF NOT EXISTS profile_pages (
  player_id INTEGER PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  bio TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT '',
  links JSONB NOT NULL DEFAULT '[]'::jsonb,
  hidden_sections JSONB NOT NULL DEFAULT '[]'::jsonb,
  avatar BYTEA,
  avatar_type TEXT,
  avatar_updated_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Public goals an owner sets on their profile ("99 Mining"), with a progress bar that moves as the profile's real XP
-- does. target_type is 'level' or 'xp'. start_xp is the skill's XP when the goal was set, reached_at is stamped the
-- first time the XP passes the target.
CREATE TABLE IF NOT EXISTS profile_goals (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  skill TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('level', 'xp')),
  target_value BIGINT NOT NULL,
  start_xp BIGINT NOT NULL DEFAULT 0,
  pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reached_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS profile_goals_player_idx ON profile_goals (player_id, created_at DESC);

-- The player a notification is about (its RSN), so the bell can show their picture. NULL when it is not about one
-- player, or when the person should stay anonymous.
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS subject TEXT;

-- A saved plan an owner has chosen to make public. Plans are private until shared; a row here is the public copy (a cleaned
-- snapshot, so later edits only go public when the owner updates it). Turning sharing off deletes the row, which kills the
-- link, and sharing again makes a new link. mode is 'static' (just the plan) or 'live' (also shows the owner's progress from
-- their tracked XP). summary holds the owner's own estimates (hours, gp, days) for link previews.
CREATE TABLE IF NOT EXISTS shared_plans (
  id SERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL,
  name TEXT NOT NULL,
  rsn TEXT NOT NULL DEFAULT '',
  mode TEXT NOT NULL DEFAULT 'static' CHECK (mode IN ('static', 'live')),
  plan JSONB NOT NULL,
  summary JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, plan_id)
);
CREATE INDEX IF NOT EXISTS shared_plans_user_idx ON shared_plans (user_id, updated_at DESC);
