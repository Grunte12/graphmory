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
