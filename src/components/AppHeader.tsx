import { open } from "@tauri-apps/plugin-dialog";
import { useConfigStore } from "@/stores/useConfigStore";
import { useLayoutStore } from "@/stores/useLayoutStore";
import { Button } from "./ui/button";
import { PanelLeft } from "lucide-react";

export function AppHeader() {
  const { cwd, setCwd } = useConfigStore();
  const { toggleSidebar } = useLayoutStore();

  async function selectCwd() {
    try {
      const projectPath = await open({
        directory: true,
        multiple: false,
      });

      if (!projectPath) {
        // User cancelled
        return;
      }
      setCwd(projectPath);
    } catch (e) {}
  }

  return (
    <div className="flex justify-between">
      <Button onClick={toggleSidebar}>
        <PanelLeft />
      </Button>
      <Button variant="outline" onClick={selectCwd}>
        project {cwd}
      </Button>
    </div>
  );
}
