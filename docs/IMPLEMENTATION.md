# Codex App-Server V2 Implementation

A Tauri + React application integrating with Codex app-server using the v2 protocol.

## Architecture

### Backend (Rust + Tauri)

#### Core Components

1. **CodexClient** (`src-tauri/src/codex/client.rs`)
   - Spawns `codex app-server` process via stdin/stdout
   - Manages JSON-RPC communication
   - Handles event loop for notifications and server requests
   - Emits events to frontend via Tauri event system

2. **Tauri Commands** (`src-tauri/src/commands.rs`)
   - `codex_initialize()` - Initialize and spawn app-server
   - `thread_start(params)` - Create new thread
   - `thread_resume(params)` - Resume existing thread
   - `turn_start(params)` - Send message and start turn
   - `turn_interrupt(params)` - Stop ongoing turn
   - `respond_to_approval(response)` - Respond to approval requests

3. **State Management** (`src-tauri/src/state.rs`)
   - Manages CodexClient instance in application state

4. **Type Definitions** (`src-tauri/src/codex/types.rs`)
   - ApprovalRequest - Unified approval request type
   - ApprovalRequestKind - CommandExecution | FileChange

#### Event Flow

```
Frontend → Tauri Command → CodexClient → app-server (stdin)
                                            ↓
Frontend ← Tauri Event ← CodexClient ← app-server (stdout)
```

### Frontend (React + Zustand)

#### State Management

1. **useCodexStore** (`src/stores/useCodexStore.ts`)
   - Manages threads, turns, and processing state
   - Actions: initialize, threadStart, threadResume, turnStart, turnInterrupt
   - Uses v2 protocol types from bindings

2. **useApprovalStore** (`src/stores/useApprovalStore.ts`)
   - Manages pending approval requests
   - Actions: addApproval, respondToApproval

#### Hooks

1. **useCodexEvents** (`src/hooks/useCodexEvents.ts`)
   - Listens to Tauri events from backend
   - Handles approval requests and server notifications
   - Auto-updates stores with incoming events

#### Components

1. **ChatPage** (`src/pages/chat-page.tsx`)
   - Main layout container
   - Initializes Codex on mount
   - Integrates ThreadList, ChatInterface, and ApprovalDialog

2. **ThreadList** (`src/components/ThreadList.tsx`)
   - Left sidebar showing all threads
   - Create new thread button
   - Thread selection and resume

3. **ChatInterface** (`src/components/ChatInterface.tsx`)
   - Main chat area with event rendering
   - Textarea for user input
   - Send button (or Stop button when processing)
   - Keyboard shortcuts: Enter to send, Shift+Enter for new line

4. **ApprovalDialog** (`src/components/ApprovalDialog.tsx`)
   - Modal dialog for approval requests
   - Shows command execution or file change details
   - Actions: Approve Once, Approve for Session, Decline

## Protocol V2 Features

### Thread Management
- ThreadStart - Create new conversation thread
- ThreadResume - Resume existing thread
- ThreadList - List all threads
- ThreadArchive - Archive thread

### Turn Management
- TurnStart - Send message and start agent turn
- TurnInterrupt - Stop ongoing turn
- Turn status tracking (inProgress, completed, failed, interrupted)

### Approval System
- **Command Execution Approval**
  - Triggered when agent wants to execute commands
  - Shows proposed command and reason
  - Can approve with execpolicy amendment

- **File Change Approval**
  - Triggered when agent wants to modify files
  - Shows grant root and reason
  - Can approve for session

### Event Streaming
- Real-time event notifications via Tauri events
- Event types:
  - thread/started
  - turn/started, turn/completed
  - item/started, item/completed
  - item/agentMessage/delta (streaming text)
  - item/commandExecution/outputDelta
  - item/fileChange/outputDelta
  - error notifications

## Type System

All types are generated from Rust and exported to TypeScript:
- V2 protocol types: `@/bindings/v2/*`
- V1 events: `@/bindings/EventMsg`
- Auto-generated, no manual type definitions needed

## Usage

1. **Initialize**: App auto-initializes Codex on startup
2. **Create Thread**: Click "New Thread" button
3. **Send Message**: Type message and press Enter or click Send
4. **Stop Processing**: Click Stop button (square icon) to interrupt
5. **Approve Actions**: When approval dialog appears, choose to approve or decline
6. **Resume Thread**: Click on thread in sidebar to resume

## Configuration

The backend uses `codex` command directly. To configure the path to Codex binary:
- Set PATH environment variable, or
- Modify backend to use specific path

## Future Enhancements

- Thread history display
- Message editing and regeneration
- File diff viewer for file changes
- Command output syntax highlighting
- Thread search and filtering
- Export conversation history
