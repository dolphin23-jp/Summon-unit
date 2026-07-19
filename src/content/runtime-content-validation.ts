import {
  T039_GENERIC_SKILL_COSTS,
  T039_PLAYER_CATALOG,
} from '../demo/region-ui-demo'
import { validateContentCatalog } from './content-validation'

export const ACTIVE_CONTENT_VALIDATION = validateContentCatalog(T039_PLAYER_CATALOG, {
  genericSkillCosts: T039_GENERIC_SKILL_COSTS,
})
