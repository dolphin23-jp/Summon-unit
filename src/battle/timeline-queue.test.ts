import { describe, expect, it } from 'vitest'
import {
  EMPTY_TIMELINE_QUEUE,
  assertValidScheduledEvent,
  cancelTimelineEvent,
  compareScheduledEvents,
  createTimelineQueue,
  getTimelineQueueSize,
  peekTimelineEvent,
  popTimelineEvent,
  pushTimelineEvent,
  type ScheduledEvent,
  type TimelineQueue,
} from './timeline-queue'

function event(
  id: string,
  time: number,
  priority: number,
  sequence: number,
): ScheduledEvent<{ readonly label: string }> {
  return {
    id,
    time,
    priority,
    sequence,
    kind: 'UNIT_TURN',
    payload: { label: id },
  }
}

function drainIds(initialQueue: TimelineQueue): readonly string[] {
  const ids: string[] = []
  let queue = initialQueue

  while (getTimelineQueueSize(queue) > 0) {
    const result = popTimelineEvent(queue)

    if (result.event === null) {
      throw new Error('non-empty queue returned no event')
    }

    ids.push(result.event.id)
    queue = result.queue
  }

  return ids
}

describe('timeline queue', () => {
  it('orders events by time, then priority, then sequence', () => {
    const queue = createTimelineQueue([
      event('late', 200, 0, 0),
      event('same-time-low-priority', 100, 5, 1),
      event('same-time-high-priority-late-sequence', 100, -1, 3),
      event('same-time-high-priority-early-sequence', 100, -1, 2),
      event('early', 50, 100, 4),
    ])

    expect(drainIds(queue)).toEqual([
      'early',
      'same-time-high-priority-early-sequence',
      'same-time-high-priority-late-sequence',
      'same-time-low-priority',
      'late',
    ])
  })

  it('preserves insertion order when all comparison keys are equal', () => {
    const queue = createTimelineQueue([
      event('first', 100, 0, 7),
      event('second', 100, 0, 7),
      event('third', 100, 0, 7),
    ])

    expect(drainIds(queue)).toEqual(['first', 'second', 'third'])
  })

  it('produces the same output for the same input order on repeated runs', () => {
    const input = [
      event('c', 120, 1, 3),
      event('a', 100, 1, 1),
      event('b', 100, 1, 2),
      event('d', 120, 0, 4),
    ]

    expect(drainIds(createTimelineQueue(input))).toEqual(
      drainIds(createTimelineQueue(input)),
    )
  })

  it('peeks and pops without mutating the source queue', () => {
    const first = event('first', 10, 0, 0)
    const second = event('second', 20, 0, 1)
    const queue = createTimelineQueue([second, first])

    expect(peekTimelineEvent(queue)).toEqual(first)

    const popped = popTimelineEvent(queue)

    expect(popped.event).toEqual(first)
    expect(drainIds(popped.queue)).toEqual(['second'])
    expect(drainIds(queue)).toEqual(['first', 'second'])
    expect(Object.isFrozen(queue)).toBe(true)
    expect(Object.isFrozen(queue.events)).toBe(true)
  })

  it('returns null when peeking or popping an empty queue', () => {
    expect(peekTimelineEvent(EMPTY_TIMELINE_QUEUE)).toBeNull()

    const result = popTimelineEvent(EMPTY_TIMELINE_QUEUE)

    expect(result.event).toBeNull()
    expect(result.queue).toBe(EMPTY_TIMELINE_QUEUE)
  })

  it('pushes without mutating the existing queue', () => {
    const original = createTimelineQueue([event('later', 20, 0, 1)])
    const updated = pushTimelineEvent(original, event('earlier', 10, 0, 0))

    expect(drainIds(original)).toEqual(['later'])
    expect(drainIds(updated)).toEqual(['earlier', 'later'])
  })

  it('cancels an event so it cannot be peeked or popped', () => {
    const queue = createTimelineQueue([
      event('first', 10, 0, 0),
      event('cancelled', 20, 0, 1),
      event('last', 30, 0, 2),
    ])

    const result = cancelTimelineEvent(queue, 'cancelled')

    expect(result.cancelled).toBe(true)
    expect(drainIds(result.queue)).toEqual(['first', 'last'])
    expect(drainIds(queue)).toEqual(['first', 'cancelled', 'last'])
  })

  it('returns the original queue when the cancellation target is absent', () => {
    const queue = createTimelineQueue([event('present', 10, 0, 0)])
    const result = cancelTimelineEvent(queue, 'absent')

    expect(result.cancelled).toBe(false)
    expect(result.queue).toBe(queue)
  })

  it('rejects duplicate event ids within one queue', () => {
    const queue = createTimelineQueue([event('duplicate', 10, 0, 0)])

    expect(() => pushTimelineEvent(queue, event('duplicate', 20, 0, 1))).toThrow(
      'event.id must be unique within the queue: duplicate',
    )
  })

  it.each([
    [{ ...event('invalid', 0, 0, 0), id: '   ' }, 'event.id must be a non-empty string'],
    [{ ...event('invalid', -1, 0, 0) }, 'event.time must be greater than or equal to 0'],
    [{ ...event('invalid', 1.5, 0, 0) }, 'event.time must be a safe integer'],
    [{ ...event('invalid', 0, Number.NaN, 0) }, 'event.priority must be a safe integer'],
    [{ ...event('invalid', 0, 0, -1) }, 'event.sequence must be greater than or equal to 0'],
    [
      { ...event('invalid', 0, 0, 0), kind: 'UNKNOWN' } as unknown as ScheduledEvent,
      'event.kind is invalid',
    ],
  ] as const)('rejects invalid scheduled events', (invalidEvent, message) => {
    expect(() => assertValidScheduledEvent(invalidEvent)).toThrow(message)
  })

  it('compares only the documented time, priority, and sequence keys', () => {
    expect(compareScheduledEvents(event('z', 10, 0, 1), event('a', 10, 0, 1))).toBe(0)
    expect(compareScheduledEvents(event('later', 11, -10, 0), event('earlier', 10, 10, 99))).toBeGreaterThan(0)
    expect(compareScheduledEvents(event('priority-first', 10, -1, 9), event('priority-last', 10, 0, 0))).toBeLessThan(0)
    expect(compareScheduledEvents(event('sequence-first', 10, 0, 1), event('sequence-last', 10, 0, 2))).toBeLessThan(0)
  })
})
