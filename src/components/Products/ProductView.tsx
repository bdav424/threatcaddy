import { createElement, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { BarChart3, Bot, Check, Clipboard, Download, FileDown, FileOutput, FilePenLine, FileText, Image as ImageIcon, Layers, Printer, Search, Settings2, Sparkles, Table2, Upload, Wand2, X } from 'lucide-react';
import type { Note, NoteTemplate } from '../../types';
import { formatDate } from '../../lib/utils';
import { renderMarkdown } from '../../lib/markdown';
import { downloadFile } from '../../lib/export';
import {
  buildBaselineFromDocumentText,
  serializeProductBaselinePackage,
  stageSectionContent,
  suggestSectionMapping,
  type ProductRenderContext,
  type SectionMapping,
} from '../../lib/product-baselines';
import { arrayBufferToBase64, buildTemplateBackedDocxBlob, hasDocxTemplateAsset } from '../../lib/docx-template-renderer';
import { extractDocxEvidence, extractPdfText } from '../../lib/evidence-import';
import { parseXlsxWorkbook, rowsToMarkdownTable, type XlsxSheet } from '../../lib/xlsx-import';
import { CHART_TYPES, parseMarkdownTableRows, resolveChartModel, type ChartModel, type ChartType } from '../../lib/chart-model';
import { ChartPreview } from './ChartPreview';
import { Modal } from '../Common/Modal';

interface ProductViewProps {
  folderName?: string;
  products: Note[];
  baselines: NoteTemplate[];
  onOpenSourceNote: (id: string) => void;
  onOpenChat: () => void;
  onImportBaseline?: (json: string, fileName: string) => Promise<NoteTemplate>;
  /** PDF/DOCX path — no structured package to parse, so this takes an
   * already-built baseline (see buildBaselineFromDocumentText) instead of
   * raw file contents. */
  onCreateBaseline?: (partial: Partial<NoteTemplate> & { name: string; content: string }) => Promise<NoteTemplate>;
  onUpdateBaseline?: (id: string, updates: Partial<NoteTemplate>) => Promise<void>;
  /** Section wand (CaddyLab Stage 2) — loads the same investigation-data
   * context render_product_baseline uses, so the wand can tell a section
   * with real data ("3 timeline events found") from one with none. */
  onLoadBaselineContext?: (baseline: NoteTemplate) => Promise<ProductRenderContext>;
  /** Section wand — assembles the analyst's per-section text into a product
   * note, identical in shape/tags to one the AI-driven render tool creates. */
  onGenerateProduct?: (baseline: NoteTemplate, sections: { heading: string; content: string }[], title: string, charts?: Note['productCharts']) => Promise<Note>;
  /** Figure upload-to-format (CaddyLab Stage 3) — persists an uploaded image
   * against a product's structuralMap figure key, so DOCX export can pour it
   * into that figure's template-owned frame. */
  onUpdateProductFigures?: (productId: string, figures: Note['productFigures']) => Promise<void>;
}

interface WandSectionState {
  key: string;
  heading: string;
  content: string;
  mapping?: SectionMapping;
  /** True if `content` was seeded from real investigation data on open —
   * used only for the badge; editing the textarea doesn't clear it. */
  autoFilled: boolean;
}

export function ProductView({
  folderName,
  products,
  baselines,
  onOpenSourceNote,
  onOpenChat,
  onImportBaseline,
  onCreateBaseline,
  onUpdateBaseline,
  onLoadBaselineContext,
  onGenerateProduct,
  onUpdateProductFigures,
}: ProductViewProps) {
  const [query, setQuery] = useState('');
  const [baselineManagerOpen, setBaselineManagerOpen] = useState(false);
  const [selectedBaselineId, setSelectedBaselineId] = useState<string | null>(baselines[0]?.id ?? null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [baselineMessage, setBaselineMessage] = useState('');
  const [baselineError, setBaselineError] = useState('');
  const [pdfExporting, setPdfExporting] = useState(false);
  const baselineInputRef = useRef<HTMLInputElement>(null);
  const docxTemplateInputRef = useRef<HTMLInputElement>(null);

  // Section wand (CaddyLab Stage 2) state — separate from the baseline
  // manager modal above since it operates on one specific baseline's
  // structuralMap, not the picker.
  const [wandBaseline, setWandBaseline] = useState<NoteTemplate | null>(null);
  const [wandSections, setWandSections] = useState<WandSectionState[]>([]);
  const [wandTitle, setWandTitle] = useState('');
  const [wandLoading, setWandLoading] = useState(false);
  const [wandSaving, setWandSaving] = useState(false);
  const [wandError, setWandError] = useState('');
  // CaddyLab Stage 4 — xlsx read as a data source for tables. Transient per
  // wand-session state (not persisted): which sheets a section's uploaded
  // spreadsheet has, so a multi-sheet workbook can be re-picked without
  // re-uploading.
  const [wandXlsxSheets, setWandXlsxSheets] = useState<Record<string, XlsxSheet[]>>({});
  // CaddyLab Stage 5a — resolved chart model per section (analyst confirms the
  // model + type before any OOXML is generated). Keyed by section key; a
  // string value means the resolve failed and holds the reason to show.
  const [wandCharts, setWandCharts] = useState<Record<string, ChartModel | string>>({});
  const [wandChartOpen, setWandChartOpen] = useState<Record<string, boolean>>({});
  // CaddyLab Stage 5b — charts the analyst committed to a section (each drops a
  // [[chart:key]] token in that section's content). Survives content edits so
  // the resolved model still exists at generate time; keyed by section key.
  const [wandInsertedCharts, setWandInsertedCharts] = useState<Record<string, ChartModel>>({});

  async function openWand(baseline: NoteTemplate) {
    const structuralMap = baseline.productBaseline?.structuralMap;
    if (!structuralMap || !onLoadBaselineContext) return;
    setWandBaseline(baseline);
    setWandError('');
    setWandLoading(true);
    setWandTitle(`${folderName ? `${folderName} — ` : ''}${baseline.name}`);
    try {
      const context = await onLoadBaselineContext(baseline);
      setWandSections(structuralMap.sections.map((section) => {
        const mapping = suggestSectionMapping(section.heading);
        const staged = stageSectionContent(mapping, context);
        return {
          key: section.key,
          heading: section.heading,
          content: staged,
          mapping,
          autoFilled: staged.trim().length > 0,
        };
      }));
    } catch (error) {
      setWandError(error instanceof Error ? error.message : 'Failed to load investigation data for this baseline.');
    } finally {
      setWandLoading(false);
    }
  }

  function closeWand() {
    setWandBaseline(null);
    setWandSections([]);
    setWandError('');
    setWandXlsxSheets({});
    setWandCharts({});
    setWandChartOpen({});
    setWandInsertedCharts({});
  }

  function insertSectionChart(sectionKey: string, model: ChartModel) {
    setWandInsertedCharts((current) => ({ ...current, [sectionKey]: model }));
    const token = `[[chart:${sectionKey}]]`;
    // Append the token directly (not via updateWandSection, which would clear
    // the live preview) so the chart persists into the generated content.
    setWandSections((current) => current.map((section) =>
      section.key === sectionKey && !section.content.includes(token)
        ? { ...section, content: `${section.content.trimEnd()}\n\n${token}` }
        : section));
  }

  function updateWandSection(key: string, content: string) {
    setWandSections((current) => current.map((section) => (section.key === key ? { ...section, content } : section)));
    // The table drives the chart; if the content changed, any previewed model
    // is stale — drop it so the analyst re-resolves against the new data.
    setWandCharts((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  async function handleSectionXlsxUpload(sectionKey: string, file: File) {
    try {
      const buffer = await file.arrayBuffer();
      const sheets = parseXlsxWorkbook(new Uint8Array(buffer));
      if (sheets.length === 0) {
        setWandError(`"${file.name}" has no readable rows.`);
        return;
      }
      setWandXlsxSheets((current) => ({ ...current, [sectionKey]: sheets }));
      updateWandSection(sectionKey, rowsToMarkdownTable(sheets[0].rows));
    } catch {
      setWandError(`Failed to read "${file.name}" as a spreadsheet.`);
    }
  }

  function handleSectionSheetChange(sectionKey: string, sheetIndex: number) {
    const sheet = wandXlsxSheets[sectionKey]?.[sheetIndex];
    if (!sheet) return;
    updateWandSection(sectionKey, rowsToMarkdownTable(sheet.rows));
  }

  function resolveSectionChart(sectionKey: string, content: string, forcedType?: ChartType) {
    const rows = parseMarkdownTableRows(content);
    if (!rows) {
      setWandCharts((current) => ({ ...current, [sectionKey]: 'Add a table (type one or insert a spreadsheet) to chart it.' }));
      return;
    }
    try {
      const palette = wandBaseline?.productBaseline?.structuralMap?.palette;
      const model = resolveChartModel(rows, { palette, forcedType });
      setWandCharts((current) => ({ ...current, [sectionKey]: model }));
    } catch (error) {
      setWandCharts((current) => ({ ...current, [sectionKey]: error instanceof Error ? error.message : 'Could not build a chart from this table.' }));
    }
  }

  function toggleSectionChart(sectionKey: string, content: string) {
    const open = !wandChartOpen[sectionKey];
    setWandChartOpen((current) => ({ ...current, [sectionKey]: open }));
    if (open && !wandCharts[sectionKey]) resolveSectionChart(sectionKey, content);
  }

  async function copySectionPrompt(section: WandSectionState) {
    const prompt = [
      'CaddyLab section wand — draft one section of a product.',
      `Investigation: ${folderName || '[select an investigation]'}`,
      `Baseline: ${wandBaseline?.name || ''}`,
      `Section: ${section.heading}`,
      section.mapping ? `Likely maps to: ${section.mapping.label}` : 'No obvious data mapping for this heading — use investigation notes/evidence as you see fit.',
      section.content.trim() ? `Staged reference data:\n${section.content}` : 'No staged data — draft from investigation context.',
      'Return ONLY the section body (no heading, no preamble) so it can be pasted directly in.',
    ].join('\n\n');
    try {
      await navigator.clipboard?.writeText(prompt);
    } catch {
      // Clipboard can be unavailable from file://; the analyst can still type directly.
    }
    onOpenChat();
  }

  async function handleGenerateProduct() {
    if (!wandBaseline || !onGenerateProduct) return;
    setWandSaving(true);
    setWandError('');
    try {
      const charts = Object.entries(wandInsertedCharts).map(([key, model]) => ({
        key,
        model: { type: model.type, categories: model.categories, series: model.series, colors: model.colors, title: model.title },
      }));
      const product = await onGenerateProduct(
        wandBaseline,
        wandSections.map(({ heading, content }) => ({ heading, content })),
        wandTitle,
        charts.length > 0 ? charts : undefined,
      );
      setSelectedProductId(product.id);
      closeWand();
    } catch (error) {
      setWandError(error instanceof Error ? error.message : 'Failed to generate this product.');
    } finally {
      setWandSaving(false);
    }
  }

  const filteredProducts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const activeProducts = products
      .filter((product) => !product.trashed && !product.archived)
      .sort((a, b) => b.updatedAt - a.updatedAt);
    if (!normalized) return activeProducts;
    return activeProducts.filter((product) => [
      product.title,
      product.content,
      product.tags.join(' '),
    ].join('\n').toLowerCase().includes(normalized));
  }, [products, query]);

  const selectedBaseline = useMemo(
    () => baselines.find((baseline) => baseline.id === selectedBaselineId) || baselines[0],
    [baselines, selectedBaselineId],
  );

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId) || null,
    [products, selectedProductId],
  );

  const selectedProductHtml = useMemo(
    // [[chart:key]] tokens are docx-export markers, not display text — strip
    // them from the on-screen HTML; the charts render in the Charts panel and
    // as native charts in the exported docx.
    () => selectedProduct ? renderMarkdown(selectedProduct.content.replace(/\[\[chart:[^\]]+\]\]/g, '')) : '',
    [selectedProduct],
  );

  const selectedProductBaseline = useMemo(() => {
    if (!selectedProduct) return undefined;
    const baselineTag = selectedProduct.tags.find((tag) => tag.startsWith('baseline:'));
    const baselineId = baselineTag?.slice('baseline:'.length);
    if (!baselineId) return undefined;
    return baselines.find((baseline) => baseline.id === baselineId);
  }, [baselines, selectedProduct]);

  const handleDownloadMarkdown = () => {
    if (!selectedProduct) return;
    downloadFile(selectedProduct.content, `${safeFilename(selectedProduct.title)}.md`, 'text/markdown;charset=utf-8');
  };

  const handleDownloadBaselinePackage = () => {
    if (!selectedBaseline) return;
    downloadFile(
      serializeProductBaselinePackage(selectedBaseline),
      `${safeFilename(selectedBaseline.name)}.tc-product-baseline.json`,
      'application/json;charset=utf-8',
    );
  };

  const handleDownloadDocx = () => {
    if (!selectedProduct) return;
    try {
      const templateBacked = buildTemplateBackedDocxBlob(selectedProduct, selectedProductBaseline);
      downloadBlob(templateBacked || buildDocxBlob(selectedProduct.title, selectedProductHtml), `${safeFilename(selectedProduct.title)}.docx`);
    } catch (error) {
      setBaselineError(error instanceof Error ? error.message : 'Failed to render DOCX from the attached baseline template.');
      downloadBlob(buildDocxBlob(selectedProduct.title, selectedProductHtml), `${safeFilename(selectedProduct.title)}.docx`);
    }
  };

  const handleFigureUpload = async (figureKey: string, file: File) => {
    if (!selectedProduct || !onUpdateProductFigures) return;
    const buffer = await file.arrayBuffer();
    const data = arrayBufferToBase64(buffer);
    const next = [
      ...(selectedProduct.productFigures || []).filter((figure) => figure.key !== figureKey),
      { key: figureKey, name: file.name, mimeType: file.type || 'application/octet-stream', data },
    ];
    try {
      await onUpdateProductFigures(selectedProduct.id, next);
    } catch (error) {
      setBaselineError(error instanceof Error ? error.message : 'Failed to attach the figure image.');
    }
  };

  const handlePrintProduct = () => {
    if (!selectedProduct) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.open();
    printWindow.document.write(buildPrintableDocument(selectedProduct.title, selectedProductHtml));
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const handleExportPdf = async () => {
    if (!selectedProduct) return;
    setPdfExporting(true);
    setBaselineError('');
    try {
      // Render the product with chart tokens replaced by the chart flattened
      // to a PNG image, inline where it belongs — the spec's "charts flatten to
      // images on PDF export." (html2canvas stalls on inline <svg>, so the
      // chart is rasterized up front; the legend rides alongside as plain HTML.)
      let bodyHtml = renderMarkdown(selectedProduct.content);
      const charts = selectedProduct.productCharts ?? [];
      if (charts.length > 0) {
        const [{ renderToStaticMarkup }, { svgToPngDataUrl }] = await Promise.all([
          import('react-dom/server'),
          import('../../lib/pdf-export'),
        ]);
        for (const chart of charts) {
          const model = { ...chart.model, categoryColumnIndex: null, numericColumnIndexes: [], suggestionReason: '' };
          const markup = renderToStaticMarkup(createElement(ChartPreview, { model }));
          const svg = markup.match(/<svg[\s\S]*?<\/svg>/)?.[0];
          let chartHtml = '';
          if (svg) {
            const png = await svgToPngDataUrl(svg);
            const labels = model.type === 'pie' ? model.categories : model.series.map((series) => series.name);
            const legend = `<div style="margin-top:4px;font-size:9px;color:#374151">${labels
              .map((label, index) => `<span style="display:inline-block;margin-right:10px"><span style="display:inline-block;width:8px;height:8px;background:${model.colors[index % model.colors.length]};vertical-align:middle;margin-right:3px"></span>${escapeHtml(label)}</span>`)
              .join('')}</div>`;
            chartHtml = `<div class="product-chart"><img src="${png}" style="max-width:5.5in;height:auto"/>${legend}</div>`;
          }
          bodyHtml = bodyHtml.split(`[[chart:${chart.key}]]`).join(chartHtml);
        }
      }
      bodyHtml = bodyHtml.replace(/\[\[chart:[^\]]+\]\]/g, ''); // drop any token whose chart wasn't stored
      const { exportBodyToPdf } = await import('../../lib/pdf-export');
      await exportBodyToPdf(bodyHtml, PRODUCT_DOCUMENT_CSS, `${safeFilename(selectedProduct.title)}.pdf`);
    } catch (error) {
      setBaselineError(error instanceof Error ? error.message : 'Failed to export this product as a PDF.');
    } finally {
      setPdfExporting(false);
    }
  };

  const handleCopyBaselinePrompt = async (baseline: NoteTemplate) => {
    const prompt = `Use the "${baseline.name}" product baseline to render a finished product for the active investigation. Keep it customer-ready, preserve source notes, and create the product as a tagged product note.`;
    try {
      await navigator.clipboard?.writeText(prompt);
    } catch {
      // Clipboard access can be unavailable from file://; the preview still remains usable.
    }
  };

  const handleBaselineFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (baselineInputRef.current) baselineInputRef.current.value = '';
    if (!file) return;
    setBaselineError('');
    setBaselineMessage('');

    // PDF/DOCX have no structured package to parse — extract their text and
    // seed a new markdown baseline from it, the same way ReportCaddy's
    // "Upload Word template" seeds a new report template. Only .json goes
    // through the existing importProductBaselinePackage path below.
    const lowerName = file.name.toLowerCase();
    if (lowerName.endsWith('.pdf') || lowerName.endsWith('.docx')) {
      if (!onCreateBaseline) return;
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const docType = lowerName.endsWith('.pdf') ? 'pdf' as const : 'docx' as const;
        const { text, warning } = docType === 'pdf'
          ? (() => { const r = extractPdfText(bytes); return { text: r.text, warning: r.rejected ? 'This looks like a scanned or image-only PDF with no embedded text layer.' : undefined }; })()
          : extractDocxEvidence(bytes);
        if (!text.trim()) {
          setBaselineError(warning || `No readable text could be extracted from this ${docType.toUpperCase()} file.`);
          return;
        }
        const partial = buildBaselineFromDocumentText(text, file.name, docType);
        const created = await onCreateBaseline(partial);
        setSelectedBaselineId(created.id);
        setBaselineManagerOpen(true);
        setBaselineMessage(warning ? `Imported ${created.name} (${warning})` : `Imported ${created.name}`);
      } catch (error) {
        setBaselineError(error instanceof Error ? error.message : `Failed to import ${file.name}.`);
      }
      return;
    }

    if (!onImportBaseline) return;
    try {
      const imported = await onImportBaseline(await file.text(), file.name);
      setSelectedBaselineId(imported.id);
      setBaselineManagerOpen(true);
      setBaselineMessage(`Imported ${imported.name}`);
    } catch (error) {
      setBaselineError(error instanceof Error ? error.message : 'Failed to import product baseline package.');
    }
  };

  const handleDocxTemplateFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (docxTemplateInputRef.current) docxTemplateInputRef.current.value = '';
    if (!file || !selectedBaseline || !selectedBaseline.productBaseline || !onUpdateBaseline) return;
    setBaselineError('');
    setBaselineMessage('');
    try {
      const assets = [
        ...(selectedBaseline.productBaseline.assets || []).filter((asset) => asset.role !== 'docx-template'),
        {
          name: file.name,
          role: 'docx-template' as const,
          mimeType: file.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          data: arrayBufferToBase64(await file.arrayBuffer()),
          notes: 'Attached DOCX template used for baseline-backed product export.',
        },
      ];
      await onUpdateBaseline(selectedBaseline.id, {
        productBaseline: {
          ...selectedBaseline.productBaseline,
          kind: 'docx-template',
          renderer: 'docx-template',
          visualFidelity: selectedBaseline.productBaseline.visualFidelity === 'word-template'
            ? 'word-template'
            : 'structural',
          assets,
        },
      });
      setBaselineMessage(`Attached DOCX template ${file.name}`);
    } catch (error) {
      setBaselineError(error instanceof Error ? error.message : 'Failed to attach DOCX template.');
    }
  };

  return (
    <div className="flex-1 overflow-hidden flex flex-col bg-bg-primary">
      <header className="shrink-0 border-b border-border-subtle px-4 py-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <FileOutput size={20} className="text-accent-blue shrink-0" />
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-text-primary">Products</h1>
            <p className="text-xs text-text-muted truncate">
              {folderName ? folderName : 'Generated reports, notes, and deliverables'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(onImportBaseline || onCreateBaseline) && (
            <label
              className="inline-flex cursor-pointer items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border-subtle text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
              title="Import a .tc-product-baseline.json package, or a .pdf/.docx to seed a new baseline from its extracted text"
            >
              <Upload size={14} />
              Import Baseline
              <input
                ref={baselineInputRef}
                type="file"
                accept=".json,.tc-product-baseline.json,application/json,.pdf,application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={handleBaselineFileSelect}
                className="hidden"
              />
            </label>
          )}
          <button
            onClick={() => setBaselineManagerOpen(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border-subtle text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
          >
            <Settings2 size={14} />
            Baselines
          </button>
          <button
            onClick={onOpenChat}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border-subtle text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
          >
            <Bot size={14} />
            CaddyAI
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-6xl space-y-4">
          <section className="rounded-lg border border-border-subtle bg-bg-surface p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                  <Layers size={16} className="text-accent-blue" />
                  Product Baselines
                </div>
                <p className="mt-1 max-w-2xl text-xs text-text-muted">
                  Jinja-compatible baselines define repeatable report structures. CaddyAI can render these with investigation notes, IOCs, evidence, timelines, and analyst-provided fields.
                </p>
              </div>
              <span className="rounded-md bg-accent-blue/10 px-2 py-1 text-xs text-accent-blue">
                {baselines.length} baseline{baselines.length === 1 ? '' : 's'}
              </span>
            </div>
            {(baselineMessage || baselineError) && (
              <p className={`mt-2 text-xs ${baselineError ? 'text-red-400' : 'text-green-400'}`}>
                {baselineError || baselineMessage}
              </p>
            )}
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {baselines.length === 0 ? (
                <div className="rounded-md border border-dashed border-border-subtle bg-bg-primary px-3 py-4 text-xs text-text-muted md:col-span-2">
                  Import a product baseline package to make it available to CaddyAI and product rendering.
                </div>
              ) : baselines.map((baseline) => (
                <article key={baseline.id} className="rounded-md border border-border-subtle bg-bg-primary px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-bg-raised px-1.5 py-0.5 text-[10px] text-text-muted">{baseline.icon || 'TPL'}</span>
                    <h3 className="min-w-0 flex-1 truncate text-xs font-semibold text-text-primary">{baseline.name}</h3>
                    <button
                      onClick={() => {
                        setSelectedBaselineId(baseline.id);
                        setBaselineManagerOpen(true);
                      }}
                      className="rounded px-1.5 py-0.5 text-[10px] font-medium text-accent-blue hover:bg-accent-blue/10"
                    >
                      Preview
                    </button>
                  </div>
                  {baseline.description && (
                    <p className="mt-1 line-clamp-2 text-[11px] text-text-muted">{baseline.description}</p>
                  )}
                  {baseline.productBaseline && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      <span className="rounded bg-bg-raised px-1.5 py-0.5 text-[10px] text-text-muted">{baseline.productBaseline.productType}</span>
                      <span className="rounded bg-bg-raised px-1.5 py-0.5 text-[10px] text-text-muted">{baseline.productBaseline.visualFidelity}</span>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>

          <section>
            <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-semibold uppercase text-text-muted">Generated Products</h2>
                <span className="text-xs text-text-muted">
                  {filteredProducts.length === products.length ? products.length : `${filteredProducts.length} / ${products.length}`}
                </span>
              </div>
              <div className="relative w-full sm:w-72">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  aria-label="Search products"
                  placeholder="Search products"
                  className="w-full rounded-md border border-border-subtle bg-bg-surface py-1.5 ps-8 pe-8 text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-accent-blue"
                />
                {query && (
                  <button
                    onClick={() => setQuery('')}
                    aria-label="Clear product search"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-text-muted hover:text-text-primary hover:bg-bg-hover"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

            {products.length === 0 ? (
              <div className="rounded-lg border border-border-subtle bg-bg-surface p-8 text-center">
                <FileOutput size={36} className="mx-auto mb-3 text-text-muted" />
                <h3 className="text-sm font-semibold text-text-primary">No products yet</h3>
                <p className="mt-1 text-xs text-text-muted">Ask CaddyAI to render a product baseline to create a draft report here.</p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="rounded-lg border border-border-subtle bg-bg-surface p-8 text-center">
                <Search size={32} className="mx-auto mb-3 text-text-muted" />
                <h3 className="text-sm font-semibold text-text-primary">No products match</h3>
                <p className="mt-1 text-xs text-text-muted">Try a product title, tag, or phrase from the draft.</p>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {filteredProducts.map((product) => (
                  <article key={product.id} className="rounded-lg border border-border-subtle bg-bg-surface p-3 hover:border-border-medium transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded-md bg-bg-raised text-accent-blue flex items-center justify-center shrink-0">
                        <FileText size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="line-clamp-2 text-sm font-medium text-text-primary">{product.title}</h3>
                        <p className="mt-1 line-clamp-3 text-xs text-text-muted">{previewProduct(product.content)}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-text-muted">
                          <span>{formatDate(product.updatedAt)}</span>
                          {product.tags.filter((tag) => tag !== 'product').slice(0, 3).map((tag) => (
                            <span key={tag} className="rounded bg-bg-raised px-1.5 py-0.5">{tag}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setSelectedProductId(product.id)}
                        className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border-subtle px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
                      >
                        <FileText size={13} />
                        Preview Product
                      </button>
                      <button
                        onClick={() => onOpenSourceNote(product.id)}
                        className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border-subtle px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
                      >
                        <FilePenLine size={13} />
                        Source Note
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>

      <Modal
        open={baselineManagerOpen}
        onClose={() => setBaselineManagerOpen(false)}
        title="Product Baselines"
        extraWide
      >
        <div className="grid gap-4 lg:grid-cols-[minmax(220px,320px)_1fr]">
          <div className="space-y-2">
            {baselines.map((baseline) => (
              <button
                key={baseline.id}
                onClick={() => setSelectedBaselineId(baseline.id)}
                className={`w-full rounded-lg border p-3 text-left transition-colors ${selectedBaseline?.id === baseline.id ? 'border-accent-blue bg-accent-blue/10' : 'border-border-subtle bg-bg-surface hover:border-border-medium'}`}
              >
                <div className="flex items-center gap-2">
                  <span className="rounded bg-bg-raised px-1.5 py-0.5 text-[10px] text-text-muted">{baseline.icon || 'TPL'}</span>
                  <span className="min-w-0 flex-1 truncate text-xs font-semibold text-text-primary">{baseline.name}</span>
                </div>
                {baseline.description && (
                  <p className="mt-1 line-clamp-2 text-[11px] text-text-muted">{baseline.description}</p>
                )}
                <div className="mt-2 flex flex-wrap gap-1">
                  <span className="rounded bg-bg-raised px-1.5 py-0.5 text-[10px] text-text-muted">{baseline.source}</span>
                  {baseline.tags?.slice(0, 3).map((tag) => (
                    <span key={tag} className="rounded bg-bg-raised px-1.5 py-0.5 text-[10px] text-text-muted">{tag}</span>
                  ))}
                </div>
              </button>
            ))}
          </div>
          <div className="min-w-0 rounded-lg border border-border-subtle bg-bg-surface">
            {selectedBaseline ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border-subtle p-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-text-primary">{selectedBaseline.name}</h3>
                    {selectedBaseline.description && (
                      <p className="mt-1 text-xs text-text-muted">{selectedBaseline.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedBaseline.productBaseline && onUpdateBaseline && (
                      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border-subtle px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-bg-hover">
                        <Upload size={13} />
                        Attach DOCX
                        <input
                          ref={docxTemplateInputRef}
                          type="file"
                          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                          onChange={handleDocxTemplateFileSelect}
                          className="hidden"
                        />
                      </label>
                    )}
                    {selectedBaseline.productBaseline?.structuralMap && onGenerateProduct && (
                      <button
                        onClick={() => openWand(selectedBaseline)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-accent-blue/40 bg-accent-blue/15 px-2.5 py-1.5 text-xs font-medium text-accent-blue hover:bg-accent-blue/20"
                      >
                        <Wand2 size={13} />
                        Fill Sections
                      </button>
                    )}
                    <button
                      onClick={() => handleCopyBaselinePrompt(selectedBaseline)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-border-subtle px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-bg-hover"
                    >
                      <Clipboard size={13} />
                      Copy Prompt
                    </button>
                    <button
                      onClick={handleDownloadBaselinePackage}
                      className="inline-flex items-center gap-1.5 rounded-md border border-border-subtle px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-bg-hover"
                    >
                      <Download size={13} />
                      Export Package
                    </button>
                    <button
                      onClick={onOpenChat}
                      className="inline-flex items-center gap-1.5 rounded-md border border-border-subtle px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-bg-hover"
                    >
                      <Bot size={13} />
                      CaddyAI
                    </button>
                  </div>
                </div>
                <pre className="max-h-[58vh] overflow-auto whitespace-pre-wrap p-4 text-xs leading-6 text-text-secondary">
                  {selectedBaseline.content}
                </pre>
                {selectedBaseline.productBaseline && (
                  <div className="border-t border-border-subtle p-3 text-xs text-text-muted">
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded bg-bg-raised px-1.5 py-0.5">{selectedBaseline.productBaseline.productType}</span>
                      <span className="rounded bg-bg-raised px-1.5 py-0.5">{selectedBaseline.productBaseline.renderer}</span>
                      <span className="rounded bg-bg-raised px-1.5 py-0.5">{selectedBaseline.productBaseline.visualFidelity}</span>
                      {hasDocxTemplateAsset(selectedBaseline) && (
                        <span className="rounded bg-green-500/10 px-1.5 py-0.5 text-green-400">DOCX template attached</span>
                      )}
                    </div>
                    {selectedBaseline.productBaseline.sourceDocuments && selectedBaseline.productBaseline.sourceDocuments.length > 0 && (
                      <p className="mt-2">
                        Baseline sources: {selectedBaseline.productBaseline.sourceDocuments.map((doc) => doc.name).join(', ')}
                      </p>
                    )}
                    {selectedBaseline.productBaseline.testFixtures && selectedBaseline.productBaseline.testFixtures.length > 0 && (
                      <p className="mt-1">
                        Test fixtures: {selectedBaseline.productBaseline.testFixtures.map((fixture) => fixture.name).join(', ')}
                      </p>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="p-8 text-center text-sm text-text-muted">No product baselines available.</div>
            )}
          </div>
        </div>
      </Modal>

      <Modal
        open={selectedProduct !== null}
        onClose={() => setSelectedProductId(null)}
        title={selectedProduct?.title || 'Product Preview'}
        extraWide
      >
        {selectedProduct && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border-subtle bg-bg-surface px-3 py-2">
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-text-muted">
                <span>Updated {formatDate(selectedProduct.updatedAt)}</span>
                {selectedProduct.tags.filter((tag) => tag !== 'product').slice(0, 6).map((tag) => (
                  <span key={tag} className="rounded bg-bg-raised px-1.5 py-0.5">{tag}</span>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleDownloadDocx}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border-subtle px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-bg-hover"
                >
                  <Download size={13} />
                  DOCX
                </button>
                <button
                  onClick={handleExportPdf}
                  disabled={pdfExporting}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border-subtle px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <FileDown size={13} />
                  {pdfExporting ? 'Exporting…' : 'PDF'}
                </button>
                <button
                  onClick={handleDownloadMarkdown}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border-subtle px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-bg-hover"
                >
                  <Download size={13} />
                  Markdown
                </button>
                <button
                  onClick={handlePrintProduct}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border-subtle px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-bg-hover"
                >
                  <Printer size={13} />
                  Print
                </button>
                <button
                  onClick={() => onOpenSourceNote(selectedProduct.id)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border-subtle px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-bg-hover"
                >
                  <FilePenLine size={13} />
                  Source
                </button>
              </div>
            </div>
            {selectedProductBaseline?.productBaseline?.structuralMap?.figures &&
              selectedProductBaseline.productBaseline.structuralMap.figures.length > 0 && (
              <div className="rounded-lg border border-border-subtle bg-bg-surface p-3">
                <h3 className="mb-2 text-xs font-semibold uppercase text-text-muted">Figures</h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {selectedProductBaseline.productBaseline.structuralMap.figures.map((figure) => {
                    const uploaded = selectedProduct.productFigures?.find((upload) => upload.key === figure.key);
                    return (
                      <div key={figure.key} className="flex items-center gap-3 rounded-md border border-border-subtle bg-bg-raised/40 p-2">
                        {uploaded ? (
                          <img
                            src={`data:${uploaded.mimeType};base64,${uploaded.data}`}
                            alt={figure.caption || `Figure ${figure.order + 1}`}
                            className="h-12 w-12 shrink-0 rounded object-cover"
                          />
                        ) : (
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-bg-hover text-text-muted">
                            <ImageIcon size={16} />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-text-primary">{figure.caption || `Figure ${figure.order + 1}`}</p>
                          <p className="truncate text-[11px] text-text-muted">{uploaded ? uploaded.name : 'Pending — no image uploaded'}</p>
                        </div>
                        <label className="shrink-0 cursor-pointer rounded-md border border-border-subtle px-2 py-1 text-[11px] font-medium text-text-secondary hover:text-text-primary hover:bg-bg-hover">
                          {uploaded ? 'Replace' : 'Upload'}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              event.target.value = '';
                              if (file) void handleFigureUpload(figure.key, file);
                            }}
                          />
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {selectedProduct.productCharts && selectedProduct.productCharts.length > 0 && (
              <div className="rounded-lg border border-border-subtle bg-bg-surface p-3">
                <h3 className="mb-2 text-xs font-semibold uppercase text-text-muted">
                  Charts · native editable Word charts
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {selectedProduct.productCharts.map((chart) => (
                    <div key={chart.key}>
                      <ChartPreview model={{ ...chart.model, categoryColumnIndex: null, numericColumnIndexes: [], suggestionReason: '' }} />
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="max-h-[68vh] overflow-auto rounded-lg border border-border-subtle bg-gray-200 p-4">
              <article
                className="product-document markdown-preview mx-auto min-h-[11in] max-w-[8.5in] bg-white px-[0.7in] py-[0.65in] text-[12pt] text-gray-950 shadow-lg"
                dangerouslySetInnerHTML={{ __html: selectedProductHtml }}
              />
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={wandBaseline !== null}
        onClose={closeWand}
        title={wandBaseline ? `Fill Sections — ${wandBaseline.name}` : 'Fill Sections'}
        extraWide
      >
        {wandLoading ? (
          <div className="p-8 text-center text-sm text-text-muted">Loading investigation data…</div>
        ) : (
          <div className="space-y-3">
            {wandError && <p className="text-xs text-red-400">{wandError}</p>}
            <label className="grid gap-1 text-xs font-medium text-text-secondary">
              Product title
              <input
                value={wandTitle}
                onChange={(event) => setWandTitle(event.target.value)}
                className="rounded-lg border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-blue"
              />
            </label>
            <div className="max-h-[55vh] space-y-3 overflow-auto pr-1">
              {wandSections.map((section) => (
                <div key={section.key} className="rounded-lg border border-border-subtle bg-bg-surface p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-text-primary">{section.heading}</h3>
                    {section.autoFilled ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-accent-green/30 bg-accent-green/10 px-2 py-0.5 text-[10px] font-medium text-accent-green">
                        <Check size={10} />
                        Auto-filled{section.mapping ? ` · ${section.mapping.label}` : ''}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                        <Sparkles size={10} />
                        Needs input{section.mapping ? ` · ${section.mapping.label} not found` : ''}
                      </span>
                    )}
                  </div>
                  <textarea
                    value={section.content}
                    onChange={(event) => updateWandSection(section.key, event.target.value)}
                    rows={section.mapping?.kind === 'timeline-table' || section.mapping?.kind === 'ioc-table' ? 6 : 4}
                    placeholder="Type this section's content, or ask CaddyAI to draft it…"
                    className="w-full rounded-lg border border-border-subtle bg-bg-primary px-3 py-2 font-mono text-xs text-text-primary outline-none focus:border-accent-blue"
                  />
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {!section.autoFilled && (
                      <button
                        onClick={() => copySectionPrompt(section)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-border-subtle px-2 py-1 text-[11px] font-medium text-text-secondary hover:text-text-primary hover:bg-bg-hover"
                      >
                        <Bot size={12} />
                        Ask CaddyAI to draft this
                      </button>
                    )}
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border-subtle px-2 py-1 text-[11px] font-medium text-text-secondary hover:text-text-primary hover:bg-bg-hover">
                      <Table2 size={12} />
                      Insert spreadsheet
                      <input
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          event.target.value = '';
                          if (file) void handleSectionXlsxUpload(section.key, file);
                        }}
                      />
                    </label>
                    {wandXlsxSheets[section.key] && wandXlsxSheets[section.key].length > 1 && (
                      <select
                        aria-label={`${section.heading} spreadsheet sheet`}
                        defaultValue={0}
                        onChange={(event) => handleSectionSheetChange(section.key, Number(event.target.value))}
                        className="rounded-md border border-border-subtle bg-bg-primary px-2 py-1 text-[11px] text-text-primary outline-none focus:border-accent-blue"
                      >
                        {wandXlsxSheets[section.key].map((sheet, index) => (
                          <option key={sheet.name} value={index}>{sheet.name}</option>
                        ))}
                      </select>
                    )}
                    {parseMarkdownTableRows(section.content) && (
                      <button
                        onClick={() => toggleSectionChart(section.key, section.content)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-border-subtle px-2 py-1 text-[11px] font-medium text-text-secondary hover:text-text-primary hover:bg-bg-hover"
                      >
                        <BarChart3 size={12} />
                        {wandChartOpen[section.key] ? 'Hide chart' : 'Preview as chart'}
                      </button>
                    )}
                  </div>
                  {wandChartOpen[section.key] && (
                    <div className="mt-2 rounded-lg border border-border-subtle bg-bg-base/40 p-3">
                      {typeof wandCharts[section.key] === 'string' ? (
                        <p className="text-[11px] text-amber-300">{wandCharts[section.key] as string}</p>
                      ) : wandCharts[section.key] ? (
                        <>
                          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                            <p className="text-[11px] text-text-muted">{(wandCharts[section.key] as ChartModel).suggestionReason}</p>
                            <label className="inline-flex items-center gap-1.5 text-[11px] text-text-secondary">
                              Type
                              <select
                                value={(wandCharts[section.key] as ChartModel).type}
                                onChange={(event) => resolveSectionChart(section.key, section.content, event.target.value as ChartType)}
                                className="rounded-md border border-border-subtle bg-bg-primary px-2 py-1 text-[11px] text-text-primary outline-none focus:border-accent-blue"
                              >
                                {CHART_TYPES.map((option) => (
                                  <option key={option.type} value={option.type}>{option.label}</option>
                                ))}
                              </select>
                            </label>
                          </div>
                          <ChartPreview model={wandCharts[section.key] as ChartModel} />
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <button
                              onClick={() => insertSectionChart(section.key, wandCharts[section.key] as ChartModel)}
                              className="inline-flex items-center gap-1.5 rounded-md border border-accent-blue/40 bg-accent-blue/15 px-2 py-1 text-[11px] font-medium text-accent-blue hover:bg-accent-blue/20"
                            >
                              <Check size={12} />
                              {wandInsertedCharts[section.key] ? 'Chart inserted — update' : 'Insert chart into section'}
                            </button>
                            <span className="text-[10px] text-text-muted">
                              Exports as a native editable Word chart (Edit Data works in Word). Flattens to an image on PDF export.
                            </span>
                          </div>
                        </>
                      ) : (
                        <p className="text-[11px] text-text-muted">Resolving chart…</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 border-t border-border-subtle pt-3">
              <button
                onClick={closeWand}
                className="rounded-lg border border-border-subtle px-3 py-2 text-sm text-text-secondary hover:bg-bg-hover"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateProduct}
                disabled={wandSaving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent-blue px-4 py-2 text-sm font-semibold text-white hover:bg-accent-blue/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Wand2 size={14} />
                {wandSaving ? 'Generating…' : 'Generate Product'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function previewProduct(markdown: string): string {
  return markdown
    .replace(/^#.+$/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/[#>*_`|-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 260) || 'No product preview available.';
}

function safeFilename(value: string): string {
  const cleaned = value
    .trim()
    .split('')
    .map((char) => {
      const code = char.charCodeAt(0);
      return code <= 0x1f || '<>:"/\\|?*'.includes(char) ? '-' : char;
    })
    .join('')
    .replace(/\s+/g, ' ')
    .slice(0, 120);
  return cleaned || 'ThreatCaddy Product';
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function buildDocxBlob(title: string, bodyHtml: string): Blob {
  const html = buildProductHtmlDocument(title, bodyHtml);
  const data = buildZip([
    {
      path: '[Content_Types].xml',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="html" ContentType="text/html"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
    },
    {
      path: '_rels/.rels',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
    },
    {
      path: 'word/document.xml',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    <w:altChunk r:id="rIdHtml"/>
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="936" w:right="1008" w:bottom="936" w:left="1008" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`,
    },
    {
      path: 'word/_rels/document.xml.rels',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdHtml" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/aFChunk" Target="afchunk.html"/>
</Relationships>`,
    },
    {
      path: 'word/afchunk.html',
      content: html,
    },
  ]);
  const buffer = new ArrayBuffer(data.byteLength);
  new Uint8Array(buffer).set(data);
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

function buildPrintableDocument(title: string, bodyHtml: string): string {
  return buildProductHtmlDocument(title, bodyHtml, '@page { size: letter; margin: 0.65in 0.7in; } body { margin: 0; }');
}

const PRODUCT_DOCUMENT_CSS = `
    body { font-family: Aptos, Calibri, Arial, sans-serif; font-size: 11pt; line-height: 1.45; color: #111827; }
    h1 { font-size: 20pt; border-bottom: 1px solid #9ca3af; padding-bottom: 4pt; }
    h2 { font-size: 15pt; margin-top: 18pt; }
    h3 { font-size: 12.5pt; margin-top: 14pt; }
    table { border-collapse: collapse; width: 100%; margin: 10pt 0; }
    th, td { border: 1px solid #9ca3af; padding: 5pt; text-align: left; vertical-align: top; }
    th { background: #e5e7eb; font-weight: 700; }
    code { background: #f3f4f6; padding: 1pt 3pt; font-family: Consolas, monospace; }
    .product-chart { margin: 12pt 0; max-width: 5.5in; }
`;

function buildProductHtmlDocument(title: string, bodyHtml: string, extraCss = ''): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <style>
    ${extraCss}
    ${PRODUCT_DOCUMENT_CSS}
  </style>
</head>
<body>${bodyHtml}</body>
</html>`;
}

function buildZip(files: Array<{ path: string; content: string }>): Uint8Array {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const name = encoder.encode(file.path);
    const data = encoder.encode(file.content);
    const crc = crc32(data);
    const local = new Uint8Array(30 + name.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, 0, true);
    localView.setUint16(12, 0, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, data.length, true);
    localView.setUint32(22, data.length, true);
    localView.setUint16(26, name.length, true);
    localView.setUint16(28, 0, true);
    local.set(name, 30);
    localParts.push(local, data);

    const central = new Uint8Array(46 + name.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, 0, true);
    centralView.setUint16(14, 0, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, data.length, true);
    centralView.setUint32(24, data.length, true);
    centralView.setUint16(28, name.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, offset, true);
    central.set(name, 46);
    centralParts.push(central);

    offset += local.length + data.length;
  }

  const centralSize = centralParts.reduce((total, part) => total + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);
  endView.setUint16(20, 0, true);

  return concatUint8Arrays([...localParts, ...centralParts, end]);
}

function concatUint8Arrays(parts: Uint8Array[]): Uint8Array {
  const totalLength = parts.reduce((total, part) => total + part.length, 0);
  const output = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

const CRC32_TABLE = new Uint32Array(256).map((_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
  }
  return value >>> 0;
});

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
