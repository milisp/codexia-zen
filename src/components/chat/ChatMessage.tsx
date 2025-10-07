import { memo, useMemo, type ReactNode } from "react"
import { Bot, User } from "lucide-react"

import { cn } from "@/lib/utils"

import type { ChatMessage as ChatMessageType } from "./types"
import { DiffView } from "@/components/diff/DiffView"

const roleConfig = {
  user: {
    label: "You",
    icon: <User className="size-4" />,
    bubble: "bg-primary text-primary-foreground border-primary/60",
    align: "items-end",
  },
  assistant: {
    label: "Assistant",
    icon: <Bot className="size-4" />,
    bubble: "bg-card text-card-foreground border-border",
    align: "items-start",
  },
  system: {
    label: "System",
    icon: <Bot className="size-4" />,
    bubble: "bg-muted text-muted-foreground border-border",
    align: "items-start",
  },
} as const satisfies Record<ChatMessageType["role"], {
  label: string
  icon: ReactNode
  bubble: string
  align: string
}>

const Avatar = memo(({ role }: { role: ChatMessageType["role"] }) => {
  const { icon, label } = roleConfig[role]

  return (
    <div
      aria-hidden
      className={cn(
        "grid size-9 place-items-center rounded-full border bg-background shadow-sm",
        role === "user" ? "border-primary/40 text-primary" : "border-border text-foreground"
      )}
      title={label}
    >
      {icon}
    </div>
  )
})
Avatar.displayName = "Avatar"

function renderContent(content: string) {
  const segments = content
    .split(/\n\s*\n/)
    .map((segment) => segment.trim())
    .filter(Boolean)

  return segments.map((segment, index) => (
    <p className="whitespace-pre-wrap" key={index}>
      {segment}
    </p>
  ))
}

export function ChatMessage({ message }: { message: ChatMessageType }) {
  const { role, content, timestamp, diffs } = message
  const isUser = role === "user"
  const config = roleConfig[role]

  const timeLabel = useMemo(() => {
    try {
      return new Intl.DateTimeFormat("en", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(timestamp))
    } catch {
      return timestamp
    }
  }, [timestamp])

  return (
    <div className={cn("flex w-full gap-3", isUser ? "justify-end" : "justify-start")}
    >
      {!isUser && <Avatar role={role} />}
      <div className={cn("flex w-full max-w-3xl flex-col gap-3", config.align)}>
        <div
          className={cn(
            "grid gap-1 rounded-2xl border px-4 py-3 text-sm leading-6 shadow-sm",
            config.bubble,
            isUser ? "rounded-br-sm" : "rounded-bl-sm"
          )}
        >
          <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-wide text-muted-foreground">
            <span className="font-semibold text-foreground/80 dark:text-foreground/90">
              {config.label}
            </span>
            <time className="tabular-nums text-muted-foreground" dateTime={timestamp}>
              {timeLabel}
            </time>
          </div>
          <div className="grid gap-2">{renderContent(content)}</div>
          {message.isStreaming && (
            <span className="text-xs text-muted-foreground">Assistant is composing…</span>
          )}
        </div>
        {!!diffs?.length && <DiffView diffs={diffs} />}
      </div>
      {isUser && <Avatar role={role} />}
    </div>
  )
}

export const ChatMessageList = memo(({ messages }: { messages: ChatMessageType[] }) => {
  return (
    <div className="flex flex-col gap-6">
      {messages.map((message) => (
        <ChatMessage key={message.id} message={message} />
      ))}
    </div>
  )
})
ChatMessageList.displayName = "ChatMessageList"
