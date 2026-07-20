import { UX_GUIDANCE_VALIDATION } from '../src/ux/ux-guidance'
import { DISPLAY_MASTER_VALIDATION } from '../src/content/display-masters'
import {
  ACTIVE_CONTENT_VALIDATION,
  AUTHORED_VERTICAL_SLICE_CONTENT_VALIDATION,
  AUTHORED_VERTICAL_SLICE_WORLD_VALIDATION,
  BALANCED_VERTICAL_SLICE_CONTENT_VALIDATION,
} from '../src/content/runtime-content-validation'

console.log(
  JSON.stringify(
    {
      active: ACTIVE_CONTENT_VALIDATION,
      verticalSlice: AUTHORED_VERTICAL_SLICE_CONTENT_VALIDATION,
      verticalSliceWorld: AUTHORED_VERTICAL_SLICE_WORLD_VALIDATION,
      verticalSliceBalanced: BALANCED_VERTICAL_SLICE_CONTENT_VALIDATION,
      displayMasters: DISPLAY_MASTER_VALIDATION,
      uxGuidance: UX_GUIDANCE_VALIDATION,
    },
    null,
    2,
  ),
)
