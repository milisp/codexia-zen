# Chatbox Preview

This Tauri v2 prototype adds a Codex-inspired chatbox to the React frontend. The interface renders user and assistant turns, highlights unified diffs, and keeps every label in English in accordance with the project guidelines.

The Tauri backend now starts a long-lived `codex proto` session so that every prompt travels through the real Codex CLI pipeline instead of a mocked preview.

## Running the Prototype

1. Install dependencies if you have not already: `bun install`.
2. Ensure the `codex` CLI binary is available on your `$PATH`. You can build it from `/Users/gpt/projects/jsapp/codex/codex-rs` or use the vendored release.
3. Launch the local preview: `bun run tauri dev` for the desktop shell or `bun run dev` for the web build.
4. Send prompts with the composer at the bottom of the window. Use ⌘⏎ (macOS) or Ctrl⏎ (Windows/Linux) as a quick-send shortcut.

The viewport scrolls to the latest message automatically, mirroring the behavior in the Codex CLI conversation log.

## UI Structure

- **Header** — lists the chatbox name and a short description of the prototype.
- **Conversation feed** — displays user, assistant, and system turns with timestamps. Assistant turns can render one or more diffs beneath the message body.
- **Chat composer** — multiline textarea with submission shortcut hints and a send button that disables while the assistant is preparing a reply.

## Backend Bridge

- The Rust backend spawns `codex proto -c preset=chatbox` when the frontend explicitly requests it through the `chatbox_start_session` command. Use `chatbox_init` to update stored configuration overrides without launching a new Codex process, and `chatbox_send` to submit user prompts.
- Each chat submission serialises to the Codex `Submission` JSON format and is written to `stdin`; events from `stdout` are streamed to the UI through the `chatbox://event` channel.
- When the Codex process exits or reports an error, the UI posts a system message and disables the composer until a new session is initialised.

## Turn Diff Actions

Each unified diff card follows the requested layout:

- Left side: `filename | + rows | - rows` badge group to summarise the change size.
- Right side: icon buttons for copying the diff or collapsing the rendered view. Copy feedback is provided inline.
- Collapsing a diff hides the syntax-coloured preview while keeping the header visible.

## Related Commands

Use the Codex CLI to rehearse a conversation or diff before applying it to the workspace:

```bash
codex proto -c preset=chatbox
codex proto -c scope=chatbox,preview=true
```

Run `codex proto -h` inside `/Users/gpt/projects/jsapp/codex/codex-cli` for the full set of configuration flags provided by the upstream project.
