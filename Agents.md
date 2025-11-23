# Development Notes

- must be english in file
- docs file also english first

### Project tech
- Package manager: bun
- Framework: React + shadcn + tailwindcss + TypeScript + Tauri v2
- Don't use emit_all, use emit
- UI: shadcn UI components
- code comment language: English-only
- Zustand: for state management with persistence
- When consuming Zustand stores prefer destructuring the store return (e.g. `const { foo } = useStore();`) instead of manually selecting each state/action via `(state) => state.foo`.

## Common Commands
- `bun run build` - when frontend code change

## Project Structure
- `src/components/` - React components
- `src/pages/` - Page components
- `src/hooks/` - Custom hooks and stores
- use `@/hooks` `@/types` etc.

```ts
import { invoke } from "@tauri-apps/api/core";
```
