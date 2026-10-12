interface HorizonAsset {
  asset_code?: unknown;
  asset_issuer?: unknown;
}

interface HorizonAssetPage {
  _embedded?: { records?: HorizonAsset[] };
  _links?: { next?: { href?: string } };
}

export type { HorizonAssetPage };
