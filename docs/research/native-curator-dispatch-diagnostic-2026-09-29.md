# Native Curator dispatch diagnostic

## Scope and observed local CLI

This is a read-only diagnosis of the named Curator dispatch attempt. The installed CLI reports `codex-cli 0.146.0`. Its `codex --help` and `codex exec --help` do not expose a direct `--agent` selector. Custom-agent dispatch therefore needs to be verified through the native subagent tool call and resulting child metadata, not inferred from a role file or a lead agent's summary.

## Supported role file and spawn contract

OpenAI's current [Subagents documentation](https://learn.chatgpt.com/docs/agent-configuration/subagents) defines standalone custom-agent TOML files under `~/.codex/agents/` or project `.codex/agents/`. Required keys are `name`, `description`, and `developer_instructions`; `model`, `model_reasoning_effort`, and other session settings are supported. The `name` value identifies the role; the filename is only a convention. This matches the structure Graphmory generates for its project-scoped Curator. The docs describe how to define roles; they do not guarantee that a particular spawn call successfully selects one.

For version-specific behavior, I inspected official [`openai/codex` release tag `rust-v0.146.0`](https://github.com/openai/codex/releases/tag/rust-v0.146.0), not the moving `main` branch:

- The tagged [`multi_agents_spec.rs`](https://github.com/openai/codex/blob/rust-v0.146.0/codex-rs/core/src/tools/handlers/multi_agents_spec.rs#L3113-L3151) describes `agent_type` as the role override and tells callers to set `fork_turns` to `none` or a positive integer when overriding it.
- In tagged [`multi_agents_v2/spawn.rs`](https://github.com/openai/codex/blob/rust-v0.146.0/codex-rs/core/src/tools/handlers/multi_agents_v2/spawn.rs#L1015-L1094), any supplied `fork_context` is rejected with `fork_context is not supported in MultiAgentV2; use fork_turns instead`. If `fork_turns` is omitted, the handler defaults it to `all`, which means a full-history fork. The handler then rejects a role override on a full-history fork and only applies the custom role for non-full-history forks ([spawn path](https://github.com/openai/codex/blob/rust-v0.146.0/codex-rs/core/src/tools/handlers/multi_agents_v2/spawn.rs#L789-L843)).

Thus, **for MultiAgentV2**, the source-supported named-role shape is `agent_type="graphmory_curator"`, `fork_turns="none"`, with `fork_context` omitted. `fork_turns="none"` starts without inherited conversation history, so the task message must be self-contained. The V2 source proves these incompatibilities; it does not prove the failed attempt used V2.

## What the failed attempt establishes

The prior parent session was ephemeral, so its model-visible tool schema, exact call arguments, response payload, and child metadata were not retained. The reported agent-type/fork error is consistent with the V2 restrictions above, but the available evidence cannot identify the selected multi-agent version or establish that the role file was loaded. No child metadata means that attempt did not verify named-role dispatch. It is not evidence that the custom-agent TOML format is wrong, nor evidence that a generic child would satisfy the Curator requirement.

## One bounded next diagnostic

If dispatch is tested again, use one persisted native Codex session in the same trusted project, with the existing project role file, model, and multi-agent settings unchanged. Ask for the same synthetic Curator delegation, but use the V2-supported shape: `agent_type="graphmory_curator"`, `fork_turns="none"`, and no `fork_context`. Keep the prompt self-contained because no parent history is inherited. Before marking dispatch successful, preserve the sanitized model-visible spawn schema/namespace, exact arguments and tool response, and child metadata showing `agent_role=graphmory_curator` plus the configured model. A generated TOML file or a lead self-report alone does not pass this check. Do not add a generic-role fallback or change product prompts/config based on the unretained failure.
