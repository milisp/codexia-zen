import { EventMsg } from '@/bindings/EventMsg';
import React, { JSX, useMemo } from 'react';
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';

import { github } from 'react-syntax-highlighter/dist/esm/styles/hljs';

interface EventLogProps {
  events: EventMsg[];
}

const EventLog: React.FC<EventLogProps> = ({ events }) => {
      const aggregatedOutputs = useMemo(() => {
      const outputs = new Map<string, { output: string, command: string[] }>();
      events.forEach(event => {
        if (event.type === 'exec_command_output_delta' && 'call_id' in event && event.chunk) {
          const decodedChunk = event.chunk;
          const current = outputs.get(event.call_id) || { output: '', command: [] };
          outputs.set(event.call_id, { ...current, output: current.output + decodedChunk });
        } else if (event.type === 'exec_command_begin' && 'call_id' in event && 'command' in event) {
          const current = outputs.get(event.call_id) || { output: '', command: [] };
          outputs.set(event.call_id, { ...current, command: event.command });
        }
      });
      return outputs;
    }, [events]);
  const renderEvent = (event: EventMsg): JSX.Element | null => {
    switch (event.type) {
      case 'task_started':
        return <div className="text-sm text-gray-500">🚀 Task started</div>;
      
      case 'agent_message':
        return 'message' in event ? <div className="text-sm my-1">🤖 {event.message}</div> : null;

      case 'exec_command_begin':
        if ('parsed_cmd' in event && event.parsed_cmd.length > 0 && 'ListFiles' in event.parsed_cmd[0]) {
          return <div className="text-sm text-gray-500">🔍 Listing files...</div>;
        }
        return (
          <div className="text-sm text-gray-500">
            🔄 Executing: <strong>{('command' in event ? event.command.join(' ') : '')}</strong>
          </div>
        );

      case 'exec_command_end': {
        const data = aggregatedOutputs.get(event.call_id);
        if (!data || data.output.trim() === '') return null;
        
        const language = data.command.join(' ').includes('diff') ? 'diff' : 'bash';

        return (
          <div className="event command-end mt-2">
            <details>
              <summary className="text-sm font-semibold cursor-pointer">📋 Command Output</summary>
              <SyntaxHighlighter language={language} style={github} customStyle={{maxHeight: '400px', overflowY: 'auto'}}>
                {data.output}
              </SyntaxHighlighter>
            </details>
          </div>
        );
      }
      
      case 'task_complete':
        return <div className="text-sm text-gray-500 mt-2">✅ Task complete</div>;

      // Hide noisy events
      case 'exec_command_output_delta':
      case 'token_count':
        return null;

      default:
        return <div className="text-xs text-gray-400">Unhandled event: {event.type}</div>;
    }
  };

  return (
    <div className="log-container space-y-2">
      {events.map((event) => (
        <div key={'call_id' in event ? event.call_id : `${event.type}-${Math.random()}`} className="event-item">
          {renderEvent(event)}
        </div>
      ))}
    </div>
  );
};

export default EventLog;