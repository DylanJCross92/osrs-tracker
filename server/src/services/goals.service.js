import { pool } from '../db.js'
import { MAX_ACTIVE_GOALS, cleanGoalInput, goalProgress, goalTitle } from '../utils/goals.js'
import { addNotification, followersOfPlayer, ownerOfPlayer } from './inbox.service.js'

export class GoalError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.status = status
  }
}

async function latestSkills(playerId) {
  const { rows } = await pool.query('SELECT skills FROM snapshots WHERE player_id = $1 ORDER BY captured_at DESC LIMIT 1', [playerId])
  return rows[0]?.skills || {}
}

const shape = (row, skills) => {
  const g = { skill: row.skill, type: row.target_type, target: Number(row.target_value) }
  const progress = goalProgress(g, skills[row.skill]?.xp ?? 0)
  return {
    id: row.id,
    skill: g.skill,
    type: g.type,
    target: g.target,
    title: goalTitle(g),
    pinned: row.pinned,
    createdAt: row.created_at,
    reachedAt: row.reached_at,
    startXp: Number(row.start_xp),
    ...progress,
    // A goal counts as reached once stamped, even if the number later dips (hiscores glitches never un-reach it).
    reached: Boolean(row.reached_at) || progress.reached,
    percent: row.reached_at ? 100 : progress.percent,
  }
}

/** A profile's goals, pinned first then newest, with live progress. */
export async function listGoals(playerId) {
  const [{ rows }, skills] = await Promise.all([
    pool.query('SELECT * FROM profile_goals WHERE player_id = $1 ORDER BY pinned DESC, created_at DESC', [playerId]),
    latestSkills(playerId),
  ])
  return rows.map((r) => shape(r, skills))
}

export async function getGoal(playerId, id) {
  const [{ rows }, skills] = await Promise.all([pool.query('SELECT * FROM profile_goals WHERE player_id = $1 AND id = $2', [playerId, id]), latestSkills(playerId)])
  return rows[0] ? shape(rows[0], skills) : null
}

export async function addGoal(playerId, input) {
  const goal = cleanGoalInput(input)
  if (!goal) throw new GoalError('Pick a skill and a level (2 to 126) or an XP amount (up to 200M).')
  const skills = await latestSkills(playerId)
  const progress = goalProgress(goal, skills[goal.skill]?.xp ?? 0)
  if (progress.reached) throw new GoalError(`You already have ${goalTitle(goal)}. Pick a goal still ahead of you.`)
  const { rows: active } = await pool.query('SELECT count(*)::int AS n FROM profile_goals WHERE player_id = $1 AND reached_at IS NULL', [playerId])
  if (active[0].n >= MAX_ACTIVE_GOALS) throw new GoalError(`You can have ${MAX_ACTIVE_GOALS} goals in progress. Remove one first.`)
  const dupe = await pool.query('SELECT 1 FROM profile_goals WHERE player_id = $1 AND skill = $2 AND target_type = $3 AND target_value = $4 AND reached_at IS NULL', [playerId, goal.skill, goal.type, goal.target])
  if (dupe.rowCount) throw new GoalError('That goal is already on your profile.')
  const { rows } = await pool.query(
    `INSERT INTO profile_goals (player_id, skill, target_type, target_value, start_xp) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [playerId, goal.skill, goal.type, goal.target, progress.currentXp],
  )
  return shape(rows[0], skills)
}

export async function deleteGoal(playerId, id) {
  const { rowCount } = await pool.query('DELETE FROM profile_goals WHERE player_id = $1 AND id = $2', [playerId, id])
  if (!rowCount) throw new GoalError('That goal does not exist.', 404)
}

/** Pins (or unpins) one goal; only one goal is pinned at a time. */
export async function pinGoal(playerId, id, pinned) {
  const { rows } = await pool.query('SELECT 1 FROM profile_goals WHERE player_id = $1 AND id = $2', [playerId, id])
  if (!rows.length) throw new GoalError('That goal does not exist.', 404)
  await pool.query('UPDATE profile_goals SET pinned = false WHERE player_id = $1', [playerId])
  if (pinned) await pool.query('UPDATE profile_goals SET pinned = true WHERE player_id = $1 AND id = $2', [playerId, id])
}

/**
 * After a new snapshot: stamps any goal whose target was just passed and tells the owner and followers. Called for
 * profiles that have an owner (goals can only exist on those).
 */
export async function checkGoals(playerId) {
  const { rows } = await pool.query('SELECT * FROM profile_goals WHERE player_id = $1 AND reached_at IS NULL', [playerId])
  if (!rows.length) return
  const skills = await latestSkills(playerId)
  const done = rows.filter((r) => goalProgress({ skill: r.skill, type: r.target_type, target: Number(r.target_value) }, skills[r.skill]?.xp ?? 0).reached)
  if (!done.length) return
  const { rows: pl } = await pool.query('SELECT username, display_name FROM players WHERE id = $1', [playerId])
  const link = `/player/${encodeURIComponent(pl[0].username)}?tab=goals`
  const ownerId = await ownerOfPlayer(playerId)
  const followers = (await followersOfPlayer(playerId)).filter((id) => id !== ownerId)
  for (const r of done) {
    await pool.query('UPDATE profile_goals SET reached_at = now() WHERE id = $1 AND reached_at IS NULL', [r.id])
    const title = goalTitle({ skill: r.skill, type: r.target_type, target: Number(r.target_value) })
    if (ownerId) await addNotification(ownerId, { type: 'goal_reached', text: `You reached your goal: ${title}!`, link, dedupeKey: `goal:${r.id}`, subject: pl[0].username })
    for (const id of followers) await addNotification(id, { type: 'follow_goal', text: `${pl[0].display_name} reached their goal: ${title}`, link, dedupeKey: `goal:${r.id}`, subject: pl[0].username })
  }
}
