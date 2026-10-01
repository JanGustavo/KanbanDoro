import { useEffect, useRef, useState } from 'react';
import { getAISettings } from './aiSettings';
import { MAX_AUDIO_BYTES, MAX_RECORDING_SECONDS, transcribeAudio, type TranscriptTarget } from './voiceTranscription';

type Phase = 'idle' | 'permission' | 'recording' | 'ready' | 'sending';

export default function VoiceRecorder({
  onText,
  allowTaskFields = false,
}: {
  onText: (text: string, target: TranscriptTarget) => void;
  allowTaskFields?: boolean;
}) {
  const [target, setTarget] = useState<TranscriptTarget>('name');
  const onTextRef = useRef(onText);
  useEffect(() => {
    onTextRef.current = onText;
  }, [onText]);
  const [phase, setPhase] = useState<Phase>('idle');
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState('');
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const audio = useRef<Blob | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const request = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const release = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach(track => track.stop());
    stream.current = null;
  };
  const cancel = () => {
    generation.current++;
    request.current?.abort();
    request.current = null;
    if (recorder.current && recorder.current.state !== 'inactive') recorder.current.stop();
    recorder.current = null;
    release();
    audio.current = null;
    setPhase('idle');
    setError('');
  };
  useEffect(
    () => () => {
      generation.current++;
      request.current?.abort();
      if (recorder.current && recorder.current.state !== 'inactive') recorder.current.stop();
      release();
    },
    [],
  );

  async function start() {
    const attempt = ++generation.current;
    setError('');
    setSeconds(0);
    setPhase('permission');
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined')
        throw Error('Este navegador não permite gravar áudio aqui. Abra o quadro em uma aba da extensão.');
      const settings = await getAISettings();
      if (attempt !== generation.current) return;
      if (!settings.apiKey.trim()) throw Error('Salve sua chave da Groq em Preferências → IA para transcrever.');
      const input = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (attempt !== generation.current) {
        input.getTracks().forEach(track => track.stop());
        return;
      }
      stream.current = input;
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'].find(type =>
        MediaRecorder.isTypeSupported(type),
      );
      const recording = new MediaRecorder(input, mimeType ? { mimeType } : undefined);
      recorder.current = recording;
      const chunks: Blob[] = [];
      let size = 0;
      recording.ondataavailable = event => {
        if (attempt !== generation.current) return;
        if (event.data.size) {
          chunks.push(event.data);
          size += event.data.size;
        }
        if (size > MAX_AUDIO_BYTES && recording.state !== 'inactive') recording.stop();
      };
      recording.onerror = () => {
        if (attempt !== generation.current) return;
        cancel();
        setError('A gravação foi interrompida. Tente novamente.');
      };
      recording.onstop = () => {
        if (attempt !== generation.current) return;
        release();
        recorder.current = null;
        const blob = new Blob(chunks, { type: recording.mimeType });
        if (!blob.size || blob.size > MAX_AUDIO_BYTES) {
          audio.current = null;
          setPhase('idle');
          setError('Gravação vazia ou acima de 10 MB. Grave novamente uma fala mais curta.');
          return;
        }
        audio.current = blob;
        setPhase('ready');
      };
      recording.start(1000);
      setPhase('recording');
      const startedAt = Date.now();
      timer.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startedAt) / 1000);
        setSeconds(Math.min(elapsed, MAX_RECORDING_SECONDS));
        if (elapsed >= MAX_RECORDING_SECONDS && recording.state !== 'inactive') recording.stop();
      }, 250);
    } catch (reason) {
      if (attempt !== generation.current) return;
      release();
      setPhase('idle');
      setError(
        reason instanceof DOMException && reason.name === 'NotAllowedError'
          ? 'Permita o microfone no navegador para gravar. Nenhum áudio foi enviado.'
          : reason instanceof DOMException && reason.name === 'NotFoundError'
            ? 'Nenhum microfone foi encontrado.'
            : reason instanceof Error
              ? reason.message
              : 'Não foi possível abrir o microfone.',
      );
    }
  }

  async function send() {
    if (!audio.current) return;
    const attempt = generation.current;
    const destination = target;
    const controller = new AbortController();
    request.current = controller;
    setPhase('sending');
    setError('');
    const timeout = setTimeout(() => controller.abort(), 60000);
    try {
      const settings = await getAISettings();
      if (attempt !== generation.current) return;
      const text = await transcribeAudio(audio.current, settings.apiKey, controller.signal);
      if (attempt !== generation.current) return;
      onTextRef.current(text, destination);
      audio.current = null;
      setPhase('idle');
    } catch (reason) {
      if (attempt !== generation.current) return;
      setPhase('ready');
      setError(
        controller.signal.aborted
          ? 'A transcrição demorou demais. Você pode tentar novamente.'
          : reason instanceof TypeError
            ? 'Não foi possível acessar a Groq. Confira sua conexão.'
            : reason instanceof Error
              ? reason.message
              : 'Não foi possível transcrever.',
      );
    } finally {
      clearTimeout(timeout);
      if (request.current === controller) request.current = null;
    }
  }

  return (
    <div className="voice-recorder">
      {allowTaskFields && (
        <label className="voice-target">
          Transcrever em
          <select
            aria-label="Destino da transcrição"
            value={target}
            disabled={phase !== 'idle' && phase !== 'ready'}
            onChange={event => setTarget(event.target.value as TranscriptTarget)}
          >
            <option value="name">Nome / pedido da tarefa</option>
            <option value="description">Descrição</option>
          </select>
        </label>
      )}
      {phase === 'idle' && (
        <button
          type="button"
          className="voice-trigger"
          onClick={() => void start()}
          aria-label="Gravar fala para transcrever"
        >
          🎙 Entrada por voz
        </button>
      )}
      {phase !== 'idle' && (
        <div className="voice-panel">
          <span role="status" className={phase === 'recording' ? 'voice-recording' : ''}>
            {phase === 'permission'
              ? 'Aguardando microfone…'
              : phase === 'recording'
                ? `Gravando · ${seconds}s / ${MAX_RECORDING_SECONDS}s`
                : phase === 'sending'
                  ? 'Transcrevendo na Groq…'
                  : `Áudio pronto · ${seconds}s`}
          </span>
          {phase === 'recording' && (
            <button type="button" onClick={() => recorder.current?.stop()}>
              Parar gravação
            </button>
          )}
          {phase === 'ready' && (
            <button type="button" className="voice-transcribe" onClick={() => void send()}>
              Transcrever
            </button>
          )}
          <button type="button" onClick={cancel}>
            Cancelar
          </button>
        </div>
      )}
      <small>
        Até 2 minutos. O áudio só é enviado à Groq ao clicar em Transcrever.{' '}
        {allowTaskFields ? `O texto será acrescentado ${target === 'name' ? 'ao nome/pedido' : 'à descrição'}. ` : ''}
        Revise o texto antes de enviar à IA.
      </small>
      {error && (
        <p className="voice-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
