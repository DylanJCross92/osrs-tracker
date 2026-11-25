// Injection key for what kind of account the plan open now is for (a computed { members, build, iron, ironKind }), provided by the Account Planner
// so the pickers inside it can mark what the build rules out (see utils/builds.js).
export const plannerAccountContext = Symbol('plannerAccountContext')
