import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('T052 theme contract', () => {
  it('uses one tokenised CSS entrypoint with responsive battle layers', () => {
    const main = readFileSync(new URL('../main.tsx', import.meta.url), 'utf-8')
    const theme = readFileSync(new URL('./theme.css', import.meta.url), 'utf-8')
    expect(main).toContain("import './ui/theme.css'")
    expect(main).not.toMatch(/import '\.\/t\d+\.css'/)
    expect(theme).toContain('--color-bg-canvas')
    expect(theme).toContain('--region-accent')
    expect(theme).toContain('/* T052 responsive battle deck */')
    expect(theme).toContain('.battle-foreground-layer')
    expect(theme).toContain('height: 100dvh')
  })
})
