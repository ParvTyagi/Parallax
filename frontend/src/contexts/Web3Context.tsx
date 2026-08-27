import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { ethers } from 'ethers';
import { TASK_MANAGER_ADDRESS, TASK_MANAGER_ABI } from '../lib/constants';

declare global {
  interface Window {
    ethereum?: any;
  }
}

export const MONAD_CHAIN_ID = "0x279F"; // 10143 in decimal

export const MONAD_TESTNET_CONFIG = {
  chainId: MONAD_CHAIN_ID,
  chainName: "Monad Testnet",
  nativeCurrency: {
    name: "MON",
    symbol: "MON",
    decimals: 18,
  },
  rpcUrls: ["https://testnet-rpc.monad.xyz"],
  blockExplorerUrls: ["https://testnet.monadexplorer.com"],
};

export const ensureMonadNetwork = async () => {
  if (typeof window === "undefined" || !window.ethereum) return;
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: MONAD_CHAIN_ID }],
    });
  } catch (switchError: any) {
    if (switchError.code === 4902 || switchError.data?.originalError?.code === 4902) {
      try {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [MONAD_TESTNET_CONFIG],
        });
      } catch (addError) {
        console.error("Failed to add Monad Testnet to wallet:", addError);
      }
    }
  }
};

interface Web3ContextType {
  account: string | null;
  balance: string | null;
  provider: ethers.BrowserProvider | null;
  signer: ethers.JsonRpcSigner | null;
  taskManager: ethers.Contract | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  isConnecting: boolean;
  refreshBalance: () => Promise<void>;
  ensureNetwork: () => Promise<void>;
}

const Web3Context = createContext<Web3ContextType>({
  account: null,
  balance: null,
  provider: null,
  signer: null,
  taskManager: null,
  connectWallet: async () => {},
  disconnectWallet: () => {},
  isConnecting: false,
  refreshBalance: async () => {},
  ensureNetwork: async () => {},
});

export const useWeb3 = () => useContext(Web3Context);

export const Web3Provider = ({ children }: { children: ReactNode }) => {
  const [account, setAccount] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [signer, setSigner] = useState<ethers.JsonRpcSigner | null>(null);
  const [taskManager, setTaskManager] = useState<ethers.Contract | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const fetchBalance = async (addr: string, prov: ethers.BrowserProvider) => {
    try {
      const bal = await prov.getBalance(addr);
      setBalance(Number(ethers.formatEther(bal)).toFixed(2));
    } catch (e) {
      console.warn("Failed to fetch balance", e);
    }
  };

  const refreshBalance = async () => {
    if (account && provider) {
      await fetchBalance(account, provider);
    }
  };

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
            const addr = accounts[0].address;
            setAccount(addr);
            setSigner(_signer);
            setTaskManager(new ethers.Contract(TASK_MANAGER_ADDRESS, TASK_MANAGER_ABI, _signer));
            fetchBalance(addr, _provider);
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
          window.location.reload();
        } else {
          setAccount(null);
          setBalance(null);
          setSigner(null);
          setTaskManager(null);
        }
      });
      window.ethereum.on('chainChanged', () => {
        window.location.reload();
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
      await ensureMonadNetwork();
      const _provider = new ethers.BrowserProvider(window.ethereum);
      await _provider.send("eth_requestAccounts", []);
      
      const _signer = await _provider.getSigner();
      const address = await _signer.getAddress();
      
      setProvider(_provider);
      setSigner(_signer);
      setAccount(address);
      setTaskManager(new ethers.Contract(TASK_MANAGER_ADDRESS, TASK_MANAGER_ABI, _signer));
      fetchBalance(address, _provider);
    } catch (error) {
      console.error("Error connecting wallet", error);
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    setAccount(null);
    setBalance(null);
    setSigner(null);
    setTaskManager(null);
  };

  return (
    <Web3Context.Provider value={{ account, balance, provider, signer, taskManager, connectWallet, disconnectWallet, isConnecting, refreshBalance, ensureNetwork: ensureMonadNetwork }}>
      {children}
    </Web3Context.Provider>
  );
};
