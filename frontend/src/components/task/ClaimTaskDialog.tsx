import { ArrowUpRight, Clock3, Wallet, FileCheck2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../ui/Dialog";
export interface ClaimPreview { subtaskId: string; rangeLabel?: string; objective?: string; reward: string; leaseDuration?: number; deliverableFormat?: string; acceptanceCriteria?: string[]; }
interface Props {
  task: ClaimPreview | null; bond: string | null; currency: string; connected: boolean;
  busy: boolean; message?: string; onClose: () => void; onConfirm: () => void; onConnect: () => void;
}
export function ClaimTaskDialog({task,bond,currency,connected,busy,message,onClose,onConfirm,onConnect}: Props) {
  return <Dialog open={Boolean(task)} onOpenChange={open => { if (!open && !busy) onClose(); }}>
    <DialogContent className="claim-dialog" onEscapeKeyDown={e => { if(busy)e.preventDefault(); }} onPointerDownOutside={e => { if(busy)e.preventDefault(); }}>
      <DialogHeader><p className="eyebrow">Your next contribution</p><DialogTitle>Review your claim</DialogTitle><DialogDescription>Check the scope and commitment before continuing to your wallet.</DialogDescription></DialogHeader>
      {task && <>
        <div className="claim-task-name"><FileCheck2 size={22} /><div><h3>{task.rangeLabel || "Independent task"}</h3>{task.objective && <p>{task.objective}</p>}</div></div>
        <div className="claim-figures"><div><span>Task reward</span><strong>{task.reward} <small>{currency}</small></strong></div><div><span>Required claim bond</span><strong>{bond ?? "Loading…"} <small>{bond !== null ? currency : ""}</small></strong></div></div>
        <div className="claim-fact"><Clock3 size={17} /><div><strong>Submission window</strong><p>{task.leaseDuration ? `${Math.ceil(task.leaseDuration / 60)} minutes after claiming` : "See the task specification for its deadline."}</p></div></div>
        {task.deliverableFormat && <div className="claim-fact"><FileCheck2 size={17} /><div><strong>Deliverable</strong><p>{task.deliverableFormat}</p></div></div>}
        {!!task.acceptanceCriteria?.length && <details className="claim-criteria"><summary>Acceptance criteria <span>{task.acceptanceCriteria.length}</span></summary><ul>{task.acceptanceCriteria.map((criterion,i)=><li key={i}>{criterion}</li>)}</ul></details>}
        <p className="claim-terms">The bond is locked when you claim. Successful verification returns it with your reward; failed verification can be appealed. The bond remains held until an administrator resolves the appeal; an upheld rejection or an expired claim reclaimed by another user forfeits it. Network fees are additional.</p>
        {message && <p role="status" className="claim-feedback">{message}</p>}
        <DialogFooter><button className="btn btn-ghost" onClick={onClose} disabled={busy}>Back to task</button>{connected ? <button className="btn btn-primary" disabled={busy || bond === null} onClick={onConfirm}>{busy ? <><span className="loading loading-spinner loading-xs" />Claim in progress</> : <>Continue in wallet <ArrowUpRight size={16} /></>}</button> : <button className="btn btn-primary" onClick={onConnect}><Wallet size={16} />Connect wallet</button>}</DialogFooter>
      </>}
    </DialogContent>
  </Dialog>;
}
