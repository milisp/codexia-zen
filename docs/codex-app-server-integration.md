# Codex App-Server Integration Notes

This document summarizes the latest changes made to the desktop client in order to interact with the Codex app-server protocol.

## Backend (Tauri) updates
- Added a dedicated `send_user_message` command that forwards fully-formed `SendUserMessageParams` payloads to the Codex binary (`src-tauri/src/commands.rs`). The command logs request metadata and surfaces detailed errors to the frontend.
- Extended the embedded app-server client to emit structured logs for stdout traffic, notifications, and approval requests. These messages are routed through `tauri-plugin-log`, making it easier to trace JSON-RPC activity when debugging (`src-tauri/src/codex/client.rs`).
- Conversation initialization now automatically registers a listener after the server returns a conversation id, ensuring events arrive without requiring extra frontend wiring.

## Frontend (React) updates
- Reworked the conversation store to append events in strict arrival order. Delta events are buffered separately, while every non-delta event is preserved for history (`src/stores/useConversationStore.ts`).
- `ChatPanel` renders each event using the protocol payload. User events are right-aligned; all other events stay left-aligned, display a short summary when present, and include the raw JSON payload for full context (`src/components/ChatPanel.tsx`).
- Outbound messages now originate from `SendUserMessageParams` built in the UI. Text input is serialized into the `InputItem` schema before invoking the Tauri command, matching the backend contract (`src/pages/chat.tsx`).
- Added console diagnostics throughout the conversation lifecycle (initialization, event streaming, resend logic) to help investigate state issues during development.

## Remaining warning
- `state::get_client` is still unused. The helper is kept for potential future reuse, but can be removed if the warning becomes disruptive.

## Next steps / improvement plan
- **Interactive approvals**: Surface `exec_command` and `apply_patch` approval requests in the UI instead of auto-denying them. This requires a modal/notification flow in React plus a bidirectional channel to respond with `ReviewDecision::Approved`.
- **Delta coalescing**: Stream reasoning and assistant deltas into the visible transcript (with live diffing) rather than a separate box once the event volumes are better understood.
- **Session recovery**: Detect app-server restarts more gracefully by re-registering listeners for active conversations and replaying initial history when `SessionConfigured` arrives.
- **Logging toggles**: Gate the verbose stdout/notification logging behind a runtime flag so production builds remain quiet while development retains full traces.
