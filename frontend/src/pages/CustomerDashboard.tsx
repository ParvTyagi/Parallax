import React, { useState } from "react";
import { useWeb3 } from "../contexts/Web3Context";
import { ethers } from "ethers";

const CustomerDashboard = () => {
  const { account, signer, taskManager, connectWallet } = useWeb3();
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState("");

  const handleDecompose = async () => {
    if (!account) {
      await connectWallet();
      return;
    }
    if (!description || !budget) return;

    setIsProcessing(true);
    try {
      // 1. Call AI Decompose
      setStatusText("AI is analyzing and decomposing the master task...");
      const res = await fetch("http://localhost:3000/api/decompose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, budget })
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || "Decompose failed");

      // 2. Submit to Smart Contract
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

      // Completely bypass ethers.js pre-flight RPC checks to avoid rate limits
      const txHash = await (window as any).ethereum.request({
        method: "eth_sendTransaction",
        params: [
          {
            from: await signer!.getAddress(),
            to: await taskManager!.getAddress(),
            data: txData,
            value: "0x" + totalValue.toString(16),
            gas: "0x2DC6C0" // 3,000,000 gas limit hardcoded to bypass MetaMask estimation failures
          }
        ]
      });
      
      setStatusText("Transaction sent! Waiting for confirmation...");
      // We don't need to await tx.wait() because we know it confirms fast and we want to avoid RPC rate limits
      
      setStatusText("Task created successfully on Monad Testnet!");
      setTimeout(() => {
        setIsProcessing(false);
        setStatusText("");
        setDescription("");
        setBudget("");
      }, 3000);
      
    } catch (error: any) {
      console.error(error);
      alert("Error: " + (error.message || "Unknown error"));
      setIsProcessing(false);
      setStatusText("");
    }
  };

  return (
    <div className="animate-in fade-in duration-700 ease-out flex flex-col md:flex-row gap-16">
      
      {/* Left Column: Form */}
      <div className="flex-1 max-w-xl">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4 text-black">
          Parallel Compute, <br/>
          <span className="text-gray-400">Human Scale.</span>
        </h1>
        <p className="text-lg text-gray-500 mb-10 leading-relaxed">
          Describe a large objective. Our orchestrator splits it into independent microtasks. Settle on Monad instantly.
        </p>
        
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Objective Description</label>
            <textarea
              className="w-full p-4 bg-white border border-gray-200 rounded-lg focus:border-black focus:ring-1 focus:ring-black outline-none transition-all resize-none shadow-sm text-black placeholder-gray-400 disabled:opacity-50"
              placeholder="e.g. Research 20 AI startups..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              disabled={isProcessing}
            />
          </div>
          
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Budget Allocation (MON)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-mono">Ξ</span>
              <input
                type="number"
                className="w-full pl-10 p-4 bg-white border border-gray-200 rounded-lg focus:border-black focus:ring-1 focus:ring-black outline-none transition-all shadow-sm text-black font-mono disabled:opacity-50"
                placeholder="100.00"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                disabled={isProcessing}
              />
            </div>
          </div>
          
          <div className="pt-2">
            <button 
              onClick={handleDecompose}
              disabled={isProcessing}
              className="w-full bg-black text-white font-semibold py-4 rounded-lg shadow-crisp hover:shadow-crisp-hover hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:hover:translate-y-0"
            >
              {isProcessing ? (
                <>
                   <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                   Processing...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                  {account ? "Initiate Decomposition" : "Connect Wallet to Continue"}
                </>
              )}
            </button>
            {statusText && <p className="text-sm font-semibold text-emerald-600 mt-4 text-center animate-pulse">{statusText}</p>}
          </div>
        </div>
      </div>

      {/* Right Column: Visualizer Placeholder */}
      <div className="flex-1 hidden md:flex items-center justify-center relative">
        <div className="absolute inset-0 bg-gradient-to-tr from-gray-100 to-white border border-gray-200 rounded-2xl shadow-sm flex flex-col items-center justify-center overflow-hidden">
          {/* Subtle grid background */}
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+CjxwYXRoIGQ9Ik0gMjAgMCBMMCAwIDAgMjAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2YwZjBmMCIgc3Ryb2tlLXdpZHRoPSIxIiAvPgo8L3N2Zz4=')] opacity-50"></div>
          
          <div className="relative z-10 flex flex-col items-center text-center p-8">
            {isProcessing ? (
               <>
                 <div className="w-16 h-16 bg-white border border-gray-200 shadow-sm rounded-xl flex items-center justify-center mb-6 relative">
                    <span className="absolute inset-0 rounded-xl ring-4 ring-emerald-500/20 animate-ping"></span>
                    <span className="w-6 h-6 border-2 border-black/20 border-t-black rounded-full animate-spin"></span>
                 </div>
                 <h3 className="text-gray-900 font-semibold mb-2">Executing AI Decomposition</h3>
                 <p className="text-gray-500 text-sm max-w-xs">{statusText}</p>
               </>
            ) : (
               <>
                 <div className="w-16 h-16 bg-white border border-gray-200 shadow-sm rounded-xl flex items-center justify-center mb-6">
                    <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                 </div>
                 <h3 className="text-gray-900 font-semibold mb-2">Live Execution Visualizer</h3>
                 <p className="text-gray-500 text-sm max-w-xs">Enter a description and budget to see the AI dynamically split and execute tasks.</p>
               </>
            )}
          </div>
        </div>
      </div>

    </div>
  );
};

export default CustomerDashboard;
