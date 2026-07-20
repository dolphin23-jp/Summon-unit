import { DISPLAY_MASTER_VALIDATION } from '../src/content/display-masters'
import { VERTICAL_SLICE_SKILL_FX_VALIDATION } from '../src/content/skill-fx'
import {
  ACTIVE_CONTENT_VALIDATION,
  AUTHORED_VERTICAL_SLICE_CONTENT_VALIDATION,
  AUTHORED_VERTICAL_SLICE_WORLD_VALIDATION,
  BALANCED_VERTICAL_SLICE_CONTENT_VALIDATION,
} from '../src/content/runtime-content-validation'
import { UX_GUIDANCE_VALIDATION } from '../src/ux/ux-guidance'

console.log(
  JSON.stringify(
    {
      active: ACTIVE_CONTENT_VALIDATION,
      verticalSlice: AUTHORED_VERTICAL_SLICE_CONTENT_VALIDATION,
      verticalSliceWorld: AUTHORED_VERTICAL_SLICE_WORLD_VALIDATION,
      verticalSliceBalanced: BALANCED_VERTICAL_SLICE_CONTENT_VALIDATION,
      displayMasters: DISPLAY_MASTER_VALIDATION,
      skillFx: VERTICAL_SLICE_SKILL_FX_VALIDATION,
      uxGuidance: UX_GUIDANCE_VALIDATION,
    },
    null,
    2,
  ),
)
