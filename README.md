# EOLE Stock Catalog

Private monday.com app for End of Life Essentials. Provides a catalog/portal
UI for managing merchandise stock and placing orders, with bidirectional sync
to the existing monday boards and a full audit trail on the Stock Movements
board.

- **Custom Object portal** — workspace-level iframe view, accessed from the
  monday left-sidebar (+) → Apps → Stock Catalog. Built with React (Vite).
- **monday code backend** — Express service deployed via `mapps code:push`,
  handling order submission, manual stock adjustments, initial sync, and
  reverse-sync webhooks.
- **Boards as the persistence layer** — Products live as items on the
  Inventory board (5027265627) and Orders live as items on the Orders board
  (5027265628). The portal reads/writes them via GraphQL. Renames in monday
  flow through automatically.
- **Stock Movements board** (5028073700) — append-only audit log. One item
  per discrete change with delta, reason, actor, before/after, related order,
  and optional note.

## Architecture in one picture

```
                ┌──────────────────────────┐
                │  Custom Object portal    │     React + monday SDK
                │  (Catalog, New Order,    │     deployed to monday CDN
                │   History, Settings)     │     via `mapps code:push -c`
                └────────────┬─────────────┘
                             │ /api/...
                             ▼
                ┌──────────────────────────┐
                │  monday code backend      │     Express, deployed via
                │  (Express + apps-sdk)     │     `mapps code:push`
                └─┬──┬────────────┬──┬──────┘
                  │  │            │  │
        listBoardItems │   createItem │   updateColumnValues
                  │  │            │  │
                  ▼  ▼            ▼  ▼
        ┌─────────────────┐  ┌──────────────────┐  ┌──────────────────┐
        │ Inventory board │  │ Orders board     │  │ Stock Movements  │
        │   5027265627    │  │   5027265628     │  │   5028073700     │
        │ (Products)      │  │ (Orders)         │  │ (audit log)      │
        └─────────────────┘  └──────────────────┘  └──────────────────┘
                  ▲
                  │  webhook on column change
                  │
                  └─── reverse-sync ─── monday code /webhooks/inventory
```

## Folder layout

```
app.json                  monday app manifest (features + webhooks)
package.json              workspace root
client/                   React (Vite) portal — deployed to monday CDN
  src/
    App.jsx               router + layout
    views/                Catalog, NewOrder, History, ProductDetail, Config
    components/           StatusPill, Toast
    lib/                  API wrapper + formatters
server/                   monday code backend (Express)
  src/
    index.js              app entry
    app.js                Express bootstrap + middleware
    routes/               products, orders, movements, contacts, config,
                          install, webhooks, queue
    lib/
      config.js           defaults + storage-backed config CRUD
      monday.js           single GraphQL client wrapper
      matcher.js          name normalisation + Levenshtein
      status.js           status transition logic
      productMapping.js   inventory item → Product, Product → orders column
      movements.js        buildMovementPayload (Stock Movements board write)
      deduction.js        order submission planner (pure)
      installer.js        creates Reorder Point + Last Movement columns
      initialSync.js      idempotent first-install sync
      reverseSync.js      board-edit → Product update plan
      sync.js             buildInventoryColumnUpdate, buildOrderColumnPayload
      syncGuard.js        TTL'd loop-guard markers
      orderSubmission.js  end-to-end order submit orchestration
      storage.js          monday code Storage client + InMemory for tests
  test/                   node --test suite (matcher, status, movements,
                          deduction, syncGuard, initialSync, productMapping,
                          sync)
scripts/
  dryrun.js               Run all three validation steps against fixtures
                          (or live data with --no-fixtures)
```

## Prerequisites

- Node 20+
- A monday Developer Center account
- `@mondaycom/apps-cli` installed globally:
  ```bash
  npm i -g @mondaycom/apps-cli
  mapps init -t YOUR_DEVELOPER_TOKEN
  ```
- The Stock Movements board (5028073700) must exist and have the columns
  documented in `server/src/lib/config.js`. The default config is preloaded
  with the column IDs you supplied.

## Install

```bash
git clone -b claude/nodejs-inventory-deduction-X3nu4 https://github.com/ignitioncg/eole_merch.git
cd eole_merch
npm install
```

(Or via SSH: `git clone -b claude/nodejs-inventory-deduction-X3nu4 git@github.com:ignitioncg/eole_merch.git`.)

## Run tests

```bash
npm test
```

41 unit tests cover: matcher (exact / July: / EOLE / PRINT as required /
Levenshtein-2 / no match), status transitions (including Discontinued and
On Order lockout), buildMovementPayload, order submission planner
(cumulative stockInUse, low-stock transitions, lockouts, validation),
manual adjustment planner, sync helpers, sync-guard echo detection,
reverse-sync manual_correction movement, and idempotent initial sync.

## Run the dry-run

The dry-run validator simulates initial sync, an order submission, and a
reverse-sync trace without writing to monday. By default it uses fixtures
(no token required). Pass `--no-fixtures` to hit your real monday data.

```bash
# fixtures only (recommended for development)
npm run dryrun

# against live data
MONDAY_API_TOKEN=<your-token> node scripts/dryrun.js --no-fixtures
```

## Local development

The frontend dev server proxies `/api/...` to the backend on :8080.

```bash
# terminal 1
MONDAY_API_TOKEN=<your-token> npm run dev:server

# terminal 2
npm run dev:client
# open http://localhost:5173
```

## Deploy

The frontend and backend deploy as two separate `mapps code:push` calls.
**Important:** the backend must be pushed from inside `server/` so the
`server/package.json` is the deployable root — if you push from the repo
root, monday code can't find a runnable `package.json` (the workspace
config at the root has no `main`/`start`) and the container fails with
`MODULE_NOT_FOUND`, `requireStack: []`.

```bash
# 1. Push the backend (from inside server/)
npm run deploy:server
# expands to: cd server && mapps code:push

# 2. Build and push the frontend (from inside client/)
npm run deploy:client
# expands to: npm run build:client && cd client && mapps code:push -c -d dist

# 3. Set the runtime token used by webhooks/cron contexts
mapps code:secret -m set -k MONDAY_API_TOKEN -v <your-token>

# 4. Promote the draft version
mapps app:promote
```

If you prefer running `mapps` directly:

```bash
cd server && mapps code:push                          # backend
cd client && npm run build && mapps code:push -c -d dist   # frontend
```

## App configuration

Open the app's **Settings** view from the sidebar to edit:

- **Boards**: Orders / Inventory / Contacts / Movements board IDs
- **Inventory Columns**: name, stock-on-hand, stock-in-use, status,
  reorder-point, last-movement
- **Orders Columns**: date sent, recipient, shipping, sent via, contact,
  notes, event
- **Movements Columns**: product, related order, reason, delta, stock
  before, stock after, stock-in-use after, movement at, actor, note
- **Behaviour**:
  - `DEFAULT_LOW_STOCK_THRESHOLD` (default 25) — used only when a Product
    has no per-product Reorder Point
  - `SYNC_LOOP_GUARD_SECONDS` (default 3) — reverse-sync ignores changes
    within this window of an outbound write
  - `COLUMN_CACHE_TTL_SECONDS` (default 300) — Product → Orders-board
    quantity-column resolution cache
  - `RETRY_MAX_ATTEMPTS` / `RETRY_INITIAL_DELAY_MS` — failed inventory
    write-backs are retried via the monday code Queue

Defaults are loaded from `DEFAULTS` in `server/src/lib/config.js`. Per-tenant
overrides live in monday code Storage under the key `config:active`.

### First install

On first install, click **Run initial sync** in the Settings view. This:

1. Ensures the **Reorder Point** and **Last Movement** columns exist on the
   Inventory board (creates them if missing) and persists their column IDs
   into config.
2. For each Inventory item not yet recorded on the Stock Movements board,
   writes one `initial_sync` movement (`stockBefore=0`,
   `stockAfter=current stock`).

Re-running it is idempotent — items already represented on the Stock
Movements board are skipped.

## How the portal works

### Catalog
Lists every Inventory item as a Product. Sorted Out → Low → In → On Order →
Discontinued, then alphabetic. Click a row to edit name / stock /
reorder point / status. Manual stock edits prompt for a reason and
optional note, and create one Stock Movement.

### New Order
1. Pick a recipient from the Contacts board (typeahead) or type a name.
2. Pre-fills the shipping address from the Contact if available.
3. Add product lines from a searchable picker. Discontinued items are
   hidden; Out of Stock are greyed out; On Order prompts for confirmation.
4. Submit deducts stock atomically per line, writes one `order_placed`
   StockMovement per line, creates the Order on the Orders board with all
   per-product quantity columns populated, and writes the new stock /
   stock-in-use / status / lastMovementAt back to the Inventory board.

### History
Lists every StockMovement, filterable by product and reason. Clicking
"View movement history" on a Product detail panel jumps into History
filtered to that product.

### Settings
The Configurable Settings table above. Saving validates that required
fields are set; invalid configs return a 400 from `/api/config`.

## Sync rules

### Forward sync (Custom Object → boards)
On every Product or Order mutation:

1. Set a sync-origin marker keyed by board+item with TTL =
   `SYNC_LOOP_GUARD_SECONDS`.
2. Write the equivalent column values to the linked board item.
3. The marker is read by the reverse-sync handler to identify the echoed
   webhook and skip it.

### Reverse sync (Inventory board → Custom Object)
A monday webhook is registered against the Inventory board for column
changes (`change_specific_column_value`). On each delivery:

1. If the sync-origin marker exists for this item and is unexpired, skip.
2. Match the item to a Product via `linkedInventoryItemId`. If no match,
   log and skip.
3. Update the Product's corresponding field with the new value.
4. If `stockOnHand` changed, write a StockMovement with
   `reason=manual_correction`, `actor` set to the user who edited the board,
   capturing stockBefore/After.
5. Recalculate status and write `lastMovementAt` back to the board (which
   triggers another webhook — but the marker set in step 1 of the forward
   write blocks the loop).

The Orders board is **not** subscribed; orders are placed only through the
portal.

### Status logic
Status indices (must match the labels on
`INVENTORY_STATUS_COLUMN_ID`):

| Index | Label         |
| ----- | ------------- |
| 0     | Low Stock     |
| 1     | In Stock      |
| 2     | Out of Stock  |
| 7     | On Order      |
| 17    | Discontinued  |

After deduction:

- **Discontinued** or **On Order** → never auto-changes (manual only).
- `new <= 0` → Out of Stock.
- `new < (reorderPoint ?? DEFAULT_LOW_STOCK_THRESHOLD)` → Low Stock.
- Otherwise → In Stock.

When a Product transitions **into** Low Stock or Out of Stock, the backend
posts an item update on the linked Inventory board item:

> Stock alert: Cutlery Sets is now Low Stock (24 remaining, reorder point 25). Reorder soon.

## monday API formatting gotchas

- **board_relation** uses `{ item_ids: [n, n] }` — both the key (`item_ids`)
  and the array of *numeric* monday item IDs are required.
- **status** uses `{ label: "Label Text" }` — must match an existing label
  exactly. We pass `create_labels_if_missing: false` to fail loudly on typos
  rather than silently creating duplicate labels.
- **numeric** columns use stringified numbers in column_values, e.g. `"476"`,
  not `476`.
- **date** columns use `{ date: "YYYY-MM-DD" }`.

## Troubleshooting

### Deployment fails with `Cannot find module '/workspace/index.js'`
monday code's container mounts your push at `/workspace/` and runs
`node /workspace/index.js` — it does **not** honor `package.json#main`.
Two things must be true:

1. The file `index.js` must exist at the **root of what you pushed**
   (this repo's `server/index.js` plays that role).
2. You must push from inside `server/`, so `server/` is the deployable
   root:
   ```bash
   cd server
   mapps code:push -i <APP_VERSION_ID>
   ```
   `npm run deploy:server -- -i <APP_VERSION_ID>` does this for you.

Pushing from the repo root uploads the workspace `package.json` (which
has no entry) — the container then can't find `/workspace/index.js`.

### Reverse-sync is firing but nothing changes in the Catalog
1. Check `mapps code:logs --live` for `[reverse-sync] skipped: <reason>`
   lines.
2. If the reason is `untracked-column`, the column ID isn't one of the four
   tracked ones in `reverseSync.js#TRACKED_FIELDS`. Verify
   `INVENTORY_STOCK_ON_HAND_COLUMN_ID` etc. in Settings.
3. If the reason is `echo`, your write went out and came back. Wait
   `SYNC_LOOP_GUARD_SECONDS` and try again.
4. If the reason is `no-matching-product`, the Inventory item was created
   directly on the board after the last `Run initial sync`. Re-run initial
   sync from Settings.

### A board write failed; how do I flush the retry queue?
Failed `inventory_update` writes are queued via the monday code Queue
(`/mndy-queue`). They retry with exponential backoff up to
`RETRY_MAX_ATTEMPTS` (default 5). Inspect them via:

```bash
mapps storage:search -k "retry:"
```

If a record is stuck, you can re-publish it manually:

```bash
mapps storage:export -k "retry:..."   # to inspect
# then via monday code logs, the next /mndy-queue delivery will retry it
```

If you need to delete a stuck retry record:

```bash
mapps storage:remove-data -k "retry:<id>"
```

### The Catalog is empty / 401 from /api/products
The frontend forwards a session token via the `x-monday-token` header.
Confirm:

1. The portal iframe is loaded inside monday (the SDK only returns a token
   when embedded in a monday context).
2. `MONDAY_API_TOKEN` is set as a secret on the backend
   (`mapps code:secret -m set -k MONDAY_API_TOKEN -v ...`) for cron / webhook
   contexts where there's no user token.

### Orders board says "could not resolve quantity column for product X"
The Product → Orders-column resolver couldn't fuzzy-match the Product name
to a numeric column on the Orders board. Either:

- Rename the Orders column to match the Product name (the matcher handles
  "July: ", "EOLE ", and " - print as required"), or
- Add a numeric column on the Orders board with that name, then click
  **Save changes** in Settings to bust the column cache.

## Dependency notes

- `@mondaycom/apps-sdk` is pinned to **3.0.10** (not `^3.x`). 3.0.11 onward
  pulls a `@google-cloud/pubsub` chain with several moderate-severity
  advisories that are unreachable from our code paths but flagged by `npm
  audit`. 3.0.10 is the most recent version without that chain. The SDK
  surface we use (`Storage`, `SecretsManager`, `Logger`, `Queue`) is stable
  across 3.x.
- `@vibe/core` is **not** a dependency. The portal's UI is built with custom
  CSS to keep the bundle small and avoid pulling in `monday-ui-style`'s
  vulnerable PostCSS chain.
- `package.json` declares `overrides` to force newer `uuid`, `gaxios`,
  `http-proxy-agent`, `retry-request`, `teeny-request`, and
  `@tootallnate/once` versions across the whole tree. Without these,
  Google Cloud transitive deps still trigger advisories. Run
  `npm audit` after any dependency bump to confirm we're still clean.

## Out of scope

- External hosting or webhooks outside monday code
- Marketplace listing
- UI outside the Custom Object portal
- Backfill of historical Orders board items
- Multi-tenant config — single EOLE workspace
- PO generation (alert only)
- Hospital Collaborative form, Contacts board edits, or any non-merchandise
  workflow
