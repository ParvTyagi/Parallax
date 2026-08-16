import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useWeb3 } from "../contexts/Web3Context";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/Tabs";

const WorkerTasks = () => {
  const { account, signer, taskManager, connectWallet } = useWeb3();
  const [subtasks, setSubtasks] = useState<any[]>([]);
  const [myTasks, setMyTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const navigate = useNavigate();
  const [, setNow] = useState(Date.now());

  useEffect(() => {
    fetchSubtasks();
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (account) {
      fetchMyTasks(account);
    } else {
      setMyTasks([]);
    }
  }, [account]);

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

  const fetchMyTasks = async (walletAddress: string) => {
    try {
      const res = await fetch(`http://localhost:3000/api/tasks/worker/${walletAddress}`);
      const data = await res.json();
      setMyTasks(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleClaim = async (taskId: string, subtaskId: string) => {
    if (!account || !signer) {
      await connectWallet();
      return;
    }
    setClaimingId(subtaskId);
    try {
      const txData = taskManager!.interface.encodeFunctionData("claimSubtask", [taskId, subtaskId]);
      
      await (window as any).ethereum.request({
        method: "eth_sendTransaction",
        params: [
          {
            from: await signer!.getAddress(),
            to: await taskManager!.getAddress(),
            data: txData,
            gas: "0x186A0"
          }
        ]
      });

      navigate(`/task/${taskId}`);
    } catch (error: any) {
      console.error(error);
      alert("Error: " + (error.message || "Unknown error"));
      setClaimingId(null);
    }
  };

  const activeTasks = myTasks.filter((st: any) => st.state === "CLAIMED" || st.state === "SUBMITTED");
  const completedTasks = myTasks.filter((st: any) => st.state === "VERIFIED");
  const earnedMON = completedTasks.reduce((acc, st) => acc + Number(st.reward), 0).toFixed(2);
  const successRate = myTasks.length > 0 ? ((completedTasks.length / myTasks.length) * 100).toFixed(0) : "0";

  return (
    <div className="animate-in fade-in duration-700 ease-out max-w-5xl mx-auto pb-24">
      
      {/* Header & Stats */}
      <div className="mb-10">
        <h1 className="text-2xl font-bold tracking-tight text-black mb-6">Good afternoon.<br/><span className="text-gray-400 font-normal">Ready to work?</span></h1>
        
        {account && (
          <div className="grid grid-cols-3 gap-6 bg-white border border-gray-100 rounded-xl p-6 shadow-sm mb-10">
            <div>
              <p className="text-sm text-gray-500 font-medium mb-1">Active</p>
              <p className="text-2xl font-mono font-bold text-black">{activeTasks.length}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium mb-1">Earned</p>
              <p className="text-2xl font-mono font-bold text-emerald-600">{earnedMON} <span className="text-sm text-emerald-500">MON</span></p>
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium mb-1">Success</p>
              <p className="text-2xl font-mono font-bold text-black">{successRate}%</p>
            </div>
          </div>
        )}
      </div>

      <Tabs defaultValue="available" className="w-full">
        <TabsList className="mb-8 w-full justify-start rounded-none border-b border-gray-200 bg-transparent p-0">
          <TabsTrigger 
            value="available" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-black data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-black px-6 rounded-t-lg text-gray-500 hover:text-black"
          >
            Available ({subtasks.length})
          </TabsTrigger>
          <TabsTrigger 
            value="active"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-black data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-black px-6 rounded-t-lg text-gray-500 hover:text-black"
          >
            Active ({activeTasks.length})
          </TabsTrigger>
          <TabsTrigger 
            value="completed"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-black data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-black px-6 rounded-t-lg text-gray-500 hover:text-black"
          >
            Completed
          </TabsTrigger>
        </TabsList>

        <TabsContent value="available" className="mt-0">
          {loading ? (
            <div className="text-center py-20 text-gray-400 font-mono text-sm">Loading available work...</div>
          ) : subtasks.length === 0 ? (
            <div className="text-center py-20 bg-gray-50 rounded-xl border border-gray-100 text-gray-500 text-sm">No open subtasks available right now.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {subtasks.map((st) => (
                <div key={st.subtaskId} className="bg-white border border-gray-200 rounded-xl p-5 hover:border-gray-300 hover:shadow-sm transition-all flex flex-col group">
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-[10px] font-bold text-gray-400 tracking-widest uppercase bg-gray-50 px-2 py-1 rounded">AVAILABLE</span>
                    <span className="text-xs font-mono font-bold text-black">{st.reward} MON</span>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2 leading-snug line-clamp-2">{st.task.description}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed mb-6 flex-grow line-clamp-3">
                    {st.description}
                  </p>
                  <button 
                    onClick={() => handleClaim(st.taskId, st.subtaskId)}
                    disabled={claimingId === st.subtaskId}
                    className="w-full bg-black text-white font-semibold py-2.5 rounded-lg hover:bg-gray-900 transition-colors text-sm disabled:opacity-50"
                  >
                    {claimingId === st.subtaskId ? "Claiming..." : account ? "Claim Task" : "Connect to Claim"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="active" className="mt-0">
          {activeTasks.length === 0 ? (
            <div className="text-center py-20 bg-gray-50 rounded-xl border border-gray-100 text-gray-500 text-sm">You have no active tasks.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {activeTasks.map((st) => {
                const expiryTime = new Date(st.updatedAt || new Date()).getTime() + (st.leaseDuration || 1800) * 1000;
                const timeDiff = expiryTime - Date.now();
                const isExpired = timeDiff <= 0;
                const mins = Math.floor(timeDiff / 60000);
                const secs = Math.floor((timeDiff % 60000) / 1000);
                const timeText = isExpired ? "EXPIRED" : `${mins}m ${secs}s`;

                return (
                  <Link to={`/task/${st.taskId}`} key={st.subtaskId} className="bg-white border border-blue-200 rounded-xl p-5 hover:shadow-md transition-all flex flex-col group block">
                    <div className="flex justify-between items-start mb-3">
                      <span className={`text-[10px] font-bold tracking-widest uppercase px-2 py-1 rounded flex items-center gap-1.5 ${isExpired ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                        {!isExpired && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>}
                        {isExpired ? "LEASE EXPIRED" : "IN PROGRESS"}
                      </span>
                      <span className="text-xs font-mono font-bold text-black">{st.reward} MON</span>
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-2 leading-snug line-clamp-2">{st.task?.description || "Unknown Task"}</h3>
                    <p className="text-gray-500 text-sm leading-relaxed mb-4 flex-grow line-clamp-3">
                      {st.description}
                    </p>
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-xs font-semibold text-gray-500">Time left:</span>
                      <span className={`text-xs font-mono font-bold ${isExpired ? 'text-red-500' : 'text-blue-600'}`}>{timeText}</span>
                    </div>
                    <div className={`w-full font-semibold py-2.5 rounded-lg transition-colors text-sm text-center ${isExpired ? 'bg-red-50 text-red-700 group-hover:bg-red-100' : 'bg-blue-50 text-blue-700 group-hover:bg-blue-100'}`}>
                      {isExpired ? "Claim Dropped" : "Resume Work →"}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed" className="mt-0">
          {completedTasks.length === 0 ? (
             <div className="text-center py-20 bg-gray-50 rounded-xl border border-gray-100 text-gray-500 text-sm">You haven't completed any tasks yet.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {completedTasks.map((st) => (
                <Link to={`/task/${st.taskId}`} key={st.subtaskId} className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-sm transition-all flex flex-col group block opacity-80 hover:opacity-100">
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-[10px] font-bold text-emerald-600 tracking-widest uppercase bg-emerald-50 px-2 py-1 rounded flex items-center gap-1.5">
                      ✓ VERIFIED
                    </span>
                    <span className="text-xs font-mono font-bold text-emerald-600">+{st.reward} MON</span>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2 leading-snug line-clamp-2">{st.task.description}</h3>
                  <div className="w-full bg-gray-50 text-gray-600 font-semibold py-2.5 rounded-lg group-hover:bg-gray-100 transition-colors text-sm text-center mt-auto">
                    View Proof
                  </div>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

      </Tabs>
    </div>
  );
};

export default WorkerTasks;
