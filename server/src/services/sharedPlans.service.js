import { pool } from '../db.js'
import { MAX_SHARES_PER_USER, SharePlanError, cleanSharedPlan, isSlug, newSlug, publicShape } from '../utils/sharedPlans.js'

const ownerShape = (row) => ({ ...publicShape(row), planId: row.plan_id })

/** Shares the signed-in user's plan, or refreshes its public copy if it is already shared. Returns the owner's view. */
export async function shareMyPlan(userId, body) {
  const data = cleanSharedPlan(body)
  const existing = await pool.query('SELECT id FROM shared_plans WHERE user_id = $1 AND plan_id = $2', [userId, data.planId])
  if (existing.rows[0]) {
    const { rows } = await pool.query(
      `UPDATE shared_plans SET name = $3, rsn = $4, mode = $5, plan = $6, summary = $7, updated_at = now()
       WHERE user_id = $1 AND plan_id = $2 RETURNING *`,
      [userId, data.planId, data.name, data.rsn, data.mode, data.plan, data.summary],
    )
    return ownerShape(rows[0])
  }
  const { rows: count } = await pool.query('SELECT count(*)::int AS n FROM shared_plans WHERE user_id = $1', [userId])
  if (count[0].n >= MAX_SHARES_PER_USER) throw new SharePlanError(`You can have up to ${MAX_SHARES_PER_USER} public plans. Stop sharing one to share another.`, 409)
  // A slug collision is astronomically unlikely, but retry rather than fail.
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const { rows } = await pool.query(
        `INSERT INTO shared_plans (slug, user_id, plan_id, name, rsn, mode, plan, summary) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [newSlug(), userId, data.planId, data.name, data.rsn, data.mode, data.plan, data.summary],
      )
      return ownerShape(rows[0])
    } catch (err) {
      if (err.code !== '23505') throw err
    }
  }
  throw new SharePlanError('Could not create a link, please try again.', 500)
}

export async function listMyShares(userId) {
  const { rows } = await pool.query('SELECT * FROM shared_plans WHERE user_id = $1 ORDER BY updated_at DESC', [userId])
  return rows.map(ownerShape)
}

/** Turns sharing off: the row and so the link are gone. True when something was removed. */
export async function stopSharing(userId, slug) {
  if (!isSlug(slug)) return false
  const { rowCount } = await pool.query('DELETE FROM shared_plans WHERE user_id = $1 AND slug = $2', [userId, slug])
  return rowCount > 0
}

export async function getPublicShare(slug) {
  if (!isSlug(slug)) return null
  const { rows } = await pool.query('SELECT * FROM shared_plans WHERE slug = $1', [slug])
  return rows[0] ? publicShape(rows[0]) : null
}
