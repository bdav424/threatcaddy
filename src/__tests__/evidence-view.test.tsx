import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { EvidenceView } from '../components/Evidence/EvidenceView';
import type { EvidenceItem } from '../types';

function makeEvidenceItem(overrides: Partial<EvidenceItem> = {}): EvidenceItem {
  return {
    id: 'evidence-1',
    title: 'weaponized-clipboard.rtf',
    folderId: 'folder-1',
    fileName: 'weaponized-clipboard.rtf',
    fileType: 'rtf',
    mimeType: 'text/rtf',
    size: 1024,
    content: [
      '# Evidence: weaponized-clipboard.rtf',
      '',
      '**Extraction:** extracted',
      '',
      '## Extracted Text',
      '',
      'Initial triage notes.',
      'The VENDOR clipboard payload appears in the body of the report.',
    ].join('\n'),
    extractionStatus: 'extracted',
    importedAt: 100,
    chunkIndex: 1,
    chunkCount: 1,
    tags: ['evidence'],
    trashed: false,
    archived: false,
    createdAt: 100,
    updatedAt: 100,
    ...overrides,
  };
}

describe('EvidenceView inspect preview', () => {
  const scrollIntoView = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    scrollIntoView.mockClear();
    Element.prototype.scrollIntoView = scrollIntoView;
    window.requestAnimationFrame = (callback: FrameRequestCallback) => window.setTimeout(() => callback(0), 0);
    window.cancelAnimationFrame = (id: number) => window.clearTimeout(id);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('debounces inspect search and scrolls to the settled match', async () => {
    render(
      <EvidenceView
        folderId="folder-1"
        folderName="Weaponized Clipboard"
        items={[makeEvidenceItem()]}
        onImportFiles={vi.fn(async () => [])}
        onOpenChat={vi.fn()}
      />,
    );

    const input = screen.getByLabelText('Search inspected evidence');

    fireEvent.change(input, { target: { value: 'O' } });
    await act(async () => {
      vi.advanceTimersByTime(900);
    });

    expect(document.querySelector('[data-evidence-inspect-hit="true"]')).toBeNull();

    fireEvent.change(input, { target: { value: 'VENDOR' } });
    await act(async () => {
      vi.advanceTimersByTime(799);
    });

    expect(document.querySelector('[data-evidence-inspect-hit="true"]')).toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    await act(async () => {
      vi.runOnlyPendingTimers();
    });

    const hit = document.querySelector('[data-evidence-inspect-hit="true"]');
    expect(hit).toHaveTextContent('VENDOR');
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center', inline: 'nearest' });
  });

  it('advances to the next inspect result when Enter is pressed on an active query', async () => {
    render(
      <EvidenceView
        folderId="folder-1"
        folderName="Weaponized Clipboard"
        items={[
          makeEvidenceItem({
            content: [
              '# Evidence: weaponized-clipboard.rtf',
              '',
              '**Extraction:** extracted',
              '',
              '## Extracted Text',
              '',
              'VENDOR first hit.',
              'VENDOR second hit.',
            ].join('\n'),
          }),
        ]}
        onImportFiles={vi.fn(async () => [])}
        onOpenChat={vi.fn()}
      />,
    );

    const input = screen.getByLabelText('Search inspected evidence');
    fireEvent.change(input, { target: { value: 'VENDOR' } });
    await act(async () => {
      vi.advanceTimersByTime(800);
      vi.runOnlyPendingTimers();
    });

    expect(screen.getByText('1/2')).toBeInTheDocument();

    fireEvent.keyDown(input, { key: 'Enter' });
    await act(async () => {
      vi.runOnlyPendingTimers();
    });

    expect(screen.getByText('2/2')).toBeInTheDocument();
  });

  it('shows a readable PDF text preview with visual artifact caveats', () => {
    render(
      <EvidenceView
        folderId="folder-1"
        folderName="Weaponized Clipboard"
        items={[
          makeEvidenceItem({
            title: 'weaponized-clipboard.pdf',
            fileName: 'weaponized-clipboard.pdf',
            fileType: 'pdf',
            mimeType: 'application/pdf',
            extractionStatus: 'partial',
            extractionWarning: 'PDF extraction is best-effort for selectable text objects.',
            content: [
              '# Evidence: weaponized-clipboard.pdf',
              '',
              '**Extraction:** partial',
              '**Note:** PDF extraction is best-effort for selectable text objects.',
              '',
              '## Extracted Text',
              '',
              'Figure 2 shows a chart of clipboard abuse over time.',
            ].join('\n'),
          }),
        ]}
        onImportFiles={vi.fn(async () => [])}
        onOpenChat={vi.fn()}
      />,
    );

    expect(screen.getByText('Readable PDF Text')).toBeInTheDocument();
    expect(screen.getAllByText(/Figure 2 shows a chart/).length).toBeGreaterThan(0);
    expect(screen.getByText(/PDF preview uses extracted selectable text/)).toBeInTheDocument();
  });

  it('renders readable evidence with paragraph spacing and formatted section headings', () => {
    render(
      <EvidenceView
        folderId="folder-1"
        folderName="Weaponized Clipboard"
        items={[
          makeEvidenceItem({
            content: [
              '# Evidence: summary.rtf',
              '',
              '**Extraction:** extracted',
              '',
              '## Extracted Text',
              '',
              'Executive Summary',
              '',
              'This paragraph should read like normal prose.',
              'It should not collapse into a tight raw dump.',
              '',
              'Key Findings',
              '',
              '- VENDOR appeared in a clipboard-related note.',
            ].join('\n'),
          }),
        ]}
        onImportFiles={vi.fn(async () => [])}
        onOpenChat={vi.fn()}
      />,
    );

    const section = screen.getByText('Readable RTF Text').closest('section');
    expect(section).toBeTruthy();
    const preview = within(section as HTMLElement);

    expect(preview.getByText('Executive Summary').closest('h4')).toBeTruthy();
    expect(preview.getByText('Key Findings').closest('h4')).toBeTruthy();
    expect(preview.getByText(/This paragraph should read like normal prose/).closest('p')).toBeTruthy();
  });

  it('quarantines low-confidence PDF extraction debris in the readable preview', () => {
    render(
      <EvidenceView
        folderId="folder-1"
        folderName="Weaponized Clipboard"
        items={[
          makeEvidenceItem({
            title: 'encoded-font.pdf',
            fileName: 'encoded-font.pdf',
            fileType: 'pdf',
            mimeType: 'application/pdf',
            extractionStatus: 'partial',
            content: [
              '# Evidence: encoded-font.pdf',
              '',
              '**Extraction:** partial',
              '',
              '## Extracted Text',
              '',
              '\u00FB0\u00FF\u00D9++-\u2020\u20AC\u20AC\u20AC\u20AC\u00C8\u00DB\u00FF\u00EF w\u00FF\u00E9\u00F8hNPPPPPPPPV',
              'yyyyPPPPPPPPPQF\u00E4y0\u00C4V0PPPPPPSF9\u00C7\u0178\u00F6\u00E5aaaaaaaa\u00F0\u00FF\u00FF\u00D8',
              'Da',
              'he',
              'Conf',
              'ident',
              'al',
              'Or',
              'Hi',
              'SO',
              'TY',
              'SH',
              'EA',
              'RW',
              'TER',
              'vi',
              'er',
              'si',
              'on',
              ', VENDOR and/or its',
              'affiliates',
              'Executive Summary',
              'This cleaner sentence is still useful.',
            ].join('\n'),
          }),
        ]}
        onImportFiles={vi.fn(async () => [])}
        onOpenChat={vi.fn()}
      />,
    );

    const section = screen.getByText('Readable PDF Text').closest('section');
    expect(section).toBeTruthy();
    const previewText = section?.textContent || '';

    expect(previewText).toContain('PDF text extraction looks low-confidence');
    expect(previewText).toContain('VENDOR and/or its');
    expect(previewText).toContain('Executive Summary');
    expect(previewText).not.toContain('\u00FB0\u00FF\u00D9');
    expect(screen.getByText(/Raw PDF extraction is hidden/)).toBeInTheDocument();
    expect(screen.queryByText('Raw Inspect')).not.toBeInTheDocument();
  });

  it('filters readable preview lines with boolean inspect queries when the switch is on', async () => {
    render(
      <EvidenceView
        folderId="folder-1"
        folderName="Weaponized Clipboard"
        items={[
          makeEvidenceItem({
            content: [
              '# Evidence: weaponized-clipboard.rtf',
              '',
              '**Extraction:** extracted',
              '',
              '## Extracted Text',
              '',
              'Cloud Object Storage console repo',
              'VENDOR database wallet path',
              'Microsoft cloud tenant address',
            ].join('\n'),
          }),
        ]}
        onImportFiles={vi.fn(async () => [])}
        onOpenChat={vi.fn()}
      />,
    );

    const input = screen.getByLabelText('Search inspected evidence');
    fireEvent.change(input, { target: { value: 'cloud OR microsoft' } });
    await act(async () => {
      vi.advanceTimersByTime(800);
    });

    fireEvent.click(screen.getByLabelText('Filter inspect preview to matching lines and rows'));

    const section = screen.getByText('Readable RTF Text').closest('section');
    expect(section).toBeTruthy();
    const preview = within(section as HTMLElement);
    const previewText = section?.textContent || '';

    expect(previewText).toContain('Cloud Object Storage console repo');
    expect(previewText).toContain('Microsoft cloud tenant address');
    expect(previewText).not.toContain('VENDOR database wallet path');
    expect(preview.getByText(/Showing 2 of 3 visible lines/)).toBeInTheDocument();
  });
});

describe('EvidenceView TLP classification', () => {
  it('shows a TLP chip and colored border on a classified evidence card, matching the level', () => {
    render(
      <EvidenceView
        folderId="folder-1"
        folderName="Weaponized Clipboard"
        items={[makeEvidenceItem({ clsLevel: 'TLP:RED' })]}
        onImportFiles={vi.fn(async () => [])}
        onOpenChat={vi.fn()}
      />,
    );

    const card = document.querySelector('article[data-tlp="TLP:RED"]') as HTMLElement | null;
    expect(card).not.toBeNull();
    expect(card!.style.borderColor).toBe('rgb(239, 68, 68)'); // getTlpBorderColor('TLP:RED')
    expect(within(card!).getByText('TLP:RED')).toBeInTheDocument();
  });

  it('omits the chip and data-tlp for unclassified evidence', () => {
    render(
      <EvidenceView
        folderId="folder-1"
        folderName="Weaponized Clipboard"
        items={[makeEvidenceItem()]}
        onImportFiles={vi.fn(async () => [])}
        onOpenChat={vi.fn()}
      />,
    );

    const card = document.querySelector('article') as HTMLElement | null;
    expect(card).not.toBeNull();
    expect(card!.hasAttribute('data-tlp')).toBe(false);
    expect(card!.style.borderColor).toBe('');
  });

  it('omits the chip for TLP:CLEAR (not a meaningful classification signal)', () => {
    render(
      <EvidenceView
        folderId="folder-1"
        folderName="Weaponized Clipboard"
        items={[makeEvidenceItem({ clsLevel: 'TLP:CLEAR' })]}
        onImportFiles={vi.fn(async () => [])}
        onOpenChat={vi.fn()}
      />,
    );

    expect(screen.queryByText('TLP:CLEAR')).not.toBeInTheDocument();
  });
});
