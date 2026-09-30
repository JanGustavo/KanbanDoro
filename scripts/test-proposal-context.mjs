import assert from 'node:assert/strict';
import { proposalContext } from '../src/proposalContext.ts';

const draft = {
  name: 'Estudar elicitação de requisitos, arquitetura e engenharia',
  description: 'Praticar com um estudo de caso',
  estimate: 25,
  difficulty: 1,
  slices: ['Ler', 'Praticar'],
};
const untouched = { estimate: false, difficulty: false };
const initial = proposalContext(draft, 'manual', untouched);
assert(!('estimate' in initial), 'manual default 25 must not constrain AI estimation');
assert(!('difficulty' in initial), 'manual default easy must not constrain AI classification');
assert.equal(initial.description, draft.description);
assert.deepEqual(initial.slices, draft.slices);
assert.equal(draft.estimate, 25, 'building context must not change the editable draft');
const explicit = proposalContext(draft, 'manual', { estimate: true, difficulty: true });
assert.equal(explicit.estimate, 25, 'an intentional 25 minutes must be respected, even at the default value');
assert.equal(explicit.difficulty, 1);
const timeOnly = proposalContext({ ...draft, estimate: 90 }, 'manual', { estimate: true, difficulty: false });
assert.equal(timeOnly.estimate, 90);
assert(!('difficulty' in timeOnly), 'each field has independent user intent');
const difficultyOnly = proposalContext(draft, 'manual', { estimate: false, difficulty: true });
assert(!('estimate' in difficultyOnly));
assert.equal(difficultyOnly.difficulty, 1);
const rewrite = proposalContext({ ...draft, estimate: 135, difficulty: 3 }, 'ai', untouched);
assert.equal(rewrite.estimate, 135, 'rewriting an AI proposal preserves its actual estimates');
assert.equal(rewrite.difficulty, 3);
console.log('Propostas: padrões manuais ignorados pela IA; escolhas explícitas e revisões preservadas.');
