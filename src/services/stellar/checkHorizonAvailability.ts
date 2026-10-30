const checkHorizonAvailability = async (
  horizonUrl: string,
  networkPassphrase?: string,
): Promise<void> => {
  const response = await fetch(new URL('/', horizonUrl), {
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`Horizon root request failed: ${response.status}`);
  }

  const root = (await response.json()) as { network_passphrase?: unknown };

  if (networkPassphrase !== undefined && root.network_passphrase !== networkPassphrase) {
    throw new Error('Stellar Horizon network mismatch');
  }
};

export default checkHorizonAvailability;
