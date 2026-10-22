# Lumenrise Launch

The worker derives immutable public slugs from on-chain project names using the
same normalization as the API. `Blue Man` and `blue-man` both claim `blue-man`;
uniqueness applies per network, independently of token symbols. Internal launch,
trade, holder, pricing and queue identities remain contract addresses.

The shared `launch_names` collection atomically arbitrates API reservations and
direct on-chain launches. A reservation must match the on-chain owner, image URL
and normalized project name. Re-indexing the same contract is idempotent. A
conflicting or unusable name is logged and skipped without blocking subsequent
factory entries. RPC and database failures remain retryable rather than being
silently skipped. Expired reservations cannot be claimed by stale transactions.

Before deploying this worker, stop older workers and run the API repository's
`npm run migrate` to backfill existing names and slugs. Legacy duplicate names
receive stable slug suffixes without changing display names. Reconciliation
preserves these migrated slugs. Deploy with the matching API version; public
launch URLs now accept slugs.
