import './App.css';
import { ChatView } from '@/components/ChatView';
import { open } from "@tauri-apps/plugin-dialog"
import { Button } from "@/components/ui/button"
import { useCodex } from "@/stores/useCodexStore"

export default function App() {
  const { setCwd, cwd } = useCodex();

  const openProject = async() => {
      const result = await open({
        directory: true,
        multiple: false,
      });
      if (result) {
        console.log("open project", result)
        setCwd(result);
      }
    
  };
  
  return (
    <div className="flex flex-col bg-background text-foreground h-screen">
      <div className="flex px-2 gap-2 py-2">
        <Button onClick={openProject}>Open project</Button>
        {cwd ?
            <span>{cwd}</span>
          : <span className='bg-red-500'>must setup project</span>
        }
      </div>
      <ChatView />
    </div>
  );
}