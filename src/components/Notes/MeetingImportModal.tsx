import { useState, useRef, useCallback } from 'react';
import { FileText, Upload, X, ClipboardPaste } from 'lucide-react';

interface MeetingImportModalProps {
  onClose: () => void;
  onImport: (title: string, content: string) => void;
}

/** Parse a VTT or plain Zoom transcript into clean markdown text. */
function parseMeetingContent(raw: string, fileName?: string): { title: string; body: string } {
  const date = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  const title = `Meeting Notes — ${date}`;

  // VTT: strip WEBVTT header, cue IDs, timestamps, and collapse speaker lines
  if (raw.trimStart().startsWith('WEBVTT') || fileName?.endsWith('.vtt')) {
    const lines = raw.split('\n');
    const textLines: string[] = [];
    const tsRe = /^\d{2}:\d{2}[\d:.,]+ --> /;
    const cueIdRe = /^\d+\s*$/;
    let prevSpeaker = '';

    for (const line of lines) {
      const t = line.trim();
      if (!t || t === 'WEBVTT' || tsRe.test(t) || cueIdRe.test(t)) continue;
      // Speaker label: "Name: text" or "<v Name>text"
      const vTagMatch = t.match(/^<v ([^>]+)>(.*)/);
      const colonMatch = t.match(/^([^:]{1,40}):\s+(.*)/);
      if (vTagMatch) {
        const speaker = vTagMatch[1].trim();
        const text = vTagMatch[2].trim();
        if (speaker !== prevSpeaker) { textLines.push(`\n**${speaker}:** ${text}`); prevSpeaker = speaker; }
        else textLines.push(text);
      } else if (colonMatch) {
        const speaker = colonMatch[1].trim();
        const text = colonMatch[2].trim();
        if (speaker !== prevSpeaker) { textLines.push(`\n**${speaker}:** ${text}`); prevSpeaker = speaker; }
        else textLines.push(text);
      } else {
        textLines.push(t);
      }
    }
    return { title, body: textLines.join('\n').trim() };
  }

  // Plain text: keep as-is (may include Zoom chat or meeting notes)
  return { title, body: raw.trim() };
}

export function MeetingImportModal({ onClose, onImport }: MeetingImportModalProps) {
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isDesktop = typeof window !== 'undefined' && !!window.threatcaddyNotes;

  const handleFilePickDesktop = useCallback(async () => {
    if (!window.threatcaddyNotes) return;
    setError(null);
    try {
      const result = await window.threatcaddyNotes.pickFile();
      if (!result.ok || !result.content) return;
      const { title, body } = parseMeetingContent(result.content, result.name);
      onImport(title, body);
      onClose();
    } catch (err) {
      setError(String(err));
    }
  }, [onImport, onClose]);

  const handleFilePickWeb = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const raw = ev.target?.result as string;
      const { title, body } = parseMeetingContent(raw, file.name);
      onImport(title, body);
      onClose();
    };
    reader.readAsText(file);
  }, [onImport, onClose]);

  const handlePasteImport = useCallback(() => {
    if (!pasteText.trim()) { setError('Paste some text first.'); return; }
    const { title, body } = parseMeetingContent(pasteText);
    onImport(title, body);
    onClose();
  }, [pasteText, onImport, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-xl border border-border-medium bg-bg-raised shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-accent" />
            <span className="text-sm font-semibold text-text-primary">Import Meeting Notes</span>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4">
          <p className="mb-3 text-xs text-text-muted">
            Import a Zoom meeting notes file (.txt, .vtt, .md) or paste text directly. Creates a new note
            with the content formatted cleanly.
          </p>

          {/* Tab switcher */}
          <div className="mb-4 flex gap-2 border-b border-border-subtle pb-3">
            <button
              onClick={() => setPasteMode(false)}
              className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${!pasteMode ? 'bg-accent/15 text-accent' : 'text-text-muted hover:text-text-primary'}`}
            >
              <Upload size={12} className="mr-1 inline" />
              File
            </button>
            <button
              onClick={() => setPasteMode(true)}
              className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${pasteMode ? 'bg-accent/15 text-accent' : 'text-text-muted hover:text-text-primary'}`}
            >
              <ClipboardPaste size={12} className="mr-1 inline" />
              Paste
            </button>
          </div>

          {!pasteMode ? (
            <div className="flex flex-col gap-3">
              {isDesktop ? (
                <button
                  onClick={handleFilePickDesktop}
                  className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border-medium bg-bg-surface px-4 py-6 text-sm text-text-secondary transition-colors hover:border-accent/50 hover:bg-accent/5 hover:text-accent"
                >
                  <Upload size={18} />
                  Click to pick a file (.txt, .vtt, .md)
                </button>
              ) : (
                <>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border-medium bg-bg-surface px-4 py-6 text-sm text-text-secondary transition-colors hover:border-accent/50 hover:bg-accent/5 hover:text-accent"
                  >
                    <Upload size={18} />
                    Click to pick a file (.txt, .vtt, .md)
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.vtt,.md"
                    className="hidden"
                    onChange={handleFilePickWeb}
                  />
                </>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <textarea
                value={pasteText}
                onChange={(e) => { setPasteText(e.target.value); setError(null); }}
                placeholder="Paste Zoom chat, meeting notes, or VTT transcript here…"
                rows={8}
                className="w-full resize-none rounded-lg border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-accent/40 focus:outline-none"
              />
              <button
                onClick={handlePasteImport}
                disabled={!pasteText.trim()}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-40"
              >
                Import
              </button>
            </div>
          )}

          {error && (
            <p className="mt-2 text-xs text-red-400">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
