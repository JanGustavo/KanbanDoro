import assert from 'node:assert/strict';
import { completedCycleCount, elapsedCredit, suggestedBreakMinutes } from '../src/cycleRules.ts';

const session = { startedAt: 0, endsAt: 90_000, creditedSeconds: 0, excludedSeconds: 0 };
assert.equal(elapsedCredit(session, 30_000), 30);
assert.equal(elapsedCredit({ ...session, creditedSeconds: 30 }, 75_000), 45, 'switching tasks credits only the new segment');
assert.equal(elapsedCredit({ ...session, creditedSeconds: 75 }, 120_000), 15, 'time beyond the cycle is not credited');
assert.equal(elapsedCredit({ ...session, creditedSeconds: 90 }, 120_000), 0, 'finishing cannot credit a segment twice');
assert.equal(completedCycleCount([{ kind: 'completed' }, { kind: 'completed', cycleId: '1' }, { kind: 'switched', cycleId: '1' }, { kind: 'cycle-completed', cycleId: '1' }]), 2);
assert.equal(suggestedBreakMinutes(4, true, { short: 5, long: 20 }), 20);
assert.equal(suggestedBreakMinutes(4, false, { short: 5, long: 20 }), 5);
console.log('Crédito de tempo por tarefa e alternância de pausas validados.');
