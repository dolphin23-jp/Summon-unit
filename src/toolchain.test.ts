import { describe, expect, it } from 'vitest'
import { formatCheckCommand, requiredChecks } from './toolchain'

describe('toolchain foundation', () => {
  it('defines the required verification commands in their documented order', () => {
    expect(requiredChecks.map(formatCheckCommand)).toEqual([
      'pnpm test',
      'pnpm lint',
      'pnpm build',
    ])
  })
})
