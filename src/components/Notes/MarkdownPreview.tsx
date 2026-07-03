import { useMemo, useCallback } from 'react';
import { renderMarkdown, sanitizeHtml } from '../../lib/markdown';
import type { WikiLinkTarget } from '../../lib/markdown';
import { extractIOCs, refangToDefanged } from '../../lib/ioc-extractor';
import type { Note, IOCEntry } from '../../types';

const NETWORK_IOC_TYPES = new Set(['url', 'domain', 'ipv4', 'ipv6', 'email']);
const SELECTION_START_TOKEN = 'TCSELECTIONMIRRORSTART9F6B2D';
const SELECTION_END_TOKEN = 'TCSELECTIONMIRROREND9F6B2D';

interface MarkdownPreviewProps {
  content: string;
  defanged?: boolean;
  allNotes?: Note[];
  onNavigateToNote?: (noteId: string) => void;
  /** Pre-extracted IOCs — avoids redundant extraction when available */
  iocs?: IOCEntry[];
  selectionMirror?: MarkdownSelectionMirror;
}

export interface MarkdownSelectionMirror {
  enabled: boolean;
  start: number;
  end: number;
}

interface MarkerPosition {
  node: Text;
  nodeIndex: number;
  index: number;
}

function insertSelectionMarkers(content: string, start: number, end: number): string {
  return `${content.slice(0, start)}${SELECTION_START_TOKEN}${content.slice(start, end)}${SELECTION_END_TOKEN}${content.slice(end)}`;
}

function getTextNodes(root: HTMLElement): Text[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    nodes.push(node);
  }
  return nodes;
}

function findMarkerPosition(
  nodes: Text[],
  token: string,
  after?: { nodeIndex: number; offset: number }
): MarkerPosition | null {
  for (let nodeIndex = 0; nodeIndex < nodes.length; nodeIndex += 1) {
    if (after && nodeIndex < after.nodeIndex) continue;
    const fromIndex = after && nodeIndex === after.nodeIndex ? after.offset : 0;
    const index = (nodes[nodeIndex].nodeValue ?? '').indexOf(token, fromIndex);
    if (index !== -1) return { node: nodes[nodeIndex], nodeIndex, index };
  }
  return null;
}

function stripSelectionTokens(container: HTMLElement) {
  for (const node of getTextNodes(container)) {
    node.nodeValue = (node.nodeValue ?? '')
      .replaceAll(SELECTION_START_TOKEN, '')
      .replaceAll(SELECTION_END_TOKEN, '');
  }

  for (const element of Array.from(container.querySelectorAll('*'))) {
    for (const attr of Array.from(element.attributes)) {
      if (!attr.value.includes(SELECTION_START_TOKEN) && !attr.value.includes(SELECTION_END_TOKEN)) continue;
      element.setAttribute(
        attr.name,
        attr.value.replaceAll(SELECTION_START_TOKEN, '').replaceAll(SELECTION_END_TOKEN, '')
      );
    }
  }
}

function wrapTextRange(node: Text, start: number, end: number) {
  if (!node.parentNode) return;
  const safeStart = Math.max(0, Math.min(start, node.length));
  const safeEnd = Math.max(0, Math.min(end, node.length));
  if (safeStart >= safeEnd) return;

  const range = document.createRange();
  range.setStart(node, safeStart);
  range.setEnd(node, safeEnd);

  const mark = document.createElement('mark');
  mark.className = 'markdown-selection-mirror';
  mark.setAttribute('data-selection-mirror', 'true');
  range.surroundContents(mark);
}

function applySelectionMirror(html: string): string {
  if (typeof document === 'undefined') return html;

  const container = document.createElement('div');
  container.innerHTML = html;

  const markerNodes = getTextNodes(container);
  const startMarker = findMarkerPosition(markerNodes, SELECTION_START_TOKEN);
  if (!startMarker) {
    stripSelectionTokens(container);
    return container.innerHTML;
  }

  const endMarker = findMarkerPosition(markerNodes, SELECTION_END_TOKEN, {
    nodeIndex: startMarker.nodeIndex,
    offset: startMarker.index + SELECTION_START_TOKEN.length,
  });
  if (!endMarker) {
    stripSelectionTokens(container);
    return container.innerHTML;
  }

  let startOffset = startMarker.index;
  let endOffset = endMarker.index;

  endMarker.node.nodeValue = (endMarker.node.nodeValue ?? '').replace(SELECTION_END_TOKEN, '');
  startMarker.node.nodeValue = (startMarker.node.nodeValue ?? '').replace(SELECTION_START_TOKEN, '');

  if (startMarker.node === endMarker.node && endMarker.index > startMarker.index) {
    endOffset -= SELECTION_START_TOKEN.length;
  }

  const textNodes = getTextNodes(container);
  const startNodeIndex = textNodes.indexOf(startMarker.node);
  const endNodeIndex = textNodes.indexOf(endMarker.node);
  if (startNodeIndex === -1 || endNodeIndex === -1 || startNodeIndex > endNodeIndex) {
    stripSelectionTokens(container);
    return container.innerHTML;
  }

  if (startNodeIndex === endNodeIndex) {
    wrapTextRange(startMarker.node, startOffset, endOffset);
    return container.innerHTML;
  }

  for (let nodeIndex = endNodeIndex; nodeIndex >= startNodeIndex; nodeIndex -= 1) {
    const node = textNodes[nodeIndex];
    const rangeStart = nodeIndex === startNodeIndex ? startOffset : 0;
    const rangeEnd = nodeIndex === endNodeIndex ? endOffset : node.length;
    wrapTextRange(node, rangeStart, rangeEnd);
  }

  return container.innerHTML;
}

export function MarkdownPreview({ content, defanged, allNotes, onNavigateToNote, iocs: preExtractedIOCs, selectionMirror }: MarkdownPreviewProps) {
  const wikiLinkTargets = useMemo<WikiLinkTarget[] | undefined>(() => {
    if (!allNotes) return undefined;
    return allNotes
      .filter((n) => !n.trashed)
      .map((n) => ({ id: n.id, title: n.title }));
  }, [allNotes]);

  const html = useMemo(() => {
    const selectionStart = Math.max(0, Math.min(selectionMirror?.start ?? 0, selectionMirror?.end ?? 0, content.length));
    const selectionEnd = Math.max(0, Math.min(Math.max(selectionMirror?.start ?? 0, selectionMirror?.end ?? 0), content.length));
    const shouldMirrorSelection = Boolean(selectionMirror?.enabled && selectionStart !== selectionEnd && content.slice(selectionStart, selectionEnd).trim());
    let src = shouldMirrorSelection ? insertSelectionMarkers(content, selectionStart, selectionEnd) : content;

    const applyNetworkDefanging = (value: string, networkValues: string[]) => {
      let nextValue = value;
      for (const networkValue of networkValues) {
        nextValue = nextValue.replaceAll(networkValue, refangToDefanged(networkValue));
      }
      return nextValue;
    };

    if (defanged) {
      // Use pre-extracted IOCs if available, otherwise extract (cached)
      const iocs = preExtractedIOCs ?? extractIOCs(content);
      const networkValues = iocs
        .filter((i) => NETWORK_IOC_TYPES.has(i.type))
        .map((i) => i.value);
      networkValues.sort((a, b) => b.length - a.length);
      src = applyNetworkDefanging(src, networkValues);
    }

    const rendered = renderMarkdown(src, wikiLinkTargets);
    if (!shouldMirrorSelection) return rendered;
    // applySelectionMirror injects <mark> elements into already-sanitized HTML.
    // Re-sanitize so DOMPurify.sanitize() is always the last step before
    // dangerouslySetInnerHTML — correct order: applySelectionMirror → sanitize.
    return sanitizeHtml(applySelectionMirror(rendered));
  }, [
    content,
    defanged,
    wikiLinkTargets,
    preExtractedIOCs,
    selectionMirror?.enabled,
    selectionMirror?.start,
    selectionMirror?.end,
  ]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!onNavigateToNote) return;
    const target = (e.target as HTMLElement).closest('a[data-note-link="true"]');
    if (!target) return;
    e.preventDefault();
    const noteId = target.getAttribute('data-note-id');
    if (noteId) onNavigateToNote(noteId);
  }, [onNavigateToNote]);

  return (
    <div
      className="markdown-preview text-gray-200 prose-invert"
      dangerouslySetInnerHTML={{ __html: html }}
      onClick={handleClick}
    />
  );
}
