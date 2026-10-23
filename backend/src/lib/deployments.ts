import { ethers } from "ethers";

export interface Deployment {
  taskManagerAddress: string;
  escrowAddress?: string;
  startBlock: number;
}

export function getDeployments(): Deployment[] {
  const current = process.env.TASKMANAGER_ADDRESS;
  const deployments: Deployment[] = [
    ...(current ? [{ taskManagerAddress: current, escrowAddress: process.env.ESCROW_ADDRESS, startBlock: Number(process.env.CHAIN_START_BLOCK || 0) }] : []),
  ];
  const unique = new Map<string, Deployment>();
  for (const deployment of deployments) {
    if (!ethers.isAddress(deployment.taskManagerAddress)) throw new Error("Invalid configured task manager address");
    const key = deployment.taskManagerAddress.toLowerCase();
    if (!unique.has(key)) unique.set(key, deployment);
  }
  return [...unique.values()];
}

export function getDeployment(address?: string | null): Deployment {
  const deployments = getDeployments();
  const result = address
    ? deployments.find((item) => item.taskManagerAddress.toLowerCase() === address.toLowerCase())
    : deployments[0];
  if (!result) throw new Error("Task manager is not a configured deployment");
  return result;
}

// Unattributed historical tasks must never be sent to the active contract.
export function getTaskDeployment(address?: string | null): Deployment {
  if (!address) throw new Error("Task has no active contract address");
  return getDeployment(address);
}

export function activeTaskFilter() {
  return { contractAddress: { equals: getDeployment().taskManagerAddress, mode: "insensitive" as const } };
}
