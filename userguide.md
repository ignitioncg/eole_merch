# Stock Catalog — User Guide

A short, non-technical guide to using the Stock Catalog app for End of
Life Essentials. Written for Brittny and anyone else who'll be placing
orders or correcting stock counts day-to-day.

## What this app does

Everything to do with merchandise stock and order placement now happens
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
**Apps** → **Stock Catalog**.

The app opens full-screen. There are four screens, switched from the
left-hand menu:

- **Catalog** — every product, its stock, and its status.
- **New order** — the order form.
- **History** — every stock change, ever.
- **Settings** — for admins; you probably won't need this day-to-day.

The first time the app loads it may take a few seconds — it's reading
the latest inventory.

## Catalog

The default screen. Lists every product in a sortable, searchable grid.

Columns shown:

| Column | Meaning |
| --- | --- |
| **Name** | The product name (matches the Inventory board exactly) |
| **Stock on Hand** | What we physically have right now |
| **Stock in Use** | The lifetime total of how many have gone out (cumulative — never decreases) |
| **Reorder Point** | If stock drops below this, it goes Low Stock. If blank, the default of **25** is used. |
| **Status** | Coloured pill — see below |
| **Last Movement** | When this item's stock last changed |

Out of Stock items appear at the top, then Low Stock, then In Stock,
then On Order, then Discontinued.

Use the **search box** to filter by name. Click any row to open the
**detail panel**, where you can:

- Edit the **Reorder Point** for that specific product (recommended for
  things you order frequently — e.g. set it to 100 for high-volume items)
- Manually adjust **Stock on Hand** (see [Correcting stock](#correcting-stock-stocktake-shipments-mistakes) below)
- Click **View movement history** to jump to a filtered History view

### Status pills explained

| Pill | What it means |
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

## Placing a new order

Click **New order** in the sidebar.

### 1. Pick the recipient

Type a name into the **Recipient** field. As you type, matches from the
Contacts board appear in a dropdown. Click one to:

- Set the recipient name
- Auto-fill the shipping address (if the contact has one on file)
- Link the order to that contact in monday

If the recipient isn't in Contacts, just type their name freely and fill
the address manually. The order will still go through; it just won't
have a contact link.

### 2. Fill in the rest

- **Sent via** — courier or method (e.g. "AusPost express")
- **Shipping address** — pre-filled if you picked a contact, but always editable
- **Event** *(optional)* — name the event/conference if applicable
- **Notes** *(optional)* — anything you want recorded on the order

### 3. Add product lines

Click **+ Add line**. In the picker:

- **In Stock** and **Low Stock** items appear normally — pick freely.
- **Out of Stock** items are greyed out — you can't add them.
- **On Order** items are selectable but pop a confirmation: "Item is
  currently On Order. Add anyway?" Use this if you have stock arriving
  before the recipient needs it.
- **Discontinued** items are hidden entirely.

Set the quantity for each line. If you ask for more than is on hand, you
get a yellow warning ("Only X on hand — stock will go negative") but you
can still submit. The app trusts you.

### 4. Submit

Click **Submit order**. Submission is one click — the app then:

1. Decrements stock on hand for each line.
2. Adds the same number to **Stock in Use** (so you can see lifetime totals).
3. Recalculates each item's status.
4. Writes one **Stock Movement** entry per line (reason: *Order Placed*).
5. Creates the **Order** on the Merchandise Orders board with all the
   per-product quantity columns and recipient details populated.
6. Updates the Inventory board to match.

You'll see a confirmation toast and bounce back to the Catalog with
fresh numbers.

If the submission warns about an unmatched product (rare — happens if
the Orders board's column titles don't match a product name), it'll
say so in the warning banner. The order still goes through; the column
just doesn't get auto-populated.

## Correcting stock (stocktake, shipments, mistakes)

When you find that the actual stock doesn't match what the system says
— stocktake found 12 missing, a new shipment arrived, someone took
some without recording it — open the product's detail panel and edit
**Stock on Hand**.

The app will ask **why**:

- **Stocktake adjustment** — counted physically and the number's different
- **New shipment received** — adding new stock that arrived from a supplier
- **Manual correction** — fixing a typo or anything else

Add a note if you want (recommended — future-you will thank you). Click
**Save adjustment**.

This:

- Updates Stock on Hand and recalculates the status
- Writes a Stock Movement entry with your name, the reason, and the note
- Updates the Last Movement date

You can also edit the Inventory board directly in monday if that's
quicker — those edits flow back into the catalog automatically and
also create a *Manual Correction* entry on the Stock Movements board.
(There's a 3-second guard so the app's own write-back doesn't loop
back into a duplicate entry.)

## History

Click **History** in the sidebar to see every stock movement ever
recorded.

Each row shows:

- **When** the movement happened
- **What** changed (the product and signed delta — green for additions,
  red for deductions)
- **Why** (Order Placed / New Shipment / Stocktake Adjustment / Manual
  Correction / Initial Sync)
- **Before → After** stock counts
- **Who** made the change
- The **note** if there was one

Filter by reason using the dropdown. To filter to a single product, open
that product in the catalog and click "View movement history".

The same data is available as items on the **Stock Movements board** in
monday if you ever want to share or report on it from there.

## Settings (admin only)

If you have admin access, the **Settings** screen lets you change:

- Which boards the app uses (Inventory, Orders, Contacts, Stock Movements)
- Which columns it reads/writes on each board
- The default low-stock threshold (currently 25)
- Sync timing parameters

You shouldn't need to touch this unless monday's board structure
changes. The "Run initial sync" button at the top is only for the very
first install or after adding new inventory items in bulk.

## Frequently asked questions

### I changed an inventory item's name in monday. Will the app still find it?
Yes. Names are matched flexibly — the app strips "July:" / "EOLE"
prefixes, "- print as required" suffixes, treats dashes/colons as
spaces, and tolerates typos up to 2 characters off. Renames are picked
up within 5 minutes (after the cache refreshes); manual stock edits
flow back immediately.

### I'm sending out stock for someone but I don't want it to count as an order. What do I do?
Open the product, drop the Stock on Hand by the right amount, and
choose **Manual correction** as the reason with a note explaining why.
That records the change without creating a fake order or contact.

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
**No.** The app only deducts on submit; it doesn't put stock back when
you delete an order. If you need to undo, open each product, add the
quantities back as **Manual correction** with a note like "Refunded
order #1234".

### How do I tell who placed an order?
The Order item on the Orders board has the recipient and contact link.
The Stock Movements entries created at submission time have your monday
user attached as the *Actor*.

## Getting help

If something looks off — wrong stock numbers, a product missing from
the catalog, an order that didn't sync — start by reloading the page.
If it's still wrong, contact the app admin (Chris) and include:

- What you were trying to do
- The product / order / movement involved (a screenshot is great)
- Roughly when it happened (so we can find it in the logs)

The Stock Movements board is the source of truth for "what changed
when" — it's worth a look before reporting.
