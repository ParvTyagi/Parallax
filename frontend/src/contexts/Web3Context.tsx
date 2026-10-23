import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { ethers } from 'ethers';
import { TASK_MANAGER_ADDRESS, TASK_MANAGER_ABI, ETH_CHAIN_ID } from '../lib/constants';

declare global {
  interface Window {
    ethereum?: any;
  }
}

export const MONAD_CHAIN_ID = "0x279f"; // 10143 in decimal
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

export const ETH_SEPOLIA_CHAIN_ID = "0xaa36a7"; // 11155111 in decimal
export const ETH_LOCAL_CHAIN_ID = "0x7a69";   // 31337 in decimal (Hardhat)

export const SEPOLIA_CONFIG = {
  chainId: ETH_SEPOLIA_CHAIN_ID,
  chainName: "Sepolia",
  nativeCurrency: {
    name: "SepoliaETH",
    symbol: "SepoliaETH",
    decimals: 18,
  },
  rpcUrls: [
    "https://ethereum-sepolia-rpc.publicnode.com",
    "https://sepolia.drpc.org",
    "https://1rpc.io/sepolia",
    "https://rpc.sepolia.org",
  ],
  blockExplorerUrls: ["https://sepolia.etherscan.io"],
};

export const LOCALHOST_CONFIG = {
  chainId: ETH_LOCAL_CHAIN_ID,
  chainName: "Hardhat Localhost",
  nativeCurrency: {
    name: "ETH",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: ["http://127.0.0.1:8545"],
  blockExplorerUrls: [],
};

const CHAIN_CONFIGS: Record<string, any> = {
  [MONAD_CHAIN_ID]: MONAD_TESTNET_CONFIG,
  "0x279F": MONAD_TESTNET_CONFIG,
  [ETH_SEPOLIA_CHAIN_ID]: SEPOLIA_CONFIG,
  "0xAA36A7": SEPOLIA_CONFIG,
  [ETH_LOCAL_CHAIN_ID]: LOCALHOST_CONFIG,
  "0x7A69": LOCALHOST_CONFIG,
};

export const TARGET_CHAIN_ID = `0x${BigInt(ETH_CHAIN_ID).toString(16)}`;
const TARGET_CHAIN_CONFIG = CHAIN_CONFIGS[TARGET_CHAIN_ID] || MONAD_TESTNET_CONFIG;

export const ensureEthereumNetwork = async () => {
  if (typeof window === "undefined" || !window.ethereum) return;
  const targetChain = TARGET_CHAIN_ID;

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: targetChain }],
    });
  } catch (switchError: any) {
    if (switchError.code === 4902 || switchError.data?.originalError?.code === 4902) {
      const config = CHAIN_CONFIGS[targetChain];
      if (!config) throw new Error(`Unsupported network: ${targetChain}`);
      try {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [config],
        });
      } catch (addError) {
        throw addError;
      }
    } else {
      throw switchError;
    }
  }
};

// Backwards compatibility alias
export const ensureMonadNetwork = ensureEthereumNetwork;

interface Web3ContextType {
  account: string | null;
  balance: string | null;
  provider: ethers.BrowserProvider | null;
  signer: ethers.JsonRpcSigner | null;
  taskManager: ethers.Contract | null;
  networkName: string;
  currencySymbol: string;
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
  networkName: TARGET_CHAIN_CONFIG.chainName,
  currencySymbol: TARGET_CHAIN_CONFIG.nativeCurrency.symbol,
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
  const [networkName, setNetworkName] = useState<string>(TARGET_CHAIN_CONFIG.chainName);
  const [currencySymbol, setCurrencySymbol] = useState<string>(TARGET_CHAIN_CONFIG.nativeCurrency.symbol);

  const fetchBalance = async (addr: string, prov: ethers.BrowserProvider) => {
    try {
      const bal = await prov.getBalance(addr);
      setBalance(Number(ethers.formatEther(bal)).toFixed(4));
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

            const net = await _provider.getNetwork();
            if (net.chainId === 10143n) { setNetworkName("Monad Testnet"); setCurrencySymbol("MON"); }
            else if (net.chainId === 11155111n) { setNetworkName("Sepolia"); setCurrencySymbol("SepoliaETH"); }
            else if (net.chainId === 31337n) { setNetworkName("Localhost"); setCurrencySymbol("ETH"); }
            else if (net.chainId === 1n) { setNetworkName("Ethereum Mainnet"); setCurrencySymbol("ETH"); }
            else { setNetworkName(`Chain ${net.chainId}`); }
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
      alert("Please install MetaMask or an EVM-compatible Web3 wallet!");
      return;
    }
    
    setIsConnecting(true);
    try {
      await ensureEthereumNetwork();
      const _provider = new ethers.BrowserProvider(window.ethereum);
      await _provider.send("eth_requestAccounts", []);
      
      const _signer = await _provider.getSigner();
      const address = await _signer.getAddress();
      
      setProvider(_provider);
      setSigner(_signer);
      setAccount(address);
      setTaskManager(new ethers.Contract(TASK_MANAGER_ADDRESS, TASK_MANAGER_ABI, _signer));
      fetchBalance(address, _provider);

      const net = await _provider.getNetwork();
      if (net.chainId === 10143n) { setNetworkName("Monad Testnet"); setCurrencySymbol("MON"); }
      else if (net.chainId === 11155111n) { setNetworkName("Ethereum Sepolia"); setCurrencySymbol("ETH"); }
      else if (net.chainId === 31337n) { setNetworkName("Localhost"); setCurrencySymbol("ETH"); }
      else if (net.chainId === 1n) { setNetworkName("Ethereum Mainnet"); setCurrencySymbol("ETH"); }
      else { setNetworkName(`Chain ${net.chainId}`); }
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
    <Web3Context.Provider
      value={{
        account,
        balance,
        provider,
        signer,
        taskManager,
        networkName,
        currencySymbol,
        connectWallet,
        disconnectWallet,
        isConnecting,
        refreshBalance,
        ensureNetwork: ensureEthereumNetwork,
      }}
    >
      {children}
    </Web3Context.Provider>
  );
};
