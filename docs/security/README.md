# Security Documentation — consolidated elsewhere

The firm's security policies are **firm-level** and are maintained in one place:

**`the-one-process/docs/security/`**

Every `.md` file in this directory is now a pointer to its canonical counterpart. They
are kept rather than deleted so that anyone working in this repository is told where the
policy lives and why it moved.

## Why

Nine policies existed in both repositories and **all nine had diverged.** Asked "what is
your incident response plan?", the firm had two different answers — 141 lines here
against 336 lines there, the shorter one missing every amended Regulation S-P
requirement. They were not simply stale copies: several were genuinely different
documents describing different systems, which is why consolidation separated firm-level
requirements (stated once) from system-specific facts (stated in a per-system section of
the relevant policy).

Consolidated 2026-08-05 to 2026-08-06. Each canonical document's review history records
what changed and what was corrected.

## What stays here

`docs/information-security-program.md` — a technical system profile for Portfolio
Architect covering its data inventory, access enforcement, incident detection signals,
retention behaviour and known gaps. It is an appendix, not a competing policy, and is
referenced from the canonical WISP.

`GCP-[FALL-2025] GCP SOC 2 Report..pdf` — vendor evidence, duplicated in both
repositories by design so it is available wherever it is needed.

## Do not reintroduce a local copy

If a policy needs to say something specific to Portfolio Architect, add it to that
policy's system-specific section in the canonical location. A second copy in this
repository will diverge again — that is what created the problem being unwound here.
