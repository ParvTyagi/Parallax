import React, { useState, useEffect } from "react";
import { useWeb3 } from "../contexts/Web3Context";
import { ethers } from "ethers";

const WorkerTasks = () => {
  const { account, signer, taskManager, connectWallet } = useWeb3();
  const [subtasks, setSubtasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  useEffect(() => {
    fetchSubtasks();
  }, []);

  const fetchSubtasks = async () => {
    try {
      const res = await fetch("http://localhost:3000/api/tasks/open-subtasks");
      const data = await res.json();
      setSubtasks(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleClaim = async (taskId: string, subtaskId: string) => {
    if (!account) {
      await connectWallet();
      return;
    }
    setClaimingId(subtaskId);
    try {
      const txData = taskManager!.interface.encodeFunctionData("claimSubtask", [taskId, subtaskId]);
      // signer is already destructured from useWeb3
      
      await (window as any).ethereum.request({
        method: "eth_sendTransaction",
        params: [
          {
            from: await signer.getAddress(),
            to: await taskManager!.getAddress(),
            data: txData,
            gas: "0x186A0" // 100,000 gas limit (reduced from 300k to show a much lower fee in MetaMask)
          }
        ]
      });

      alert("Subtask claimed successfully! You can now submit your work on the Task Detail page.");
      fetchSubtasks(); // Refresh the list
    } catch (error: any) {
      console.error(error);
      alert("Error: " + (error.message || "Unknown error"));
    } finally {
      setClaimingId(null);
    }
  };

  return (
    <div className="animate-in fade-in duration-700 ease-out">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-black mb-2">Available Work</h1>
          <p className="text-gray-500">Claim verified microtasks. Instant payout via Monad Testnet.</p>
        </div>
        <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-md text-xs font-semibold border border-emerald-100">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          Network Live
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-500 font-mono">Loading subtasks...</div>
      ) : subtasks.length === 0 ? (
        <div className="text-center py-20 text-gray-500">No open subtasks available right now.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {subtasks.map((st) => (
            <div key={st.subtaskId} className="bg-white border-crisp rounded-xl p-6 shadow-sm hover:shadow-crisp-hover transition-all flex flex-col h-full group">
              <div className="flex justify-between items-start mb-4">
                <span className="text-xs font-bold text-gray-500 tracking-wider uppercase">{st.rangeLabel}</span>
                <span className="bg-black text-white text-xs font-mono px-2 py-1 rounded">{st.reward} MON</span>
              </div>
              <h2 className="text-lg font-bold text-black mb-2 group-hover:text-gray-600 transition-colors">{st.task.description.substring(0, 50)}...</h2>
              <p className="text-gray-500 text-sm leading-relaxed mb-8 flex-grow">
                {st.description}
              </p>
              <button 
                onClick={() => handleClaim(st.taskId, st.subtaskId)}
                disabled={claimingId === st.subtaskId}
                className="w-full bg-gray-50 border border-gray-200 text-black font-semibold py-2.5 rounded-lg hover:bg-black hover:text-white transition-colors text-sm disabled:opacity-50"
              >
                {claimingId === st.subtaskId ? "Claiming..." : account ? "Claim Task" : "Connect to Claim"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default WorkerTasks;
