import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useWeb3 } from "../contexts/Web3Context";
import { ethers } from "ethers";
import { CheckCircle2, Clock, PlayCircle, Search, ShieldCheck } from "lucide-react";
import { API_URL } from "../lib/constants";

const TaskDetail = () => {
  const { taskId } = useParams();
  const { account, taskManager } = useWeb3();
  const [task, setTask] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submissionContent, setSubmissionContent] = useState<{ [key: string]: string }>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const fetchTask = async () => {
    try {
      const res = await fetch(`${API_URL}/api/tasks/${taskId}`);
      if (res.ok) {
        const data = await res.json();
        setTask(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTask();
    const interval = setInterval(fetchTask, 3000);
    return () => clearInterval(interval);
  }, [taskId]);

  const handleSubmit = async (subtaskId: string) => {
    if (!account) {
      alert("Please connect your wallet first");
      return;
    }
    const content = submissionContent[subtaskId];
    if (!content) return;

    setSubmittingId(subtaskId);
    try {
      console.log(`[TaskDetail] Starting submission for subtask ${subtaskId}...`);
      
      const submissionHash = ethers.id(content);
      const txData = taskManager!.interface.encodeFunctionData("recordSubmissionProof", [taskId, subtaskId, submissionHash]);
      
      console.log(`[TaskDetail] Prompting MetaMask to sign recordSubmissionProof tx...`);
      const txHash = await (window as any).ethereum.request({
        method: "eth_sendTransaction",
        params: [
          {
            from: account,
            to: await taskManager!.getAddress(),
            data: txData,
            gas: "0x186A0"
          }
        ]
      });
      console.log(`[TaskDetail] Transaction broadcasted with hash: ${txHash}`);

      console.log(`[TaskDetail] Waiting for Monad Testnet to mine the block...`);
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      await provider.waitForTransaction(txHash);
      console.log(`[TaskDetail] Transaction successfully mined on-chain!`);

      console.log(`[TaskDetail] Saving submission to off-chain DB...`);
      const res = await fetch(`${API_URL}/api/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subtaskId, worker: account, content })
      });
      const data = await res.json();
      console.log(`[TaskDetail] DB Save response:`, data);
      if (!res.ok) throw new Error(data.error || "Submission failed");

      console.log(`[TaskDetail] Triggering AI Orchestrator API for verification...`);
      fetch(`${API_URL}/api/orchestrator/trigger-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subtaskId })
      })
        .then(async (res) => {
           console.log(`[TaskDetail] Orchestrator responded with status: ${res.status}`);
           const respData = await res.json();
           console.log(`[TaskDetail] Orchestrator full response:`, respData);
        })
        .catch(err => console.error(`[TaskDetail] Orchestrator fetch error:`, err));

      alert("Work submitted! The AI Orchestrator is now verifying your submission. Check the console logs!");
      setSubmissionContent({ ...submissionContent, [subtaskId]: "" });
      fetchTask();
    } catch (e: any) {
      console.error("[TaskDetail] Submission Error:", e);
      alert(e.message || "Error submitting work");
    } finally {
      setSubmittingId(null);
    }
  };

  if (loading) return <div className="text-center py-20 font-mono">Loading Task Room...</div>;
  if (!task) return <div className="text-center py-20 font-mono text-red-500">Task not found</div>;

  const totalBudget = task.budget;
  const verifiedCount = task.subtasks.filter((s: any) => s.state === 'VERIFIED').length;
  const totalCount = task.subtasks.length;
  const progressPercent = totalCount === 0 ? 0 : (verifiedCount / totalCount) * 100;
  
  // Mock transaction hashes for the hackathon demo effect (in reality, store these in DB)
  const mockEscrowHash = "0x8f2d" + task.taskId.substring(0, 10).toLowerCase();

  // Helper to format timestamps
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleString(undefined, { 
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
    });
  };

  return (
    <div className="animate-in fade-in duration-700 ease-out max-w-4xl mx-auto pb-24">
      
      {/* Header */}
      <div className="mb-10 border-b border-gray-200 pb-10">
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-black mb-6 leading-tight">
          {task.description}
        </h1>
        
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="flex items-center gap-6">
            <div>
              <p className="text-sm font-semibold text-gray-500 mb-1 tracking-wider uppercase">Escrowed</p>
              <p className="text-3xl font-mono font-bold text-black">{totalBudget} <span className="text-lg text-gray-400">MON</span></p>
            </div>
            <div className="h-10 w-px bg-gray-200"></div>
            <div>
              <p className="text-sm font-semibold text-gray-500 mb-1 tracking-wider uppercase">Status</p>
              <p className="text-lg font-bold text-black flex items-center gap-2">
                {progressPercent === 100 ? (
                  <><CheckCircle2 className="w-5 h-5 text-emerald-500" /> Settled</>
                ) : (
                  <><Clock className="w-5 h-5 text-amber-500" /> In Progress</>
                )}
              </p>
            </div>
          </div>
          
          <div className="w-full md:w-64">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-semibold text-gray-600">{verifiedCount} / {totalCount} complete</span>
              <span className="text-sm font-mono text-gray-500">{progressPercent.toFixed(0)}%</span>
            </div>
            <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
              <div className="bg-black h-full transition-all duration-1000 ease-out" style={{ width: `${progressPercent}%` }}></div>
            </div>
          </div>
        </div>
      </div>

      {task.status === "COMPLETED" && task.solution && (
        <div className="mb-12 bg-gray-50 border border-gray-200 rounded-xl p-8 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            Final Aggregated Solution
          </h3>
          <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
            {task.solution}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        
        {/* Left Column: Subtasks Graph */}
        <div className="lg:col-span-2 space-y-6">
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 mb-6">
            <Search className="w-4 h-4 text-gray-500" />
            Execution Graph
          </h3>
          
          {task.subtasks.map((st: any) => {
            const isVerified = st.state === 'VERIFIED';
            const isSubmitted = st.submissions && st.submissions.length > 0 && !isVerified;
            const isClaimed = st.state === 'CLAIMED' || st.state === 'SUBMITTED' || (st.worker && !isSubmitted && !isVerified);
            
            const isMyTask = account && st.worker && st.worker.toLowerCase() === account.toLowerCase();

            return (
              <div key={st.subtaskId} className="bg-white border border-gray-200 rounded-xl overflow-hidden transition-all hover:border-gray-300 shadow-sm">
                <div className={`p-5 flex justify-between items-start border-b ${isVerified ? 'border-gray-100 bg-emerald-50/10' : 'border-gray-100'}`}>
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      {isVerified ? (
                        <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-1 rounded flex items-center gap-1">✓ VERIFIED</span>
                      ) : isSubmitted ? (
                        <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-1 rounded flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span> AI VERIFYING</span>
                      ) : isClaimed ? (
                        <span className="bg-amber-50 text-amber-700 text-[10px] font-bold px-2 py-1 rounded flex items-center gap-1"><PlayCircle className="w-3 h-3" /> IN PROGRESS</span>
                      ) : (
                        <span className="bg-gray-100 text-gray-600 text-[10px] font-bold px-2 py-1 rounded">AVAILABLE</span>
                      )}
                      
                      <span className="text-xs font-bold text-black">{st.rangeLabel}</span>
                    </div>
                    
                    <p className="text-sm text-gray-600 pr-8">{st.description}</p>
                  </div>
                  
                  <div className="text-right">
                    <p className="text-xs font-semibold text-gray-500 mb-1 tracking-wider uppercase">Reward</p>
                    <p className={`text-sm font-mono font-bold ${isVerified ? 'text-emerald-600' : 'text-black'}`}>
                      {isVerified && '+'}{st.reward} MON
                    </p>
                  </div>
                </div>

                <div className="px-5 py-3 bg-gray-50/50 flex flex-wrap items-center justify-between gap-y-2">
                  <div className="text-xs text-gray-500 flex flex-wrap items-center gap-4">
                    {st.worker ? (
                      <span className="font-mono bg-white px-2 py-1 border border-gray-200 rounded text-gray-700 shadow-sm">
                        Worker: {st.worker.slice(0, 6)}...{st.worker.slice(-4)}
                      </span>
                    ) : (
                      <span className="text-gray-400 italic">Waiting for worker...</span>
                    )}
                    
                    {st.updatedAt && (
                      <span className="text-gray-400 font-medium flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {formatDate(st.updatedAt)}
                      </span>
                    )}
                  </div>
                  
                  {isVerified && (
                     <div className="text-xs font-mono text-emerald-600 font-semibold flex items-center gap-1">
                       <ShieldCheck className="w-3.5 h-3.5" /> Settled On-Chain
                     </div>
                  )}
                </div>

                {/* Worker Submission Box */}
                {isMyTask && !isSubmitted && !isVerified && (
                  <div className="p-5 border-t border-gray-200 bg-blue-50/30">
                    <label className="block text-xs font-bold tracking-wider uppercase text-blue-800 mb-3">Submit your work</label>
                    <textarea
                      className="w-full p-3 bg-white border border-blue-200 rounded-lg text-sm focus:border-blue-500 outline-none mb-3 shadow-sm text-black placeholder-gray-400"
                      placeholder="Paste your completed JSON/text here..."
                      rows={3}
                      value={submissionContent[st.subtaskId] || ""}
                      onChange={(e) => setSubmissionContent({ ...submissionContent, [st.subtaskId]: e.target.value })}
                    />
                    <button 
                      onClick={() => handleSubmit(st.subtaskId)}
                      disabled={submittingId === st.subtaskId || !submissionContent[st.subtaskId]}
                      className="bg-blue-600 text-white px-5 py-2.5 text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors w-full sm:w-auto"
                    >
                      {submittingId === st.subtaskId ? "Submitting..." : "Submit to Orchestrator"}
                    </button>
                  </div>
                )}
                
                {/* View Verification Output */}
                {isVerified && st.submissions && st.submissions.length > 0 && (
                   <div className="p-5 border-t border-gray-100">
                     <p className="text-xs font-bold tracking-wider uppercase text-gray-400 mb-2">Worker Output</p>
                     <p className="text-sm text-gray-800 font-mono bg-gray-100 p-3 rounded-md break-words">{st.submissions[0].storagePath}</p>
                   </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Right Column: Monad Transactions */}
        <div>
          <div className="sticky top-24">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 mb-6">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              Monad Settlement
            </h3>
            
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="font-semibold text-gray-700">Escrow</span>
                <a href={`https://testnet.monadexplorer.com/tx/${mockEscrowHash}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline font-mono text-xs">
                  {mockEscrowHash.slice(0,8)}...
                </a>
              </div>
              
              {task.subtasks.map((st: any) => {
                if (st.state === 'VERIFIED') {
                  // Mock payout hash
                  const mockPayoutHash = "0x72c" + st.subtaskId.substring(0, 10).toLowerCase();
                  return (
                    <div key={st.subtaskId} className="flex justify-between items-center text-sm pt-4 border-t border-gray-200">
                      <div>
                        <span className="font-semibold text-emerald-600 block">Payout</span>
                        <span className="text-[10px] text-gray-500 uppercase">{st.rangeLabel}</span>
                      </div>
                      <a href={`https://testnet.monadexplorer.com/tx/${mockPayoutHash}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline font-mono text-xs">
                        {mockPayoutHash.slice(0,8)}...
                      </a>
                    </div>
                  );
                }
                return null;
              })}
            </div>
            
            <p className="text-xs text-gray-400 mt-6 text-center leading-relaxed">
              Parallelis leverages the Monad Testnet to guarantee trustless execution and sub-second settlement for global AI compute.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default TaskDetail;
