# AI Research Synthesis Engine

## What is this project?

Academic researchers and knowledge workers face a fundamental problem: the volume of published research has grown beyond what any individual can reasonably read. A single research question may touch dozens or hundreds of papers spread across multiple databases, journals, and preprint servers. Reading, extracting, comparing, and synthesizing all of them manually takes weeks — and even then, human reviewers miss connections, overlook contradictions, and struggle to maintain consistent citation discipline.

This project is a software platform that automates that entire process. A researcher provides a question. The system finds the relevant papers, reads them, extracts what each one claims, compares those claims across sources, and produces a structured research brief — with every single statement in that brief traced back to a specific passage in a specific paper.

---

## The core problem

There are two distinct problems this project solves.

**The volume problem.** There is simply too much to read. A researcher trying to understand the current state of knowledge on any active topic cannot be expected to locate, download, read, and manually synthesize 50+ papers. The time cost is prohibitive. Most knowledge work therefore proceeds on incomplete information — researchers read what they can, cite what they remember, and miss what they never found.

**The trust problem.** Existing AI tools can summarize documents and answer questions, but they hallucinate — they produce confident-sounding claims that have no basis in the source material. For academic and scientific work, a fabricated citation is not a minor error. It is a fundamental failure. Any tool that cannot guarantee every output claim traces to a real source passage is not useful for serious research work.

This project must solve both problems simultaneously. Speed without traceability is not acceptable. Traceability without speed provides no advantage over manual review.

---

## What the platform does

### Paper discovery

Given a research question in natural language, the system searches academic databases and returns a ranked list of relevant papers. The ranking reflects genuine relevance to the query, not recency or citation count alone. The system must return useful results for questions phrased in everyday language, not just precise academic terminology.

### Document ingestion

Papers retrieved from databases or uploaded directly as PDFs are processed into structured representations. For each paper, the system identifies and separately stores the abstract, methodology, key findings, limitations, and conclusion. The raw text is also chunked in a way that preserves section context — so any passage can later be attributed not just to a paper but to the specific section and page it came from.

### Claim extraction

The system reads each ingested paper and extracts individual factual claims as discrete, attributable units. Each claim is classified by type:

- **Finding** — a result the authors report as observed or measured
- **Hypothesis** — a proposition the authors suggest but have not established
- **Limitation** — a constraint, caveat, or acknowledged weakness of the study

Every claim carries its source metadata: which paper, which section, which page. This tagging is what makes citation traceability possible downstream.

### Cross-source synthesis

With claims extracted from all papers, the system groups related claims by topic and compares them across sources. Three relationships are identified:

- **Agreement** — multiple papers report consistent findings on the same point
- **Contradiction** — papers report conflicting findings on the same point
- **Thin evidence** — only one or two papers address a particular point, indicating the field has not studied it sufficiently

Surfacing contradictions is particularly important. A planted contradiction in a test set — where one paper's finding directly conflicts with another's — must be correctly detected and flagged, not silently averaged away.

### Research brief generation

The system produces a structured document containing:

- An executive summary answering the research question at a high level
- Key findings organized by theme, not by paper
- Areas of consensus where the evidence is strong and consistent
- Open questions where papers contradict or where evidence is thin
- Recommended next papers for deeper investigation on specific sub-topics

Every sentence in the brief that makes a factual claim must be sourced. The system does not add claims from its own background knowledge. If a statement cannot be grounded in a retrieved passage, it does not appear in the brief.

### Citation export

Every claim in the output links to the source passage it came from. This linkage is available in standard academic citation formats — APA, MLA, and BibTeX — so the brief can be used directly in academic writing without manual citation lookup.

---

## What success looks like

The platform succeeds when:

- A researcher with a genuine question gets a useful, accurate brief in minutes rather than weeks
- Every claim in that brief can be verified by clicking through to the source passage
- Contradictions between papers are surfaced explicitly rather than hidden
- A domain expert reviewing the brief finds it coherent, accurate, and useful as a starting point for deeper work
- No claim in the output is fabricated or unsourced

The platform fails if any generated claim cannot be traced to a real passage in the source documents, regardless of how plausible or accurate that claim might appear.

---

## What this project is not

This is not a general-purpose AI assistant or chatbot. It does not answer questions from background knowledge. It does not generate content beyond what the source documents support. It is a structured pipeline that transforms a corpus of research papers into a verified, traceable synthesis — nothing more and nothing less.
