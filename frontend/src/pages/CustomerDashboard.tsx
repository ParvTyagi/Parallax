import { useState, useEffect } from "react";
import { useWeb3 } from "../contexts/Web3Context";
import { ethers } from "ethers";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/Tabs";
import { API_URL } from "../lib/constants";

const CustomerDashboard = () => {
  const { account, signer, taskManager, connectWallet } = useWeb3();
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState("");

  const [myTasks, setMyTasks] = useState<any[]>([]);

  useEffect(() => {
    if (account) {
      fetchCustomerTasks(account);
    } else {
      setMyTasks([]);
    }
  }, [account]);

  useEffect(() => {
    let interval: any;
    if (account && myTasks.length > 0) {
      interval = setInterval(() => {
        fetchCustomerTasks(account);
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [account, myTasks.length]);

  const fetchCustomerTasks = async (walletAddress: string) => {
    try {
      const res = await fetch(`${API_URL}/api/tasks/customer/${walletAddress}`);
      if (res.ok) {
        const data = await res.json();
        setMyTasks(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDecompose = async () => {
    if (!account) {
      await connectWallet();
      return;
    }
    if (!description || !budget) return;

    setIsProcessing(true);
    try {
      setStatusText("AI is analyzing and decomposing the master task...");
      const res = await fetch(`${API_URL}/api/decompose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, budget })
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || "Decompose failed");

      setStatusText("Awaiting MetaMask confirmation to fund escrow...");
      
      let totalValue = 0n;
      const subtasksFormatted = data.subtasks.map((st: any) => {
        const rewardBigInt = ethers.parseEther(st.reward.toString());
        totalValue += rewardBigInt;
        return {
          rangeLabel: st.rangeLabel,
          description: st.description,
          reward: rewardBigInt
        };
      });
      
      const txData = taskManager!.interface.encodeFunctionData("createTask", [
        data.masterTask,
        subtasksFormatted
      ]);

      await window.ethereum.request({
        method: "eth_sendTransaction",
        params: [
          {
            from: await signer!.getAddress(),
            to: await taskManager!.getAddress(),
            data: txData,
            value: "0x" + totalValue.toString(16),
            gas: "0x2DC6C0"
          }
        ]
      });
      
      setStatusText("Transaction sent! Waiting for confirmation...");
      
      setStatusText("Task created successfully on Monad Testnet!");
      setTimeout(() => {
        setIsProcessing(false);
        setStatusText("");
        setDescription("");
        setBudget("");
        if (account) fetchCustomerTasks(account);
      }, 3000);
      
    } catch (error: any) {
      console.error(error);
      alert("Error: " + (error.message || "Unknown error"));
      setIsProcessing(false);
      setStatusText("");
    }
  };

  const activeCount = myTasks.filter(t => t.subtasks.some((st:any) => st.state !== "VERIFIED")).length;
  const completedCount = myTasks.filter(t => t.subtasks.every((st:any) => st.state === "VERIFIED") && t.subtasks.length > 0).length;
  const escrowedMON = myTasks.reduce((acc, t) => acc + Number(t.budget), 0).toFixed(2);

  return (
    <div className="animate-in fade-in duration-700 ease-out max-w-5xl mx-auto pb-24">
      
      {/* Header & Stats */}
      <div className="mb-10">
        <h1 className="text-2xl font-bold tracking-tight text-black mb-6">Welcome to Parallax.<br/><span className="text-gray-400 font-normal">Manage your tasks.</span></h1>
        
        {account && (
          <div className="grid grid-cols-3 gap-6 bg-white border border-gray-100 rounded-xl p-6 shadow-sm mb-10">
            <div>
              <p className="text-sm text-gray-500 font-medium mb-1">Active Tasks</p>
              <p className="text-2xl font-mono font-bold text-black">{activeCount}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium mb-1">Escrowed</p>
              <p className="text-2xl font-mono font-bold text-black">{escrowedMON} <span className="text-sm text-gray-400">MON</span></p>
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium mb-1">Completed</p>
              <p className="text-2xl font-mono font-bold text-emerald-600">{completedCount}</p>
            </div>
          </div>
        )}
      </div>

      <Tabs defaultValue="create" className="w-full">
        <TabsList className="mb-8 w-full justify-start rounded-none border-b border-gray-200 bg-transparent p-0">
          <TabsTrigger 
            value="create" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-black data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-black px-6 rounded-t-lg text-gray-500 hover:text-black"
          >
            Create Task
          </TabsTrigger>
          <TabsTrigger 
            value="tasks"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-black data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-black px-6 rounded-t-lg text-gray-500 hover:text-black"
          >
            My Tasks ({myTasks.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="mt-0">
          <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm max-w-2xl">
            <h2 className="text-xl font-bold tracking-tight text-black mb-2">New Parallax Task</h2>
            <p className="text-sm text-gray-500 mb-8">Describe your objective. The AI Orchestrator will decompose it into microtasks and deploy it to the worker network.</p>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Objective Description</label>
                <textarea
                  className="w-full p-4 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:border-black focus:ring-1 focus:ring-black outline-none transition-all resize-none shadow-sm text-black placeholder-gray-400 disabled:opacity-50"
                  placeholder="e.g. Research 20 AI startups..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={5}
                  disabled={isProcessing}
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Total Escrow Budget (MON)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-mono">Ξ</span>
                  <input
                    type="number"
                    className="w-full pl-10 p-4 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:border-black focus:ring-1 focus:ring-black outline-none transition-all shadow-sm text-black font-mono disabled:opacity-50"
                    placeholder="0.00"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    disabled={isProcessing}
                  />
                </div>
              </div>
              
              <div className="pt-4 border-t border-gray-100">
                <button 
                  onClick={handleDecompose}
                  disabled={isProcessing || !description || !budget}
                  className="w-full bg-black text-white font-semibold py-4 rounded-lg hover:bg-gray-900 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isProcessing ? (
                    <>
                       <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                       {statusText || "Processing..."}
                    </>
                  ) : (
                    <>
                      {account ? "Decompose & Deploy" : "Connect Wallet to Continue"}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="tasks" className="mt-0">
          {!account ? (
             <div className="text-center py-20 bg-gray-50 rounded-xl border border-gray-100 text-gray-500 text-sm">Please connect your wallet to view your tasks.</div>
          ) : myTasks.length === 0 ? (
             <div className="text-center py-20 bg-gray-50 rounded-xl border border-gray-100 text-gray-500 text-sm">You haven't created any tasks yet.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {myTasks.map((task) => {
                const verifiedCount = task.subtasks.filter((st: any) => st.state === "VERIFIED").length;
                const totalCount = task.subtasks.length;
                const isComplete = verifiedCount === totalCount && totalCount > 0;
                
                return (
                  <a 
                    key={task.taskId} 
                    href={`/task/${task.taskId}`}
                    className="bg-white border border-gray-200 rounded-xl p-6 hover:border-black hover:shadow-sm transition-all group block relative overflow-hidden flex flex-col h-full"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <span className="text-[10px] font-mono text-gray-400 bg-gray-50 px-2 py-1 rounded">{task.taskId.substring(0, 10)}...</span>
                      {isComplete ? (
                        <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-1 rounded flex items-center gap-1"><span className="text-emerald-500">✓</span> COMPLETED</span>
                      ) : (
                        <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-1 rounded flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span> ACTIVE</span>
                      )}
                    </div>
                    
                    <h3 className="font-semibold text-gray-900 group-hover:text-black mb-6 line-clamp-2">{task.description}</h3>
                    
                    <div className="mt-auto">
                      <div className="flex items-center justify-between mb-3">
                         <span className="text-xs font-mono font-bold text-black">{task.budget} MON Escrowed</span>
                         <span className="text-xs font-semibold text-gray-500">{verifiedCount}/{totalCount} Completed</span>
                      </div>
                      
                      {/* Progress bar */}
                      <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-1000 ease-out ${isComplete ? 'bg-emerald-500' : 'bg-black'}`} 
                          style={{ width: `${totalCount === 0 ? 0 : (verifiedCount / totalCount) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </TabsContent>

      </Tabs>
    </div>
  );
};

export default CustomerDashboard;
