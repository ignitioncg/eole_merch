# Stock Catalog — User Guide

A short, friendly walk-through of the Stock Catalog app for End of Life
Essentials. Written for Brittny and anyone else who'll be placing orders
or correcting stock counts.

## What it does

Everything to do with merchandise stock and order placement happens
inside one screen — the **Stock Catalog** — instead of typing numbers
into the Merchandise Orders board column-by-column.

When you submit an order from here, the app:

1. Subtracts the quantities from the Merchandise Inventory automatically.
2. Updates each item's status (In Stock / Low Stock / Out of Stock).
3. Creates the order on the Merchandise Orders board with all the right
   columns filled in.
4. Records the change on the Stock Movements board so there's always a
   trail of who changed what and why.

You don't need to touch the boards. They stay in sync on their own.

## Opening the app

In monday, click the **+** button at the top of the left sidebar →
**Apps** → **Stock Catalog**. The app opens full-screen.

The left sidebar shows your name (with initials avatar) and four nav
items:

- **Catalog** — every product, with quick-filter stat cards
- **New order** — the guided 3-step order form
- **History** — every stock change, ever
- **Settings** — admin-only configuration (you'll rarely visit)

## Catalog — your home base

The default screen. At the top you'll see four big **stat cards**:

| Card | What it shows |
| --- | --- |
| **Total** | Every product in the catalog |
| **Out of Stock** 🔴 | Anything at zero or negative |
| **Low Stock** 🟠 | Below the reorder point (default 25, or per-product if you've set one) |
| **In Stock** 🟢 | Plenty available |

**Click any card to filter the list to just those products.** Click it
again (or click "Total") to clear the filter.

Below the cards:

- **Search box** — type any part of a product name
- **Filter chips** — same filters as the stat cards plus On Order and
  Discontinued, with a count next to each

The product table shows: **Product name**, **Stock on Hand**,
**Stock in Use** (lifetime cumulative outbound — never decreases),
**Reorder Point** (or "default" if you haven't set one for that
product), **Status**, and **Last Movement** date.

**Click any row** to open the side panel where you can adjust stock or
view that product's full history.

### Status pills explained

| Pill | Meaning |
| --- | --- |
| 🟢 **In Stock** | Plenty available |
| 🟠 **Low Stock** | Below the reorder point — order more soon |
| 🔴 **Out of Stock** | Zero or negative — don't promise this until restocked |
| 🔵 **On Order** | A reorder is in transit. The app **will not** auto-change this status — only you can, manually. |
| 🟣 **Discontinued** | No longer stocked. The app **will not** auto-change this either. |

When something transitions into Low Stock or Out of Stock as a result
of an order, an update gets posted on the Inventory board item —
"Stock alert: Cutlery Sets is now Low Stock (24 remaining, reorder
point 25). Reorder soon." — so it shows up in your monday updates.

### The product side panel

Click any product row to slide open a panel from the right with:

- **Status pill** at the top
- A 2×2 grid of stats: Stock on Hand, Stock in Use, Reorder Point, Last Movement
- An **"Adjust stock on hand"** form (covered below)
- **Movement history** button at the bottom — jumps to the History
  screen filtered to this product

Click anywhere outside the panel (or the **×** in the top-right) to
close it.

## Placing a new order — three quick steps

Click **New order** in the sidebar (or the "New order" button on the
Catalog). You'll see a step indicator at the top: **Recipient → Products → Review**. Each step is gated — the **Next** button stays disabled
until you've filled in what's required.

### Step 1 — Recipient

A blue help banner explains the flow. Then two fields side-by-side:

- **Search Contacts** — start typing 2+ letters of a contact's name.
  Matches from the Contacts board appear in a dropdown. Click one to:
  - Set the recipient name automatically
  - Pre-fill the shipping address (if the contact has one on file)
  - Link the order to that contact in monday
  
  If the contact isn't found, you'll see "No contacts match X. Type a
  name manually below." — just keep going.

- **Recipient name \*** — required. This is what shows on the Orders
  board. Pre-filled if you picked a contact, but always editable.

Then:

- **Shipping address \*** — required. Pre-filled from the contact if
  available.
- **Sent via** — courier or method (e.g. "AusPost express")
- **Event** — optional, if it's for a conference or specific event
- **Notes** — anything else you want recorded

Click **Next: Products** to continue.

### Step 2 — Products

Add a line per product you're sending.

For each line, the picker shows:

- **In Stock** and **Low Stock** items normally
- **Out of Stock** items greyed out — you can't pick them
- **On Order** items — picking one prompts "Item is currently On Order.
  Add anyway?" — confirm if your stock will arrive in time
- **Discontinued** items are hidden

The picker shows the **status pill** and **on-hand count** next to each
option, so you can pick at a glance.

Set the quantity for each line. If you ask for more than is on hand, the
line turns yellow with "Only X on hand — stock will go negative" — you
can still submit, the app trusts you.

Click **+ Add another product** for more lines.

A **Total units** card appears at the bottom showing the running total.

Click **Next: Review** to continue.

### Step 3 — Review

A read-only summary of everything you're about to do:

- **Recipient block**: the recipient, contact link (if any), shipping
  address, sent via, event, and notes
- **Lines table**: every product, the quantity, the **stock after**
  this order, and the **predicted status** pill — so you can see
  exactly what each item will look like once you submit

A yellow banner appears if any line will leave stock negative.

Click **Submit order** when you're ready. You'll see a "Submitting…"
spinner, then a green toast pops up:

> ✓ Order submitted ✓ — 3 stock movement(s) logged

You're bounced back to the Catalog with fresh numbers.

If submission fails (unlikely), the error appears in red on the Review
screen so you can fix it without losing your work.

### What happens behind the scenes

For each line, the app:

1. Subtracts the quantity from **Stock on Hand**
2. Adds the same number to **Stock in Use** (lifetime total)
3. Recalculates the status (so an order that drops something below the
   reorder point flips it to Low Stock)
4. Writes a **Stock Movement** entry (reason: *Order Placed*) with
   your name, the product, the quantity, before/after counts, and a
   link to the order

Then:

5. Creates the **Order** on the Merchandise Orders board with all the
   per-product quantity columns and recipient details populated
6. Writes the new stock counts back to the Merchandise Inventory board

## Correcting stock (stocktake, shipments, mistakes)

When the actual stock doesn't match what the system says — stocktake
found 12 missing, a new shipment arrived, someone took some without
recording it — open the product's side panel from the catalog and
adjust **Stock on Hand**.

The form shows:

- **Current** (read-only) and **New** side-by-side
- A live **+/-X change** indicator under New so you can see the delta
- Three **reason cards** — pick one:
  - **Stocktake adjustment** — counted physically and the number is different
  - **New shipment** — new stock arrived from a supplier
  - **Manual correction** — fixing a typo or anything else
- **Note** — optional but recommended. Future-you will thank you.

Click **Save adjustment**. You'll see a green toast:

> ✓ Adjustment saved

This:

- Updates Stock on Hand and recalculates the status
- Writes a Stock Movement entry with your name, the reason, and the note
- Updates the Last Movement date

You can also edit the Inventory board directly in monday if that's
quicker — those edits flow back into the catalog automatically and
also create a *Manual Correction* entry on the Stock Movements board.
(There's a 3-second guard so the app's own write-back doesn't loop
back into a duplicate entry.)

## History — the audit trail

Click **History** in the sidebar to see every stock movement, grouped
by day with friendly labels (**Today** / **Yesterday** / weekday name
for the past week / "27 Apr 2026" beyond that).

A row of **filter chips** along the top lets you narrow by reason:

- **All reasons**, **Orders**, **Shipments**, **Stocktake**,
  **Corrections**, **Initial sync**

Each row shows:

- A coloured dot (orange = order, green = shipment, red = stocktake,
  blue = correction, purple = initial sync)
- **Product** name and the auto-generated movement description
- **Reason · Actor · Note** in smaller text below
- The **delta** (green for additions, red for deductions)
- **Before → After** stock counts

If you opened History from a product's side panel, a banner at the top
shows "Filtered to one product" with a button to clear the filter.

The same data is also available as items on the **Stock Movements
board** in monday if you ever want to share or report from there.

## Settings — admin-only

This screen lets the app's admin (Chris) point the catalog at different
boards or columns, change thresholds, etc. **You shouldn't need to
touch this unless monday's board structure changes.**

Settings are organised into tabs at the top:

- **Boards** — Inventory, Orders, Contacts, Stock Movements
- **Inventory Columns** — name, stock-on-hand, stock-in-use, status,
  reorder-point, last-movement
- **Orders Columns** — date sent, recipient, shipping, sent via,
  contact, notes, event
- **Movements Columns** — product, related order, reason, delta, stock
  before/after, stock-in-use after, movement at, actor, note
- **Behaviour** — default low-stock threshold (25), sync-loop guard
  seconds, column cache TTL, retry settings

Each field has inline help explaining what it does. A **"customised"**
tag appears on any field you've changed from the default.

If you have unsaved changes, a yellow banner says "Unsaved changes" —
click **Save changes** in the header to apply them, or just refresh
the page to discard.

There's also a **Run initial sync** button at the top. Use it:

- The very first time the app is installed
- After adding new inventory items in bulk (it picks up new items but
  doesn't double-create existing ones)

## Frequently asked questions

### I changed an inventory item's name in monday. Will the app still find it?
Yes. Names are matched flexibly — the app strips "July:" / "EOLE"
prefixes, "- print as required" suffixes, treats dashes/colons as
spaces, and tolerates typos up to 2 characters off. Renames are picked
up within 5 minutes (after the cache refreshes); manual stock edits
flow back immediately.

### I'm sending out stock for someone but I don't want it to count as an order. What do I do?
Open the product, drop the Stock on Hand by the right amount, and
choose **Manual correction** as the reason with a note explaining
why. That records the change without creating a fake order or contact.

### A product on the Orders board still isn't being filled in when I submit orders.
The app couldn't fuzzy-match that product to a quantity column on the
Orders board. Either:

- Rename the column on the Orders board to match the product name, or
- Add a new numeric column with the right name.

Either way, the next order will pick it up (or wait 5 minutes for the
cache to expire, then it's instant).

### I marked something Out of Stock but I want it to stay Out of Stock when I restock.
Mark it **On Order** instead. The app *won't* auto-change items that
are On Order or Discontinued — only you can move them in or out of
those states, manually.

### I deleted an order on the Orders board. Did the stock come back?
**No.** The app only deducts on submit; it doesn't put stock back
when you delete an order. If you need to undo, open each product, add
the quantities back as **Manual correction** with a note like
"Refunded order #1234".

### How do I tell who placed an order?
The Order item on the Orders board has the recipient and contact
link. The Stock Movements entries created at submission time have your
monday user attached as the *Actor* (you'll see it in the row meta on
the History screen).

### The contact dropdown isn't showing matches even though I know the contact exists.
Check that you've typed at least 2 characters. If you still see "No
contacts match…", confirm with Chris that the **CONTACTS_BOARD_ID**
in Settings points to the right board (default is `5027265629`). New
contacts added in monday show up in the dropdown within 60 seconds
(the app caches the contact list briefly to keep the typeahead snappy).

### How do I quickly find everything that's running low?
On the Catalog screen, click the orange **Low Stock** stat card at the
top. It filters the list to just the items below their reorder point.
Click **Out of Stock** for the urgent ones.

## Getting help

If something looks off — wrong stock numbers, a product missing from
the catalog, an order that didn't sync — start by clicking **Refresh**
on the Catalog (top-right) or reloading the page. If it's still wrong,
contact the app admin (Chris) and include:

- What you were trying to do
- The product / order / movement involved (a screenshot is great)
- Roughly when it happened (so we can find it in the logs)

The Stock Movements board is the source of truth for "what changed
when" — it's worth a look on the History screen before reporting.
