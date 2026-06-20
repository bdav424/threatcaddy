import { useState, useCallback, useRef, useLayoutEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Plus, Trash2, Download, Copy, ChevronRight, ArrowLeft, LayoutTemplate, X, Camera } from 'lucide-react';
import { useReportTemplates } from '../../hooks/useReportTemplates';
import { useInvestigation } from '../../contexts/InvestigationContext';
import { useToast } from '../../contexts/ToastContext';
import { useWorkspacePanelChromeState } from '../WorkspacePanels/WorkspacePanel';
import { buildReportContext, renderSectionTemplate } from '../../lib/report-template-renderer';
import { useGraphSnapshots } from '../../hooks/useGraphSnapshots';
import { nanoid } from 'nanoid';
import type { ReportTemplate, ReportSection } from '../../types';

interface ActiveReport {
  id: string;
  title: string;
  templateId: string;
  sections: Array<{ sectionId: string; content: string }>;
  createdAt: number;
}

function buildMarkdown(report: ActiveReport, template: ReportTemplate): string {
  const lines: string[] = [`# ${report.title}`, ''];
  const ordered = [...template.sections].sort((a, b) => a.order - b.order);
  for (const sec of ordered) {
    const entry = report.sections.find(s => s.sectionId === sec.id);
    lines.push(`## ${sec.title}`, '');
    lines.push(entry?.content.trim() || `*${sec.placeholder ?? 'No content added.'}*`);
    lines.push('');
  }
  return lines.join('\n');
}

function downloadMarkdown(report: ActiveReport, template: ReportTemplate) {
  const md = buildMarkdown(report, template);
  const blob = new Blob([md], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${report.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Template picker ──────────────────────────────────────────────────────────

function TemplatePicker({
  onSelect,
  onNewBlank,
}: {
  onSelect: (template: ReportTemplate) => void;
  onNewBlank: () => void;
}) {
  const { t } = useTranslation();
  const { allTemplates, categories, loading } = useReportTemplates();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const visible = selectedCategory
    ? allTemplates.filter(t => t.category === selectedCategory)
    : allTemplates;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40 text-sm" style={{ color: 'var(--color-text-muted)' }}>
        {t('common.loading', { defaultValue: 'Loading…' })}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-3 shrink-0">
        <LayoutTemplate size={15} style={{ color: 'var(--color-accent)' }} />
        <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          {t('reports.pickTemplate', { defaultValue: 'Choose a report template' })}
        </span>
      </div>

      {/* Category filter */}
      <div className="flex gap-1.5 px-4 pb-3 shrink-0 flex-wrap">
        <button
          className="px-2.5 py-1 rounded-full text-xs font-medium transition-colors"
          style={
            !selectedCategory
              ? { background: 'var(--color-accent)', color: '#fff' }
              : { background: 'var(--color-bg-raised)', color: 'var(--color-text-secondary)' }
          }
          onClick={() => setSelectedCategory(null)}
        >
          {t('common.all', { defaultValue: 'All' })}
        </button>
        {categories.map(cat => (
          <button
            key={cat}
            className="px-2.5 py-1 rounded-full text-xs font-medium transition-colors"
            style={
              selectedCategory === cat
                ? { background: 'var(--color-accent)', color: '#fff' }
                : { background: 'var(--color-bg-raised)', color: 'var(--color-text-secondary)' }
            }
            onClick={() => setSelectedCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Template grid */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
          {/* Blank report card */}
          <button
            className="flex flex-col gap-2 p-3.5 rounded-lg border text-left transition-colors hover:border-[color:var(--color-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)]"
            style={{ background: 'var(--color-bg-raised)', borderColor: 'var(--color-border-medium)' }}
            onClick={onNewBlank}
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--color-bg-hover)' }}>
              <Plus size={16} style={{ color: 'var(--color-text-secondary)' }} />
            </div>
            <div>
              <p className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                {t('reports.blankReport', { defaultValue: 'Blank Report' })}
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                {t('reports.blankReportDesc', { defaultValue: 'Start from scratch' })}
              </p>
            </div>
          </button>

          {visible.map(tmpl => (
            <button
              key={tmpl.id}
              className="flex flex-col gap-2 p-3.5 rounded-lg border text-left transition-colors hover:border-[color:var(--color-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)]"
              style={{ background: 'var(--color-bg-raised)', borderColor: 'var(--color-border-medium)' }}
              onClick={() => onSelect(tmpl)}
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm" style={{ background: 'var(--color-bg-hover)' }}>
                {tmpl.icon ?? <FileText size={14} style={{ color: 'var(--color-accent)' }} />}
              </div>
              <div>
                <p className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>{tmpl.name}</p>
                {tmpl.description && (
                  <p className="text-[11px] mt-0.5 line-clamp-2" style={{ color: 'var(--color-text-muted)' }}>{tmpl.description}</p>
                )}
                <p className="text-[10px] mt-1.5 font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                  {tmpl.sections.length} {tmpl.sections.length === 1 ? 'section' : 'sections'} · {tmpl.category}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Section editor ───────────────────────────────────────────────────────────

function SectionEditor({
  section,
  content,
  onChange,
  folderId,
}: {
  section: ReportSection;
  content: string;
  onChange: (value: string) => void;
  folderId: string | null;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showSnapPicker, setShowSnapPicker] = useState(false);
  const { snapshots, updateCaption } = useGraphSnapshots(folderId);
  const [editingCaptionId, setEditingCaptionId] = useState<string | null>(null);
  const [draftCaption, setDraftCaption] = useState('');

  const autoResize = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${ta.scrollHeight}px`;
  }, []);

  // Resize on mount so pre-filled bodyTemplate content isn't clipped
  useLayoutEffect(() => { autoResize(); }, [autoResize]);

  const insertSnapshot = useCallback((snap: { dataUrl: string; caption: string; nodeCount: number; edgeCount: number }) => {
    const label = snap.caption || `Investigation graph — ${snap.nodeCount} nodes, ${snap.edgeCount} edges`;
    const mdImage = `\n![${label}](${snap.dataUrl})\n*${label}*\n`;
    onChange(content + mdImage);
    setShowSnapPicker(false);
    setTimeout(autoResize, 0);
  }, [content, onChange, autoResize]);

  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-1.5">
        <label className="block text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
          {section.title}
        </label>
        {snapshots.length > 0 && (
          <button
            type="button"
            onClick={() => setShowSnapPicker(v => !v)}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] transition-colors"
            style={showSnapPicker
              ? { background: 'var(--color-accent)', color: '#fff' }
              : { background: 'var(--color-bg-hover)', color: 'var(--color-text-secondary)' }}
            title="Insert a saved graph snapshot"
          >
            <Camera size={10} />
            Insert snapshot ({snapshots.length})
          </button>
        )}
      </div>

      {showSnapPicker && snapshots.length > 0 && (
        <div
          className="mb-2 rounded-lg border p-2"
          style={{ background: 'var(--color-bg-deep)', borderColor: 'var(--color-border-subtle)' }}
        >
          <div className="flex flex-wrap gap-2">
            {snapshots.map(snap => (
              <div
                key={snap.id}
                className="flex flex-col items-start gap-1 p-1.5 rounded-md border"
                style={{ background: 'var(--color-bg-raised)', borderColor: 'var(--color-border-medium)', maxWidth: 130 }}
              >
                <button
                  type="button"
                  onClick={() => insertSnapshot(snap)}
                  className="w-full rounded overflow-hidden hover:opacity-80 transition-opacity"
                  title="Click to insert this snapshot"
                >
                  <img
                    src={snap.dataUrl}
                    alt="Graph snapshot"
                    className="w-full rounded"
                    style={{ height: 60, objectFit: 'cover' }}
                  />
                </button>
                {editingCaptionId === snap.id ? (
                  <input
                    autoFocus
                    value={draftCaption}
                    onChange={(e) => setDraftCaption(e.target.value)}
                    onBlur={async () => {
                      await updateCaption(snap.id, draftCaption);
                      setEditingCaptionId(null);
                    }}
                    onKeyDown={async (e) => {
                      if (e.key === 'Enter') { await updateCaption(snap.id, draftCaption); setEditingCaptionId(null); }
                      if (e.key === 'Escape') setEditingCaptionId(null);
                    }}
                    className="w-full text-[10px] bg-transparent border-b border-dashed outline-none"
                    style={{ borderColor: 'var(--color-accent)', color: 'var(--color-text-primary)' }}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => { setEditingCaptionId(snap.id); setDraftCaption(snap.caption || ''); }}
                    className="text-[10px] truncate w-full text-start hover:underline"
                    style={{ color: 'var(--color-text-muted)' }}
                    title="Click to edit caption"
                  >
                    {snap.caption || `${snap.nodeCount}n · ${snap.edgeCount}e`}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <textarea
        ref={textareaRef}
        value={content}
        placeholder={section.placeholder}
        rows={4}
        className="w-full rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 transition-colors"
        style={{
          background: 'var(--color-bg-raised)',
          border: '1px solid var(--color-border-medium)',
          color: 'var(--color-text-primary)',
          minHeight: '88px',
        }}
        onFocus={e => (e.currentTarget.style.borderColor = 'var(--color-accent)')}
        onBlur={e => (e.currentTarget.style.borderColor = 'var(--color-border-medium)')}
        onChange={e => {
          onChange(e.target.value);
          autoResize();
        }}
        onInput={autoResize}
      />
    </div>
  );
}

// ─── Report editor ────────────────────────────────────────────────────────────

function ReportEditor({
  report,
  template,
  onUpdateSection,
  onUpdateTitle,
  onBack,
  onDelete,
}: {
  report: ActiveReport;
  template: ReportTemplate;
  onUpdateSection: (sectionId: string, content: string) => void;
  onUpdateTitle: (title: string) => void;
  onBack: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const { selectedFolderId } = useInvestigation();
  const [activeSectionIdx, setActiveSectionIdx] = useState<number | null>(null);
  const compact = Boolean(useWorkspacePanelChromeState()?.compact);

  const ordered = [...template.sections].sort((a, b) => a.order - b.order);

  const handleExportMd = useCallback(() => {
    downloadMarkdown(report, template);
  }, [report, template]);

  const handleCopyMd = useCallback(async () => {
    const md = buildMarkdown(report, template);
    await navigator.clipboard.writeText(md);
    addToast('success', 'Copied to clipboard');
  }, [report, template, addToast]);

  const getSectionContent = (sectionId: string) =>
    report.sections.find(s => s.sectionId === sectionId)?.content ?? '';

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div
        className="flex items-center gap-2 px-3 py-2 shrink-0 border-b"
        style={{ borderColor: 'var(--color-border-subtle)' }}
      >
        <button
          className="p-1 rounded transition-colors"
          style={{ color: 'var(--color-text-muted)' }}
          title={t('common.back', { defaultValue: 'Back' })}
          onClick={onBack}
        >
          <ArrowLeft size={14} />
        </button>

        <input
          className="flex-1 min-w-0 bg-transparent text-sm font-semibold focus:outline-none"
          style={{ color: 'var(--color-text-primary)' }}
          value={report.title}
          onChange={e => onUpdateTitle(e.target.value)}
          placeholder={t('reports.reportTitle', { defaultValue: 'Report title…' })}
        />

        <span className="text-[11px] shrink-0" style={{ color: 'var(--color-text-muted)' }}>
          {template.name}
        </span>

        <button
          className="p-1.5 rounded transition-colors hover:bg-[color:var(--color-bg-raised)]"
          style={{ color: 'var(--color-text-secondary)' }}
          title={t('reports.copyMarkdown', { defaultValue: 'Copy Markdown' })}
          onClick={handleCopyMd}
        >
          <Copy size={13} />
        </button>

        <button
          className="p-1.5 rounded transition-colors hover:bg-[color:var(--color-bg-raised)]"
          style={{ color: 'var(--color-text-secondary)' }}
          title={t('reports.exportMarkdown', { defaultValue: 'Export Markdown' })}
          onClick={handleExportMd}
        >
          <Download size={13} />
        </button>

        <button
          className="p-1.5 rounded transition-colors hover:bg-[color:var(--color-bg-raised)]"
          style={{ color: 'var(--color-accent-pink, #f472b6)' }}
          title={t('common.delete', { defaultValue: 'Delete report' })}
          onClick={onDelete}
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* Body: section nav + editor */}
      <div className="flex flex-1 overflow-hidden">
        {/* Section nav — hidden in very compact mode (< 640px handled by CSS) */}
        {!compact && (
          <div
            className="hidden sm:flex flex-col w-40 shrink-0 border-r overflow-y-auto py-2"
            style={{ borderColor: 'var(--color-border-subtle)', background: 'var(--color-bg-deep)' }}
          >
            {ordered.map((sec, idx) => (
              <button
                key={sec.id}
                className="flex items-center gap-1.5 px-3 py-2 text-left text-[11px] transition-colors"
                style={
                  activeSectionIdx === idx
                    ? { color: 'var(--color-text-primary)', background: 'var(--color-bg-raised)' }
                    : { color: 'var(--color-text-muted)' }
                }
                onClick={() => {
                  setActiveSectionIdx(idx);
                  document.getElementById(`report-section-${sec.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
              >
                <ChevronRight size={10} style={{ opacity: activeSectionIdx === idx ? 1 : 0.4 }} />
                <span className="truncate">{sec.title}</span>
              </button>
            ))}
          </div>
        )}

        {/* Main editor area */}
        <div className="flex-1 overflow-y-auto px-4 pt-4 pb-8">
          {ordered.map((sec, idx) => (
            <div
              key={sec.id}
              id={`report-section-${sec.id}`}
              onFocus={() => setActiveSectionIdx(idx)}
            >
              <SectionEditor
                section={sec}
                content={getSectionContent(sec.id)}
                onChange={val => onUpdateSection(sec.id, val)}
                folderId={selectedFolderId ?? null}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function ReportsPanel() {
  const { t } = useTranslation();
  const { selectedFolder } = useInvestigation();
  const { allTemplates } = useReportTemplates();

  const [reports, setReports] = useState<ActiveReport[]>([]);
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  const activeReport = reports.find(r => r.id === activeReportId) ?? null;
  const activeTemplate = activeReport
    ? (allTemplates.find(t => t.id === activeReport.templateId) ?? null)
    : null;

  const createReport = useCallback(async (template: ReportTemplate) => {
    const now = Date.now();
    const ctx = await buildReportContext(selectedFolder?.id, selectedFolder?.name);
    const report: ActiveReport = {
      id: nanoid(),
      title: selectedFolder
        ? `${selectedFolder.name} — ${template.name}`
        : template.name,
      templateId: template.id,
      sections: template.sections.map(s => ({
        sectionId: s.id,
        content: s.bodyTemplate ? renderSectionTemplate(s.bodyTemplate, ctx) : '',
      })),
      createdAt: now,
    };
    setReports(prev => [report, ...prev]);
    setActiveReportId(report.id);
    setShowPicker(false);
  }, [selectedFolder]);

  const createBlankReport = useCallback(() => {
    const blankTemplate: ReportTemplate = {
      id: `blank-${nanoid()}`,
      name: t('reports.blankReport', { defaultValue: 'Blank Report' }),
      category: 'Custom',
      sections: [
        { id: 's1', title: 'Summary', order: 0, placeholder: 'Write your summary here.' },
        { id: 's2', title: 'Findings', order: 1, placeholder: 'Describe your findings.' },
        { id: 's3', title: 'Recommendations', order: 2, placeholder: 'List your recommendations.' },
      ],
      source: 'user',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    void createReport(blankTemplate);
  }, [t, createReport]);

  const updateSection = useCallback((reportId: string, sectionId: string, content: string) => {
    setReports(prev =>
      prev.map(r =>
        r.id !== reportId
          ? r
          : {
              ...r,
              sections: r.sections.map(s =>
                s.sectionId === sectionId ? { ...s, content } : s,
              ),
            },
      ),
    );
  }, []);

  const updateTitle = useCallback((reportId: string, title: string) => {
    setReports(prev => prev.map(r => (r.id !== reportId ? r : { ...r, title })));
  }, []);

  const deleteReport = useCallback((reportId: string) => {
    setReports(prev => prev.filter(r => r.id !== reportId));
    setActiveReportId(null);
  }, []);

  // ── Active report view ──
  if (activeReport && activeTemplate) {
    return (
      <ReportEditor
        report={activeReport}
        template={activeTemplate}
        onUpdateSection={(sid, val) => updateSection(activeReport.id, sid, val)}
        onUpdateTitle={title => updateTitle(activeReport.id, title)}
        onBack={() => setActiveReportId(null)}
        onDelete={() => deleteReport(activeReport.id)}
      />
    );
  }

  // ── Template picker overlay ──
  if (showPicker) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 shrink-0 border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
          <button className="p-1 rounded" onClick={() => setShowPicker(false)} style={{ color: 'var(--color-text-muted)' }}>
            <X size={14} />
          </button>
          <span className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            {t('reports.newReport', { defaultValue: 'New Report' })}
          </span>
        </div>
        <div className="flex-1 overflow-hidden">
          <TemplatePicker onSelect={createReport} onNewBlank={createBlankReport} />
        </div>
      </div>
    );
  }

  // ── Report list ──
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2.5 shrink-0 border-b"
        style={{ borderColor: 'var(--color-border-subtle)' }}
      >
        <FileText size={14} style={{ color: 'var(--color-accent)' }} />
        <span className="text-xs font-semibold flex-1" style={{ color: 'var(--color-text-primary)' }}>
          {t('reports.panelTitle', { defaultValue: 'Reports' })}
        </span>
        {selectedFolder && (
          <span className="text-[11px] truncate max-w-[120px]" style={{ color: 'var(--color-text-muted)' }}>
            {selectedFolder.name}
          </span>
        )}
        <button
          className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors"
          style={{ background: 'var(--color-accent)', color: '#fff' }}
          onClick={() => setShowPicker(true)}
        >
          <Plus size={11} />
          {t('reports.new', { defaultValue: 'New' })}
        </button>
      </div>

      {/* Report list or empty state */}
      <div className="flex-1 overflow-y-auto">
        {reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 h-full px-6 text-center">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--color-bg-raised)' }}
            >
              <FileText size={22} style={{ color: 'var(--color-accent)' }} />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                {t('reports.emptyTitle', { defaultValue: 'No reports yet' })}
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                {t('reports.emptyDesc', { defaultValue: 'Create a report from a template to get started.' })}
              </p>
            </div>
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium"
              style={{ background: 'var(--color-accent)', color: '#fff' }}
              onClick={() => setShowPicker(true)}
            >
              <Plus size={12} />
              {t('reports.createReport', { defaultValue: 'Create Report' })}
            </button>
          </div>
        ) : (
          <div className="py-2">
            {reports.map(report => {
              const tmpl = allTemplates.find(t => t.id === report.templateId);
              const filledSections = report.sections.filter(s => s.content.trim()).length;
              const totalSections = tmpl?.sections.length ?? report.sections.length;
              return (
                <button
                  key={report.id}
                  className="w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[color:var(--color-bg-hover)]"
                  onClick={() => setActiveReportId(report.id)}
                >
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 text-sm"
                    style={{ background: 'var(--color-bg-raised)' }}>
                    {tmpl?.icon ?? <FileText size={12} style={{ color: 'var(--color-accent)' }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>
                      {report.title}
                    </p>
                    <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                      {tmpl?.name ?? 'Custom'} · {filledSections}/{totalSections} sections filled
                    </p>
                  </div>
                  <ChevronRight size={12} style={{ color: 'var(--color-text-muted)' }} className="shrink-0 mt-1" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
