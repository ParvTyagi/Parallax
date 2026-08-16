import React from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Web3Provider, useWeb3 } from './contexts/Web3Context';
import CustomerDashboard from './pages/CustomerDashboard';
import WorkerTasks from './pages/WorkerTasks';
import TaskDetail from './pages/TaskDetail';

const NavLink = ({ to, children }: { to: string; children: React.ReactNode }) => {
  const location = useLocation();
  const isActive = location.pathname === to;
  
  return (
    <Link 
      to={to} 
      className={`px-4 py-2 text-sm font-semibold transition-colors duration-200 ${
        isActive 
          ? "text-black bg-gray-100 rounded-md" 
          : "text-gray-500 hover:text-black"
      }`}
    >
      {children}
    </Link>
  );
};

const Navbar = () => {
  const { account, connectWallet, isConnecting } = useWeb3();

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200/60">
      <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-7 h-7 bg-black text-white flex items-center justify-center rounded-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
            </div>
            <span className="text-xl font-bold tracking-tight group-hover:opacity-80 transition-opacity">Parallax</span>
          </Link>
          <div className="hidden md:flex space-x-1">
            <NavLink to="/">Customer</NavLink>
            <NavLink to="/worker">Worker</NavLink>
          </div>
        </div>
        <div>
           {account ? (
             <div className="text-sm font-mono font-semibold bg-gray-100 text-gray-800 px-4 py-2 rounded-md shadow-sm border border-gray-200">
               {account.slice(0, 6)}...{account.slice(-4)}
             </div>
           ) : (
             <button 
               onClick={connectWallet}
               disabled={isConnecting}
               className="text-sm font-semibold bg-black text-white px-4 py-2 rounded-md hover:bg-gray-800 transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50"
             >
               <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
               {isConnecting ? "Connecting..." : "Connect Wallet"}
             </button>
           )}
        </div>
      </div>
    </nav>
  );
};

function App() {
  return (
    <Web3Provider>
      <BrowserRouter>
        <div className="min-h-screen font-sans text-gray-900 bg-[#FAFAFA]">
          <Navbar />
          <main className="max-w-5xl mx-auto px-6 py-16">
            <Routes>
              <Route path="/" element={<CustomerDashboard />} />
              <Route path="/worker" element={<WorkerTasks />} />
              <Route path="/task/:taskId" element={<TaskDetail />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </Web3Provider>
  );
}

export default App;
