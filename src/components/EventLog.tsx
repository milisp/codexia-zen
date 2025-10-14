import { invoke } from "@tauri-apps/api/core";
import React, { JSX } from 'react';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Button } from './ui/button';
import { useSessionStore } from "@/stores/useSessionStore";
import { EventWithId } from "@/types/Message";

interface EventLogProps {
  events: EventWithId[];
}

const EventLog: React.FC<EventLogProps> = ({ events }) => {
  const commandMap = new Map<string, string>();
  const agentMessageDeltas: string[] = [];
  const { sessionId } = useSessionStore();

  const handleApproval = async (request_id: string, approved: boolean) => {
    console.log("exec_approval_request sessionId", sessionId, request_id, approved)
    try {
      await invoke("exec_approval_request", { sessionId: sessionId, requestId: request_id, decision: approved });
    } catch (error) {
      console.error(`Failed to ${approved ? 'approve' : 'deny'} request:`, error);
    }
  };

  events.forEach(event => {
    if (event.msg.type === 'exec_command_begin' && 'call_id' in event.msg && 'command' in event.msg) {
      commandMap.set(event.msg.call_id, event.msg.command.join(' '));
    }
    if (event.msg.type === 'agent_message_delta' && 'delta' in event.msg) {
      agentMessageDeltas.push(event.msg.delta);
    }
  });

  const accumulatedMessage = agentMessageDeltas.join('');

  const renderEvent = (event: EventWithId, idx: number): JSX.Element | null => {
    switch (event.msg.type) {
      case 'task_started':
        return <div className="text-sm text-gray-500">🚀 Task started</div>;
      
      case 'agent_message_delta': {
        const lastAgentMessageDeltaIndex = events.findLastIndex(e => e.msg.type === 'agent_message_delta');
        if (idx === lastAgentMessageDeltaIndex) {
          return accumulatedMessage ? (
            <div className="text-sm my-1">🤖 
              <pre className="overflow-auto bg-gray-300 p-2 text-xs my-0">
                <code>{accumulatedMessage}</code>
              </pre>
            </div>
          ) : null;
        }
        return null;
      }

      case 'exec_command_end': {
        const callId = 'call_id' in event.msg ? event.msg.call_id : '';
        const command = commandMap.get(callId) || '';
        const output = 'aggregated_output' in event.msg ? event.msg.aggregated_output : '';

        return (
          <Accordion type="single" collapsible className="my-0">
            <AccordionItem value={`command-${callId}`} className="border-0 my-0">
              <AccordionTrigger className="text-sm font-medium py-1 bg-gray-200">
                🔄 {command || 'Command'}
              </AccordionTrigger>
              <AccordionContent className="pb-1">
                <pre className="overflow-auto bg-gray-300 p-2 text-xs my-0">
                  <code>{output || 'No output available'}</code>
                </pre>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        );
      }

      case 'exec_approval_request':
        console.log(event.msg)
        return <div>
          <div>🔄 {event.msg.command.join(' ')}</div>
            <div className="space-x-2 mt-1">
            <Button size="sm" onClick={() => handleApproval(event.id, true)}>Approval</Button>
            <Button size="sm" variant="destructive" onClick={() => handleApproval(event.id, false)}>
                Deny</Button>
          </div>
        </div>
      
      case 'task_complete':
      case 'agent_message':
      case 'exec_command_begin':
      case 'exec_command_output_delta':
      case 'token_count':
        return null;

      case 'stream_error':
        return <div className="text-xs text-red-400">{event.msg.message}</div>;

      default:
        return <div className="text-xs text-gray-400">Unhandled event: {event.msg.type}</div>;
    }
  };

  return (
    <div className="space-y-2">
      {events.map((event, idx) => (
        <div
          key={event.id + (('call_id' in event.msg && event.msg.call_id) ? `-${event.msg.call_id}` : `-${idx}`)}
        >
          {renderEvent(event, idx)}
        </div>
      ))}
    </div>
  );
};

export default EventLog;