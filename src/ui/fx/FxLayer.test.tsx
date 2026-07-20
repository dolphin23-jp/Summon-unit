import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { FxLayer } from './FxLayer'
import type { FxCommand } from './fx-mapper'

const COMMAND: FxCommand = Object.freeze({
  id: 'fx:battle-event:1:damage',
  eventId: 'battle-event:1',
  kind: 'FLOAT_TEXT',
  positionId: 'ENEMY:0:2',
  fromPositionId: null,
  toPositionId: null,
  text: '-25',
  tone: 'DAMAGE',
  color: '#ff7a5c',
  durationMs: 720,
  scale: 1,
  preset: null,
  compact: false,
})

describe('FxLayer', () => {
  it('renders a non-blocking, hidden presentation overlay at board coordinates', () => {
    const html = renderToStaticMarkup(
      <FxLayer commands={[COMMAND]} batchId={4} motionLevel="STANDARD" />,
    )
    expect(html).toContain('class="fx-layer"')
    expect(html).toContain('aria-hidden="true"')
    expect(html).toContain('data-fx-kind="FLOAT_TEXT"')
    expect(html).toContain('--fx-left:83.333')
    expect(html).toContain('-25')
  })

  it('renders nothing in minimal mode', () => {
    expect(renderToStaticMarkup(<FxLayer commands={[COMMAND]} batchId={1} motionLevel="MINIMAL" />)).toBe('')
  })
})
