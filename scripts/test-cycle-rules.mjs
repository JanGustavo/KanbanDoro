import assert from 'node:assert/strict';
import {
  completedCycleCount,
  elapsedCredit,
  extensionBudget,
  extendFocusSession,
  sessionClock,
  nextStepTiming,
  resumeAfterPause,
  stepDeadline,
  suggestedBreakMinutes,
} from '../src/cycleRules.ts';

const session = { startedAt: 0, endsAt: 90_000, creditedSeconds: 0, excludedSeconds: 0 };
assert.equal(elapsedCredit(session, 30_000), 30);
assert.equal(
  elapsedCredit({ ...session, creditedSeconds: 30 }, 75_000),
  45,
  'switching tasks credits only the new segment',
);
assert.equal(elapsedCredit({ ...session, creditedSeconds: 75 }, 120_000), 15, 'time beyond the cycle is not credited');
assert.equal(elapsedCredit({ ...session, creditedSeconds: 90 }, 120_000), 0, 'finishing cannot credit a segment twice');
const multi = { ...session, endsAt: 90 * 60_000, stepEndsAt: 30 * 60_000 };
assert.equal(stepDeadline(multi), 30 * 60_000, 'the task ends before the whole cycle');
assert.equal(elapsedCredit(multi, 45 * 60_000), 30 * 60, 'waiting for a decision is never credited');
const early = nextStepTiming(multi, 20 * 60_000, 15);
assert.equal(early.stepEndsAt, 45 * 60_000, 'unused time carries into the next task');
assert.equal(early.endsAt, 90 * 60_000, 'early completion keeps the planned cycle length');
assert.equal(
  elapsedCredit({ ...multi, ...early }, 35 * 60_000),
  15 * 60,
  'the next task receives only its own seconds',
);
const late = nextStepTiming(multi, 35 * 60_000, 60);
assert.equal(late.stepEndsAt, 95 * 60_000);
assert.equal(late.endsAt, 95 * 60_000, 'decision waiting shifts the whole cycle');
assert.equal(
  elapsedCredit({ ...multi, ...late }, 45 * 60_000),
  10 * 60,
  'decision waiting is not credited to the next task',
);
const paused = { ...session, phase: 'intermission', pauseStartedAt: 30_000, pauseEndsAt: 210_000, stepEndsAt: 90_000 };
const resumed = resumeAfterPause(paused, 240_000);
assert.equal(resumed.stepEndsAt, 300_000, 'focus deadline shifts by the actual break, even when the user returns late');
assert.equal(resumed.endsAt, 300_000);
assert.equal(elapsedCredit(resumed, 270_000), 60, 'the pause does not count as focus time');
assert.equal(resumeAfterPause(resumed, 270_000), resumed, 'resuming twice does not shift the deadline again');
assert.equal(extensionBudget(40, 0, 0), 20);
assert.equal(extensionBudget(40, 13, 1), 7);
assert.equal(extensionBudget(40, 0, 2), 0, 'at most two extensions per task');
assert.equal(
  completedCycleCount([
    { kind: 'completed' },
    { kind: 'completed', cycleId: '1' },
    { kind: 'switched', cycleId: '1' },
    { kind: 'cycle-completed', cycleId: '1' },
  ]),
  2,
);
assert.equal(suggestedBreakMinutes(4, true, { short: 5, long: 20 }), 20);
assert.equal(suggestedBreakMinutes(4, false, { short: 5, long: 20 }), 5);
console.log('Crédito de tempo por tarefa e alternância de pausas validados.');

const finished = { ...multi, phase: 'decision', extensions: 0, extensionMinutes: 0 };
const firstExtension = extendFocusSession(finished, 20, 5, 31 * 60_000);
assert.equal(firstExtension.extensions, 1);
assert.equal(firstExtension.stepEndsAt, 36 * 60_000);
assert.equal(firstExtension.excludedSeconds, 60);
assert.equal(
  extendFocusSession(firstExtension, 20, 5, 31 * 60_000),
  firstExtension,
  'a duplicate click cannot consume the second extension',
);
assert.equal(extensionBudget(20, firstExtension.extensionMinutes, firstExtension.extensions), 5);
const secondExtension = extendFocusSession(firstExtension, 20, 5, 37 * 60_000);
assert.equal(secondExtension.extensions, 2, 'the second increment remains available when the first expires');
assert.equal(secondExtension.extensionMinutes, 10);
assert.equal(secondExtension.excludedSeconds, 120);
assert.equal(extendFocusSession(secondExtension, 20, 1, 43 * 60_000), secondExtension);
assert.equal(
  extendFocusSession(firstExtension, 20, 6, 37 * 60_000),
  firstExtension,
  'both extensions share the same 50 percent cap',
);
const allBudget = extendFocusSession(finished, 20, 10, 31 * 60_000);
assert.equal(extensionBudget(20, allBudget.extensionMinutes, allBudget.extensions), 0);
const rest = { ...finished, phase: 'break', startedAt: 100 * 60_000, endsAt: 140 * 60_000 };
assert.equal(
  sessionClock(rest, 100 * 60_000).remainingMs,
  40 * 60_000,
  'a break ignores the expired focus step deadline',
);
assert.equal(sessionClock(rest, 120 * 60_000).progress, 50);
assert.equal(sessionClock(rest, 141 * 60_000).remainingMs, 0);
assert.equal(sessionClock(paused, 90_000).remainingMs, 120_000);
assert.equal(sessionClock(firstExtension, 32 * 60_000).remainingMs, 4 * 60_000);
assert.equal(sessionClock(firstExtension, 32 * 60_000).totalMs, 5 * 60_000);
assert.equal(extendFocusSession(rest, 20, 5, 141 * 60_000), rest);
console.log('Duas extensões, proteção contra clique duplicado e relógios de pausa validados.');
