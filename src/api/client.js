// In dev, Vite serves the frontend on its own port (5173) separate from the
// API (4000), so it needs the full origin. In a production build this same
// Express server serves both the built frontend and the API, so a relative
// path keeps it working under whatever domain it's deployed to.
export const BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:4000/api' : '/api')

export class ApiError extends Error {
  constructor(message, status, code = '') {
    super(message)
    this.status = status
    // A short machine-readable reason some endpoints add (for example "email_not_verified").
    this.code = code
  }
}

async function request(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    // Send the sign-in cookie. Same-origin in production; in dev it crosses from the Vite port to the API port.
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (res.status === 204) return null

  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new ApiError(data?.error || 'Something went wrong.', res.status, data?.code || '')
  }
  return data
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body: body ?? {} }),
  put: (path, body) => request(path, { method: 'PUT', body: body ?? {} }),
}
