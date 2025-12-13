import { useApprovalStore } from '@/stores/useApprovalStore';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

export function ApprovalDialog() {
  const { currentApproval, respondToApproval } = useApprovalStore();

  if (!currentApproval) return null;

  const isCommandExecution = currentApproval.type === 'commandExecution';

  const handleApprove = async () => {
    try {
      await respondToApproval(
        currentApproval.requestId,
        'accept',
        isCommandExecution
      );
    } catch (error) {
      console.error('Failed to approve:', error);
    }
  };

  const handleApproveForSession = async () => {
    try {
      await respondToApproval(
        currentApproval.requestId,
        'acceptForSession',
        isCommandExecution
      );
    } catch (error) {
      console.error('Failed to approve for session:', error);
    }
  };

  const handleDecline = async () => {
    try {
      await respondToApproval(
        currentApproval.requestId,
        'decline',
        isCommandExecution
      );
    } catch (error) {
      console.error('Failed to decline:', error);
    }
  };

  return (
    <Dialog open={!!currentApproval}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-warning" />
            Approval Required
          </DialogTitle>
          <DialogDescription>
            {isCommandExecution
              ? 'The agent wants to execute a command'
              : 'The agent wants to change files'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <div className="text-sm font-medium mb-1">Thread ID:</div>
            <div className="text-sm text-muted-foreground font-mono">
              {currentApproval.threadId}
            </div>
          </div>

          <div>
            <div className="text-sm font-medium mb-1">Item ID:</div>
            <div className="text-sm text-muted-foreground font-mono">
              {currentApproval.itemId}
            </div>
          </div>

          {currentApproval.reason && (
            <div>
              <div className="text-sm font-medium mb-1">Reason:</div>
              <div className="text-sm text-muted-foreground p-2 bg-muted rounded">
                {currentApproval.reason}
              </div>
            </div>
          )}

          {isCommandExecution && currentApproval.proposedExecpolicyAmendment && (
            <div>
              <div className="text-sm font-medium mb-1">Proposed Command:</div>
              <div className="text-sm text-muted-foreground p-2 bg-muted rounded font-mono">
                {currentApproval.proposedExecpolicyAmendment.join(' ')}
              </div>
            </div>
          )}

          {!isCommandExecution && currentApproval.grantRoot && (
            <div>
              <div className="text-sm font-medium mb-1">Grant Root:</div>
              <div className="text-sm text-muted-foreground p-2 bg-muted rounded font-mono">
                {currentApproval.grantRoot}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={handleDecline}>
            Decline
          </Button>
          <Button variant="secondary" onClick={handleApproveForSession}>
            Approve for Session
          </Button>
          <Button onClick={handleApprove}>Approve Once</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
