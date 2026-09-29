# Research and Inspiration

This repository contains original implementation and documentation. It does not vendor code or prose from the works below.

The design was informed by:

- Andrej Karpathy, "LLM Wiki": persistent, interlinked Markdown knowledge compiled from source material.
  https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f
- Anthropic, "Effective context engineering for AI agents": bounded context, just-in-time retrieval, and external memory.
  https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- Anthropic, "Building effective agents": simple workflows, routing, and evaluator patterns.
  https://www.anthropic.com/engineering/building-effective-agents
- "Useful Memories Become Faulty When Continuously Updated by LLMs": evidence preservation and gated consolidation.
  https://arxiv.org/abs/2605.12978
- "Episodic-Semantic Memory Architecture for Long-Horizon Scientific Agents": separation of immediate and consolidated memory.
  https://arxiv.org/abs/2605.17625
- "CraniMem": gated, bounded memory under noisy long-horizon conditions.
  https://openreview.net/forum?id=Tts94WVw40
- "SimpleMem": structured compression, consolidation, and adaptive retrieval.
  https://openreview.net/forum?id=CMveUVer0m
- "Evaluating Memory Structure in LLM Agents" / StructMemEval: explicit memory structure and organization.
  https://openreview.net/forum?id=a9vY2sJkf4
- "Retrieval-Augmented Generation for Large Language Models: A Survey": Naive, Advanced, and Modular RAG taxonomy.
  https://arxiv.org/abs/2312.10997
- "Agentic Retrieval-Augmented Generation: A Survey on Agentic RAG": planning and iterative agent control over retrieval.
  https://arxiv.org/abs/2501.09136
- Anthropic, "Contextual Retrieval": contextual chunks, hybrid sparse/dense retrieval, and reranking.
  https://www.anthropic.com/research/contextual-retrieval
- LangChain, "Context Engineering": write, select, compress, and isolate context.
  https://www.langchain.com/blog/context-engineering-for-agents
- HumanLayer, "12-factor agents": explicit context, control flow, structured outputs, and focused agents.
  https://github.com/humanlayer/12-factor-agents
- FAISS, SQLite Vec1, and Qdrant documentation were consulted to verify that vector retrieval can run locally and is not inherently a cloud service.
  https://github.com/facebookresearch/faiss
  https://sqlite.org/vec1
  https://qdrant.tech/documentation/

Names and links are provided for attribution and research traceability. They do not imply endorsement.

## Vendored development evaluation skills

`.agents/skills/{eval-audit,evaluate-rag,validate-evaluator,write-code-eval}/` contains
unmodified instruction files from [AI Evals Course / evals-skills](https://github.com/ai-evals-course/evals-skills),
revision `80d5f7b0127c7572ed9e9339937adbfd7240ffeb`, under Apache-2.0.
The license is included at `.agents/skills/LICENSE.evals-skills`; file hashes
and provenance are recorded in `.agents/skills/evals-skills-provenance.json`.
These repository development skills are excluded from the npm package's
explicit `files` list. They are separate from the original runtime and from
the research inspirations listed above.

## Vendored Context Engineering development skills

`.agents/skills/{evaluation,tool-design}/` contains unmodified files from
[Agent Skills for Context Engineering](https://github.com/muratcankoylan/Agent-Skills-for-Context-Engineering),
revision `6dbe1a1d868eab51a3bc9011b0f55e2891513e40`, under MIT. The license and source hashes are retained in
`.agents/skills/LICENSE.context-engineering` and
`.agents/skills/context-engineering-provenance.json`. These development-only
resources are excluded from the npm package. Bundled heuristic example scorers
are guidance, not adopted benchmark implementations.
