import { api, BASE_URL } from './client'

export const sharedPlansApi = {
  // The signed-in owner's public plans: { shares: [{ slug, planId, name, rsn, mode, plan, summary, updatedAt }] }
  mine: () => api.get('/plans/shared'),
  // Share a saved plan, or refresh its public copy. { share }
  share: (payload) => api.post('/plans/shared', payload),
  // Turn sharing off: the link stops working.
  stop: (slug) => api.del(`/plans/shared/${slug}`),
  // Public, no account: { plan: { slug, name, rsn, mode, plan, summary, createdAt, updatedAt } }
  get: (slug) => api.get(`/plans/public/${slug}`),
  // Site owner / admins only: any plan from the Player plans page (ref on each plan), same shape as a public plan.
  adminGet: (ref) => api.get(`/admin/plans/view/${encodeURIComponent(ref)}`),
  // Site owner / admins only: the ref of whoever holds a plan with this id, for a /planner/<id> address that is not the viewer's own.
  adminFind: (planId) => api.get(`/admin/plans/find/${encodeURIComponent(planId)}`),
  // Count a view or a use of a public plan (no account needed, nothing about who is sent).
  event: (slug, type) => api.post(`/plans/public/${slug}/event`, { type }),
  cardUrl: (slug, version) => `${BASE_URL}/plans/public/${slug}/card.png${version ? `?v=${version}` : ''}`,
  // The link people share: the server gives it a preview card, then the app shows the plan.
  pageUrl: (slug) => `${window.location.origin}/plan/${slug}`,
}
