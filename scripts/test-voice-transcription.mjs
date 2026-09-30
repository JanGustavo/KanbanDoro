import assert from 'node:assert/strict';
import { transcribeAudio, appendTranscript, MAX_AUDIO_BYTES } from '../src/voiceTranscription.ts';
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
