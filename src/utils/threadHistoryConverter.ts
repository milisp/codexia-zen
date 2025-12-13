import type { ChatEvent } from '@/types/ChatEvent';
import type { Thread } from '@/bindings/v2/Thread';
import type { ThreadItem } from '@/bindings/v2/ThreadItem';

/**
 * Converts thread history (turns with items) to ChatEvents for display
 */
export function convertThreadHistoryToEvents(thread: Thread): ChatEvent[] {
  const events: ChatEvent[] = [];

  // Process each turn in the thread
  for (const turn of thread.turns) {
    // Process each item in the turn
    for (const item of turn.items) {
      const convertedEvents = convertThreadItemToEvents(item, thread.id, turn.id);
      events.push(...convertedEvents);
    }

    // Add turn completed event if the turn is completed
    if (turn.status === 'completed') {
      events.push({
        method: 'turn/completed',
        params: {
          threadId: thread.id,
          turn: turn,
        },
      });
    }
  }

  return events;
}

/**
 * Converts a single ThreadItem to one or more ChatEvents
 */
function convertThreadItemToEvents(
  item: ThreadItem,
  threadId: string,
  turnId: string
): ChatEvent[] {
  const events: ChatEvent[] = [];

  switch (item.type) {
    case 'userMessage':
      // Convert user message to user_input event
      const textContent = item.content
        .filter((c) => c.type === 'text')
        .map((c) => (c as any).text)
        .join('\n');

      if (textContent) {
        events.push({
          method: 'user_input',
          params: { text: textContent },
        });
      }
      break;

    case 'agentMessage':
      // Convert agent message to item started + delta event
      events.push({
        method: 'item/started',
        params: {
          item: item,
          threadId: threadId,
          turnId: turnId,
        },
      });

      events.push({
        method: 'item/agentMessage/delta',
        params: {
          threadId: threadId,
          turnId: turnId,
          itemId: item.id,
          delta: item.text,
        },
      });
      break;

    case 'reasoning':
      // For now, just show that reasoning happened
      events.push({
        method: 'item/started',
        params: {
          item: item,
          threadId: threadId,
          turnId: turnId,
        },
      });
      break;

    case 'commandExecution':
      events.push({
        method: 'item/started',
        params: {
          item: item,
          threadId: threadId,
          turnId: turnId,
        },
      });
      break;

    case 'fileChange':
      events.push({
        method: 'item/started',
        params: {
          item: item,
          threadId: threadId,
          turnId: turnId,
        },
      });
      break;

    case 'mcpToolCall':
      events.push({
        method: 'item/started',
        params: {
          item: item,
          threadId: threadId,
          turnId: turnId,
        },
      });
      break;

    // Add more cases as needed for other ThreadItem types
  }

  return events;
}
