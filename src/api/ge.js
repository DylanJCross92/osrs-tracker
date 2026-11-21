import { api } from './client'

// Grand Exchange prices (public). See server/src/routes/ge.routes.js.
export const geApi = {
  // { updatedAt, stale, items: [[id, name, slug, members, high, low, volume, limit, change1, change7, change30, margin, icon|null], ...] }
  index: () => api.get('/ge/items'),
  // { updatedAt, stale, prices: { "lower case name": [high, low, slug, icon|null] } } for the item names given.
  // The same rows as index for just the items with these addresses (the ones someone watches).
  watch: (slugs) => api.get(`/ge/watch?slugs=${encodeURIComponent(slugs.join(','))}`),
  prices: (names) => api.get(`/ge/prices?names=${encodeURIComponent(names.join('|'))}`),
  item: (slug) => api.get(`/ge/items/${encodeURIComponent(slug)}`),
  // { range, points: [{ t, high, low, vol }] } for 1d, 1w, 1m, 3m or 1y.
  history: (slug, range) => api.get(`/ge/items/${encodeURIComponent(slug)}/history?range=${encodeURIComponent(range)}`),
}
