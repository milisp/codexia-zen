export type { Message} from "./Message"
import { EventMsg } from "@/bindings/EventMsg";

export interface Params {
  id: string;
  msg: EventMsg;
  conversationId: string;
}

export interface Line {
  method: string;
  params: Params;
}