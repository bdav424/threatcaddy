import { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, MicOff, Square, Loader2 } from 'lucide-react';

interface WhisperRecorderProps {
  /** Called with the transcribed text when transcription completes. */
  onTranscript: (text: string) => void;
  /** Whisper endpoint base URL, e.g. http://localhost:9000 */
  endpoint: string;
}

type RecordState = 'idle' | 'recording' | 'transcribing' | 'error';

export function WhisperRecorder({ onTranscript, endpoint }: WhisperRecorderProps) {
  const [state, setState] = useState<RecordState>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => () => {
    mediaRecorderRef.current?.stop();
  }, []);

  const startRecording = useCallback(async () => {
    setErrorMsg(null);
    setState('recording');
    chunksRef.current = [];
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      setState('error');
      setErrorMsg('Microphone access denied. Allow mic in browser settings.');
      return;
    }
    const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
    mediaRecorderRef.current = mr;
    mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    mr.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      setState('transcribing');
      try {
        const form = new FormData();
        form.append('audio_file', blob, 'recording.webm');
        // whisper.cpp server API: POST /inference
        const resp = await fetch(`${endpoint}/inference`, { method: 'POST', body: form });
        if (!resp.ok) throw new Error(`Whisper server returned ${resp.status}`);
        const json = await resp.json();
        const text: string = json.text ?? json.transcript ?? json.result ?? '';
        if (!text.trim()) throw new Error('Empty transcription result from Whisper.');
        onTranscript(text.trim());
        setState('idle');
      } catch (err) {
        setState('error');
        setErrorMsg(err instanceof Error ? err.message : 'Transcription failed.');
      }
    };
    mr.start();
  }, [endpoint, onTranscript]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setState('transcribing');
  }, []);

  return (
    <div className="flex items-center gap-1.5">
      {state === 'idle' && (
        <button
          type="button"
          onClick={startRecording}
          className="flex h-6 w-6 items-center justify-center rounded text-text-muted transition-colors hover:bg-bg-hover hover:text-red-400"
          title="Start Whisper transcription"
          aria-label="Start recording"
        >
          <Mic size={14} />
        </button>
      )}
      {state === 'recording' && (
        <button
          type="button"
          onClick={stopRecording}
          className="flex h-6 items-center gap-1 rounded bg-red-500/15 px-1.5 text-red-400 transition-colors hover:bg-red-500/25 animate-pulse"
          title="Stop recording and transcribe"
          aria-label="Stop recording"
        >
          <Square size={11} />
          <span className="text-[10px] font-medium">Stop</span>
        </button>
      )}
      {state === 'transcribing' && (
        <span className="flex items-center gap-1 text-[10px] text-text-muted">
          <Loader2 size={11} className="animate-spin" />
          Transcribing…
        </span>
      )}
      {state === 'error' && (
        <div className="flex items-center gap-1">
          <MicOff size={13} className="text-red-400" />
          <span className="max-w-[140px] truncate text-[10px] text-red-400" title={errorMsg ?? ''}>
            {errorMsg ?? 'Error'}
          </span>
          <button
            type="button"
            onClick={() => setState('idle')}
            className="text-[10px] text-text-muted underline hover:text-text-primary"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
