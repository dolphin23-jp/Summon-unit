import { describe, expect, it } from 'vitest'
import theme from './theme.css?raw'

describe('T052 theme contract', () => {
  it('uses tokenised CSS with responsive battle layers', () => {
    expect(theme).toContain('--color-bg-canvas')
    expect(theme).toContain('--region-accent')
    expect(theme).toContain('/* T052 responsive battle deck */')
    expect(theme).toContain('.battle-foreground-layer')
    expect(theme).toContain('height: 100dvh')
  })
})
