import React, { useEffect, useState } from "react";
import { EventWithId } from "@/types/Message";

/**
 * Renders streaming delta events for the assistant. It accumulates the deltas
 * similarly to the original EventLog but only deals with the delta types.
 */
interface DeltaEventLogProps {
  events: EventWithId[];
}

const DeltaEventLog: React.FC<DeltaEventLogProps> = ({ events }) => {
  // Full accumulated deltas received from the backend
  const [fullMessageDeltas, setFullMessageDeltas] = useState<Record<string, string>>({});
  const [fullReasoningDeltas, setFullReasoningDeltas] = useState<Record<string, string>>({});

  useEffect(() => {
    // Rebuild accumulated deltas from scratch from the current events array.
    // Previously we started from the current state and appended, which caused
    // duplicate accumulation when `events` contains older entries again.
    const newMsg: Record<string, string> = {};
    const newReason: Record<string, string> = {};

    for (const ev of events) {
      const t = ev.msg.type;
      if (t === "agent_message_delta") {
        newMsg[ev.id] = (newMsg[ev.id] || "") + ev.msg.delta;
      } else if (t === "agent_reasoning_raw_content_delta") {
        newReason[ev.id] = (newReason[ev.id] || "") + ev.msg.delta;
      }
    }

    // Only update state when the rebuilt maps differ to avoid unnecessary renders
    setFullMessageDeltas((prev) => {
      const kPrev = Object.keys(prev);
      const kNew = Object.keys(newMsg);
      if (kPrev.length !== kNew.length) return newMsg;
      for (const k of kNew) {
        if (prev[k] !== newMsg[k]) return newMsg;
      }
      return prev;
    });

    setFullReasoningDeltas((prev) => {
      const kPrev = Object.keys(prev);
      const kNew = Object.keys(newReason);
      if (kPrev.length !== kNew.length) return newReason;
      for (const k of kNew) {
        if (prev[k] !== newReason[k]) return newReason;
      }
      return prev;
    });
  }, [events]);

  return (
    <div className="space-y-2">
  {Object.entries(fullMessageDeltas).map(([id, txt]) => (
    <span key={id} className="text-sm my-1">
      {txt}
    </span>
  ))}
  {Object.entries(fullReasoningDeltas).map(([id, txt]) => (
    <span key={id} className="text-xs text-muted-foreground my-1 block">
      {txt}
    </span>
  ))}
</div>
  );
};

export default DeltaEventLog;
