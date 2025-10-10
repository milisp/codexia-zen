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

## Common Commands
- `bun run build` - test frontend

## Project Structure
- `src/components/` - React components
- `src/pages/` - Page components
- `src/hooks/` - Custom hooks and stores
- use `@/hooks` `@/types` etc.

```ts
import { invoke } from "@tauri-apps/api/core";
```
