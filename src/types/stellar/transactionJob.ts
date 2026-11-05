interface StellarTransactionJob {
  network: 'testnet' | 'public';
  action: 'launch' | 'trade';
  transactionHash: string;
  contractId: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  scheduledAt: Date;
  leaseUntil: Date | null;
  attempts: number;
  observedBlock?: number;
  failureStatus?: number;
  lastError: string | null;
  result: Record<string, unknown> | null;
}

export type { StellarTransactionJob };
