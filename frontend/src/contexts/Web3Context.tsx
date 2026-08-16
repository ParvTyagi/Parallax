import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { ethers } from 'ethers';
import { TASK_MANAGER_ADDRESS, TASK_MANAGER_ABI } from '../lib/constants';

declare global {
  interface Window {
    ethereum?: any;
  }
}

interface Web3ContextType {
  account: string | null;
  provider: ethers.BrowserProvider | null;
  signer: ethers.JsonRpcSigner | null;
  taskManager: ethers.Contract | null;
  connectWallet: () => Promise<void>;
  isConnecting: boolean;
}

const Web3Context = createContext<Web3ContextType>({
  account: null,
  provider: null,
  signer: null,
  taskManager: null,
  connectWallet: async () => {},
  isConnecting: false,
});

export const useWeb3 = () => useContext(Web3Context);

export const Web3Provider = ({ children }: { children: ReactNode }) => {
  const [account, setAccount] = useState<string | null>(null);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [signer, setSigner] = useState<ethers.JsonRpcSigner | null>(null);
  const [taskManager, setTaskManager] = useState<ethers.Contract | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    // Check if already connected on load
    const init = async () => {
      if (window.ethereum) {
        const _provider = new ethers.BrowserProvider(window.ethereum);
        setProvider(_provider);
        try {
          const accounts = await _provider.listAccounts();
          if (accounts.length > 0) {
            const _signer = await _provider.getSigner();
            setAccount(accounts[0].address);
            setSigner(_signer);
            setTaskManager(new ethers.Contract(TASK_MANAGER_ADDRESS, TASK_MANAGER_ABI, _signer));
          }
        } catch (e) {
          console.error("Auto-connect failed", e);
        }
      }
    };
    init();

    // Listen for account changes
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts: string[]) => {
        if (accounts.length > 0) {
          window.location.reload(); // Simplest way to cleanly reset state
        } else {
          setAccount(null);
          setSigner(null);
          setTaskManager(null);
        }
      });
    }
  }, []);

  const connectWallet = async () => {
    if (!window.ethereum) {
      alert("Please install MetaMask!");
      return;
    }
    
    setIsConnecting(true);
    try {
      const _provider = new ethers.BrowserProvider(window.ethereum);
      await _provider.send("eth_requestAccounts", []);
      
      const _signer = await _provider.getSigner();
      const address = await _signer.getAddress();
      
      setProvider(_provider);
      setSigner(_signer);
      setAccount(address);
      setTaskManager(new ethers.Contract(TASK_MANAGER_ADDRESS, TASK_MANAGER_ABI, _signer));
    } catch (error) {
      console.error("Error connecting wallet", error);
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <Web3Context.Provider value={{ account, provider, signer, taskManager, connectWallet, isConnecting }}>
      {children}
    </Web3Context.Provider>
  );
};
