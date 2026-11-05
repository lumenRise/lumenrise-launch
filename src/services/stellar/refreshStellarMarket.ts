import type { ClientSession } from 'mongoose';

import Launch from '../../models/Launch';
import getStellarRpc from './getStellarRpc';
import readLaunchContract from './readLaunchContract';
import LaunchPriceSample from '../../models/LaunchPriceSample';
import type { MarketIdentity } from '../../types/launch/market';
import nextStatePollAt from '../../utils/launch/nextStatePollAt';
import parseLaunchState from '../../utils/launch/parseLaunchState';
import parseTradeInteger from '../../utils/launch/parseTradeInteger';

const refreshStellarMarket = async (
  identity: MarketIdentity,
  minimumLedger: number,
  session: ClientSession,
): Promise<void> => {
  const launch = await Launch.findOne(identity).session(session).lean();

  if (!launch) {
    throw new Error('Launch is not indexed');
  }

  if (launch.stateAsOfLedger >= minimumLedger && (launch.priceAsOfLedger ?? 0) >= minimumLedger) {
    return;
  }

  const server = getStellarRpc(identity.network);

  const stateRead = await readLaunchContract(
    server,
    identity.contractId,
    'get_state',
    identity.network,
  );

  const priceRead = await readLaunchContract(
    server,
    identity.contractId,
    'current_price',
    identity.network,
  );

  if (stateRead.ledger < minimumLedger || priceRead.ledger < stateRead.ledger) {
    throw new Error('RPC observation is behind the trade');
  }

  const state = parseLaunchState(stateRead.value);
  const price = parseTradeInteger(priceRead.value);

  if (price <= 0n || price.toString().length > 39) {
    throw new Error('Invalid contract price observation');
  }

  const now = new Date();
  const params = launch.config.params as Record<string, unknown>;

  const next = nextStatePollAt(
    {
      factoryIndex: launch.factoryIndex,
      contractId: launch.contractId,
      startsAt: String(params.starts_at),
      endsAt: params.ends_at === undefined ? null : String(params.ends_at),
      graduated: state.graduated === true,
      sold: String(state.sold),
    },
    state.graduated === true,
    now,
  );

  await Launch.updateOne(
    { ...identity, stateAsOfLedger: { $lte: stateRead.ledger } },
    {
      $set: {
        state,
        stateAsOfLedger: stateRead.ledger,
        priceAsOfLedger: priceRead.ledger,
        stateObservedAt: now,
        nextStatePollAt: next,
      },
    },
    { session },
  );

  await LaunchPriceSample.updateOne(
    { ...identity, observationKey: String(priceRead.ledger) },
    {
      $setOnInsert: {
        bucket: now,
        sampledAt: now,
        ledger: priceRead.ledger,
        price: price.toString(),
        priceSort: price.toString().padStart(39, '0'),
      },
    },
    { upsert: true, session },
  );
};

export default refreshStellarMarket;
