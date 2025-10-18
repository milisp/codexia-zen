import { invoke } from "@tauri-apps/api/core";
import React, { JSX, useState, useEffect } from "react";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Button } from "./ui/button";
import { useSessionStore } from "@/stores/useSessionStore";
import { EventWithId } from "@/types/Message";
import { v4 } from "uuid";

interface EventLogProps {
  events: EventWithId[];
}

const EventLog: React.FC<EventLogProps> = ({ events }) => {
  const commandMap = new Map<string, string>();
  const { sessionId } = useSessionStore();

  const [agentMessageDeltas, setAgentMessageDeltas] = useState<
    Record<string, string>
  >({});
  const [agentReasoningDeltas, setAgentReasoningDeltas] = useState<
    Record<string, string>
  >({});

  React.useEffect(() => {
    const approvalEvents = events.filter(
      (e) => e.msg.type === "exec_approval_request",
    );
    if (approvalEvents.length > 0) {
      console.log("Approval events:", approvalEvents);
    }
  }, [events]);

  // Accumulate deltas for agent_message_delta and agent_reasoning_raw_content_delta
  useEffect(() => {
    // Temporary accumulators
    const newAgentMessageDeltas: Record<string, string> = {};
    const newAgentReasoningDeltas: Record<string, string> = {};

    // Copy previous state to start with
    Object.assign(newAgentMessageDeltas, agentMessageDeltas);
    Object.assign(newAgentReasoningDeltas, agentReasoningDeltas);

    // Track which messages have been finalized (to clear deltas)
    const finalizedAgentMessages = new Set<string>();
    const finalizedAgentReasonings = new Set<string>();

    for (const event of events) {
      if (event.msg.type === "agent_message_delta") {
        const key = event.id;
        newAgentMessageDeltas[key] =
          (newAgentMessageDeltas[key] || "") + event.msg.delta;
      } else if (event.msg.type === "agent_reasoning_raw_content_delta") {
        const key = event.id;
        newAgentReasoningDeltas[key] =
          (newAgentReasoningDeltas[key] || "") + event.msg.delta;
      } else if (event.msg.type === "agent_message") {
        // When final agent_message arrives, replace delta with full text
        const key = event.id;
        newAgentMessageDeltas[key] = event.msg.message;
        finalizedAgentMessages.add(key);
      } else if (event.msg.type === "agent_reasoning_raw_content") {
        const key = event.id;
        newAgentReasoningDeltas[key] = event.msg.text;
        finalizedAgentReasonings.add(key);
      }
    }

    // Clean up old deltas that have been finalized
    for (const key of Object.keys(newAgentMessageDeltas)) {
      if (finalizedAgentMessages.has(key)) {
        // keep the final text
      } else {
        // keep accumulating until final message arrives
      }
    }
    for (const key of Object.keys(newAgentReasoningDeltas)) {
      if (finalizedAgentReasonings.has(key)) {
        // keep the final text
      } else {
        // keep accumulating until final message arrives
      }
    }

    setAgentMessageDeltas(newAgentMessageDeltas);
    setAgentReasoningDeltas(newAgentReasoningDeltas);
  }, [events]);

  const handleApproval = async (request_id: number, approved: boolean) => {
    console.log(
      "exec_approval_request sessionId",
      sessionId,
      request_id,
      approved,
    );
    try {
      await invoke("exec_approval_request", {
        sessionId: sessionId,
        requestId: request_id,
        decision: approved,
      });
    } catch (error) {
      console.error(
        `Failed to ${approved ? "approve" : "deny"} request:`,
        error,
      );
    }
  };

  events.forEach((event) => {
    if (
      event.msg.type === "exec_command_begin" &&
      "call_id" in event.msg &&
      "command" in event.msg
    ) {
      commandMap.set(event.msg.call_id, event.msg.command.join(" "));
    }
  });

  const renderEvent = (event: EventWithId): JSX.Element | null => {
    switch (event.msg.type) {
      case "task_started":
        return <div className="text-sm text-gray-500">🚀 Task started</div>;

      case "agent_message_delta": {
        const text = agentMessageDeltas[event.id] || "";
        return <div className="text-sm my-1">🤖 {text}</div>;
      }

      case "agent_reasoning_raw_content_delta": {
        const text = agentReasoningDeltas[event.id] || "";
        return (
          <div className="text-sm my-1">
            🤖
            <pre className="overflow-auto bg-gray-300 p-2 text-xs my-0">
              <code>{text}</code>
            </pre>
          </div>
        );
      }

      case "agent_reasoning_raw_content": {
        const text = agentReasoningDeltas[event.id] || event.msg.text || "";
        return (
          <div className="text-sm my-1">
            🤖
            <pre className="overflow-auto bg-gray-300 p-2 text-xs my-0">
              <code>{text}</code>
            </pre>
          </div>
        );
      }

      case "exec_command_end": {
        const callId = "call_id" in event.msg ? event.msg.call_id : "";
        const command = commandMap.get(callId) || "";
        const output =
          "aggregated_output" in event.msg ? event.msg.aggregated_output : "";

        return (
          <Accordion type="single" collapsible className="my-0">
            <AccordionItem
              value={`command-${callId}`}
              className="border-0 my-0"
            >
              <AccordionTrigger className="text-sm font-medium py-1 bg-gray-200">
                🔄 {command || "Command"}
              </AccordionTrigger>
              <AccordionContent className="pb-1">
                <pre className="overflow-auto bg-gray-300 p-2 text-xs my-0">
                  <code>{output || "No output available"}</code>
                </pre>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        );
      }

      case "exec_approval_request":
        return (
          <div>
            <div>🔄 {event.msg.command.join(" ")}</div>
            <div className="space-x-2 mt-1">
              <Button
                size="sm"
                onClick={() => handleApproval(event.request_id ?? 0, true)}
              >
                Approval
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => handleApproval(event.request_id ?? 0, false)}
              >
                Deny
              </Button>
            </div>
          </div>
        );

      case "agent_message":
        // Render final agent message text
        return (
          <div className="text-sm my-1">
            🤖 {agentMessageDeltas[event.id] || event.msg.message}
          </div>
        );

      case "exec_command_begin":
      case "exec_command_output_delta":
      case "token_count":
        return null;

      case "mcp_tool_call_begin":
      case "mcp_tool_call_end":
        return (
          <div className="text-xs text-red-400">
            <p>
              {event.msg.invocation.server} - {event.msg.invocation.tool}
            </p>
            <pre>
              <code>
                {JSON.stringify(event.msg.invocation.arguments, null, 2)}
              </code>
            </pre>
          </div>
        );

      case "stream_error":
      case "error":
        return <div className="text-xs text-red-400">{event.msg.message}</div>;

      case "task_complete":
        return (
          <div className="text-sm my-1">🤖 {event.msg.last_agent_message}</div>
        );

      default:
        return (
          <div className="text-xs text-gray-400">
            Unhandled event: {event.msg.type}
          </div>
        );
    }
  };

  return (
    <div className="space-y-2">
      {events.map((event) => (
        <div key={event.id + event.msg.type + v4()}>
          {renderEvent(event)}
        </div>
      ))}
    </div>
  );
};

export default EventLog;
