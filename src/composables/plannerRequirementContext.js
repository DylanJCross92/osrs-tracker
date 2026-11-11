// Injection key for the planner's requirement context (a computed { levels, planned, confirmations }), provided by the
// Account Planner so any planner component can check a method's requirements the same way.
export const plannerRequirementContext = Symbol('plannerRequirementContext')
