import {
  formatHeadlessBattleResult,
  runStandardHeadlessBattle,
} from '../src/demo/standard-headless-battle'
import {
  formatReferenceHeadlessBattleV2,
  runReferenceHeadlessBattleV2,
} from '../src/demo/reference-headless-battle-v2'

console.log(
  JSON.stringify(
    {
      v1: JSON.parse(formatHeadlessBattleResult(runStandardHeadlessBattle())),
      v2: JSON.parse(
        formatReferenceHeadlessBattleV2(runReferenceHeadlessBattleV2()),
      ),
    },
    null,
    2,
  ),
)
