import { describe, expect, it } from 'vitest';
import { buildTemplateBackedDocxBytes, deriveDocxTemplate, extractDocxTemplateProfile } from '../lib/docx-template-renderer';
import type { ProductFigureUpload } from '../types';

describe('docx template renderer', () => {
  it('replaces the main document body while preserving section furniture', () => {
    const template = buildStoredZip([
      {
        path: '[Content_Types].xml',
        content: '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>',
      },
      {
        path: 'word/document.xml',
        content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    <w:p><w:r><w:t>Old template content</w:t></w:r></w:p>
    <w:tbl><w:tblPr><w:tblStyle w:val="BaselineTable"/><w:tblW w:w="0" w:type="auto"/></w:tblPr><w:tr><w:tc><w:p><w:r><w:t>Old table</w:t></w:r></w:p></w:tc></w:tr></w:tbl>
    <w:sectPr><w:headerReference w:type="default" r:id="rIdHeader"/><w:footerReference w:type="default" r:id="rIdFooter"/><w:pgSz w:w="12240" w:h="15840"/></w:sectPr>
  </w:body>
</w:document>`,
      },
      {
        path: 'word/header1.xml',
        content: '<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:r><w:t>Confidential - Restricted</w:t></w:r></w:p></w:hdr>',
      },
    ]);
    const rendered = buildTemplateBackedDocxBytes(template, [
      '# Seedworm Intrusion Activity',
      '',
      'Analyst-ready executive summary.',
      '',
      '## Selected Indicators',
      '',
      '| Type | Value |',
      '| --- | --- |',
      '| domain | timetrakr.cloud |',
    ].join('\n'));
    const documentXml = readZipText(rendered, 'word/document.xml');
    const headerXml = readZipText(rendered, 'word/header1.xml');

    expect(documentXml).toContain('Seedworm Intrusion Activity');
    expect(documentXml).toContain('Analyst-ready executive summary.');
    expect(documentXml).toContain('Selected Indicators');
    expect(documentXml).toContain('timetrakr.cloud');
    expect(documentXml).toContain('BaselineTable');
    expect(documentXml).toContain('rIdHeader');
    expect(documentXml).not.toContain('Old template content');
    expect(headerXml).toContain('Confidential - Restricted');
  });

  it('uses Intel Note role anchors instead of carrying stale baseline body text', () => {
    const template = buildStoredZip([
      {
        path: '[Content_Types].xml',
        content: '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>',
      },
      {
        path: 'word/document.xml',
        content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    <w:p><w:r><w:t>Classification: TLP Amber</w:t></w:r></w:p>
    <w:p><w:r><w:t>Date: 21 May 2026</w:t></w:r></w:p>
    <w:p><w:r><w:t>Executive Summary</w:t></w:r></w:p>
    <w:p><w:r><w:t>OLD TRIFLECK EXECUTIVE TEXT</w:t></w:r></w:p>
    <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Recent Activity</w:t></w:r></w:p>
    <w:p><w:r><w:t>OLD RECENT ACTIVITY</w:t></w:r></w:p>
    <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Timeline of Significant Events</w:t></w:r></w:p>
    <w:p><w:r><w:t>Table 1: Timeline of Significant Events</w:t></w:r></w:p>
    <w:tbl><w:tblPr><w:tblStyle w:val="IntelTimeline"/><w:tblW w:w="0" w:type="auto"/></w:tblPr><w:tr><w:tc><w:p><w:r><w:t>Old event</w:t></w:r></w:p></w:tc></w:tr></w:tbl>
    <w:p><w:pPr><w:pStyle w:val="Heading1-Firstheading"/></w:pPr><w:r><w:t>Digital Identifiers</w:t></w:r></w:p>
    <w:p><w:r><w:t>Table 3: Actionable Digital Identifiers</w:t></w:r></w:p>
    <w:tbl><w:tblPr><w:tblStyle w:val="IntelIocs"/><w:tblW w:w="0" w:type="auto"/></w:tblPr><w:tr><w:tc><w:p><w:r><w:t>Old IOC</w:t></w:r></w:p></w:tc></w:tr></w:tbl>
    <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Recommendations</w:t></w:r></w:p>
    <w:p><w:pPr><w:pStyle w:val="ListBullet"/></w:pPr><w:r><w:t>OLD RECOMMENDATION</w:t></w:r></w:p>
    <w:sectPr><w:headerReference w:type="default" r:id="rIdHeader"/><w:footerReference w:type="default" r:id="rIdFooter"/></w:sectPr>
  </w:body>
</w:document>`,
      },
      {
        path: 'word/footnotes.xml',
        content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:footnotes xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:footnote w:type="separator" w:id="-1"><w:p><w:r><w:separator/></w:r></w:p></w:footnote>
  <w:footnote w:type="continuationSeparator" w:id="0"><w:p><w:r><w:continuationSeparator/></w:r></w:p></w:footnote>
  <w:footnote w:id="1"><w:p><w:r><w:t>OLD SOURCE FOOTNOTE</w:t></w:r></w:p></w:footnote>
</w:footnotes>`,
      },
    ]);
    const profile = extractDocxTemplateProfile(template);

    expect(profile.anchors.executiveSummary).toBe(true);
    expect(profile.anchors.digitalIdentifiers).toBe(true);
    expect(profile.tableCount).toBe(2);
    expect(profile.tableStyles).toContain('IntelIocs');

    const rendered = buildTemplateBackedDocxBytes(template, [
      '# Seedworm Intrusion Activity Targeting South Korean Electronics Sector',
      '',
      '**Classification:** TLP:AMBER',
      '**Date:** 25 May 2026',
      '',
      '## Executive Summary',
      '',
      'Vendor reporting described a February 2026 intrusion affecting a major South Korean electronics manufacturer.',
      '',
      '## Recent Activity',
      '',
      'Official source seed count: 16. Enriched seed count: 16.',
      '',
      '## Timeline of Significant Events',
      '',
      '| Date | Event | Source | Conf. |',
      '| --- | --- | --- | --- |',
      '| 2026-02 | Intrusion window reported | Symantec | medium |',
      '',
      '## Actionable Digital Identifiers',
      '',
      '| Type | Value | Description | Confidence |',
      '| --- | --- | --- | --- |',
      '| domain | timetrakr.cloud | Domain used for PowerShell payload retrieval. | medium |',
      '',
      '## Recommendations',
      '',
      '- Hunt exact promoted hashes and domains.',
      '',
      '## Sources',
      '',
      '- Symantec Threat Hunter Team / Security.com. See: https://www.security.com/threat-intelligence/iran-seedworm-electronics',
    ].join('\n'), 'intel-note');
    const documentXml = readZipText(rendered, 'word/document.xml');
    const footnotesXml = readZipText(rendered, 'word/footnotes.xml');

    expect(documentXml).toContain('Date: 25 May 2026');
    expect(documentXml).toContain('Vendor reporting described a February 2026 intrusion');
    expect(documentXml).toContain('Official source seed count: 16');
    expect(documentXml).toContain('timetrakr.cloud - Domain used for PowerShell payload retrieval.');
    expect(documentXml).toContain('not live validated');
    expect(documentXml).toContain('<w:gridCol w:w="1000"/>');
    expect(documentXml).toContain('<w:gridCol w:w="1600"/>');
    expect(documentXml).toContain('<w:gridCol w:w="4760"/>');
    expect(documentXml).toContain('<w:gridCol w:w="2000"/>');
    expect(documentXml).toContain('w:ascii="Aptos"');
    expect(documentXml).toContain('<w:sz w:val="21"/>');
    expect(documentXml).toContain('<w:sz w:val="19"/>');
    expect(documentXml).not.toContain('<w:sz w:val="14"/>');
    expect(documentXml).not.toContain('w:fill="F2F2F2"');
    expect(documentXml).toContain('<w:footnoteReference w:id="1"/>');
    expect(documentXml).toContain('IntelTimeline');
    expect(documentXml).toContain('IntelIocs');
    expect(documentXml).toContain('rIdHeader');
    expect(documentXml).not.toContain('OLD TRIFLECK EXECUTIVE TEXT');
    expect(documentXml).not.toContain('OLD RECENT ACTIVITY');
    expect(documentXml).not.toContain('Old IOC');
    expect(footnotesXml).toContain('Symantec Threat Hunter Team / Security.com');
    expect(footnotesXml).toContain('See: https://www.security.com/threat-intelligence/iran-seedworm-electronics');
    expect(footnotesXml).toContain('<w:vertAlign w:val="subscript"/>');
    expect(footnotesXml).toContain('<w:sz w:val="13"/>');
    expect(footnotesXml).not.toContain('OLD SOURCE FOOTNOTE');
  });
});

describe('docx template derivation (CaddyLab Stage 1 — generic docx round-trip)', () => {
  function buildArbitraryReportZip() {
    return buildStoredZip([
      {
        path: '[Content_Types].xml',
        content: '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>',
      },
      {
        path: 'word/document.xml',
        content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>Cover page preamble, no heading yet.</w:t></w:r></w:p>
    <w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t>Quarterly Threat Roundup</w:t></w:r></w:p>
    <w:p><w:r><w:t>Some intro paragraph under the title.</w:t></w:r></w:p>
    <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Overview</w:t></w:r></w:p>
    <w:p><w:r><w:rPr><w:color w:val="1F4E79"/></w:rPr><w:t>OLD overview text that should be replaced.</w:t></w:r></w:p>
    <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Notable Incidents</w:t></w:r></w:p>
    <w:tbl><w:tblPr><w:tblStyle w:val="ArbitraryTable"/><w:tblW w:w="0" w:type="auto"/></w:tblPr><w:tr><w:tc><w:tcPr><w:shd w:val="clear" w:fill="4472C4"/></w:tcPr><w:p><w:r><w:t>OLD incident row</w:t></w:r></w:p></w:tc></w:tr></w:tbl>
    <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Untouched Appendix</w:t></w:r></w:p>
    <w:p><w:r><w:t>This appendix has no matching markdown section and must survive verbatim.</w:t></w:r></w:p>
    <w:sectPr><w:pgSz w:w="12240" w:h="15840"/></w:sectPr>
  </w:body>
</w:document>`,
      },
    ]);
  }

  it('derives an ordered section map, table detection, and a color palette from an arbitrary report shape', () => {
    const template = buildArbitraryReportZip();
    const map = deriveDocxTemplate(template);

    expect(map.sections.map((s) => s.heading)).toEqual([
      'Quarterly Threat Roundup',
      'Overview',
      'Notable Incidents',
      'Untouched Appendix',
    ]);
    expect(map.sections[0].level).toBe(1); // Title
    expect(map.sections[1].level).toBe(1); // Heading1
    expect(map.sections[1].key).toBe('overview');
    expect(map.sections[2].hasTable).toBe(true);
    expect(map.sections[3].hasTable).toBe(false);
    expect(map.sections[3].paragraphCount).toBe(1);
    expect(map.tableCount).toBe(1);
    expect(map.palette.some((c) => c.hex === '#4472C4' && c.usage === 'table-header')).toBe(true);
    expect(map.palette.some((c) => c.hex === '#1F4E79' && c.usage === 'text')).toBe(true);
  });

  it('fills matched sections and leaves unmatched sections exactly as the original template had them', () => {
    const template = buildArbitraryReportZip();
    const map = deriveDocxTemplate(template);

    const rendered = buildTemplateBackedDocxBytes(template, [
      '## Overview',
      '',
      'New overview content written by the analyst.',
      '',
      '## Notable Incidents',
      '',
      '| Incident | Severity |',
      '| --- | --- |',
      '| APT phishing wave | High |',
    ].join('\n'), undefined, map);

    const documentXml = readZipText(rendered, 'word/document.xml');

    // Matched sections got new content, and the ORIGINAL heading text/style survives untouched.
    expect(documentXml).toContain('Overview');
    expect(documentXml).toContain('New overview content written by the analyst.');
    expect(documentXml).not.toContain('OLD overview text');
    expect(documentXml).toContain('Notable Incidents');
    expect(documentXml).toContain('APT phishing wave');
    expect(documentXml).not.toContain('OLD incident row');
    expect(documentXml).toContain('ArbitraryTable'); // table style cloned from the original template table

    // Unmatched section (no markdown heading for it) survives byte-for-byte.
    expect(documentXml).toContain('This appendix has no matching markdown section and must survive verbatim.');
    expect(documentXml).toContain('Untouched Appendix');

    // Preamble content before the first heading also survives untouched.
    expect(documentXml).toContain('Cover page preamble, no heading yet.');
  });
});

describe('docx figure placeholders + upload-to-format (CaddyLab Stage 3)', () => {
  function buildReportZipWithFigure() {
    return buildStoredZip([
      {
        path: '[Content_Types].xml',
        content: '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="png" ContentType="image/png"/></Types>',
      },
      {
        path: 'word/_rels/document.xml.rels',
        content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/></Relationships>',
      },
      {
        path: 'word/media/image1.png',
        content: 'ORIGINAL-SOURCE-REPORT-IMAGE-BYTES',
      },
      {
        path: 'word/document.xml',
        content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
  <w:body>
    <w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t>Quarterly Threat Roundup</w:t></w:r></w:p>
    <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Overview</w:t></w:r></w:p>
    <w:p><w:r><w:t>OLD overview text that should be replaced.</w:t></w:r></w:p>
    <w:p><w:r><w:drawing><wp:inline><wp:extent cx="914400" cy="609600"/><a:graphic><a:graphicData><pic:pic><pic:blipFill><a:blip r:embed="rId5"/></pic:blipFill></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>
    <w:p><w:pPr><w:pStyle w:val="Caption"/></w:pPr><w:r><w:t>Figure 1: Sample Screenshot</w:t></w:r></w:p>
    <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Notable Incidents</w:t></w:r></w:p>
    <w:p><w:r><w:t>Some incident narrative.</w:t></w:r></w:p>
    <w:sectPr><w:pgSz w:w="12240" w:h="15840"/></w:sectPr>
  </w:body>
</w:document>`,
      },
    ]);
  }

  it('derives a figure spec (section, caption, size, relationship id) from a real embedded image', () => {
    const template = buildReportZipWithFigure();
    const map = deriveDocxTemplate(template);

    expect(map.figures).toHaveLength(1);
    const figure = map.figures[0];
    expect(figure.relationshipId).toBe('rId5');
    expect(figure.sectionKey).toBe('overview');
    expect(figure.caption).toBe('Figure 1: Sample Screenshot');
    expect(figure.widthEmu).toBe(914400);
    expect(figure.heightEmu).toBe(609600);
    expect(map.figurePlaceholderCount).toBe(1);
  });

  it('emits a [Figure: pending] placeholder when generating with no uploaded image', () => {
    const template = buildReportZipWithFigure();
    const map = deriveDocxTemplate(template);

    const rendered = buildTemplateBackedDocxBytes(template, [
      '## Overview',
      '',
      'New overview content written by the analyst.',
    ].join('\n'), undefined, map);
    const documentXml = readZipText(rendered, 'word/document.xml');

    expect(documentXml).toContain('[Figure: pending — Figure 1: Sample Screenshot]');
    expect(documentXml).not.toContain('r:embed="rId5"');
    expect(documentXml).toContain('New overview content written by the analyst.');
  });

  it('pours an uploaded image into the figure, preserving the template frame and adding a fresh media part', () => {
    const template = buildReportZipWithFigure();
    const map = deriveDocxTemplate(template);
    const figureKey = map.figures[0].key;
    const uploads: ProductFigureUpload[] = [
      { key: figureKey, name: 'screenshot.png', mimeType: 'image/png', data: btoa('ANALYST-UPLOADED-IMAGE-BYTES') },
    ];

    const rendered = buildTemplateBackedDocxBytes(template, [
      '## Overview',
      '',
      'New overview content written by the analyst.',
    ].join('\n'), undefined, map, uploads);
    const documentXml = readZipText(rendered, 'word/document.xml');
    const relsXml = readZipText(rendered, 'word/_rels/document.xml.rels');

    expect(documentXml).not.toContain('[Figure: pending');
    expect(documentXml).not.toContain('r:embed="rId5"'); // repointed at the new relationship
    expect(documentXml).toContain('<wp:extent cx="914400" cy="609600"/>'); // frame untouched — "auto-formats"
    const newRelId = documentXml.match(/r:embed="([^"]+)"/)?.[1];
    expect(newRelId).toBeTruthy();
    expect(relsXml).toContain(`Id="${newRelId}"`);
    expect(relsXml).toContain(`Target="media/figure-${figureKey}.png"`);

    const uploadedMedia = readZipText(rendered, `word/media/figure-${figureKey}.png`);
    expect(uploadedMedia).toBe('ANALYST-UPLOADED-IMAGE-BYTES');

    // The original template's own source image is left in place, untouched, just unreferenced.
    const originalMedia = readZipText(rendered, 'word/media/image1.png');
    expect(originalMedia).toBe('ORIGINAL-SOURCE-REPORT-IMAGE-BYTES');
  });
});

function buildStoredZip(files: Array<{ path: string; content: string }>): Uint8Array {
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
    centralView.setUint32(42, offset, true);
    central.set(name, 46);
    centralParts.push(central);

    offset += local.length + data.length;
  }

  const centralSize = centralParts.reduce((total, part) => total + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);
  return concat([...localParts, ...centralParts, end]);
}

function readZipText(bytes: Uint8Array, path: string): string {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let offset = bytes.length - 22; offset >= 0; offset -= 1) {
    if (view.getUint32(offset, true) !== 0x06054b50) continue;
    const total = view.getUint16(offset + 10, true);
    let centralOffset = view.getUint32(offset + 16, true);
    for (let index = 0; index < total; index += 1) {
      const nameLength = view.getUint16(centralOffset + 28, true);
      const extraLength = view.getUint16(centralOffset + 30, true);
      const commentLength = view.getUint16(centralOffset + 32, true);
      const localOffset = view.getUint32(centralOffset + 42, true);
      const name = new TextDecoder().decode(bytes.slice(centralOffset + 46, centralOffset + 46 + nameLength));
      if (name === path) {
        const localNameLength = view.getUint16(localOffset + 26, true);
        const localExtraLength = view.getUint16(localOffset + 28, true);
        const dataLength = view.getUint32(localOffset + 18, true);
        const dataStart = localOffset + 30 + localNameLength + localExtraLength;
        return new TextDecoder().decode(bytes.slice(dataStart, dataStart + dataLength));
      }
      centralOffset += 46 + nameLength + extraLength + commentLength;
    }
  }
  throw new Error(`Missing ${path}`);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

const CRC32_TABLE = new Uint32Array(256).map((_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
  return value >>> 0;
});

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
