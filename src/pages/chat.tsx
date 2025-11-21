import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ConversationList } from "@/components/ConversationList";

export default function ChatPage() {

  return (
    <ResizablePanelGroup direction="horizontal" className="h-full w-screen">
      <ResizablePanel defaultSize={20}>
        <ConversationList />
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
