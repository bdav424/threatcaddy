# CaddyAI VirusTotal Threat Intelligence Package

Status: v1 implementation guide

Primary goal: teach CaddyAI and ThreatCaddy analysts to use VirusTotal as
read-only enrichment and pivot telemetry, then corroborate findings with
Flashpoint, Censys, internal case evidence, and analyst judgment.

## Operating Principles

- VirusTotal is not a final verdict engine. Treat engine detections, labels,
  comments, and relationships as evidence that needs context.
- Keep v1 read-only. Do not submit files or URLs, vote, comment, rescan, create
  Livehunt or Retrohunt jobs, or mutate VT Graph state.
- Separate claims:
  - File or URL maliciousness
  - Malware family confidence
  - Actor attribution
  - Infrastructure relationship
  - Victim or brand relevance
- Promote an IOC only when the pivot has case relevance, not merely because it
  appears in a relationship table.
- Stop or narrow live testing on HTTP 429. Treat it as quota exhaustion, not as
  an analyst failure.

## CaddyAI Commands

| Command | Agent Host skill | Use |
| --- | --- | --- |
| `/vt <ioc>` | `virustotal_ioc_report` | Single read-only report for IP, domain, URL, or hash. |
| `/vt-hunt <ioc>` | `virustotal_ioc_bundle` | Report plus curated relationships for analyst pivots. |
| `/vt-search <query>` | `virustotal_search_collection` | Bounded VT Intelligence search with cursor preservation. |
| `/all <ioc>` | VT plus Censys for IPs | Run compatible deterministic sources and skip incompatible ones. |

Optional command hints:

```text
/vt-hunt bad.example relationships:resolutions,communicating_files limit:10
/vt-search engines:"akira" limit:10 cursor:<vt-cursor>
```

## vt.compact.v1 Output Contract

Higher-level VirusTotal package tools return `vt.compact.v1`:

```json
{
  "schema_version": "vt.compact.v1",
  "mode": "report_bundle | relationship_bundle | search | batch | analyst_packet",
  "query": {},
  "limits": {},
  "counts": {},
  "results": [],
  "triage_summary": {},
  "pagination": {},
  "errors": [],
  "caveat": "VirusTotal is enrichment telemetry; corroborate before attribution or blocking decisions."
}
```

CaddyAI renders this into:

- Verdict summary
- Result summaries
- Relationship pivot rows
- Analyst packet guidance
- Pagination/cursor details
- Warnings and source caveats
- Recommended next pivots

Raw `last_analysis_results` and raw vendor response bodies should not be shown
by default.

## IOC Playbooks

### Hash

1. Run `/vt <hash>` for the baseline report.
2. If suspicious or unclear, run `/vt-hunt <hash>`.
3. Review:
   - Detection ratio and suspicious vendor names
   - Popular threat classification
   - Meaningful name, file type, size, and first submission timing
   - Contacted domains/IPs/URLs
   - Dropped files, execution parents, bundled files
4. Promote:
   - C2 domains/IPs seen across multiple suspicious files
   - Downloaded or dropped files that align to the case timeline
5. Hold:
   - Single-engine or generic detections
   - Common CDNs, resolvers, cloud services, or sinkholes
6. Discard:
   - Benign libraries, shared infrastructure, unrelated parent files

### IP Address

1. Run `/vt <ip>`.
2. For an IP hunt, use `/vt-hunt <ip> relationships:resolutions,communicating_files,historical_ssl_certificates`.
3. Pivot to Censys when the IP may be infrastructure:
   - `/censys <ip>`
4. Review:
   - Resolved domains and timing
   - Communicating files
   - Certificates
   - AS owner and country
   - Current exposed services in Censys
5. Avoid attributing shared hosting, public resolvers, CDN edges, or cloud IPs
   to an actor without additional evidence.

### Domain

1. Run `/vt <domain>`.
2. Use `/vt-hunt <domain>` for resolutions, communicating files, subdomains,
   historical SSL certificates, and referrer files.
3. Promote domains when they share:
   - Rare naming patterns
   - Reused certificates
   - Shared communicating files
   - Timeline alignment with the case
4. Pivot resolved IPs into Censys only after filtering obvious benign hosting.
5. Pivot actor, victim, brand, or leak claims into Flashpoint.

### URL

1. Run `/vt <url>`.
2. Use `/vt-hunt <url> relationships:network_location,last_serving_ip_address,redirects_to,redirecting_urls,downloaded_files`.
3. Review:
   - Redirect chain
   - Downloaded files
   - Serving IP/domain
   - Final landing page and lure theme
4. Promote only stable, case-relevant infrastructure or files.

## Cross-Source Pivot Map

| VT signal | Censys pivot | Flashpoint pivot | ThreatCaddy action |
| --- | --- | --- | --- |
| Resolved IP | Host exposure, services, certificates, banners | Mentions of IP/domain in reports or source chatter | Add candidate IOC only after relevance is validated. |
| Communicating file | C2 infrastructure validation | Malware family or campaign reporting | Create note linking hash and infra with confidence. |
| Threat label | None by itself | Search family/actor reporting | Treat as family candidate, not attribution. |
| Certificate | Hosts sharing cert | Brand/actor reporting around cert CN/SAN | Add task to validate cluster ownership. |
| URL redirect/download | Serving host, TLS, web title | Lure, credential, victim, or marketplace mentions | Create timeline event if it matches observed activity. |
| VT search row | Expand with `/vt-hunt` | Corroborate campaign language | Hold until a concrete case link exists. |

## Confidence Rubric

High confidence:

- Multiple independent signals converge.
- VT relationships are coherent with internal telemetry or case timeline.
- Censys validates matching infrastructure exposure.
- Flashpoint or another source corroborates the family, campaign, victim, or
  actor claim.

Medium confidence:

- VT shows meaningful detections and coherent related objects.
- At least one external source supports the interpretation.
- Some timeline or infrastructure fit exists, but gaps remain.

Low confidence:

- Single-engine detections.
- Generic labels such as trojan, malware, phishing, suspicious.
- Relationship-only pivots with no case relevance.
- Actor claims from a single comment, tag, filename, or vendor label.

Use confidence per claim. One IOC can be high-confidence malicious while actor
attribution remains low confidence.

## Promote, Hold, Discard

Promote to ThreatCaddy IOC when:

- The indicator appears in internal telemetry, case notes, or timeline evidence.
- VT relationships connect it to suspicious files or infrastructure in the case.
- Censys or Flashpoint corroborates the role of the infrastructure or source
  claim.

Hold as candidate pivot when:

- The indicator is related in VT but not yet observed in the case.
- The relationship is plausible but broad.
- Quota, entitlement, or partial errors prevented a complete view.

Discard or suppress when:

- The pivot is common shared infrastructure with no suspicious context.
- The only signal is a weak or generic label.
- The object is unrelated by time, victimology, lure theme, or infrastructure
  pattern.

## Example Analyst Output

```markdown
## VT Triage: bad.example

Evidence:
- VT verdict summary: 0 malicious, 1 suspicious, 0 clean, 0 unknown
- Relationship pivots:
  - bad.example -> resolutions: 1 returned (203.0.113.10 [ip_address])
  - bad.example -> communicating_files: 1 returned (<sha256> [file] label=testloader)

Assessment:
- Infrastructure suspicion: medium confidence.
- Malware family: low confidence until the communicating file is reviewed.
- Actor attribution: not assessed from VT alone.

Next actions:
- Run /censys 203.0.113.10 to validate current exposure and certificate reuse.
- Search Flashpoint for bad.example and the candidate family label.
- Promote 203.0.113.10 only if it appears in case telemetry or corroborating reporting.
```

## Evaluation Checklist

- `/vt <ioc>` returns compact evidence and caveats.
- `/vt-hunt <ioc>` renders relationship rows, not raw JSON.
- `/vt-search <query>` preserves cursor and bounded result count.
- `/all <domain>` runs VT and skips Censys with a clear reason.
- Agent profiles expose safe `host__cti__virustotal_*` tools, not raw request
  tools.
- No vendor API keys appear in logs, prompts, docs, tests, or fixtures.
- Tests cover URL ID encoding, relationship slug validation, error propagation,
  quota handling, collection rendering, and profile tool access.

## Source References

- VirusTotal API v3 relationships: https://docs.virustotal.com/reference/relationships
- VirusTotal quota handling: https://docs.virustotal.com/docs/consumption-quotas-handled
- VirusTotal false-positive guidance: https://docs.virustotal.com/docs/false-positive
- VirusTotal how submissions work: https://docs.virustotal.com/docs/how-it-works
- VirusTotal Livehunt: https://docs.virustotal.com/docs/livehunt
- VirusTotal Retrohunt: https://docs.virustotal.com/docs/retrohunt
