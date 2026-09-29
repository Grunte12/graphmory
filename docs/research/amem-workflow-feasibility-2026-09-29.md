# A-MEM workflow feasibility inventory

**Purpose:** determine whether the two requested A-MEM repositories can be run as competitors in Graphmory's four synthetic write cases (approved update, retry, missing evidence, and conflict). This is a source inventory, not a measured comparison.

## Pinned sources and method

- `WujiangXu/A-mem-sys`: inspected commit [`f303dfc71e07bdc787f4bc135d4cea328ae30e99`](https://github.com/WujiangXu/A-mem-sys/commit/f303dfc71e07bdc787f4bc135d4cea328ae30e99), the latest commit shown on `main` in the repository history.
- `WujiangXu/AgenticMemory`: the requested GitHub URL redirects to `WujiangXu/A-mem`. Inspected [`0c8039f28fdcc08189a23c07a3437d9d2482f9c2`](https://github.com/WujiangXu/A-mem/commit/0c8039f28fdcc08189a23c07a3437d9d2482f9c2), the latest commit shown in that repository's history.

The clone attempt failed because this environment could not resolve `github.com`. I read the pinned official GitHub README, source, and package metadata instead. No package was installed, no model was downloaded, and no model/API call or benchmark was run. Statements below are source observations or README instructions, not local runtime verification.

## Production library: A-mem-sys

The pinned [README](https://github.com/WujiangXu/A-mem-sys/blob/f303dfc71e07bdc787f4bc135d4cea328ae30e99/README.md) describes a Python library, not a command-line memory service. Its `AgenticMemorySystem` constructor and add/read/search/update/delete methods are in the pinned [`memory_system.py`](https://github.com/WujiangXu/A-mem-sys/blob/f303dfc71e07bdc787f4bc135d4cea328ae30e99/agentic_memory/memory_system.py#L89-L121). An equivalent read/write/search sequence is:

```python
from agentic_memory.memory_system import AgenticMemorySystem

memory = AgenticMemorySystem(
    model_name="all-MiniLM-L6-v2",
    llm_backend="ollama",
    llm_model="llama2",
)
note_id = memory.add_note(
    "The deployment guide moves to the new release process.",
    keywords=["deployment", "release process"],
    context="Project operations",
    tags=["workflow"],
)
current = memory.read(note_id)
matches = memory.search("release deployment process", k=3)
neighbor_matches = memory.search_agentic("release deployment process", k=5)
memory.update(note_id, content="The deployment guide uses the approved release process.")
```

The constructor defaults to OpenAI with `gpt-4o-mini`; `OpenAIController` reads `OPENAI_API_KEY`. The README also documents Ollama, SGLang, and OpenRouter alternatives. All modes default to the `all-MiniLM-L6-v2` sentence-transformer embedding, so first use may download that model. The pinned [`pyproject.toml`](https://github.com/WujiangXu/A-mem-sys/blob/f303dfc71e07bdc787f4bc135d4cea328ae30e99/pyproject.toml) declares Python `>=3.8` and dependencies including `sentence-transformers`, `chromadb`, `rank_bm25`, `nltk`, `litellm`, `numpy`, `scikit-learn`, `openai`, and `requests`; the pinned [`requirements.txt`](https://github.com/WujiangXu/A-mem-sys/blob/f303dfc71e07bdc787f4bc135d4cea328ae30e99/requirements.txt) additionally lists `transformers`. The OpenAI default and alternate backend names are in [`llm_controller.py`](https://github.com/WujiangXu/A-mem-sys/blob/f303dfc71e07bdc787f4bc135d4cea328ae30e99/agentic_memory/llm_controller.py#L40-L53). This is a significant Python/ML installation compared with Graphmory's Node CLI. The README's setup text says to clone `agiresearch/A-mem`, while the inspected package metadata and requested source are under `WujiangXu/A-mem-sys`; pin and inspect the intended tree before installing.

**Durability and lineage:** the inspected constructor starts with an empty `self.memories` dictionary and resets its Chroma collection. The retriever instantiates `chromadb.Client(Settings(allow_reset=True))`, not a disk-backed client. The checked implementation therefore has no supported durable restart workflow. A `MemoryNote` has a `timestamp`, `links`, and an `evolution_history` field, but `update` mutates the existing object and replaces its indexed document; it does not append an evolution record. The note shape has no required provenance, approval, supersession, or event-revalidation fields. `search_agentic` can append linked neighbors to a semantic search result; that is a direct-neighbor expansion, not evidence of recursive multi-hop traversal. These observations are from the pinned [`memory_system.py`](https://github.com/WujiangXu/A-mem-sys/blob/f303dfc71e07bdc787f4bc135d4cea328ae30e99/agentic_memory/memory_system.py) and [`retrievers.py`](https://github.com/WujiangXu/A-mem-sys/blob/f303dfc71e07bdc787f4bc135d4cea328ae30e99/agentic_memory/retrievers.py).

## Paper/reproduction repository: AgenticMemory → A-mem

The README for the redirected repository identifies it as the paper-reproduction code and points users who want to build an agent to A-mem-sys. Its documented setup and evaluation are:

```sh
git clone https://github.com/WujiangXu/AgenticMemory.git
cd AgenticMemory
git checkout 0c8039f28fdcc08189a23c07a3437d9d2482f9c2
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python test_advanced_robust.py --backend ollama --model qwen2.5:3b \
  --dataset data/locomo10.json --output results_robust_ollama_qwen3b.json
```

The README also provides an OpenAI-backed evaluation command and says robust evaluation supports OpenAI, vLLM, and Ollama. It lists LoCoMo QA categories including multi-hop, temporal, open-domain, single-hop, and adversarial. The requirements include PyTorch, Transformers, sentence-transformers, NLTK, OpenAI/LiteLLM and evaluation dependencies. This is a model-backed benchmark workflow with model/server and dataset prerequisites, not a durable memory-write CLI or an approved-patch curator. These are the README's instructions; they were not executed here. See the pinned [A-mem README](https://github.com/WujiangXu/A-mem/blob/0c8039f28fdcc08189a23c07a3437d9d2482f9c2/README.md).

## Mapping to the four Graphmory cases

Graphmory's `MemoryPatch` requires claim, scope, provenance, confidence, type, and lifecycle metadata, including event triggers; its schema and patch check are designed to validate this structure. That schema validation is not proof that a claim is factually supported or authorized. A-MEM's public note API expresses a different workflow, so the following is a capability mapping, not a head-to-head pass/fail score.

| Case | A-MEM operation that can be tried | Workflow gap / comparability limit |
|---|---|---|
| Approved update | `update(note_id, content=...)`, or create a new note with `add_note` ([implementation](https://github.com/WujiangXu/A-mem-sys/blob/f303dfc71e07bdc787f4bc135d4cea328ae30e99/agentic_memory/memory_system.py#L370-L409)) | No approval or supersession contract, no retained update history, and no source lineage. Overwriting a note is not equivalent to an approved, provenance-bearing supersession. |
| Duplicate retry | Call `add_note` twice with the same text ([implementation](https://github.com/WujiangXu/A-mem-sys/blob/f303dfc71e07bdc787f4bc135d4cea328ae30e99/agentic_memory/memory_system.py#L21-L79) and [add path](https://github.com/WujiangXu/A-mem-sys/blob/f303dfc71e07bdc787f4bc135d4cea328ae30e99/agentic_memory/memory_system.py#L225-L278)) | Each new `MemoryNote` receives a UUID; there is no idempotency key or retry contract. Similarity links may be generated, but they do not make the second write an idempotent retry. |
| Missing evidence | Call `add_note` with text and no source reference ([API implementation](https://github.com/WujiangXu/A-mem-sys/blob/f303dfc71e07bdc787f4bc135d4cea328ae30e99/agentic_memory/memory_system.py#L21-L79)) | No required evidence/provenance argument or schema gate exists. This can demonstrate acceptance of unsupported text, but cannot test an equivalent evidence-validation workflow. |
| Conflict | Add conflicting text and observe model-driven `process_memory` ([prompt and actions](https://github.com/WujiangXu/A-mem-sys/blob/f303dfc71e07bdc787f4bc135d4cea328ae30e99/agentic_memory/memory_system.py#L124-L152), [implementation](https://github.com/WujiangXu/A-mem-sys/blob/f303dfc71e07bdc787f4bc135d4cea328ae30e99/agentic_memory/memory_system.py#L597-L715)) | The evolution prompt offers `strengthen` and `update_neighbor` actions, which can connect notes or change a neighbor's context/tags. It has no explicit `TENSION`/`BLOCKED` outcome or authority field, and its result depends on a model call. |

Graphmory already supports explicit evidence-bearing patches, schema preflight, a read-only lifecycle persistence check, and distinct `APPLIED`/`TENSION`/`BLOCKED` workflow outcomes in its Curator instructions. Do not bolt A-MEM onto that writer path or add a Graphmory backend from this inventory.

## Feasibility decision

An isolated Python installation is technically straightforward in a separate virtual environment, but an actual four-case comparison is not currently fair: A-mem-sys has no durable state across restart in the inspected implementation and does not represent approval, evidence lineage, idempotent retry, or explicit tension outcomes. A more appropriate competitor exercise would be a separate retrieval/organization smoke on the same synthetic corpus, documenting A-MEM's model/backend, initial memory state, direct-link expansion, and one-process scope. It should not be reported as a MemoryPatch lifecycle comparison. The paper repository's LoCoMo evaluation can be considered separately as a QA benchmark if its dataset and model costs are explicitly accepted.
