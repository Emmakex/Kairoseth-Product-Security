# CRA Compliance Operating Model

## Purpose

CRA OS is the first compliance solution built on Kairoseth Product Security. This document defines how CRA-related logic is represented operationally.

It is an engineering and product contract, not legal advice.

## Regulatory baseline

Current official EU baseline used by the product:

- CRA entered into force: 10 December 2024.
- Article 14 reporting obligations apply from: 11 September 2026.
- General CRA application date: 11 December 2027.
- Manufacturers must report actively exploited vulnerabilities and severe incidents affecting product security through the CRA reporting framework.
- Initial reporting can require an early warning within 24 hours after awareness and a fuller notification within 72 hours.
- Final-report timing depends on the event type and corrective-action timeline.

Official sources:

- https://digital-strategy.ec.europa.eu/en/policies/cyber-resilience-act
- https://digital-strategy.ec.europa.eu/en/policies/cra-reporting
- https://digital-strategy.ec.europa.eu/en/factpages/cyber-resilience-act-implementation
- https://www.enisa.europa.eu/topics/product-security

Regulatory sources and interpretations must be versioned. The engine must be able to show which rule set and source references supported a result.

## Operating principle

CRA OS transforms product-security evidence into a controlled regulatory workflow:

```text
technical signal
      ↓
product/release correlation
      ↓
assessment
      ↓
CRA rule evaluation
      ↓
potential obligation
      ↓
human review where required
      ↓
incident workflow + deadlines
      ↓
reporting package
      ↓
explicit authorized submission step
```

No vulnerability scanner result directly creates a final legal conclusion.

## Scope model

Each Product has a CRA scope state:

```text
unknown
likely_in_scope
likely_out_of_scope
in_scope_confirmed
out_of_scope_confirmed
needs_legal_review
```

Scope decisions record:

```text
operator role
product type
commercial context
remote processing relevance
open-source/commercial context
classification inputs
source references
rule-set version
review state
```

The engine may suggest a scope outcome, but ambiguous cases must remain reviewable.

## Economic operator role

The product model must be able to represent at least:

```text
manufacturer
importer
distributor
open_source_software_steward
other / unknown
```

The exact obligations depend on role and context. Role is therefore an explicit input, not inferred from repository ownership.

## Reporting trigger model

A CRA reporting workflow is never triggered solely because a CVE exists.

The system evaluates a chain such as:

```text
known vulnerability / incident signal
        ↓
product affected?
        ↓
release(s) affected?
        ↓
active exploitation / severe incident evidence?
        ↓
product CRA scope?
        ↓
operator role applicable?
        ↓
rule evaluation
        ↓
potential reporting obligation
```

Each transition must retain source evidence and reason codes.

## Awareness timestamp

The awareness timestamp is legally/operationally sensitive and must be treated as controlled data.

Required attributes:

```text
awarenessAt
awarenessSource
establishedBy
establishedAt
ruleSetVersion
notes?
```

The system must distinguish:

```text
first machine observation
first human review
organization awareness timestamp
```

These values may differ. The system must not silently assume that scanner ingestion time equals legal awareness time.

## Deadlines

Deadline records are derived, auditable objects.

```text
deadlineId
incidentId
kind
baseTimestamp
ruleId
ruleSetVersion
dueAt
status
createdAt
```

Initial supported kinds should include:

```text
early_warning
full_notification
final_report
internal_review
```

The 24-hour and 72-hour clocks must be computed from the rule-defined awareness point and stored with provenance.

## Article 14 Incident Center

The Incident Center is the first operational CRA workflow.

Suggested state model:

```text
OPEN
  ↓
TRIAGE
  ↓
POTENTIAL_CRA_REPORTING
  ↓
CRA_REVIEW
  ├── NOT_REPORTABLE → CONTINUE_SECURITY_RESPONSE / CLOSE
  └── REPORTABLE
         ↓
EARLY_WARNING_PREPARATION
         ↓
EARLY_WARNING_APPROVED
         ↓
FULL_NOTIFICATION_PREPARATION
         ↓
FULL_NOTIFICATION_APPROVED
         ↓
REMEDIATION
         ↓
FINAL_REPORT_PREPARATION
         ↓
CLOSED
```

A workflow state indicates internal operational state. It must not falsely claim that a report reached ENISA/CSIRT unless submission evidence exists.

## Reporting packages

CRA OS prepares structured packages for review.

A reporting package should contain or reference:

```text
organization / operator context
product identity
affected releases
incident/vulnerability identity
timeline
awareness record
technical impact
known exploitation context
risk analysis
mitigation / corrective action
customer/user impact where relevant
source evidence
approvals
rule-set version
```

Packages are immutable after approval. Corrections create a new revision linked to the prior package.

## Submission boundary

MVP design:

```text
prepare
→ validate
→ authorized human review
→ export / guided submission
→ store submission evidence
```

Do not assume a stable public ENISA submission API unless officially documented and technically verified.

If automated submission becomes supported later, it requires a dedicated architecture/security review and explicit customer authorization.

## Evidence requirements

Each material CRA decision should be traceable to evidence.

Examples:

- vulnerability-source snapshot;
- affected component occurrence;
- exact release/commit;
- SBOM revision;
- exploitability evidence;
- incident timeline;
- mitigation commit/release;
- customer advisory;
- reporting package;
- submission receipt/evidence.

## Deterministic rules vs AI

Deterministic/rule-driven:

- scope workflow branching;
- deadline calculation;
- required fields;
- state transitions;
- authorization;
- evidence references;
- immutable revisioning;
- validation gates.

AI-assisted:

- summarization;
- explanation;
- draft rationale;
- draft reporting narrative;
- missing-evidence suggestions;
- incident timeline synthesis.

An LLM must never be the only source for a regulatory fact or deadline.

## Rule-set versioning

Every evaluation records:

```text
ruleSetVersion
sourceRefs
softwareVersion
inputsHash
result
reasonCodes
evaluatedAt
```

When regulatory guidance changes, historical evaluations remain linked to the previous rule set. Re-evaluation creates a new evaluation rather than rewriting the past.

## Product claims boundary

The product may claim that it:

- organizes CRA evidence;
- evaluates configured CRA rules;
- tracks deadlines;
- prepares reporting packages;
- provides source-backed workflow support.

It must not claim that:

- using the software guarantees CRA compliance;
- an AI output constitutes legal advice;
- a scanner finding automatically proves reportability;
- a prepared package was submitted without submission evidence;
- regulatory authorities have endorsed Kairoseth unless explicitly true and documented.