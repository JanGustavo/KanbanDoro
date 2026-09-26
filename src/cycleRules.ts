export function elapsedCredit(session: { startedAt: number; endsAt: number; creditedSeconds: number; excludedSeconds: number }, now: number) {
  const elapsed = Math.max(0, Math.floor((Math.min(now, session.endsAt) - session.startedAt) / 1000));
  return Math.max(0, elapsed - (session.creditedSeconds || 0) - (session.excludedSeconds || 0));
}

export function completedCycleCount(history: Array<{ kind: string; cycleId?: string }>) {
  return history.filter(entry => entry.kind === 'cycle-completed' || (entry.kind === 'completed' && !entry.cycleId)).length;
}

export function suggestedBreakMinutes(completedCycles: number, justCompleted: boolean, durations: { short: number; long: number }) {
  return justCompleted && completedCycles > 0 && completedCycles % 4 === 0 ? durations.long : durations.short;
}
