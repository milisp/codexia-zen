import { useMemo, useState } from "react";
import { Check, ChevronDown, ChevronUp, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TurnDiff } from "@/components/chat/types";

function createDiffId(seed: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${seed}-${crypto.randomUUID()}`;
  }
  return `${seed}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeDiffFilename(path: string) {
  if (path.startsWith("b/")) return path.slice(2);
  if (path.startsWith("a/")) return path.slice(2);
  return path || "changes";
}

export function parseUnifiedDiff(raw: string): TurnDiff[] {
  const lines = raw.split(/\r?\n/);
  const diffs: TurnDiff[] = [];
  let current: { filename: string; lines: string[] } | null = null;

  const pushCurrent = () => {
    if (!current) return;
    const { filename, lines: chunkLines } = current;
    const added = chunkLines.filter(
      (line) => line.startsWith("+") && !line.startsWith("+++"),
    ).length;
    const removed = chunkLines.filter(
      (line) => line.startsWith("-") && !line.startsWith("---"),
    ).length;
    diffs.push({
      id: createDiffId(`${filename}-${diffs.length}`),
      filename,
      added,
      removed,
      diff: chunkLines.join("\n"),
    });
    current = null;
  };

  for (const line of lines) {    if (line.startsWith("diff --git ")) {
      pushCurrent();
      const parts = line.split(" ");
      const target = parts[3] ?? parts[2] ?? "";
      current = {
        filename: normalizeDiffFilename(target),
        lines: [line],
      };
      continue;
    }

    if (!current) {
      current = {
        filename: "changes",
        lines: [line],
      };
    } else {
      current.lines.push(line);
    }
  }

  pushCurrent();

  if (diffs.length === 0 && raw.trim().length > 0) {
    const added = lines.filter(
      (line) => line.startsWith("+") && !line.startsWith("+++"),
    ).length;
    const removed = lines.filter(
      (line) => line.startsWith("-") && !line.startsWith("---"),
    ).length;
    diffs.push({
      id: createDiffId("diff"),
      filename: "changes",
      added,
      removed,
      diff: raw,
    });
  }

  return diffs;
}

interface DiffViewProps {
  diffs: TurnDiff[];
}

function DiffCard({ diff }: { diff: TurnDiff }) {
  const [isOpen, setIsOpen] = useState(true);
  const [copied, setCopied] = useState(false);

  const lines = useMemo(() => diff.diff.split("\n"), [diff.diff]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(diff.diff);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch (error) {
      console.error("Copy diff failed", error);
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-muted/40">
      <div className="flex items-center justify-between gap-3 border-b bg-background/60 px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <span className="rounded-md bg-secondary/40 px-2 py-1 text-foreground/90">
            {diff.filename}
          </span>
          <span className="text-emerald-600 dark:text-emerald-400">+ {diff.added}</span>
          <span className="text-red-600 dark:text-red-400">- {diff.removed}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn("size-8", copied && "text-emerald-600")}
            onClick={handleCopy}
            title={copied ? "Diff copied" : "Copy diff"}
            aria-label={copied ? "Diff copied" : "Copy diff"}
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => setIsOpen((value) => !value)}
            title={isOpen ? "Collapse diff" : "Expand diff"}
            aria-expanded={isOpen}
            aria-controls={`diff-${diff.id}`}
          >
            {isOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </Button>
        </div>
      </div>
      {isOpen && (
        <pre
          id={`diff-${diff.id}`}
          className="max-h-80 overflow-auto bg-background px-4 py-3 text-sm leading-6"
        >
          <code className="grid gap-0.5 font-mono text-xs text-muted-foreground">
            {lines.map((line, index) => {
              const first = line.charAt(0);
              const tone =
                first === "+"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : first === "-"
                    ? "text-red-600 dark:text-red-400"
                    : first === "@"
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-muted-foreground";

              return (
                <span key={index} className={cn("whitespace-pre", tone)}>
                  {line || "\u00A0"}
                </span>
              );
            })}
          </code>
        </pre>
      )}
    </div>
  );
}

export function DiffView({ diffs }: DiffViewProps) {
  if (!diffs || diffs.length === 0) {
    return null;
  }

  return (
    <div className="flex w-full flex-col gap-2">
      {diffs.map((diff) => (
        <DiffCard key={diff.id} diff={diff} />
      ))}
    </div>
  );
}