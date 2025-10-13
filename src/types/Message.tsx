import { EventMsg } from "@/bindings/EventMsg";

export interface Message {
    id: string;
    role: "assistant" | "user";
    content?: string; // Make content optional for agent messages
    timestamp: number;
    events?: EventMsg[]; // Add events array for agent messages
}