import { Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useConfigStore } from '@/stores/useConfigStore';
import type { SandboxMode } from '@/bindings/v2/SandboxMode';
import type { AskForApproval } from '@/bindings/v2/AskForApproval';
import { cn } from '@/lib/utils';

export function SandboxPolicyPopover() {
  const { sandbox, approvalPolicy, setSandboxMode, setApprovalPolicy } = useConfigStore();

  const sandboxModes: SandboxMode[] = ['read-only', 'workspace-write', 'danger-full-access'];
  const approvalPolicies: AskForApproval[] = ['untrusted', 'on-failure', 'on-request', 'never'];


  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Shield className="h-4 w-4" />
          {sandbox === "read-only" ? "Chat" : sandbox === "workspace-write" ? "agent" : "agent(Full)"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[450px] p-0">
         <div className="flex divide-x">
           {/* left */}
           <div className="w-28 p-2 space-y-1">
             <div className="px-2 py-1 text-xs font-medium text-muted-foreground">Mode</div>
             {sandboxModes.map((mode) => (
               <button
                 key={mode}
                 onClick={() => setSandboxMode(mode)}
                 className={cn(
                   "w-full text-left px-2 py-1.5 text-sm rounded hover:bg-accent",
                   sandbox === mode && "bg-accent font-medium"
                 )}
               >
                 {mode === "read-only" ? "Chat" : mode === "workspace-write" ? "agent" : "agent(Full)"}
               </button>
             ))}
          </div>

           {/* Center: Sandbox */}
           <div className="w-40 p-2 space-y-1">
             <div className="px-2 py-1 text-xs font-medium text-muted-foreground">Sandbox</div>
             {sandboxModes.map((mode) => (
                <div className={cn("w-full text-left px-2 py-1.5 text-sm rounded",
                   sandbox === mode && "bg-accent font-medium")}>{mode}</div>
             ))}
          </div>
          {/* Right: Approval */}
          <div className="w-28 p-2 space-y-1">
            <div className="px-2 py-1 text-xs font-medium text-muted-foreground">Approval</div>
            {approvalPolicies.map((policy) => (
              <button
                key={policy}
                onClick={() => setApprovalPolicy(policy)}
                className={cn(
                  "w-full text-left px-2 py-1.5 text-sm rounded hover:bg-accent",
                  approvalPolicy === policy && "bg-accent font-medium"
                )}
              >
                {policy}
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
