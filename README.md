# lumenrise-launch

### Price refresh

After a launch opens, the worker reads its state and `current_price` whenever
`nextStatePollAt` is due, then schedules the next check for 15 minutes later.
A verified trade submitted to the API reads the price immediately and resets
that same deadline to 15 minutes after its observation. The deadline is stored
in MongoDB, so polling resumes after restarts and detects price changes from
trades made outside the client. Unchanged prices do not add duplicate chart
samples; this polling does not import external trades into trade history.

Failed reads retry after 30 seconds. Polling stops after graduation or after
the launch ends with no tokens left to sell back. The launch worker must be
running against the same database and network as the API.

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
