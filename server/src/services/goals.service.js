import { pool } from '../db.js'
import { MAX_ACTIVE_GOALS, cleanGoalInput, cleanPlanInput, goalProgress, goalTitle, planSummary } from '../utils/goals.js'
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
    fromPlan: Boolean(row.from_plan),
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
    pool.query('SELECT * FROM profile_goals WHERE player_id = $1 ORDER BY from_plan DESC, plan_pos ASC NULLS LAST, pinned DESC, created_at DESC', [playerId]),
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
  const { rows: plan } = await pool.query('SELECT 1 FROM profile_goals WHERE player_id = $1 AND id = $2 AND from_plan', [playerId, id])
  if (plan.length) throw new GoalError('This goal is part of the plan on your profile. Change or turn off the plan in the planner.')
  const { rowCount } = await pool.query('DELETE FROM profile_goals WHERE player_id = $1 AND id = $2', [playerId, id])
  if (!rowCount) throw new GoalError('That goal does not exist.', 404)
}

/** Pins (or unpins) one goal; only one goal is pinned at a time. */
export async function pinGoal(playerId, id, pinned) {
  const { rows } = await pool.query('SELECT from_plan FROM profile_goals WHERE player_id = $1 AND id = $2', [playerId, id])
  if (!rows.length) throw new GoalError('That goal does not exist.', 404)
  if (rows[0].from_plan) throw new GoalError('The plan on your profile is shown as a whole, so its goals are not pinned one by one.')
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

// --- A whole plan as the profile's goal ---------------------------------------------------------------------------------

/** { name, planId, updatedAt, percent, reached, count } for the plan shown on a profile (given its goals), or null when none is. */
export async function getProfilePlan(playerId, goals) {
  const { rows } = await pool.query('SELECT plan_id, name, updated_at FROM profile_plans WHERE player_id = $1', [playerId])
  if (!rows[0]) return null
  return { planId: rows[0].plan_id, name: rows[0].name, updatedAt: rows[0].updated_at, ...planSummary(goals.filter((g) => g.fromPlan)) }
}

/** What the profile page gets: every goal with live progress, and the plan they come from (if any). */
export async function profileGoals(playerId) {
  const goals = await listGoals(playerId)
  return { goals, plan: await getProfilePlan(playerId, goals) }
}

/**
 * Makes this plan the profile's goal: its skills become goals in plan order. Goals the plan still has are kept as they are (so a
 * reached goal stays reached), new ones are added, and ones the plan no longer has are dropped. A goal already reached when it is
 * added is marked reached without a notification. Safe to call again whenever the plan changes.
 */
export async function setProfilePlan(playerId, input) {
  const plan = cleanPlanInput(input)
  if (!plan) throw new GoalError('That plan can not be shown on a profile.')
  const skills = await latestSkills(playerId)
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(
      `INSERT INTO profile_plans (player_id, plan_id, name, updated_at) VALUES ($1, $2, $3, now())
       ON CONFLICT (player_id) DO UPDATE SET plan_id = EXCLUDED.plan_id, name = EXCLUDED.name, updated_at = now()`,
      [playerId, plan.planId, plan.name],
    )
    // A different plan replaces the old one's goals; the same plan keeps the ones it still has.
    const key = (skill, type, target) => `${skill}|${type}|${Number(target)}`
    const wanted = new Map(plan.goals.map((g, pos) => [key(g.skill, g.type, g.target), { ...g, pos }]))
    const { rows: current } = await client.query('SELECT id, skill, target_type, target_value FROM profile_goals WHERE player_id = $1 AND from_plan', [playerId])
    for (const r of current) {
      const k = key(r.skill, r.target_type, r.target_value)
      if (wanted.has(k)) {
        await client.query('UPDATE profile_goals SET plan_pos = $2 WHERE id = $1', [r.id, wanted.get(k).pos])
        wanted.delete(k)
      } else {
        await client.query('DELETE FROM profile_goals WHERE id = $1', [r.id])
      }
    }
    for (const g of wanted.values()) {
      // A goal the owner already had by hand becomes part of the plan instead of being doubled up.
      const taken = await client.query(
        `UPDATE profile_goals SET from_plan = true, plan_pos = $5, pinned = false WHERE player_id = $1 AND skill = $2 AND target_type = $3 AND target_value = $4 AND NOT from_plan`,
        [playerId, g.skill, g.type, g.target, g.pos],
      )
      if (taken.rowCount) continue
      const progress = goalProgress(g, skills[g.skill]?.xp ?? 0)
      await client.query(
        `INSERT INTO profile_goals (player_id, skill, target_type, target_value, start_xp, from_plan, plan_pos, reached_at) VALUES ($1, $2, $3, $4, $5, true, $6, $7)`,
        [playerId, g.skill, g.type, g.target, progress.currentXp, g.pos, progress.reached ? new Date() : null],
      )
    }
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }
}

/** Takes the plan off the profile, along with the goals that came from it. */
export async function clearProfilePlan(playerId) {
  await pool.query('DELETE FROM profile_goals WHERE player_id = $1 AND from_plan', [playerId])
  await pool.query('DELETE FROM profile_plans WHERE player_id = $1', [playerId])
}
