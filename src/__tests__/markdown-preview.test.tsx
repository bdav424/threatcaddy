import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { MarkdownPreview } from '../components/Notes/MarkdownPreview';

describe('MarkdownPreview selection mirror', () => {
  it('marks a single selected word inside markdown formatting', () => {
    const content = 'Alpha **Beta** gamma';
    const start = content.indexOf('Beta');
    const end = start + 'Beta'.length;

    const { container } = render(
      <MarkdownPreview
        content={content}
        selectionMirror={{ enabled: true, start, end }}
      />
    );

    const mark = container.querySelector('mark.markdown-selection-mirror');
    expect(mark?.textContent).toBe('Beta');
    expect(mark?.closest('strong')?.textContent).toBe('Beta');
  });

  it('marks selected markdown text in the rendered preview', () => {
    const content = '# Alpha\n\nBeta **Gamma** delta';
    const start = content.indexOf('Beta');
    const end = content.indexOf(' delta');

    const { container } = render(
      <MarkdownPreview
        content={content}
        selectionMirror={{ enabled: true, start, end }}
      />
    );

    const marks = Array.from(container.querySelectorAll('mark.markdown-selection-mirror'));
    const markText = marks.map((mark) => mark.textContent).join(' ');

    expect(marks.length).toBeGreaterThan(0);
    expect(markText).toContain('Beta');
    expect(markText).toContain('Gamma');
  });

  it('uses source position to choose the matching repeated preview text', () => {
    const content = 'repeat\n\nmiddle repeat\n\nlast repeat';
    const start = content.indexOf('repeat', content.indexOf('middle'));
    const end = start + 'repeat'.length;

    const { container } = render(
      <MarkdownPreview
        content={content}
        selectionMirror={{ enabled: true, start, end }}
      />
    );

    const mark = container.querySelector('mark.markdown-selection-mirror');
    expect(mark?.closest('p')?.textContent).toBe('middle repeat');
  });

  it('leaves the preview untouched when the mirror is disabled', () => {
    const content = 'Alpha **Beta**';
    const start = content.indexOf('Beta');
    const end = start + 'Beta'.length;

    const { container } = render(
      <MarkdownPreview
        content={content}
        selectionMirror={{ enabled: false, start, end }}
      />
    );

    expect(container.querySelector('mark.markdown-selection-mirror')).toBeNull();
  });
});
