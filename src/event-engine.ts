/** A deterministic, replayable event/action registry for later chapters. */
export interface EventContext {
  readonly facts: readonly string[];
  readonly numbers: Readonly<Record<string, number>>;
  readonly tags?: readonly string[];
}

export interface DeterministicEvent<TContext extends EventContext, TResult> {
  id: string;
  priority: number;
  when(context: TContext): boolean;
  resolve(context: TContext): TResult;
}

export function eligibleEvents<TContext extends EventContext, TResult>(
  events: readonly DeterministicEvent<TContext, TResult>[],
  context: TContext,
  resolvedIds: readonly string[] = []
): DeterministicEvent<TContext, TResult>[] {
  const resolved = new Set(resolvedIds);
  return events
    .filter((event) => !resolved.has(event.id) && event.when(context))
    .sort((left, right) => {
      if (right.priority !== left.priority) return right.priority - left.priority;
      return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
    });
}

export function resolveNextEvent<TContext extends EventContext, TResult>(
  events: readonly DeterministicEvent<TContext, TResult>[],
  context: TContext,
  resolvedIds: readonly string[] = []
): { event: DeterministicEvent<TContext, TResult>; result: TResult } | null {
  const event = eligibleEvents(events, context, resolvedIds)[0];
  return event ? { event, result: event.resolve(context) } : null;
}

export function appendResolvedEvent(resolvedIds: readonly string[], eventId: string): string[] {
  return [...new Set([...resolvedIds, eventId])];
}
