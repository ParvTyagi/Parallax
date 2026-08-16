import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useWeb3 } from "../contexts/Web3Context";
import { ethers } from "ethers";

const TaskDetail = () => {
  const { taskId } = useParams();
  const { account } = useWeb3();
  const [task, setTask] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submissionContent, setSubmissionContent] = useState<{ [key: string]: string }>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const fetchTask = async () => {
    try {
      const res = await fetch(`http://localhost:3000/api/tasks/${taskId}`);
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

  // Poll for updates every 3 seconds to create the "Live Execution" feel
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
      // 1. Submit to backend
      const res = await fetch("http://localhost:3000/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subtaskId, worker: account, content })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submission failed");

      // 2. Trigger Orchestrator Verification immediately
      fetch("http://localhost:3000/api/orchestrator/trigger-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subtaskId })
      }); // We don't await this, it runs in background and blockchain event updates the DB

      alert("Work submitted! The AI Orchestrator is now verifying your submission.");
      setSubmissionContent({ ...submissionContent, [subtaskId]: "" });
      fetchTask();
    } catch (e: any) {
      console.error(e);
      alert(e.message || "Error submitting work");
    } finally {
      setSubmittingId(null);
    }
  };

  if (loading) return <div className="text-center py-20 font-mono">Loading task pipeline...</div>;
  if (!task) return <div className="text-center py-20 font-mono text-red-500">Task not found</div>;

  const totalBudget = ethers.formatEther(task.budget);
  const distributed = task.subtasks.filter((s: any) => s.status === 'VERIFIED').reduce((acc: number, s: any) => acc + Number(ethers.formatEther(s.reward)), 0);
  const remaining = Number(totalBudget) - distributed;
  const progressPercent = (distributed / Number(totalBudget)) * 100;

  return (
    <div className="animate-in fade-in duration-700 ease-out">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 border-b border-gray-200 pb-8">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-black mb-2">Master Task Execution</h1>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-gray-400 font-mono">{task.taskId}</span>
            <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-semibold">IN PROGRESS</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        
        {/* Left Column: Flow */}
        <div className="lg:col-span-2">
          <h3 className="text-xs font-bold text-gray-400 tracking-widest uppercase mb-6">Execution Pipeline</h3>
          
          <div className="relative border-l border-gray-200 ml-3 space-y-10 pb-4">
            
            {task.subtasks.map((st: any, index: number) => {
              const isVerified = st.status === 'VERIFIED';
              const isSubmitted = st.submissions && st.submissions.length > 0 && !isVerified;
              const isClaimed = st.worker && !isSubmitted && !isVerified;
              const isOpen = !st.worker;
              
              const isMyTask = account && st.worker && st.worker.toLowerCase() === account.toLowerCase();

              return (
                <div key={st.subtaskId} className="relative pl-8">
                  <span className={`absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full ring-4 ring-white ${isVerified ? 'bg-black' : isSubmitted ? 'bg-blue-500' : isClaimed ? 'bg-amber-400' : 'bg-gray-200'}`}></span>
                  
                  <div className={`bg-white border-crisp shadow-sm rounded-lg p-5 transition-all ${isOpen ? 'opacity-60' : isSubmitted ? 'ring-1 ring-blue-500/20' : ''}`}>
                    <div className="flex justify-between items-start mb-3">
                      <h4 className={`font-bold ${isOpen ? 'text-gray-600' : 'text-black'}`}>{st.rangeLabel}</h4>
                      
                      {isVerified && <span className="text-xs font-bold bg-green-50 text-green-700 px-2 py-1 rounded">SETTLED</span>}
                      {isSubmitted && <span className="text-xs font-bold bg-blue-50 text-blue-700 px-2 py-1 rounded animate-pulse">VERIFYING AI</span>}
                      {isClaimed && <span className="text-xs font-bold bg-amber-50 text-amber-700 px-2 py-1 rounded">WORKING</span>}
                      {isOpen && <span className="text-xs font-bold bg-gray-100 text-gray-500 px-2 py-1 rounded">OPEN</span>}
                    </div>
                    
                    <p className="text-sm text-gray-600 mb-4">{st.description}</p>
                    
                    <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                      {st.worker && <span className="font-mono bg-gray-50 px-1.5 py-0.5 rounded border border-gray-200">Worker: {st.worker.slice(0, 6)}...{st.worker.slice(-4)}</span>}
                      <span>Payout: {ethers.formatEther(st.reward)} MON</span>
                    </div>

                    {/* Submission UI for Worker */}
                    {isMyTask && !isSubmitted && !isVerified && (
                      <div className="mt-4 pt-4 border-t border-gray-100">
                        <textarea
                          className="w-full p-3 bg-gray-50 border border-gray-200 rounded text-sm focus:border-black outline-none mb-3 placeholder-gray-400 text-black"
                          placeholder="Paste your completed work here..."
                          rows={3}
                          value={submissionContent[st.subtaskId] || ""}
                          onChange={(e) => setSubmissionContent({ ...submissionContent, [st.subtaskId]: e.target.value })}
                        />
                        <button 
                          onClick={() => handleSubmit(st.subtaskId)}
                          disabled={submittingId === st.subtaskId || !submissionContent[st.subtaskId]}
                          className="bg-black text-white px-4 py-2 text-sm font-semibold rounded hover:bg-gray-800 disabled:opacity-50 transition-colors"
                        >
                          {submittingId === st.subtaskId ? "Submitting..." : "Submit Result to AI Verifier"}
                        </button>
                      </div>
                    )}
                    
                    {/* View Submission Result */}
                    {isVerified && st.submissions && st.submissions.length > 0 && (
                       <div className="mt-4 pt-4 border-t border-gray-100 bg-gray-50 p-3 rounded text-sm text-gray-600 break-words">
                         <p className="font-semibold text-black mb-1">Worker Output:</p>
                         {st.submissions[0].storagePath}
                       </div>
                    )}
                  </div>
                </div>
              );
            })}

          </div>
        </div>

        {/* Right Column: Escrow Stats */}
        <div>
          <h3 className="text-xs font-bold text-gray-400 tracking-widest uppercase mb-6">Escrow State</h3>
          <div className="bg-black rounded-xl p-8 text-white shadow-xl sticky top-24">
            
            <div className="mb-8">
              <p className="text-gray-400 text-sm font-semibold mb-1">Total Escrowed</p>
              <p className="text-4xl font-mono tracking-tight">{totalBudget} <span className="text-gray-500 text-2xl">MON</span></p>
            </div>
            
            <div className="space-y-4">
              <div className="flex justify-between items-end border-b border-gray-800 pb-4">
                <p className="text-gray-400 text-sm">Distributed</p>
                <p className="text-xl font-mono text-white">{distributed.toFixed(2)} MON</p>
              </div>
              <div className="flex justify-between items-end">
                <p className="text-gray-400 text-sm">Remaining</p>
                <p className="text-xl font-mono text-gray-400">{remaining.toFixed(2)} MON</p>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-800">
               <div className="w-full bg-gray-800 rounded-full h-1.5">
                 <div className="bg-white h-1.5 rounded-full transition-all duration-1000 ease-out" style={{ width: `${progressPercent}%` }}></div>
               </div>
               <p className="text-right text-xs text-gray-500 font-mono mt-2">{progressPercent.toFixed(0)}% COMPLETED</p>
            </div>
            
          </div>
        </div>

      </div>
    </div>
  );
};

export default TaskDetail;
