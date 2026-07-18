export const SCHEDULED_EVENT_KINDS = [
  'UNIT_TURN',
  'TELEGRAPH_RESOLVE',
  'SUMMON',
  'TERRAIN_TRIGGER',
  'PHASE_CHANGE',
] as const

export type ScheduledEventKind = (typeof SCHEDULED_EVENT_KINDS)[number]

export interface ScheduledEvent<TPayload = unknown> {
  readonly id: string
  readonly time: number
  readonly priority: number
  readonly sequence: number
  readonly kind: ScheduledEventKind
  readonly payload: TPayload
}

export interface TimelineQueue {
  readonly events: readonly ScheduledEvent[]
}

export interface PopTimelineEventResult {
  readonly queue: TimelineQueue
  readonly event: ScheduledEvent | null
}

export interface CancelTimelineEventResult {
  readonly queue: TimelineQueue
  readonly cancelled: boolean
}

function freezeQueue(events: readonly ScheduledEvent[]): TimelineQueue {
  return Object.freeze({ events: Object.freeze([...events]) })
}

export const EMPTY_TIMELINE_QUEUE: TimelineQueue = freezeQueue([])

function assertNonEmptyId(id: string): void {
  if (id.trim().length === 0) {
    throw new Error('event.id must be a non-empty string')
  }
}

function assertSafeInteger(value: number, field: string, minimum?: number): void {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${field} must be a safe integer`)
  }

  if (minimum !== undefined && value < minimum) {
    throw new Error(`${field} must be greater than or equal to ${minimum}`)
  }
}

export function assertValidScheduledEvent(event: ScheduledEvent): void {
  assertNonEmptyId(event.id)
  assertSafeInteger(event.time, 'event.time', 0)
  assertSafeInteger(event.priority, 'event.priority')
  assertSafeInteger(event.sequence, 'event.sequence', 0)

  if (!SCHEDULED_EVENT_KINDS.includes(event.kind)) {
    throw new Error('event.kind is invalid')
  }
}

export function compareScheduledEvents(left: ScheduledEvent, right: ScheduledEvent): number {
  if (left.time !== right.time) {
    return left.time - right.time
  }

  if (left.priority !== right.priority) {
    return left.priority - right.priority
  }

  return left.sequence - right.sequence
}

export function createTimelineQueue(
  initialEvents: readonly ScheduledEvent[] = [],
): TimelineQueue {
  return initialEvents.reduce<TimelineQueue>(
    (queue, event) => pushTimelineEvent(queue, event),
    EMPTY_TIMELINE_QUEUE,
  )
}

export function pushTimelineEvent(queue: TimelineQueue, event: ScheduledEvent): TimelineQueue {
  assertValidScheduledEvent(event)

  if (queue.events.some((queuedEvent) => queuedEvent.id === event.id)) {
    throw new Error(`event.id must be unique within the queue: ${event.id}`)
  }

  const queuedEvent = Object.freeze({ ...event })
  const insertionIndex = queue.events.findIndex(
    (existingEvent) => compareScheduledEvents(queuedEvent, existingEvent) < 0,
  )

  if (insertionIndex === -1) {
    return freezeQueue([...queue.events, queuedEvent])
  }

  return freezeQueue([
    ...queue.events.slice(0, insertionIndex),
    queuedEvent,
    ...queue.events.slice(insertionIndex),
  ])
}

export function peekTimelineEvent(queue: TimelineQueue): ScheduledEvent | null {
  return queue.events[0] ?? null
}

export function popTimelineEvent(queue: TimelineQueue): PopTimelineEventResult {
  const [event, ...remainingEvents] = queue.events

  if (event === undefined) {
    return Object.freeze({ queue, event: null })
  }

  return Object.freeze({
    queue: freezeQueue(remainingEvents),
    event,
  })
}

export function cancelTimelineEvent(
  queue: TimelineQueue,
  eventId: string,
): CancelTimelineEventResult {
  assertNonEmptyId(eventId)

  const remainingEvents = queue.events.filter((event) => event.id !== eventId)
  const cancelled = remainingEvents.length !== queue.events.length

  return Object.freeze({
    queue: cancelled ? freezeQueue(remainingEvents) : queue,
    cancelled,
  })
}

export function getTimelineQueueSize(queue: TimelineQueue): number {
  return queue.events.length
}
