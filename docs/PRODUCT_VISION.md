# Product Vision

## Product thesis

Kairoseth Product Security is a continuous product-security operating layer. Its first solution, **CRA OS**, helps organizations turn technical product activity into traceable security and regulatory evidence.

The product is not positioned as another vulnerability scanner. It consumes scanner and repository signals, correlates them with product/release context, preserves evidence and drives regulated workflows.

## Core value proposition

```text
repo + release + SBOM + vulnerabilities + product context
                    ↓
             impact and risk
                    ↓
             CRA obligations
                    ↓
        evidence + actions + deadlines
                    ↓
            reporting package
```

The system should answer questions such as:

- Which products and releases are affected by this vulnerability?
- Is the vulnerable component actually present in the released product?
- What evidence existed when the organization became aware?
- Which decision was made, by whom and based on which sources?
- Does the event potentially activate a CRA reporting workflow?
- What deadlines are running?
- Which corrective release resolved the issue?
- Which evidence proves remediation and closure?

## Initial target market

The initial wedge is software-oriented manufacturers and producers selling into the EU, especially teams that have repositories and release pipelines but limited dedicated product-security/compliance staff.

Priority profiles:

1. commercial WordPress plugin vendors;
2. PrestaShop module vendors;
3. B2B software products;
4. distributed software / desktop products;
5. SDK/API products that include distributed components;
6. SaaS businesses with CRA-relevant product elements;
7. later: IoT, firmware and industrial products.

The initial product must not overfit to WordPress or PrestaShop. Those are commercial entry verticals, not architecture boundaries.

## Product layers

```text
Kairoseth Product Security
│
├── Product Inventory
├── Release Intelligence
├── SBOM Intelligence
├── Vulnerability Operations
├── Product Risk
├── Evidence Graph
├── Incident Operations
└── Compliance Solutions
    └── CRA OS
```

Future compliance mappings may reuse the same evidence and product-security graph without changing the core identity.

## Product boundaries

Kairoseth Product Security does not initially aim to:

- replace source-code hosting;
- replace SAST/DAST/SCA vendors;
- perform autonomous exploitation;
- retain customer source code after analysis;
- make unreviewed legal determinations;
- submit regulatory notifications without explicit authorized human action;
- become a general SOC/SIEM platform;
- become a generic enterprise GRC system.

## Strategic moat

Commodity capabilities such as SBOM generation, CVE lookup or LLM document generation are not sufficient differentiation.

The long-term moat is the **Product Security Evidence Graph**: a durable history connecting products, releases, components, vulnerabilities, decisions, risks, controls, incidents, remediation and evidence.

Example:

```text
Product
  ↓
Release 4.3.1
  ↓
SBOM
  ↓
Component openssl@x
  ↓
Vulnerability
  ↓
Exploitability decision
  ↓
Risk
  ↓
CRA rule / workflow
  ↓
Incident
  ↓
Corrective release
  ↓
Evidence
```

The historical graph should become increasingly valuable over time and difficult to reconstruct elsewhere.

## First moment of value

The first product experience should be simple:

```text
Connect GitHub
      ↓
Select repository
      ↓
Kairoseth inventories releases
      ↓
Generates SBOM
      ↓
Correlates vulnerabilities
      ↓
Shows affected product/release context
      ↓
Creates evidence baseline
```

The user should see useful product-security state before being asked to configure complex compliance machinery.

## CRA OS positioning

Customer-facing message:

> Connect your product. Kairoseth continuously maintains its product-security evidence, vulnerability context and CRA workflow.

CRA OS is an operational system, not a one-time readiness report.

## Human authority

AI assistance may:

- summarize vulnerability context;
- explain dependency impact;
- propose risk rationale;
- draft incident timelines;
- draft customer advisories;
- draft CRA reporting packages;
- identify missing evidence.

AI assistance may not independently:

- grant product access;
- decide tenant scope;
- mark a legal obligation as final without deterministic rules and/or authorized human validation;
- submit reports;
- delete regulatory evidence;
- override deadlines;
- alter immutable historical evidence.

## Success criteria for v1

A v1 is useful when an authorized customer can:

1. connect a repository;
2. associate it with a product;
3. inventory releases;
4. generate a CycloneDX SBOM;
5. see correlated vulnerability findings;
6. understand which releases are affected;
7. preserve source-backed evidence;
8. open a CRA-relevant incident workflow;
9. track deadlines/actions;
10. prepare a reviewable reporting package.

Anything beyond these capabilities is secondary until this loop is reliable.