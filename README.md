# lumenrise-launch

### Holder refresh queue

Use the same `RABBITMQ_URL` and MongoDB database as the API and reputation
services. Launch consumes its own durable queue,
`lumenrise.launch.holder-refresh.v1`. The API persists a coalesced wallet job
before publishing its job ID; launch polls pending jobs as a recovery path
when the broker is unavailable, reconnects, and retries failed contract reads.

After a verified submitted trade, launch reads `balance(address)` on the indexed
token contract and replaces the wallet snapshot. A zero balance removes the
holder. No token deltas or holder ledger tracking are used. The API's
`GET /v1/launches/:contractId/holders` lists known trading wallets by descending
observed balance, with exact 7-decimal integer amounts and cursor pagination.
Processing is asynchronous. Transfer-only recipients and unsubmitted trades
are not discovered; stored balances can change between observed trades.
