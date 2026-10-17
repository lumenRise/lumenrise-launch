# lumenrise-launch

### Launch discovery

On startup, the worker compares the factory launch count with the `factoryIndex`
values stored for that network and factory. It fetches only missing launches,
including gaps below the saved cursor. Existing launches need no contract reads.
If recovery fails, it retries the comparison before completing startup sync.
Subsequent factory checks use the saved cursor to discover new launches.

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

Polls claim a launch atomically for up to two minutes to avoid duplicate reads
by multiple worker instances. A trade's newer deadline takes precedence over
an older poll's result or retry. Normal and retry intervals start after the
read completes. Unopened launches wait until their configured opening time.

Factory discovery, token image maintenance, and asset identity sync run
independently of price polling, with at most one active run per task in each
worker. Failed tasks respect their retry delay, and shutdown waits for active
runs. The main loop checks due launches in batches of two; under load or slow
RPC responses, a poll can run later than its scheduled time.

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
