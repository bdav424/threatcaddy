# Internal Intel Note Reporting Procedure

This procedure is for AI reporters and maintainers producing analyst-style intelligence notes from ThreatCaddy investigations, daily country-hunt automation runs, or ad hoc CTI reporting.

The central rule: **an Internal intel note is a template-fidelity task, not generic DOCX generation.** The output must look and behave like the existing Internal report family.

## Known-Good Local Samples

Use these samples when available:

- `/Users/brdavies/Downloads/Internal Intel Note_GitHub Supply Chain Breach_22May.docx`
- `/Users/brdavies/Downloads/Internal Intel Note TeamPCP Megalodon report.docx`
- Any prior TeamPCP/Internal intel note supplied in Downloads or the active run package.

If more than one sample exists, prefer the one closest to the topic and section shape. For GitHub supply-chain reporting, the GitHub Supply Chain Breach sample is the best current pattern.

## Required Workflow

1. Inspect the sample before writing:
   - paragraph styles
   - heading hierarchy
   - title/date/classification treatment
   - caption placement
   - table count and geometry
   - table colors and row padding
   - source-note markers and `See:` source notes
   - header/footer, logo, and theme elements

2. Treat the sample as a locked visual template:
   - remove old report text
   - insert the new investigation text into existing formatted slots
   - preserve the existing section rhythm and visual hierarchy
   - avoid rebuilding tables or styles unless the template lacks a needed slot

3. Preserve source-note formatting:
   - keep superscript-style body markers such as `1` or `¹`
   - keep matching `See: <source>` notes
   - do not replace marked source notes with a generic Sources section unless the sample already uses that convention

4. Preserve table patterns:
   - keep table colors, captions, widths, padding, and row spacing
   - for GitHub supply-chain notes, prefer the two-column IOC table pattern: `IOC Type` / `IOC Value`
   - do not add new Notes columns, duplicate table cells, or change geometry without a written reason

5. Preserve topic-appropriate subheads:
   - under `Recent Activity`, keep lower-level subheads from the sample where useful
   - for GitHub supply-chain notes, expected subheads may include `GitHub Intrusion Disclosure`, `Megalodon CI/CD Malware Campaign`, `Malware Functionality and Objectives`, and `Assessment`

6. Keep noisy working data out of customer-facing notes:
   - do not include broad GitHub owner, business-candidate, or affected-repository tables unless explicitly requested
   - keep those in CSVs, ledgers, appendices, or internal working notes with caveats

## Jinja Role

Jinja is allowed for repeatable content assembly and validation, but it is not the visual template.

Use Jinja to produce structured section text, source references, IOC rows, and context JSON. The final DOCX must still be placed into the known-good Word note format and visually checked against the sample.

## QA Gate

Fail the report QA if any of these appear:

- generated note looks like a new generic report instead of the supplied Internal template
- malformed table geometry
- unintended extra columns
- duplicated cell content
- missing table header labels
- missing captions
- missing source markers or missing `See:` source notes
- source notes converted into generic bullets when the sample uses marked source notes
- title/date/classification treatment differs from the sample without a written reason
- noisy repository-owner or affected-business candidate tables appear in the customer-facing note without explicit user request
- customer-facing note says the product is a test, automation run, capability exercise, or ThreatCaddy workflow

If Word or visual rendering is unavailable, mark layout QA as incomplete, record the exact blocker, and preserve a follow-up task for local visual validation.

## Daily Country-Hunt Automation

Daily ThreatCaddy country-hunt runs must follow this procedure when producing Word-ready Internal notes. The run package should also update `Word_Render_QA_Checklist.md`, `Process_Kit.md`, and the automation update recommendation when a formatting defect or template rule changes.
