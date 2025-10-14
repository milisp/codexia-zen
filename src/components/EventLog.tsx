import { EventMsg } from '@/bindings/EventMsg';
import React, { JSX } from 'react';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";

interface EventLogProps {
  events: EventMsg[];
}

const EventLog: React.FC<EventLogProps> = ({ events }) => {
  const commandMap = new Map<string, string>();
  const agentMessageDeltas: string[] = [];
  
  events.forEach(event => {
    if (event.type === 'exec_command_begin' && 'call_id' in event && 'command' in event) {
      commandMap.set(event.call_id, event.command.join(' '));
    }
    if (event.type === 'agent_message_delta' && 'delta' in event) {
      agentMessageDeltas.push(event.delta);
    }
  });

  const accumulatedMessage = agentMessageDeltas.join('');

  const renderEvent = (event: EventMsg, idx: number): JSX.Element | null => {
    switch (event.type) {
      case 'task_started':
        return <div className="text-sm text-gray-500">🚀 Task started</div>;
      
      case 'agent_message_delta':
        if (idx === events.findLastIndex(e => e.type === 'agent_message_delta')) {
          return accumulatedMessage ? (
            <div className="text-sm my-1">🤖 
              <pre className="overflow-auto bg-gray-300 p-2 text-xs my-0">
                <code>{accumulatedMessage}</code>
              </pre>
            </div>
          ) : null;
        }
        return null;

      case 'agent_message':
        return 'message' in event ? <div className="text-sm my-1">🤖 
        <pre className="overflow-auto bg-gray-300 p-2 text-xs my-0">
        <code>{event.message}</code>
      </pre></div> 
        : null;

      case 'exec_command_end': {
        const callId = 'call_id' in event ? event.call_id : '';
        const command = commandMap.get(callId) || '';
        const output = 'aggregated_output' in event ? event.aggregated_output : '';

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
      
      case 'task_complete':
        return <div className="text-sm text-gray-500 mt-2">✅ Task complete</div>;

      case 'exec_command_begin':
      case 'exec_command_output_delta':
      case 'token_count':
        return null;

      default:
        return <div className="text-xs text-gray-400">Unhandled event: {event.type}</div>;
    }
  };

  return (
    <div className="space-y-2">
      {events.map((event, idx) => (
        <div
          key={
            ('call_id' in event && event.call_id)
              ? `${event.call_id}-${idx}`
              : `${event.type}-${idx}`
          }
        >
          {renderEvent(event, idx)}
        </div>
      ))}
    </div>
  );
};

export default EventLog;