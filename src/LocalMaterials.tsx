import { useEffect, useState } from 'react';
import VoiceRecorder from './VoiceRecorder';
import { appendTranscript } from './voiceTranscription';
import { deleteLocalFile, getLocalFile, MAX_LOCAL_FILE_BYTES, saveLocalFile, type LocalFile } from './localFiles';

function StoredFile({ file, onRemove }: { file: LocalFile; onRemove: () => void }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let active = true;
    let objectUrl = '';
    getLocalFile(file.id)
      .then(blob => {
        if (!active || !blob) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {});
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file.id]);
  const image = /^image\/(png|jpeg|gif|webp|avif)$/.test(file.type);
  return (
    <li className="local-file">
      {image && url && <img src={url} alt="" loading="lazy" />}
      {url ? (
        <a href={url} download={file.name}>
          {file.name}
        </a>
      ) : (
        <span>{file.name} · arquivo indisponível</span>
      )}
      <small>{(file.size / 1024).toFixed(0)} KB</small>
      <button type="button" onClick={onRemove} aria-label={`Remover ${file.name}`}>
        Remover
      </button>
    </li>
  );
}

export default function LocalMaterials({
  label,
  notes,
  files,
  onNotes,
  onFiles,
}: {
  label: string;
  notes: string;
  files: LocalFile[];
  onNotes: (notes: string) => void;
  onFiles: (change: (files: LocalFile[]) => LocalFile[]) => void;
}) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  async function addFiles(chosen: FileList | null) {
    if (!chosen?.length || busy) return;
    setBusy(true);
    setStatus('Guardando arquivos…');
    const added: LocalFile[] = [];
    try {
      if (files.length + chosen.length > 20) throw Error('Limite de 20 arquivos por tarefa ou etapa.');
      for (const file of Array.from(chosen)) {
        if (!file.size || file.size > MAX_LOCAL_FILE_BYTES) throw Error(`${file.name}: limite de 10 MB por arquivo.`);
        added.push(await saveLocalFile(file));
      }
      onFiles(current => [...current, ...added]);
      setStatus(`${added.length} arquivo(s) anexado(s).`);
      setError('');
    } catch (reason) {
      await Promise.all(added.map(file => deleteLocalFile(file.id)));
      setError(reason instanceof Error ? reason.message : 'Não foi possível guardar o arquivo.');
      setStatus('');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="local-materials">
      <label>
        {label} · anotações
        <textarea
          value={notes}
          maxLength={20_000}
          placeholder="O que aprendi, dúvidas e próximos passos…"
          onChange={event => onNotes(event.target.value)}
        />
      </label>
      <VoiceRecorder onText={text => onNotes(appendTranscript(notes, text).slice(0, 20_000))} />
      <label className="local-file-picker">
        Adicionar imagens ou arquivos (até 10 MB cada)
        <input
          type="file"
          multiple
          disabled={busy}
          onChange={event => {
            void addFiles(event.target.files);
            event.target.value = '';
          }}
        />
      </label>
      {status && <p role="status">{status}</p>}
      {error && (
        <p className="warning" role="alert">
          {error}
        </p>
      )}
      {!!files.length && (
        <ul className="local-file-list">
          {files.map(file => (
            <StoredFile
              key={file.id}
              file={file}
              onRemove={() => {
                void deleteLocalFile(file.id)
                  .then(() => {
                    onFiles(current => current.filter(item => item.id !== file.id));
                    setError('');
                  })
                  .catch(() => setError('Não foi possível remover o arquivo.'));
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
