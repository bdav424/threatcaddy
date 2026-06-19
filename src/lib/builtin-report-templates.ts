import type { ReportTemplate } from '../types';

// ---------------------------------------------------------------------------
// Shared Nunjucks bodyTemplate fragments
// Whitespace control: trimBlocks + lstripBlocks are set on the global env
// (report-template-renderer.ts), so block tags don't produce stray blank lines.
// ---------------------------------------------------------------------------

const TIMELINE_BODY = `\
{% if timeline | length > 0 %}
{% for event in timeline %}
- **{{ event.timestamp }}** — {{ event.title }}{% if event.description %}: {{ event.description }}{% endif %}{% if event.actor %} *(Actor: {{ event.actor }})*{% endif %}
{% endfor %}
{% else %}
*No timeline events recorded in this investigation.*
{% endif %}`;

const IOC_TABLE_BODY = `\
{% if iocs | length > 0 %}
| Indicator | Type | Confidence | Tags |
|-----------|------|------------|------|
{% for ioc in iocs %}
| \`{{ ioc.value }}\` | {{ ioc.type }} | {{ ioc.confidence }} | {{ ioc.tags | join(", ") or "—" }} |
{% endfor %}
{% else %}
*No indicators of compromise recorded in this investigation.*
{% endif %}`;

const TASKS_BODY = `\
{% if tasks | length > 0 %}
| Task | Status | Priority | Due |
|------|--------|----------|-----|
{% for task in tasks %}
| {{ task.title }} | {{ task.status }} | {{ task.priority or "—" }} | {{ task.dueDate or "—" }} |
{% endfor %}
{% else %}
*No tasks recorded for this investigation.*
{% endif %}`;

// ---------------------------------------------------------------------------
// Builtin templates
// ---------------------------------------------------------------------------

export const BUILTIN_REPORT_TEMPLATES: readonly ReportTemplate[] = [
  // ── 1. Incident Report ──────────────────────────────────────────────────
  {
    id: 'rt-incident-report',
    name: 'Incident Report',
    description: 'Standard incident report covering timeline, impact, IOCs, and remediation.',
    icon: '🚨',
    category: 'Incident Response',
    sections: [
      {
        id: 's1', title: 'Executive Summary', order: 0,
        placeholder: 'One-paragraph summary of the incident, impact, and current status.',
        entityHints: [],
      },
      {
        id: 's2', title: 'Incident Timeline', order: 1,
        placeholder: 'Chronological sequence of events from initial detection to containment.',
        bodyTemplate: TIMELINE_BODY,
        entityHints: ['timeline'],
      },
      {
        id: 's3', title: 'Affected Systems & Scope', order: 2,
        placeholder: 'List of affected hosts, networks, accounts, and data categories.',
        entityHints: ['notes'],
      },
      {
        id: 's4', title: 'Indicators of Compromise', order: 3,
        placeholder: 'IOCs observed during the investigation: IPs, domains, hashes, URLs.',
        bodyTemplate: IOC_TABLE_BODY,
        entityHints: ['iocs'],
      },
      {
        id: 's5', title: 'Root Cause Analysis', order: 4,
        placeholder: 'How the attacker gained initial access and what vulnerabilities were exploited.',
        entityHints: ['notes'],
      },
      {
        id: 's6', title: 'Containment & Eradication', order: 5,
        placeholder: 'Actions taken to stop the attack and remove the threat from the environment.',
        bodyTemplate: TASKS_BODY,
        entityHints: ['tasks'],
      },
      {
        id: 's7', title: 'Recommendations', order: 6,
        placeholder: 'Short-term tactical mitigations and long-term strategic improvements.',
        entityHints: [],
      },
      {
        id: 's8', title: 'Appendix', order: 7,
        placeholder: 'Supporting evidence, raw logs, or technical artifacts.',
        entityHints: ['notes'],
      },
    ],
    source: 'builtin',
    createdAt: 0,
    updatedAt: 0,
  },

  // ── 2. Threat Intelligence Report ───────────────────────────────────────
  {
    id: 'rt-threat-intel',
    name: 'Threat Intelligence Report',
    description: 'Structured CTI report with actor profile, TTPs, and infrastructure analysis.',
    icon: '🔍',
    category: 'Threat Intelligence',
    sections: [
      {
        id: 's1', title: 'Key Findings', order: 0,
        placeholder: 'Three to five bullet points summarizing the most important findings.',
        entityHints: [],
      },
      {
        id: 's2', title: 'Threat Actor Profile', order: 1,
        placeholder: 'Attribution confidence, known aliases, motivation, and target sectors.',
        entityHints: ['notes'],
      },
      {
        id: 's3', title: 'Campaign Overview', order: 2,
        placeholder: 'Observed campaign activity, timeframe, and geographic focus.',
        bodyTemplate: TIMELINE_BODY,
        entityHints: ['timeline'],
      },
      {
        id: 's4', title: 'Malware & Tooling', order: 3,
        placeholder: 'Tools, malware families, and custom implants used in the campaign.',
        entityHints: ['iocs'],
      },
      {
        id: 's5', title: 'MITRE ATT&CK Mapping', order: 4,
        placeholder: 'Observed techniques mapped to ATT&CK tactics.',
        entityHints: ['notes'],
      },
      {
        id: 's6', title: 'Infrastructure Analysis', order: 5,
        placeholder: 'C2 infrastructure, hosting providers, and operational patterns.',
        bodyTemplate: IOC_TABLE_BODY,
        entityHints: ['iocs', 'graph'],
      },
      {
        id: 's7', title: 'Detection Guidance', order: 6,
        placeholder: 'YARA rules, Sigma rules, network signatures, and behavioral detections.',
        entityHints: ['notes'],
      },
      {
        id: 's8', title: 'Confidence Assessment', order: 7,
        placeholder: 'Overall confidence in attribution and key judgments with supporting rationale.',
        entityHints: [],
      },
    ],
    source: 'builtin',
    createdAt: 0,
    updatedAt: 0,
  },

  // ── 3. Executive Brief ──────────────────────────────────────────────────
  {
    id: 'rt-executive-brief',
    name: 'Executive Brief',
    description: 'Short, non-technical brief for leadership covering impact and business risk.',
    icon: '📋',
    category: 'Executive',
    sections: [
      {
        id: 's1', title: 'Situation', order: 0,
        placeholder: 'What happened, in plain language. One to two sentences.',
        entityHints: [],
      },
      {
        id: 's2', title: 'Business Impact', order: 1,
        placeholder: 'What was affected — data, operations, customers, regulatory exposure.',
        entityHints: ['notes'],
      },
      {
        id: 's3', title: 'Current Status', order: 2,
        placeholder: 'Is the threat contained? What is still at risk?',
        entityHints: [],
      },
      {
        id: 's4', title: 'Actions Taken', order: 3,
        placeholder: 'What has the security team done so far to respond.',
        bodyTemplate: TASKS_BODY,
        entityHints: ['tasks'],
      },
      {
        id: 's5', title: 'Next Steps', order: 4,
        placeholder: 'Decisions or resources needed from leadership.',
        entityHints: ['tasks'],
      },
    ],
    source: 'builtin',
    createdAt: 0,
    updatedAt: 0,
  },

  // ── 4. Vulnerability Assessment ─────────────────────────────────────────
  {
    id: 'rt-vulnerability-assessment',
    name: 'Vulnerability Assessment',
    description: 'Structured vulnerability report with severity ratings and remediation tracking.',
    icon: '🛡️',
    category: 'Vulnerability Management',
    sections: [
      {
        id: 's1', title: 'Assessment Scope', order: 0,
        placeholder: 'Systems and applications assessed, assessment methodology, and timeframe.',
        entityHints: [],
      },
      {
        id: 's2', title: 'Critical & High Findings', order: 1,
        placeholder: 'CVEs and vulnerabilities rated Critical or High with CVSS scores.',
        bodyTemplate: IOC_TABLE_BODY,
        entityHints: ['iocs', 'notes'],
      },
      {
        id: 's3', title: 'Medium Findings', order: 2,
        placeholder: 'Medium-severity vulnerabilities.',
        entityHints: ['notes'],
      },
      {
        id: 's4', title: 'Remediation Plan', order: 3,
        placeholder: 'Prioritized remediation steps with owners and target dates.',
        bodyTemplate: TASKS_BODY,
        entityHints: ['tasks'],
      },
      {
        id: 's5', title: 'Metrics', order: 4,
        placeholder: 'Total vulnerabilities by severity, mean time to patch, patch coverage.',
        entityHints: [],
      },
    ],
    source: 'builtin',
    createdAt: 0,
    updatedAt: 0,
  },

  // ── 5. Annual Threat Landscape Report ───────────────────────────────────
  {
    id: 'rt-annual-threat-landscape',
    name: 'Annual Threat Landscape Report',
    description: 'Year-in-review threat landscape covering attack patterns, sector analysis, and actor trends.',
    icon: '📊',
    category: 'Strategic Intelligence',
    sections: [
      {
        id: 's1', title: 'Executive Summary', order: 0,
        placeholder: 'Three to five sentences: overall threat posture shift, standout trends, and strategic implications for the coming year.',
        entityHints: [],
      },
      {
        id: 's2', title: 'Global Threat Overview', order: 1,
        placeholder: 'Year-over-year incident volume, primary attack vectors, and geographic distribution of threat activity.',
        entityHints: ['notes'],
      },
      {
        id: 's3', title: 'Sector Threat Breakdown', order: 2,
        placeholder: 'Per-sector analysis: attack frequency, primary patterns, actor motivation, and data targeted.',
        bodyTemplate: `\
{% set sectors = ["Financial Services", "Healthcare & Life Sciences", "Manufacturing", "Public Sector & Government", "Education", "Technology & Software", "Retail & E-commerce", "Energy & Utilities"] %}
{% for sector in sectors %}
### {{ sector }}

| Attribute | Finding |
|-----------|---------|
| **Attack Frequency** | [Relative to prior period: ↑ Increased / ↓ Decreased / ↔ Stable] |
| **Primary Patterns** | [e.g., Social Engineering, System Intrusion, Ransomware] |
| **Threat Actors** | [Named groups or categories — e.g., FIN7, nation-state APT, opportunistic] |
| **Actor Motivation** | [Financial / Espionage / Disruption / Hacktivism] |
| **Data Types Targeted** | [e.g., PII, PHI, Credentials, Intellectual Property, Financial Records] |
| **YoY Trend Note** | [Key change vs. prior period in one sentence] |

**Analyst Summary:** [Insert distinguishing characteristic or standout risk for this sector.]

---
{% endfor %}`,
        entityHints: ['notes'],
      },
      {
        id: 's4', title: 'Top Attack Patterns', order: 3,
        placeholder: 'Analysis of the most prevalent attack patterns ranked by frequency.',
        bodyTemplate: `\
{% set patterns = ["Social Engineering", "System Intrusion", "Basic Web Application Attacks", "Denial of Service", "Lost & Stolen Assets", "Miscellaneous Errors", "Privilege Misuse", "Supply Chain Compromise"] %}
{% for pattern in patterns %}
### {{ pattern }}

| Attribute | Detail |
|-----------|--------|
| **Frequency Rank** | [Rank {{ loop.index }} of {{ patterns | length }}] |
| **Industries Most Affected** | [List affected sectors] |
| **Primary Sub-techniques** | [List common sub-techniques or variants] |
| **YoY Change** | [↑ / ↓ / ↔ vs. prior period] |
| **Notable Example** | [Brief description of a representative case, anonymized] |

{% endfor %}`,
        entityHints: ['notes', 'timeline'],
      },
      {
        id: 's5', title: 'Threat Actor Landscape', order: 4,
        placeholder: 'Overview of observed actor categories — nation-state, cybercriminal, hacktivist — and key groups.',
        bodyTemplate: `\
{% set categories = ["Nation-State / Espionage", "Organized Crime / Financial", "Ransomware Affiliates", "Hacktivists", "Insider Threats", "Opportunistic / Script-Kiddie"] %}
{% for category in categories %}
### {{ category }}

| Attribute | Detail |
|-----------|--------|
| **Activity Level** | [High / Medium / Low vs. prior period] |
| **Primary Targets** | [Sectors or verticals] |
| **Observed Tools** | [Known malware families or toolkits] |
| **Geographic Origin** | [Assessed country of origin, if known] |
| **Key Attribution Note** | [Confidence level and reasoning] |

{% endfor %}`,
        entityHints: ['notes'],
      },
      {
        id: 's6', title: 'Key Indicators from Investigation', order: 5,
        placeholder: 'Indicators of compromise observed during this investigation period.',
        bodyTemplate: IOC_TABLE_BODY,
        entityHints: ['iocs'],
      },
      {
        id: 's7', title: 'Timeline of Notable Events', order: 6,
        placeholder: 'Significant incidents and disclosures observed during the reporting period.',
        bodyTemplate: TIMELINE_BODY,
        entityHints: ['timeline'],
      },
      {
        id: 's8', title: 'Data Compromise Analysis', order: 7,
        placeholder: 'Types of data compromised across incidents: PII, PHI, credentials, IP, financial records. Volume and regulatory impact.',
        entityHints: ['notes'],
      },
      {
        id: 's9', title: 'Year-in-Review Metrics', order: 8,
        placeholder: 'Summary statistics for the reporting period.',
        bodyTemplate: `\
| Metric | Value |
|--------|-------|
| **Total Incidents Analyzed** | {{ totalIocCount }} indicators recorded ({{ date }}) |
| **Open Action Items** | {{ openTaskCount }} tasks outstanding |
| **Top Attack Pattern** | [Most frequent pattern] |
| **Most Targeted Sector** | [Sector name] |
| **Average Dwell Time** | [Days — calculated from timeline data] |
| **Detection Rate (Internal)** | [% of incidents detected internally] |
| **Ransomware as % of Incidents** | [%] |
| **Data Exfiltration Rate** | [% of incidents involving confirmed exfil] |`,
        entityHints: [],
      },
      {
        id: 's10', title: 'Methodology & Data Sources', order: 9,
        placeholder: 'Description of data collection methods, analysis framework, confidence levels, and scope limitations.',
        entityHints: [],
      },
    ],
    source: 'builtin',
    createdAt: 0,
    updatedAt: 0,
  },

  // ── 6. Adversary Threat Report ───────────────────────────────────────────
  {
    id: 'rt-adversary-threat-report',
    name: 'Adversary Threat Report',
    description: 'Deep-dive actor profile covering campaign activity, tooling, and victimology.',
    icon: '🎯',
    category: 'Threat Intelligence',
    sections: [
      {
        id: 's1', title: 'Intelligence Summary', order: 0,
        placeholder: 'Two to three paragraphs: actor overview, primary motivation, and impact to the reader\'s environment. Written for a senior security audience.',
        entityHints: [],
      },
      {
        id: 's2', title: 'Actor Profile', order: 1,
        placeholder: 'Structured actor attributes: aliases, nation-state or criminal nexus, motivation, sophistication, and operational tempo.',
        bodyTemplate: `\
| Attribute | Assessment |
|-----------|------------|
| **Primary Name / Alias** | [Actor name used in this report] |
| **Other Known Aliases** | [Additional tracking names across vendors] |
| **Suspected Origin** | [Country or region — note confidence level] |
| **Attribution Confidence** | [High / Medium / Low — explain basis] |
| **Motivation** | [Espionage / Financial / Disruption / Hacktivism] |
| **Sophistication** | [Advanced / Intermediate / Basic] |
| **Target Sectors** | [Primary and secondary verticals] |
| **Geographic Focus** | [Regions primarily targeted] |
| **First Observed** | [Date or quarter/year] |
| **Last Active** | [Date or "Ongoing"] |
| **Active Since** | [Reporting period under analysis] |

**Background:** [Two to three sentences providing historical context for this actor.]`,
        entityHints: ['notes'],
      },
      {
        id: 's3', title: 'Campaign Activity', order: 2,
        placeholder: 'Observed campaign phases from initial access through objective completion.',
        bodyTemplate: TIMELINE_BODY,
        entityHints: ['timeline'],
      },
      {
        id: 's4', title: 'Malware & Tooling', order: 3,
        placeholder: 'Malware families, open-source tools, living-off-the-land binaries, and custom implants observed.',
        bodyTemplate: IOC_TABLE_BODY,
        entityHints: ['iocs'],
      },
      {
        id: 's5', title: 'Infrastructure Analysis', order: 4,
        placeholder: 'C2 domains and IPs, hosting providers, registrar patterns, and infrastructure reuse across campaigns.',
        bodyTemplate: `\
{% if iocs | length > 0 %}
{% set network_types = ["ip", "domain", "url", "cidr"] %}
{% set network_iocs = [] %}
{% for ioc in iocs %}
{% if ioc.type in network_types %}
{% set _ = network_iocs.append(ioc) %}
{% endif %}
{% endfor %}
{% if network_iocs | length > 0 %}
| Indicator | Type | First Seen | Last Seen | Notes |
|-----------|------|------------|-----------|-------|
{% for ioc in network_iocs %}
| \`{{ ioc.value }}\` | {{ ioc.type }} | {{ ioc.firstSeen or "—" }} | {{ ioc.lastSeen or "—" }} | {{ ioc.analystNotes or "—" }} |
{% endfor %}
{% else %}
*No network-layer indicators recorded in this investigation.*
{% endif %}
{% else %}
*No indicators of compromise recorded in this investigation.*
{% endif %}`,
        entityHints: ['iocs', 'graph'],
      },
      {
        id: 's6', title: 'MITRE ATT&CK Mapping', order: 5,
        placeholder: `Map observed actor behaviors to MITRE ATT&CK tactics and techniques.

| Tactic | Technique ID | Technique Name | Observed Behavior |
|--------|-------------|----------------|-------------------|
| Initial Access | T1566 | Phishing | [Describe observed phishing lures] |
| Execution | T1059 | Command and Scripting Interpreter | [Scripting language used] |
| Persistence | [ID] | [Technique] | [Observed behavior] |
| Privilege Escalation | [ID] | [Technique] | [Observed behavior] |
| Defense Evasion | [ID] | [Technique] | [Observed behavior] |
| Credential Access | [ID] | [Technique] | [Observed behavior] |
| Discovery | [ID] | [Technique] | [Observed behavior] |
| Lateral Movement | [ID] | [Technique] | [Observed behavior] |
| Collection | [ID] | [Technique] | [Observed behavior] |
| Exfiltration | [ID] | [Technique] | [Observed behavior] |`,
        entityHints: ['notes'],
      },
      {
        id: 's7', title: 'Victimology', order: 6,
        placeholder: 'Sectors, geographies, and organization profiles targeted by this actor.',
        bodyTemplate: `\
{% set regions = ["North America", "Europe", "Asia-Pacific", "Middle East & Africa", "Latin America"] %}
{% for region in regions %}
### {{ region }}

| Attribute | Detail |
|-----------|--------|
| **Targeting Activity** | [High / Medium / Low / Not observed] |
| **Primary Sectors** | [Industries targeted in this region] |
| **Notable Campaigns** | [Campaign names or identifiers, if any] |
| **Estimated Victim Count** | [Approximate number, if assessable] |
| **Trend vs. Prior Period** | [↑ Increasing / ↓ Decreasing / ↔ Stable] |

{% endfor %}`,
        entityHints: ['notes'],
      },
      {
        id: 's8', title: 'Intelligence Confidence Assessment', order: 7,
        placeholder: 'Confidence ratings and key uncertainties for each major judgment in this report.',
        bodyTemplate: `\
| Judgment | Confidence | Key Assumptions | Gaps |
|----------|------------|-----------------|------|
| Actor identity / attribution | [High/Medium/Low] | [List key assumptions] | [What would change this assessment] |
| Motivation assessment | [High/Medium/Low] | [List key assumptions] | [What would change this assessment] |
| Target sector analysis | [High/Medium/Low] | [List key assumptions] | [What would change this assessment] |
| Infrastructure attribution | [High/Medium/Low] | [List key assumptions] | [What would change this assessment] |
| Timeline accuracy | [High/Medium/Low] | [List key assumptions] | [What would change this assessment] |

**Overall Report Confidence:** [Aggregate confidence level and brief rationale]`,
        entityHints: [],
      },
    ],
    source: 'builtin',
    createdAt: 0,
    updatedAt: 0,
  },

  // ── 7. Incident Response Trends Report ──────────────────────────────────
  {
    id: 'rt-ir-trends-report',
    name: 'Incident Response Trends Report',
    description: 'IR caseload analysis covering attacker methodology, dwell time, and industry patterns.',
    icon: '📈',
    category: 'Incident Response',
    sections: [
      {
        id: 's1', title: 'Key Findings', order: 0,
        placeholder: 'Four to six numbered findings that represent the most significant IR trends observed in this reporting period.',
        entityHints: [],
      },
      {
        id: 's2', title: 'Global Incident Landscape', order: 1,
        placeholder: 'Total engagements analyzed, geographic distribution, primary incident types, and industry breakdown. Include year-over-year comparison where available.',
        bodyTemplate: `\
| Metric | Value |
|--------|-------|
| **Reporting Period** | {{ date }} |
| **Investigation Name** | {{ investigation.name }} |
| **Total IOCs Recorded** | {{ totalIocCount }} |
| **Open Tasks** | {{ openTaskCount }} |
| **Primary Incident Type** | [Fill in] |
| **Geographic Focus** | [Fill in] |
| **YoY Volume Change** | [↑ / ↓ / ↔] |`,
        entityHints: ['notes'],
      },
      {
        id: 's3', title: 'Attack Lifecycle Analysis', order: 2,
        placeholder: 'Breakdown of attacker activity by kill-chain phase, from initial access to post-compromise objectives.',
        bodyTemplate: TIMELINE_BODY,
        entityHints: ['timeline'],
      },
      {
        id: 's4', title: 'Indicator of Compromise Summary', order: 3,
        placeholder: 'IOCs observed across IR engagements, categorized by type and confidence.',
        bodyTemplate: IOC_TABLE_BODY,
        entityHints: ['iocs'],
      },
      {
        id: 's5', title: 'Industry-Specific Threat Patterns', order: 4,
        placeholder: 'Breakdown of threat actor activity and incident patterns by industry vertical.',
        bodyTemplate: `\
{% set sectors = ["Financial Services", "Healthcare & Life Sciences", "Manufacturing", "Public Sector & Government", "Professional Services", "Technology", "Retail", "Education"] %}
{% for sector in sectors %}
### {{ sector }}

| Attribute | Finding |
|-----------|---------|
| **Most Common Initial Access** | [Phishing / Exposed RDP / Supply Chain / Other] |
| **Primary Threat Category** | [Ransomware / BEC / Espionage / Insider] |
| **Mean Dwell Time** | [Days — or "Not assessed"] |
| **Data at Risk** | [PII / PHI / Credentials / IP / Financial] |
| **Trend vs. Prior Period** | [↑ / ↓ / ↔ + brief note] |

{% endfor %}`,
        entityHints: ['notes'],
      },
      {
        id: 's6', title: 'Attacker Methodology & Dwell Time', order: 5,
        placeholder: 'Analysis of how attackers gained initial access, moved laterally, and achieved objectives. Include mean dwell time, detection source breakdown (internal vs. external), and time-to-contain.',
        bodyTemplate: `\
## Initial Access Vectors

| Vector | % of Cases | Notes |
|--------|-----------|-------|
| Phishing / Spearphishing | [%] | [Key observation] |
| Exposed Remote Services (RDP/VPN) | [%] | [Key observation] |
| Supply Chain Compromise | [%] | [Key observation] |
| Exploited Public-Facing Application | [%] | [Key observation] |
| Valid Credentials (Stolen/Purchased) | [%] | [Key observation] |
| Other | [%] | [Key observation] |

## Dwell Time Distribution

| Dwell Time Range | % of Cases |
|-----------------|-----------|
| < 1 day | [%] |
| 1–7 days | [%] |
| 8–30 days | [%] |
| 31–90 days | [%] |
| > 90 days | [%] |

**Median Dwell Time:** [X days]
**Mean Dwell Time:** [X days]

## Detection Source

| Source | % of Cases |
|--------|-----------|
| Internal security controls | [%] |
| Third-party notification | [%] |
| Ransom notification / extortion | [%] |
| Law enforcement notification | [%] |`,
        entityHints: ['timeline', 'notes'],
      },
      {
        id: 's7', title: 'ATT&CK Mapping Appendix', order: 6,
        placeholder: `MITRE ATT&CK technique coverage across analyzed incidents.

> **Note:** Populate this section by mapping observed attacker behaviors to ATT&CK technique IDs.
> Reference: https://attack.mitre.org

| Tactic | Technique ID | Technique Name | Frequency | Notes |
|--------|-------------|----------------|-----------|-------|
| Initial Access | T1566 | Phishing | [Count] | [Note] |
| Initial Access | T1190 | Exploit Public-Facing Application | [Count] | [Note] |
| Execution | T1059 | Command and Scripting Interpreter | [Count] | [Note] |
| Persistence | T1053 | Scheduled Task/Job | [Count] | [Note] |
| Privilege Escalation | T1068 | Exploitation for Privilege Escalation | [Count] | [Note] |
| Defense Evasion | T1027 | Obfuscated Files or Information | [Count] | [Note] |
| Credential Access | T1003 | OS Credential Dumping | [Count] | [Note] |
| Discovery | T1083 | File and Directory Discovery | [Count] | [Note] |
| Lateral Movement | T1021 | Remote Services | [Count] | [Note] |
| Collection | T1005 | Data from Local System | [Count] | [Note] |
| Exfiltration | T1041 | Exfiltration Over C2 Channel | [Count] | [Note] |
| Impact | T1486 | Data Encrypted for Impact | [Count] | [Note] |`,
        entityHints: ['notes'],
      },
      {
        id: 's8', title: 'Strategic Recommendations', order: 7,
        placeholder: 'Prioritized recommendations for improving detection, response, and resilience based on observed trends.',
        bodyTemplate: `\
{% if tasks | length > 0 %}
## Tracked Action Items

| Action | Status | Priority | Due |
|--------|--------|----------|-----|
{% for task in tasks %}
| {{ task.title }} | {{ task.status }} | {{ task.priority or "—" }} | {{ task.dueDate or "—" }} |
{% endfor %}

---
{% endif %}
## General Recommendations

| Priority | Recommendation | Rationale |
|----------|---------------|-----------|
| Critical | Enforce MFA on all remote access | Reduces risk from credential-based initial access |
| Critical | Patch internet-facing systems within 24h of critical CVE | Addresses most common exploitation vector |
| High | Deploy EDR on all endpoints | Improves detection of post-exploitation activity |
| High | Conduct phishing simulation quarterly | Addresses top initial access vector |
| Medium | Implement network segmentation | Limits lateral movement dwell time |
| Medium | Establish IR retainer with external responders | Reduces time-to-contain in major incidents |
| Low | Conduct tabletop exercise with executive leadership | Ensures decision-making readiness |`,
        entityHints: ['tasks'],
      },
    ],
    source: 'builtin',
    createdAt: 0,
    updatedAt: 0,
  },
];
