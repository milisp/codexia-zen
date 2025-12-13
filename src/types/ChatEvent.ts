import type { ServerNotification } from '@/bindings/ServerNotification';

/**
 * UI-specific event type that extends ServerNotification
 * to include user input messages
 */
export type ChatEvent =
  | ServerNotification
  | {
      method: 'user_input';
      params: {
        text: string;
      };
    };
