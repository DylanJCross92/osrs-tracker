import 'dotenv/config'
import pg from 'pg'

// Managed Postgres hosts (Railway, Render, etc.) terminate with a
// self-signed cert on their internal network; rejectUnauthorized: false
// accepts that without requiring a CA bundle. Local/dev Postgres has no TLS
// at all, so this only applies once NODE_ENV=production (set by the host).
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
})
