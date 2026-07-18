import { useState, useCallback, useMemo, useRef } from 'react';
import { Search, Plus, Trash2, Copy, ChevronRight, FileText, Sparkles, X, Edit2, Upload, FolderOpen } from 'lucide-react';
import { useReportTemplates } from '../../hooks/useReportTemplates';
import { useLLM } from '../../hooks/useLLM';
import { resolveAssistantLLMConfig } from '../../lib/assistant-llm-config';
import { cn } from '../../lib/utils';
import { extractDocxEvidence } from '../../lib/evidence-import';
import { buildReportContext, renderSectionTemplate, ReportEditor, ReportList, TemplatePicker, buildMarkdown } from './ReportInstanceEditor';
import type { ReportSection, ReportTemplate, Report } from '../../types';
import type { Settings } from '../../types';

interface ReportCaddyViewProps {
  folderId?: string;
  folderName?: string;
  settings?: Settings;
  reports: Report[];
  onCreateReport: (partial: Pick<Report, 'title' | 'templateId' | 'sections'> & Partial<Pick<Report, 'folderId'>>) => Promise<Report>;
  onUpdateReportSection: (id: string, sectionId: string, content: string) => void;
  onUpdateReportTitle: (id: string, title: string) => void;
  onDeleteReport: (id: string) => void;
  onShipReportToProducts: (title: string, content: string, folderId?: string) => void;
}

const EXTRACTION_SYSTEM_PROMPT = `You are a document structure analyst. The user will paste an existing report. Extract ONLY the structural skeleton: section headings, sub-headings, field labels, and any recurring outline patterns. Do NOT include any actual report content, analysis, prose, or data.

Return a JSON array of section objects (no markdown fences, just raw JSON):
[
  { "title": "Section Title", "placeholder": "What goes here (brief description)" },
  ...
]

If you see nested sections, flatten them. Aim for 4–12 sections. Output ONLY the JSON array.`;

function TemplateCard({
  template,
  onSelect,
  onClone,
  onDelete,
}: {
  template: ReportTemplate;
  onSelect: (t: ReportTemplate) => void;
  onClone?: (t: ReportTemplate) => void;
  onDelete?: (id: string) => void;
}) {
  const isUser = template.source === 'user';
  return (
    <div
      className="group relative rounded-xl border border-border-subtle bg-bg-raised transition-colors hover:border-border-medium"
    >
      <button
        type="button"
        onClick={() => onSelect(template)}
        className="w-full text-start p-4"
      >
        <div className="flex items-start gap-3">
          <span className="text-2xl leading-none shrink-0 mt-0.5">{template.icon || '📄'}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold text-text-primary truncate">{template.name}</span>
              {!isUser && (
                <span className="shrink-0 rounded-full border border-border-subtle px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-text-muted">
                  builtin
                </span>
              )}
            </div>
            {template.description && (
              <p className="mt-0.5 text-[11px] text-text-secondary line-clamp-2">{template.description}</p>
            )}
            <div className="mt-1.5 flex items-center gap-2 text-[10px] text-text-muted">
              <span>{template.sections.length} section{template.sections.length !== 1 ? 's' : ''}</span>
              <span>·</span>
              <span>{template.category}</span>
            </div>
          </div>
        </div>
      </button>

      <div className="absolute top-3 right-3 hidden group-hover:flex items-center gap-1">
        {onClone && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClone(template); }}
            title="Clone to user template"
            className="flex h-6 w-6 items-center justify-center rounded-md border border-border-subtle bg-bg-primary text-text-muted hover:text-text-primary transition-colors"
          >
            <Copy size={11} />
          </button>
        )}
        {isUser && onDelete && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(template.id); }}
            title="Delete template"
            className="flex h-6 w-6 items-center justify-center rounded-md border border-border-subtle bg-bg-primary text-text-muted hover:text-red-400 transition-colors"
          >
            <Trash2 size={11} />
          </button>
        )}
      </div>
    </div>
  );
}

function SectionEditor({
  sections,
  onChange,
}: {
  sections: ReportSection[];
  onChange: (sections: ReportSection[]) => void;
}) {
  const addSection = () => {
    const newSection: ReportSection = {
      id: `s-${Date.now()}`,
      title: '',
      order: sections.length,
      placeholder: '',
    };
    onChange([...sections, newSection]);
  };

  const updateSection = (idx: number, patch: Partial<ReportSection>) => {
    const next = sections.map((s, i) => i === idx ? { ...s, ...patch } : s);
    onChange(next);
  };

  const removeSection = (idx: number) => {
    onChange(sections.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-2">
      {sections.map((sec, idx) => (
        <div key={sec.id} className="flex items-start gap-2">
          <span className="mt-2.5 text-[10px] text-text-muted w-5 text-right shrink-0">{idx + 1}</span>
          <div className="flex-1 rounded-lg border border-border-subtle bg-bg-raised p-2 space-y-1">
            <input
              value={sec.title}
              onChange={(e) => updateSection(idx, { title: e.target.value })}
              placeholder="Section title"
              className="w-full text-xs bg-transparent outline-none text-text-primary placeholder:text-text-muted/50 font-medium"
            />
            <input
              value={sec.placeholder || ''}
              onChange={(e) => updateSection(idx, { placeholder: e.target.value })}
              placeholder="Placeholder hint (optional)"
              className="w-full text-[11px] bg-transparent outline-none text-text-secondary placeholder:text-text-muted/40"
            />
          </div>
          <button
            type="button"
            onClick={() => removeSection(idx)}
            className="mt-2 text-text-muted hover:text-red-400 transition-colors"
          >
            <X size={13} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addSection}
        className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary transition-colors mt-1"
      >
        <Plus size={12} />
        Add section
      </button>
    </div>
  );
}

export function ReportCaddyView({
  folderId,
  folderName,
  settings,
  reports,
  onCreateReport,
  onUpdateReportSection,
  onUpdateReportTitle,
  onDeleteReport,
  onShipReportToProducts,
}: ReportCaddyViewProps) {
  const { allTemplates, loading, createTemplate, updateTemplate, deleteTemplate, categories } = useReportTemplates();

  const [activeTab, setActiveTab] = useState<'templates' | 'reports'>('templates');
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const [showReportPicker, setShowReportPicker] = useState(false);
  const docxTemplateInputRef = useRef<HTMLInputElement>(null);
  const [docxImportError, setDocxImportError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newCategory, setNewCategory] = useState('Custom');
  const [newSections, setNewSections] = useState<ReportSection[]>([]);
  const [editingSections, setEditingSections] = useState(false);
  const [editingSectionsDraft, setEditingSectionsDraft] = useState<ReportSection[]>([]);

  // Example ingestion
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [importStatus, setImportStatus] = useState<'idle' | 'extracting' | 'done' | 'error'>('idle');
  const [importError, setImportError] = useState<string | null>(null);
  const [extractedSections, setExtractedSections] = useState<ReportSection[]>([]);
  const [importName, setImportName] = useState('');
  const { sendAgentRequest, streamingContent, isStreaming, abort } = useLLM();

  const filtered = useMemo(() => {
    let list = allTemplates;
    if (activeCategory) list = list.filter(t => t.category === activeCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(t => t.name.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q));
    }
    return list;
  }, [allTemplates, activeCategory, search]);

  const handleClone = useCallback(async (template: ReportTemplate) => {
    await createTemplate({
      name: `${template.name} (copy)`,
      description: template.description,
      icon: template.icon,
      category: template.category,
      sections: template.sections.map(s => ({ ...s })),
    });
  }, [createTemplate]);

  const handleCreate = useCallback(async () => {
    if (!newName.trim()) return;
    const t = await createTemplate({
      name: newName.trim(),
      description: newDescription.trim() || undefined,
      category: newCategory,
      sections: newSections,
    });
    setNewName('');
    setNewDescription('');
    setNewCategory('Custom');
    setNewSections([]);
    setShowNewForm(false);
    setSelectedTemplate(t);
  }, [newName, newDescription, newCategory, newSections, createTemplate]);

  const handleExtract = useCallback(() => {
    if (!importText.trim() || !settings) return;
    const cfg = resolveAssistantLLMConfig(settings);
    if (!cfg.apiKey && cfg.provider !== 'local') {
      setImportError('No AI provider configured. Add an API key in Settings → AI.');
      setImportStatus('error');
      return;
    }
    setImportStatus('extracting');
    setImportError(null);
    setExtractedSections([]);

    sendAgentRequest(
      {
        provider: cfg.provider,
        model: cfg.model,
        apiKey: cfg.apiKey ?? '',
        endpoint: cfg.endpoint,
        systemPrompt: EXTRACTION_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: importText.trim() }],
      },
      async () => ({ result: '', isError: false }),
      (result) => {
        if (result.error) {
          setImportError(result.error);
          setImportStatus('error');
          return;
        }
        try {
          const raw = result.content.trim().replace(/^```json\s*/i, '').replace(/```$/, '').trim();
          const parsed = JSON.parse(raw) as Array<{ title: string; placeholder?: string }>;
          const sections: ReportSection[] = parsed.map((s, i) => ({
            id: `s-${Date.now()}-${i}`,
            title: s.title,
            placeholder: s.placeholder,
            order: i,
          }));
          setExtractedSections(sections);
          setImportStatus('done');
        } catch {
          setImportError('Could not parse AI response. Try again or shorten the input.');
          setImportStatus('error');
        }
      },
    );
  }, [importText, settings, sendAgentRequest]);

  const handleSaveImported = useCallback(async () => {
    if (!importName.trim() || extractedSections.length === 0) return;
    const t = await createTemplate({
      name: importName.trim(),
      description: 'Extracted from example report',
      category: 'Custom',
      sections: extractedSections,
    });
    setShowImport(false);
    setImportText('');
    setImportName('');
    setExtractedSections([]);
    setImportStatus('idle');
    setSelectedTemplate(t);
  }, [importName, extractedSections, createTemplate]);

  const handleStartEditSections = () => {
    if (!selectedTemplate || selectedTemplate.source !== 'user') return;
    setEditingSectionsDraft([...selectedTemplate.sections]);
    setEditingSections(true);
  };

  const handleSaveSections = async () => {
    if (!selectedTemplate) return;
    await updateTemplate(selectedTemplate.id, { sections: editingSectionsDraft });
    setEditingSections(false);
    setSelectedTemplate(prev => prev ? { ...prev, sections: editingSectionsDraft } : null);
  };

  const visibleReports = useMemo(
    () => folderId ? reports.filter(r => r.folderId === folderId) : reports,
    [reports, folderId],
  );
  const activeReport = reports.find(r => r.id === activeReportId) ?? null;
  const activeReportTemplate = activeReport ? allTemplates.find(t => t.id === activeReport.templateId) ?? null : null;

  const handleSelectTemplateForNewReport = useCallback(async (template: ReportTemplate) => {
    const ctx = await buildReportContext(folderId, folderName);
    const report = await onCreateReport({
      title: folderName ? `${folderName} — ${template.name}` : template.name,
      templateId: template.id,
      sections: template.sections.map(s => ({
        sectionId: s.id,
        content: s.bodyTemplate ? renderSectionTemplate(s.bodyTemplate, ctx) : '',
      })),
      folderId,
    });
    setActiveReportId(report.id);
    setShowReportPicker(false);
  }, [folderId, folderName, onCreateReport]);

  const handleNewBlankReport = useCallback(async () => {
    const blank = allTemplates.find(t => t.id === 'rt-blank-report');
    if (!blank) return;
    await handleSelectTemplateForNewReport(blank);
  }, [allTemplates, handleSelectTemplateForNewReport]);

  const handleDeleteActiveReport = useCallback(() => {
    if (!activeReport) return;
    onDeleteReport(activeReport.id);
    setActiveReportId(null);
  }, [activeReport, onDeleteReport]);

  const handleShipActiveReport = useCallback(() => {
    if (!activeReport || !activeReportTemplate) return;
    const md = buildMarkdown(activeReport, activeReportTemplate);
    onShipReportToProducts(activeReport.title, md, activeReport.folderId ?? folderId);
  }, [activeReport, activeReportTemplate, folderId, onShipReportToProducts]);

  const handleDocxTemplateFile = useCallback(async (file: File) => {
    setDocxImportError(null);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const { text, warning } = extractDocxEvidence(bytes);
      if (!text.trim()) {
        setDocxImportError(warning || 'No readable text could be extracted from this Word document.');
        return;
      }
      setImportText(text);
      setImportName(file.name.replace(/\.docx$/i, ''));
      setImportStatus('idle');
      setExtractedSections([]);
      setShowImport(true);
      setShowNewForm(false);
    } catch (err) {
      setDocxImportError(err instanceof Error ? err.message : 'Failed to read Word document.');
    }
  }, []);

  const renderTemplatesTab = () => {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted text-sm">
        Loading templates…
      </div>
    );
  }

  // Detail view
  if (selectedTemplate) {
    const isUser = selectedTemplate.source === 'user';
    return (
      <div className="h-full flex flex-col">
        <div className="shrink-0 flex items-center gap-2 px-4 py-3 border-b border-border-subtle">
          <button
            type="button"
            onClick={() => { setSelectedTemplate(null); setEditingSections(false); }}
            className="text-xs text-text-muted hover:text-text-primary transition-colors flex items-center gap-1"
          >
            <ChevronRight size={12} className="rotate-180" />
            Templates
          </button>
          <span className="text-text-muted text-xs">/</span>
          <span className="text-xs text-text-primary font-medium">{selectedTemplate.name}</span>
          <div className="flex-1" />
          {isUser && (
            <button
              type="button"
              onClick={handleStartEditSections}
              className="flex items-center gap-1.5 rounded-lg border border-border-subtle bg-bg-primary px-2.5 py-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors"
            >
              <Edit2 size={12} />
              Edit sections
            </button>
          )}
          <button
            type="button"
            onClick={() => handleClone(selectedTemplate)}
            className="flex items-center gap-1.5 rounded-lg border border-border-subtle bg-bg-primary px-2.5 py-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors"
          >
            <Copy size={12} />
            Clone
          </button>
          {isUser && (
            <button
              type="button"
              onClick={async () => { await deleteTemplate(selectedTemplate.id); setSelectedTemplate(null); }}
              className="flex items-center gap-1.5 rounded-lg border border-border-subtle bg-bg-primary px-2.5 py-1.5 text-xs text-red-400 hover:text-red-300 transition-colors"
            >
              <Trash2 size={12} />
              Delete
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          <div className="flex items-start gap-4">
            <span className="text-4xl">{selectedTemplate.icon || '📄'}</span>
            <div>
              <h2 className="text-base font-semibold text-text-primary">{selectedTemplate.name}</h2>
              {selectedTemplate.description && (
                <p className="text-sm text-text-secondary mt-0.5">{selectedTemplate.description}</p>
              )}
              <div className="flex items-center gap-2 mt-1 text-xs text-text-muted">
                <span>{selectedTemplate.category}</span>
                <span>·</span>
                <span>{selectedTemplate.sections.length} sections</span>
                {!isUser && <span>· builtin (read-only)</span>}
              </div>
            </div>
          </div>

          {editingSections ? (
            <div className="rounded-xl border border-border-subtle bg-bg-primary/60 p-4">
              <div className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">Edit sections</div>
              <SectionEditor sections={editingSectionsDraft} onChange={setEditingSectionsDraft} />
              <div className="flex justify-end gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setEditingSections(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-text-secondary border border-border-subtle hover:bg-bg-hover transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveSections}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-accent text-white hover:bg-accent/90 transition-colors"
                >
                  Save sections
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-border-subtle bg-bg-primary/60 p-4">
              <div className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">Sections</div>
              {selectedTemplate.sections.length === 0 ? (
                <p className="text-xs text-text-muted">No sections defined.</p>
              ) : (
                <ol className="space-y-2">
                  {selectedTemplate.sections
                    .slice()
                    .sort((a, b) => a.order - b.order)
                    .map((sec, i) => (
                      <li key={sec.id} className="flex items-start gap-2.5">
                        <span className="text-[10px] text-text-muted mt-1 w-4 text-right shrink-0">{i + 1}</span>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-text-primary">{sec.title}</div>
                          {sec.placeholder && (
                            <div className="text-[11px] text-text-muted mt-0.5">{sec.placeholder}</div>
                          )}
                        </div>
                      </li>
                    ))}
                </ol>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="shrink-0 px-4 pt-4 pb-3 border-b border-border-subtle space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-base font-semibold text-text-primary">Report Templates</h1>
            <p className="text-xs text-text-secondary mt-0.5">
              Manage report templates for your investigations. Builtins are read-only; clone to customize.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <input
              ref={docxTemplateInputRef}
              type="file"
              accept=".docx"
              className="hidden"
              onChange={(e) => { const file = e.target.files?.[0]; if (file) void handleDocxTemplateFile(file); e.target.value = ''; }}
            />
            <button
              type="button"
              onClick={() => docxTemplateInputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-lg border border-border-subtle bg-bg-primary px-2.5 py-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors"
              title="Upload a Word (.docx) document and extract its structure as a template"
            >
              <Upload size={12} />
              Upload Word template
            </button>
            <button
              type="button"
              onClick={() => { setShowImport(v => !v); setShowNewForm(false); }}
              className={cn(
                'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors',
                showImport
                  ? 'border-purple/30 bg-purple/10 text-text-primary'
                  : 'border-border-subtle bg-bg-primary text-text-secondary hover:text-text-primary',
              )}
            >
              <Sparkles size={12} />
              Import from example
            </button>
            <button
              type="button"
              onClick={() => { setShowNewForm(v => !v); setShowImport(false); }}
              className={cn(
                'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors',
                showNewForm
                  ? 'border-accent/30 bg-accent/10 text-text-primary'
                  : 'border-border-subtle bg-bg-primary text-text-secondary hover:text-text-primary',
              )}
            >
              <Plus size={12} />
              New template
            </button>
          </div>
        </div>

        {docxImportError && (
          <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            <span>{docxImportError}</span>
            <button type="button" onClick={() => setDocxImportError(null)} className="ms-auto text-red-300 hover:text-red-200"><X size={12} /></button>
          </div>
        )}

        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates…"
            className="w-full rounded-lg border border-border-subtle bg-bg-deep/60 pl-7 pr-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-purple/40"
          />
        </div>

        {/* Category chips */}
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setActiveCategory(null)}
            className={cn(
              'rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors',
              activeCategory === null
                ? 'border-purple/30 bg-purple/10 text-text-primary'
                : 'border-border-subtle text-text-muted hover:text-text-primary',
            )}
          >
            All ({allTemplates.length})
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
              className={cn(
                'rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors',
                activeCategory === cat
                  ? 'border-purple/30 bg-purple/10 text-text-primary'
                  : 'border-border-subtle text-text-muted hover:text-text-primary',
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Import panel */}
      {showImport && (
        <div className="shrink-0 border-b border-border-subtle bg-bg-deep/40 px-4 py-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-purple" />
              <span className="text-xs font-semibold text-text-primary">Import structure from example report</span>
            </div>
            <button type="button" onClick={() => { setShowImport(false); setImportStatus('idle'); setExtractedSections([]); }} className="text-text-muted hover:text-text-primary"><X size={14} /></button>
          </div>
          <p className="text-[11px] text-text-secondary">
            Paste an existing report below. CaddyAI will extract only the structural skeleton — section headings and field labels. No content or vendor data is retained.
          </p>
          {importStatus !== 'done' && (
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="Paste report text here…"
              rows={6}
              className="w-full rounded-lg border border-border-subtle bg-bg-raised px-3 py-2 text-xs text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:border-purple/40"
            />
          )}
          {importStatus === 'extracting' && (
            <div className="text-xs text-text-muted italic animate-pulse">
              {streamingContent ? streamingContent.slice(0, 120) + '…' : 'Extracting structure…'}
            </div>
          )}
          {importStatus === 'error' && importError && (
            <p className="text-xs text-red-400">{importError}</p>
          )}
          {importStatus === 'done' && extractedSections.length > 0 && (
            <div className="space-y-2">
              <div className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide">
                Extracted {extractedSections.length} sections
              </div>
              <SectionEditor sections={extractedSections} onChange={setExtractedSections} />
              <input
                value={importName}
                onChange={(e) => setImportName(e.target.value)}
                placeholder="Template name…"
                className="w-full rounded-lg border border-border-subtle bg-bg-raised px-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-purple/40"
              />
            </div>
          )}
          <div className="flex justify-end gap-2">
            {importStatus === 'extracting' && (
              <button type="button" onClick={abort} className="text-xs text-text-muted hover:text-text-primary">Stop</button>
            )}
            {importStatus === 'done' ? (
              <button
                type="button"
                onClick={handleSaveImported}
                disabled={!importName.trim() || extractedSections.length === 0}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-accent text-white hover:bg-accent/90 transition-colors disabled:opacity-50"
              >
                Save template
              </button>
            ) : (
              <button
                type="button"
                onClick={handleExtract}
                disabled={!importText.trim() || isStreaming}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-purple/80 text-white hover:bg-purple transition-colors disabled:opacity-50"
              >
                <Sparkles size={11} />
                Extract structure
              </button>
            )}
          </div>
        </div>
      )}

      {/* New template form */}
      {showNewForm && (
        <div className="shrink-0 border-b border-border-subtle bg-bg-deep/40 px-4 py-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-primary">New template</span>
            <button type="button" onClick={() => setShowNewForm(false)} className="text-text-muted hover:text-text-primary"><X size={14} /></button>
          </div>
          <div className="flex gap-2">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Template name…"
              className="flex-1 rounded-lg border border-border-subtle bg-bg-raised px-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-purple/40"
            />
            <input
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="Category"
              className="w-32 rounded-lg border border-border-subtle bg-bg-raised px-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-purple/40"
            />
          </div>
          <input
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="Description (optional)"
            className="w-full rounded-lg border border-border-subtle bg-bg-raised px-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-purple/40"
          />
          <div className="rounded-lg border border-border-subtle bg-bg-raised p-3">
            <div className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide mb-2">Sections</div>
            <SectionEditor sections={newSections} onChange={setNewSections} />
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleCreate}
              disabled={!newName.trim()}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-accent text-white hover:bg-accent/90 transition-colors disabled:opacity-50"
            >
              Create template
            </button>
          </div>
        </div>
      )}

      {/* Template grid */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-text-muted">
            <FileText size={32} strokeWidth={1.5} />
            <p className="text-sm">{search ? `No templates matching "${search}"` : 'No templates yet'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map(t => (
              <TemplateCard
                key={t.id}
                template={t}
                onSelect={setSelectedTemplate}
                onClone={handleClone}
                onDelete={deleteTemplate}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
  };

  const renderReportsTab = () => {
    if (activeReport && activeReportTemplate) {
      return (
        <ReportEditor
          report={activeReport}
          template={activeReportTemplate}
          onUpdateSection={(sid, val) => onUpdateReportSection(activeReport.id, sid, val)}
          onUpdateTitle={(title) => onUpdateReportTitle(activeReport.id, title)}
          onBack={() => setActiveReportId(null)}
          onDelete={handleDeleteActiveReport}
          onShipToProducts={handleShipActiveReport}
        />
      );
    }

    if (showReportPicker) {
      return (
        <div className="flex flex-col h-full overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 shrink-0 border-b border-border-subtle">
            <button type="button" onClick={() => setShowReportPicker(false)} className="p-1 rounded text-text-muted hover:text-text-primary">
              <X size={14} />
            </button>
            <span className="text-xs font-semibold text-text-primary">New Report</span>
          </div>
          <div className="flex-1 overflow-hidden">
            <TemplatePicker onSelect={handleSelectTemplateForNewReport} onNewBlank={handleNewBlankReport} />
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 shrink-0 border-b border-border-subtle">
          <FolderOpen size={14} className="text-accent" />
          <span className="text-xs font-semibold flex-1 text-text-primary">My Reports</span>
          {folderName && (
            <span className="text-[11px] text-text-muted truncate max-w-[140px]">{folderName}</span>
          )}
          <button
            type="button"
            onClick={() => setShowReportPicker(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-accent text-white hover:bg-accent/90 transition-colors"
          >
            <Plus size={11} />
            New
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <ReportList reports={visibleReports} allTemplates={allTemplates} onOpen={setActiveReportId} onNew={() => setShowReportPicker(true)} />
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0 flex items-center gap-1 border-b border-border-subtle px-4 pt-2">
        <button
          type="button"
          onClick={() => setActiveTab('templates')}
          className={cn(
            'px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors',
            activeTab === 'templates'
              ? 'border-accent text-text-primary'
              : 'border-transparent text-text-muted hover:text-text-primary',
          )}
        >
          Templates
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab('reports'); setSelectedTemplate(null); }}
          className={cn(
            'px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors',
            activeTab === 'reports'
              ? 'border-accent text-text-primary'
              : 'border-transparent text-text-muted hover:text-text-primary',
          )}
        >
          My Reports
        </button>
      </div>
      <div className="flex-1 overflow-hidden flex flex-col">
        {activeTab === 'templates' ? renderTemplatesTab() : renderReportsTab()}
      </div>
    </div>
  );
}
