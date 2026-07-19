import {
  T039_GENERIC_SKILL_COSTS,
  T039_PLAYER_CATALOG,
} from '../demo/region-ui-demo'
import { validateContentCatalog } from './content-validation'
import { VERTICAL_SLICE_CONTENT_VALIDATION } from './vertical-slice-content'
import { VERTICAL_SLICE_T046_BALANCED_VALIDATION } from './vertical-slice-t046-balanced-master'
import { VERTICAL_SLICE_WORLD_VALIDATION } from './vertical-slice-world'

export const ACTIVE_CONTENT_VALIDATION = validateContentCatalog(T039_PLAYER_CATALOG, {
  genericSkillCosts: T039_GENERIC_SKILL_COSTS,
})

export const AUTHORED_VERTICAL_SLICE_CONTENT_VALIDATION =
  VERTICAL_SLICE_CONTENT_VALIDATION

export const AUTHORED_VERTICAL_SLICE_WORLD_VALIDATION =
  VERTICAL_SLICE_WORLD_VALIDATION

export const BALANCED_VERTICAL_SLICE_CONTENT_VALIDATION =
  VERTICAL_SLICE_T046_BALANCED_VALIDATION
