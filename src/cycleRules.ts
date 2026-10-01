export function elapsedCredit(
  session: { startedAt: number; endsAt: number; stepEndsAt?: number; creditedSeconds: number; excludedSeconds: number },
  now: number,
) {
  const elapsed = Math.max(
    0,
    Math.floor((Math.min(now, session.stepEndsAt ?? session.endsAt, session.endsAt) - session.startedAt) / 1000),
  );
  return Math.max(0, elapsed - (session.creditedSeconds || 0) - (session.excludedSeconds || 0));
}

export function stepDeadline(session: { stepEndsAt?: number; endsAt: number }) {
  return Math.min(session.stepEndsAt ?? session.endsAt, session.endsAt);
}

// Pausas dentro do foco congelam ambos os prazos; só o tempo efetivamente pausado é excluído do crédito.
export function resumeAfterPause<
  T extends {
    phase: string;
    pauseStartedAt?: number;
    pauseEndsAt?: number;
    endsAt: number;
    stepEndsAt?: number;
    excludedSeconds: number;
  },
>(session: T, now: number): T {
  if (!['intermission', 'intermission-done'].includes(session.phase) || !session.pauseStartedAt) return session;
  const elapsed = Math.max(0, now - session.pauseStartedAt);
  return {
    ...session,
    phase: 'running',
    pauseStartedAt: undefined,
    pauseEndsAt: undefined,
    endsAt: session.endsAt + elapsed,
    stepEndsAt: session.stepEndsAt === undefined ? undefined : session.stepEndsAt + elapsed,
    excludedSeconds: session.excludedSeconds + Math.floor(elapsed / 1000),
  };
}

export function extensionBudget(estimate: number, usedMinutes: number, count: number) {
  return count >= 2 ? 0 : Math.max(0, Math.floor(estimate * 0.5) - usedMinutes);
}

// Validate against the latest session, so a double click cannot consume both extensions.
export function extendFocusSession<
  T extends {
    phase: string;
    startedAt: number;
    endsAt: number;
    stepEndsAt?: number;
    stepStartedAt?: number;
    excludedSeconds: number;
    extensions: number;
    extensionMinutes: number;
    warnedMinutes?: number[];
  },
>(session: T, estimate: number, amount: number, now: number): T {
  const deadline = stepDeadline(session);
  if (
    !['running', 'decision'].includes(session.phase) ||
    now < deadline ||
    !Number.isInteger(amount) ||
    amount < 1 ||
    amount > extensionBudget(estimate, session.extensionMinutes, session.extensions)
  )
    return session;
  const waitingMs = Math.max(0, now - deadline);
  return {
    ...session,
    phase: 'running',
    stepStartedAt: now,
    stepEndsAt: now + amount * 60_000,
    endsAt: session.endsAt + waitingMs + amount * 60_000,
    excludedSeconds: (session.excludedSeconds ?? 0) + Math.floor(waitingMs / 1000),
    extensions: session.extensions + 1,
    extensionMinutes: session.extensionMinutes + amount,
    warnedMinutes: [],
  };
}

// A rest session can retain focus step fields; they must not drive its clock.
export function sessionClock(
  session: {
    phase: string;
    startedAt: number;
    endsAt: number;
    stepStartedAt?: number;
    stepEndsAt?: number;
    pauseStartedAt?: number;
    pauseEndsAt?: number;
  },
  now: number,
) {
  const quickBreak = session.phase.startsWith('intermission');
  const rest = session.phase === 'break' || session.phase === 'break-done';
  const start = quickBreak
    ? (session.pauseStartedAt ?? now)
    : rest
      ? session.startedAt
      : (session.stepStartedAt ?? session.startedAt);
  const end = quickBreak ? (session.pauseEndsAt ?? now) : rest ? session.endsAt : stepDeadline(session);
  const totalMs = Math.max(1, end - start);
  const remainingMs = Math.max(0, Math.min(totalMs, end - now));
  return { totalMs, remainingMs, progress: 100 * (1 - remainingMs / totalMs), isBreak: quickBreak || rest };
}

export function nextStepTiming(
  session: { startedAt: number; endsAt: number; stepEndsAt?: number; creditedSeconds: number; excludedSeconds: number },
  now: number,
  nextMinutes: number,
) {
  const deadline = stepDeadline(session);
  const waitingMs = Math.max(0, now - deadline);
  return {
    stepStartedAt: now,
    stepEndsAt: Math.max(now, deadline) + nextMinutes * 60_000,
    endsAt: session.endsAt + waitingMs,
    excludedSeconds: (session.excludedSeconds ?? 0) + Math.floor(waitingMs / 1000),
    creditedSeconds: session.creditedSeconds + elapsedCredit(session, now),
  };
}

export function completedCycleCount(history: Array<{ kind: string; cycleId?: string }>) {
  return history.filter(entry => entry.kind === 'cycle-completed' || (entry.kind === 'completed' && !entry.cycleId))
    .length;
}

export function suggestedBreakMinutes(
  completedCycles: number,
  justCompleted: boolean,
  durations: { short: number; long: number },
) {
  return justCompleted && completedCycles > 0 && completedCycles % 4 === 0 ? durations.long : durations.short;
}
