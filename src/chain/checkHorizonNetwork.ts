const checkHorizonNetwork = async (
  horizonUrl: string,
  expectedPassphrase: string,
): Promise<void> => {
  const response = await fetch(new URL('/', horizonUrl), {
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`Horizon root request failed: ${response.status}`);
  }

  const body = (await response.json()) as { network_passphrase?: unknown };

  if (body.network_passphrase !== expectedPassphrase) {
    throw new Error('Horizon network passphrase does not match launch network');
  }
};

export default checkHorizonNetwork;
