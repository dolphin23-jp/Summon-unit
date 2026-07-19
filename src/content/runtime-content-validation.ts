import {
  T039_GENERIC_SKILL_COSTS,
  T039_PLAYER_CATALOG,
} from '../demo/region-ui-demo'
import { validateContentCatalog } from './content-validation'
import { VERTICAL_SLICE_CONTENT_VALIDATION } from './vertical-slice-content'

export const ACTIVE_CONTENT_VALIDATION = validateContentCatalog(T039_PLAYER_CATALOG, {
  genericSkillCosts: T039_GENERIC_SKILL_COSTS,
})

export const AUTHORED_VERTICAL_SLICE_CONTENT_VALIDATION =
  VERTICAL_SLICE_CONTENT_VALIDATION
