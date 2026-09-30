export const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
export const MAX_RECORDING_SECONDS = 120;

export function appendTranscript(current: string, text: string): string {
  return [current.trimEnd(), text.trim()].filter(Boolean).join('\n');
}

export async function transcribeAudio(audio: Blob, apiKey: string, signal?: AbortSignal): Promise<string> {
  if (!apiKey.trim()) throw Error('Salve sua chave da Groq em Preferências → IA para transcrever.');
  if (!audio.size || audio.size > MAX_AUDIO_BYTES) throw Error('O áudio deve ter conteúdo e no máximo 10 MB.');
  const data = new FormData();
  data.append('file', audio, audio.type.includes('ogg') ? 'gravacao.ogg' : 'gravacao.webm');
  data.append('model', 'whisper-large-v3-turbo');
  data.append('language', 'pt');
  data.append('response_format', 'json');
  const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey.trim()}` },
    body: data,
    signal,
  });
  if (!response.ok) {
    if (response.status === 401 || response.status === 403)
      throw Error('A Groq recusou a chave. Confira-a em Preferências → IA.');
    if (response.status === 429) throw Error('Cota da Groq atingida. Aguarde antes de tentar novamente.');
    if (response.status === 413) throw Error('Áudio muito grande para a Groq. Grave uma fala mais curta.');
    throw Error(`Não foi possível transcrever na Groq (${response.status}). Tente novamente.`);
  }
  const result: unknown = await response.json();
  if (
    !result ||
    typeof result !== 'object' ||
    !('text' in result) ||
    typeof result.text !== 'string' ||
    !result.text.trim()
  ) {
    throw Error('Não foi reconhecida uma fala. Tente gravar novamente mais perto do microfone.');
  }
  return result.text.trim();
}
