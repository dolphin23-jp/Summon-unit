export const requiredChecks = ['test', 'lint', 'build'] as const

export type RequiredCheck = (typeof requiredChecks)[number]

export function formatCheckCommand(check: RequiredCheck): string {
  return `pnpm ${check}`
}
