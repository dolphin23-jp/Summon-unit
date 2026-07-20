import type { CSSProperties } from 'react'
import type { BattleMotionLevel } from '../battle-accessibility'
import type { FxCommand } from './fx-mapper'

interface PositionPercent {
  readonly left: number
  readonly top: number
}

function positionPercent(positionId: string | null): PositionPercent | null {
  if (positionId === null) return null
  const match = /^(ALLY|ENEMY):([0-2]):([0-2])$/.exec(positionId)
  if (match === null) return null
  const side = match[1]
  const localRow = Number(match[2])
  const column = Number(match[3])
  const globalRow = side === 'ENEMY' ? 2 - localRow : 3 + localRow
  return Object.freeze({
    left: ((column + 0.5) / 3) * 100,
    top: ((globalRow + 0.5) / 6) * 100,
  })
}

function commandStyle(command: FxCommand): CSSProperties {
  const position = positionPercent(command.positionId ?? command.toPositionId)
  const from = positionPercent(command.fromPositionId) ?? position
  const to = positionPercent(command.toPositionId) ?? position
  return {
    '--fx-left': `${position?.left ?? 50}%`,
    '--fx-top': `${position?.top ?? 50}%`,
    '--fx-from-left': `${from?.left ?? 50}%`,
    '--fx-from-top': `${from?.top ?? 50}%`,
    '--fx-to-left': `${to?.left ?? 50}%`,
    '--fx-to-top': `${to?.top ?? 50}%`,
    '--fx-color': command.color,
    '--fx-duration': `${command.durationMs}ms`,
    '--fx-scale': String(command.scale),
  } as CSSProperties
}

function commandClass(command: FxCommand): string {
  const classes = [
    'fx-command',
    `fx-command--${command.kind.toLowerCase().replaceAll('_', '-')}`,
    `fx-command--tone-${command.tone.toLowerCase()}`,
  ]
  if (command.compact) classes.push('fx-command--compact')
  if (command.preset !== null) classes.push(`fx-preset--${command.preset.toLowerCase()}`)
  return classes.join(' ')
}

export function FxLayer({
  commands,
  batchId,
  motionLevel,
}: {
  readonly commands: readonly FxCommand[]
  readonly batchId: number
  readonly motionLevel: BattleMotionLevel
}) {
  if (motionLevel === 'MINIMAL' || commands.length === 0) return null
  return (
    <div
      key={batchId}
      className="fx-layer"
      data-motion={motionLevel.toLowerCase()}
      aria-hidden="true"
    >
      {commands.map((command) => (
        <span
          key={command.id}
          className={commandClass(command)}
          data-fx-kind={command.kind}
          data-fx-preset={command.preset ?? undefined}
          style={commandStyle(command)}
        >
          {command.kind === 'FLOAT_TEXT' || command.kind === 'DEFEAT' ? command.text : null}
        </span>
      ))}
    </div>
  )
}
