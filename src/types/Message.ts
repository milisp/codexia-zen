import { EventMsg } from "@/bindings/EventMsg";

export type EventWithId = { id: string, msg: EventMsg, request_id?: number; };

export interface Message {
    id: string;
    role: "assistant" | "user";
    content?: string; // Make content optional for agent messages
    timestamp: number;
    events?: EventWithId[]; // Add events array for agent messages
}