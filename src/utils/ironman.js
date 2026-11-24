// Ironman accounts cannot buy or sell, so a plan for one is about what has to be gathered, not about gp: the cheapest routes (the least to gather) are
// the default, making gp is not a goal, and gp figures are left out of what is shown (see useAccountType.js and the `gp-figure` class).
import { AUTO_CHEAP, AUTO_FAST, AUTO_PROFIT } from '@/utils/planner'

/** The strategy for an ironman: fastest and profit assume buying supplies, so they become cheapest; balanced and cheapest stay. */
export const ironStrategy = (strategy) => (strategy === AUTO_FAST || strategy === AUTO_PROFIT ? AUTO_CHEAP : strategy)

/** The strategies worth offering an ironman (making gp is not one). */
export const ironStrategies = (list) => list.filter((s) => s !== AUTO_PROFIT)
