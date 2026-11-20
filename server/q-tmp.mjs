import 'dotenv/config'
const { pool } = await import('./src/db.js')
await new Promise((r) => setTimeout(r, 15000))
const before = (await pool.query('SELECT latest_at FROM ge_status')).rows[0].latest_at
const until = new Date(); until.setUTCMinutes(Math.ceil((until.getUTCMinutes() + 0.2) / 5) * 5, 40, 0)
while (Date.now() < until.getTime()) await new Promise((r) => setTimeout(r, 4000))
const after = (await pool.query('SELECT latest_at FROM ge_status')).rows[0].latest_at
console.log('checked', new Date().toISOString().slice(11, 19), 'latest_at before', new Date(before).toISOString().slice(11, 19), 'after', new Date(after).toISOString().slice(11, 19))
await pool.end()
