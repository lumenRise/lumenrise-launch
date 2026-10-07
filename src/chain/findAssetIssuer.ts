import { Asset, StrKey } from '@stellar/stellar-sdk';

import type { HorizonAssetPage } from '../types/horizon';
import type { Configuration } from '../types/configuration';

const findAssetIssuer = async (
  code: string,
  contractId: string,
  configuration: Configuration,
): Promise<string | null> => {
  const base = new URL(configuration.horizonUrl);
  const url = new URL('/assets', base);

  url.searchParams.set('asset_code', code);
  url.searchParams.set('limit', '200');

  for (let page = 0; page < 20; page += 1) {
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });

    if (!response.ok) {
      throw new Error(`Horizon assets request failed: ${response.status}`);
    }

    const body = (await response.json()) as HorizonAssetPage;
    const records = body._embedded?.records;

    if (!Array.isArray(records)) {
      throw new Error('Horizon assets response is invalid');
    }

    for (const record of records) {
      if (
        record.asset_code !== code ||
        typeof record.asset_issuer !== 'string'
      ) {
        continue;
      }

      if (!StrKey.isValidEd25519PublicKey(record.asset_issuer)) {
        continue;
      }

      if (
        new Asset(code, record.asset_issuer).contractId(
          configuration.networkPassphrase,
        ) === contractId
      ) {
        return record.asset_issuer;
      }
    }

    if (records.length < 200) {
      return null;
    }

    const next = body._links?.next?.href;

    if (!next) {
      return null;
    }

    const nextUrl = new URL(next);

    if (nextUrl.origin !== base.origin || nextUrl.pathname !== url.pathname) {
      throw new Error('Horizon assets pagination changed origin');
    }

    url.search = nextUrl.search;
  }

  throw new Error('Horizon asset candidate search exceeded page limit');
};

export default findAssetIssuer;
