import { EventMsg } from "@/bindings/EventMsg";

export type StreamedEventNotification = {
    method: string;
    params: {
      conversationId: string;
      id: string;
      msg: EventMsg;
    };
  };
  