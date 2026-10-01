import assert from 'node:assert/strict';
import { transcribeAudio, appendTranscript, appendTaskTranscript, MAX_AUDIO_BYTES } from '../src/voiceTranscription.ts';
const originalFetch = globalThis.fetch;
try {
  let calls = 0;
  globalThis.fetch = async (url, init) => {
    calls++;
    assert.equal(url, 'https://api.groq.com/openai/v1/audio/transcriptions');
    assert.equal(init.headers.Authorization, 'Bearer test-key');
    assert.equal(init.body.get('model'), 'whisper-large-v3-turbo');
    assert.equal(init.body.get('language'), 'pt');
    assert.equal(init.body.get('file').size, 5);
    return new Response(JSON.stringify({ text: '  Estudar Linux.  ' }), { status: 200 });
  };
  const audio = new Blob(['audio'], { type: 'audio/webm' });
  await assert.rejects(transcribeAudio(audio, ''), /chave/);
  await assert.rejects(transcribeAudio(new Blob([]), 'test-key'), /conteúdo/);
  await assert.rejects(transcribeAudio(new Blob([new Uint8Array(MAX_AUDIO_BYTES + 1)]), 'test-key'), /10 MB/);
  assert.equal(calls, 0, 'Áudio inválido não deve ser enviado');
  assert.equal(await transcribeAudio(audio, 'test-key'), 'Estudar Linux.');
  assert.equal(appendTranscript('Rascunho existente ', ' outra ideia '), 'Rascunho existente\noutra ideia');
  const draft = { name: 'Estudar Linux', description: 'Praticar ls', estimate: 90, slices: ['Ler', 'Praticar'] };
  const spokenName = appendTaskTranscript(draft, 'e entender grep', 'name');
  assert.equal(spokenName.name, 'Estudar Linux e entender grep');
  assert.equal(
    appendTaskTranscript(draft, 'e\n  entender grep', 'name').name,
    'Estudar Linux e entender grep',
    'name inputs need spaces instead of line breaks',
  );
  assert.equal(spokenName.description, draft.description, 'voice in the name must not change the description');
  const spokenDescription = appendTaskTranscript(draft, 'com exemplos reais', 'description');
  assert.equal(spokenDescription.name, draft.name, 'voice in the description must not change the title');
  assert.equal(spokenDescription.description, 'Praticar ls\ncom exemplos reais');
  assert.equal(spokenDescription.estimate, draft.estimate);
  assert.deepEqual(spokenDescription.slices, draft.slices);
  assert.equal(draft.name, 'Estudar Linux', 'the existing draft must remain intact');
  globalThis.fetch = async () => new Response('{}', { status: 429 });
  await assert.rejects(transcribeAudio(audio, 'test-key'), /Cota/);
  globalThis.fetch = async () => new Response('{}', { status: 401 });
  await assert.rejects(transcribeAudio(audio, 'test-key'), /chave/);
  globalThis.fetch = async () => new Response(JSON.stringify({ text: '' }), { status: 200 });
  await assert.rejects(transcribeAudio(audio, 'test-key'), /fala/);
  globalThis.fetch = async () => new Response(JSON.stringify({ text: 42 }), { status: 200 });
  await assert.rejects(transcribeAudio(audio, 'test-key'), /fala/);
  const controller = new AbortController();
  controller.abort();
  globalThis.fetch = async (_url, init) => {
    init.signal.throwIfAborted();
  };
  await assert.rejects(transcribeAudio(audio, 'test-key', controller.signal), { name: 'AbortError' });
  console.log('Transcrição: validação, preservação de rascunho, cotas e cancelamento verificados.');
} finally {
  globalThis.fetch = originalFetch;
}
