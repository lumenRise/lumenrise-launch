const checkHorizonAvailability = async (
  horizonUrl: string,
): Promise<void> => {
  const response = await fetch(new URL('/', horizonUrl), {
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`Horizon root request failed: ${response.status}`);
  }

  await response.json();
};

export default checkHorizonAvailability;
