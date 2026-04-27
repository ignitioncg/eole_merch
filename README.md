# EOLE merchandise auto-deduction

Node.js webhook + CLI that deducts merchandise inventory on monday.com whenever
a Merchandise Order is marked sent (a value is set on the Orders board's
`Date Sent` column, `date_mm126tcf`).

- **Orders board:** 5027265628
- **Inventory board:** 5027265627

The matching of order columns to inventory items is done **at runtime by name**
— there is no hardcoded column-to-item map. Renames on the inventory board are
picked up automatically (after the 5-minute cache expires), and ambiguous
columns (Flyers, Notepads, Pens, Postcards) are logged and skipped if no
matching inventory item exists.

## Setup

1. **Install:** `npm install`
2. **Copy env:** `cp .env.example .env` and fill in `MONDAY_API_TOKEN` and
   `MONDAY_WEBHOOK_SECRET`.
3. **Test:** `npm test`
4. **Run server:** `npm start` (listens on `PORT`, default 3000)

### Environment

| Variable                | Required | Default | Notes                                                          |
| ----------------------- | -------- | ------- | -------------------------------------------------------------- |
| `MONDAY_API_TOKEN`      | yes      | —       | Personal API token (Admin → Developer → My access tokens)      |
| `MONDAY_WEBHOOK_SECRET` | yes\*    | —       | Shared secret you set when creating the webhook                |
| `LOW_STOCK_THRESHOLD`   | no       | `25`    | Counts strictly below this become Low Stock                    |
| `PORT`                  | no       | `3000`  | HTTP port                                                      |

\* If unset the server logs a warning and accepts unsigned requests — only
   acceptable for local development.

## Webhook registration

Expose this service publicly (e.g. via a tunnel or behind a reverse proxy) and
register one webhook on the Orders board:

```graphql
mutation {
  create_webhook(
    board_id: 5027265628,
    url: "https://your-host.example.com/webhooks/orders",
    event: change_specific_column_value,
    config: "{\"columnId\":\"date_mm126tcf\"}"
  ) { id }
}
```

monday will first send a `{ "challenge": "..." }` handshake — the server
echoes it back. After that, every change to `date_mm126tcf` triggers a POST
that the server verifies with `MONDAY_WEBHOOK_SECRET` (HMAC-SHA256, base64,
in the `Authorization` header).

## What the server does on each event

1. Verifies the signature.
2. Ignores events that aren't a change to `date_mm126tcf` and events that
   *clear* the date (only fires when a value is set).
3. Looks up the order item with all its column values.
4. Skips the order if its Notes column (`long_text_mm12n4rz`) already contains
   `[STOCK_DEDUCTED:` (idempotency guard).
5. Loads the inventory board (cached in-memory for 5 minutes).
6. For every numeric column on the order with a value > 0, finds the matching
   inventory item by name (rules below). If any line is unmatched, the cache
   is busted and the inventory is re-fetched once before giving up.
7. Updates each matched inventory item: count column (`numeric_mm121bdf`)
   becomes `old - qty`, and the status column (`color_mm12nas5`) is
   recalculated.
8. Posts an audit update on the order item summarising every line (matched
   or not).
9. For each inventory item that *transitioned into* Low Stock or Out of Stock,
   posts a separate "Stock alert" update on that inventory item.
10. Prepends `[STOCK_DEDUCTED:<ISO_DATE>]\n` to the order's Notes.

## Matching rules (`src/matcher.js`)

Both the order column title and the inventory item name are normalised:

1. Lowercase
2. Strip leading `july: ` or `eole `
3. Strip trailing ` - print as required`
4. Replace `-` and `:` with spaces, collapse runs of whitespace
5. Trim

Then:

- **Exact** normalised match wins.
- Otherwise the closest inventory name within **Levenshtein distance ≤ 2**
  matches (catches typos like `Accrediation` → `Accreditation`).
- Otherwise the line is logged and reported as unmatched in the audit update.

## Status logic (`src/status.js`)

Status indices on the inventory board:

| Index | Label         |
| ----- | ------------- |
| 0     | Low Stock     |
| 1     | In Stock      |
| 2     | Out of Stock  |
| 7     | On Order      |
| 17    | Discontinued  |

After deduction:

- If currently `Discontinued` or `On Order`, leave it alone.
- `new <= 0` → Out of Stock.
- `new < LOW_STOCK_THRESHOLD` → Low Stock.
- Else In Stock.

## CLI

```
node src/process.js <orderItemId> [--dry-run]
```

Dry-run prints what *would* be deducted without writing anything to monday.
Useful for verifying matching against a real order:

```
node src/process.js 2636409938 --dry-run
```

## Files

- `src/app.js` — Express app, signature verification, monday challenge handshake
- `src/monday.js` — single API client wrapper (`listBoardItems`, `getItem`,
  `updateColumnValues`, `createUpdate`)
- `src/matcher.js` — pure name-matching function (unit tested)
- `src/deduction.js` — pure deduction planner (unit tested)
- `src/status.js` — pure status transition function
- `src/processor.js` — orchestrates a single order: cache, plan, write, audit
- `src/process.js` — CLI entry point
- `test/matcher.test.js`, `test/deduction.test.js` — `node --test`

## Out of scope

No marketplace app, no UI, no PO workflow, no multi-tenant. There is no
database — the `[STOCK_DEDUCTED:...]` marker on the order's Notes column
handles deduplication.
