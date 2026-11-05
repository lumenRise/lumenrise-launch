import type { Chain } from '../../types/network/chain';
import type { TradeRecord } from '../../types/launch/market';
import type { RecordedHolding } from '../../types/base/holding';

const calculateRecordedHoldings = (
  trades: TradeRecord[],
  chain: Chain = 'base',
): RecordedHolding[] => {
  const holdings = new Map<string, RecordedHolding>();
  const seen = new Set<string>();

  for (const trade of trades) {
    const key = `${trade.transactionHash}:${trade.operationIndex}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);

    const address = chain === 'base' ? trade.trader.toLowerCase() : trade.trader;
    const previous = holdings.get(address);
    const amount = BigInt(trade.assetAmount) * (trade.side === 'buy' ? 1n : -1n);
    const newer = !previous || trade.ledger >= previous.observedBlock;

    holdings.set(address, {
      address,
      amount: (previous?.amount ?? 0n) + amount,
      observedAt: newer ? trade.tradedAt : previous.observedAt,
      observedBlock: newer ? trade.ledger : previous.observedBlock,
    });
  }

  return [...holdings.values()];
};

export default calculateRecordedHoldings;
