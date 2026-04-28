import React, { useEffect, useMemo, useState } from 'react';
import { Contacts, Orders, Products, isDryRunMode, isPrintOnDemand } from '../lib/api.js';
import StatusPill from '../components/StatusPill.jsx';
import Steps from '../components/Steps.jsx';
import Banner from '../components/Banner.jsx';
import {
  IconUser, IconBox, IconClipboard, IconArrow, IconPlus, IconTrash,
  IconWarn, IconCheck, IconTruck, IconCal, IconSearch
} from '../components/Icons.jsx';

const STEPS = ['Recipient', 'Products', 'Review'];

export default function NewOrder({ actor, onSubmitted, onCancel, onToast }) {
  const [step, setStep] = useState(0);
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);

  // Step 1: recipient
  const [contactSearchTerm, setContactSearchTerm] = useState('');
  const [contact, setContact] = useState(null);
  const [recipientName, setRecipientName] = useState('');
  const [shipping, setShipping] = useState('');
  const [sentVia, setSentVia] = useState('');
  const [event, setEvent] = useState('');
  const [notes, setNotes] = useState('');

  // Step 2: lines
  const [lines, setLines] = useState([{ product: null, quantity: 1 }]);

  // Submit
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Dry-run: starts true if URL flag is set, otherwise toggle
  const [dryRun, setDryRun] = useState(() => isDryRunMode());

  useEffect(() => {
    Products.list()
      .then((r) => setProducts(r.products))
      .finally(() => setProductsLoading(false));
  }, []);

  function pickContact(c) {
    setContact(c);
    setContactSearchTerm(c.name);
    setRecipientName(c.name);
    const addrCol = (c.columnValues || []).find(
      (cv) => /address|location/i.test(cv.id) || (cv.text && /,/.test(cv.text))
    );
    if (addrCol && addrCol.text) setShipping(addrCol.text);
  }

  function setLine(idx, patch) {
    setLines((cur) => cur.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }
  function removeLine(idx) {
    setLines((cur) => cur.filter((_, i) => i !== idx));
  }
  function addLine() {
    setLines((cur) => [...cur, { product: null, quantity: 1 }]);
  }

  const validLines = lines.filter((l) => l.product && l.quantity > 0);
  const totalUnits = validLines.reduce((s, l) => s + Number(l.quantity), 0);
  const overstockLines = validLines.filter(
    (l) => !isPrintOnDemand(l.product.name) && l.quantity > l.product.stockOnHand
  );

  // step gates — only recipient name is required; address is optional (some orders are pickups / events)
  const recipientReady = recipientName.trim().length > 0;
  const linesReady = validLines.length > 0;

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const order = {
        recipientName: recipientName.trim(),
        recipientContactItemId: contact?.id || null,
        shippingAddress: shipping,
        sentVia,
        dateSent: new Date().toISOString().slice(0, 10),
        event: event || null,
        notes: notes || null,
        lines: validLines.map((l) => ({
          productId: l.product.productId,
          productNameAtTime: l.product.name,
          quantity: Number(l.quantity)
        }))
      };
      const r = await Orders.submit(order, actor, dryRun);
      onSubmitted && onSubmitted(r, { dryRun });
    } catch (e) {
      const msg = e.message || 'Submission failed';
      setError(msg);
      onToast?.({ kind: 'error', message: `Submission failed — see banner on Review for details` });
      // bring user to Review so they can see the banner
      setStep(2);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>New order</h1>
          <div className="sub">
            {dryRun
              ? 'Test mode — no stock will change, no order will be created.'
              : 'Three quick steps. Submitting deducts stock and creates the order on monday.'}
          </div>
        </div>
        <div className="page-actions">
          <label
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '8px 12px',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
              background: dryRun ? 'var(--orange-soft)' : 'var(--surface)',
              color: dryRun ? 'var(--orange)' : 'var(--text-muted)',
              fontWeight: 600, fontSize: 13, cursor: 'pointer',
              textTransform: 'none', letterSpacing: 0
            }}
            title="When ticked, Submit only previews — no stock or order changes."
          >
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              style={{ width: 'auto', margin: 0 }}
            />
            Test mode (no changes)
          </label>
          <button className="btn ghost" onClick={onCancel}>Cancel</button>
        </div>
      </div>

      {dryRun && (
        <Banner kind="warn" title="🧪 You're in test mode">
          Submissions are previewed only — no stock changes, no order on monday, no Stock Movement entries. Untick the checkbox above to switch off.
        </Banner>
      )}

      <Steps steps={STEPS} current={step} />

      <div className="card card-pad-lg" style={{ marginBottom: 16 }}>
        {step === 0 && (
          <RecipientStep
            contactSearchTerm={contactSearchTerm} setContactSearchTerm={setContactSearchTerm}
            contact={contact} pickContact={pickContact}
            recipientName={recipientName} setRecipientName={setRecipientName}
            shipping={shipping} setShipping={setShipping}
            sentVia={sentVia} setSentVia={setSentVia}
            event={event} setEvent={setEvent}
            notes={notes} setNotes={setNotes}
          />
        )}
        {step === 1 && (
          <ProductsStep
            products={products} loading={productsLoading}
            lines={lines} setLine={setLine} removeLine={removeLine} addLine={addLine}
            overstockLines={overstockLines} totalUnits={totalUnits}
          />
        )}
        {step === 2 && (
          <ReviewStep
            recipientName={recipientName} contact={contact}
            shipping={shipping} sentVia={sentVia} event={event} notes={notes}
            validLines={validLines} totalUnits={totalUnits}
            overstockLines={overstockLines}
            error={error}
          />
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          className="btn ghost"
          disabled={step === 0}
          onClick={() => { setError(null); setStep((s) => Math.max(0, s - 1)); }}
        >
          ← Back
        </button>
        {step < 2 ? (
          <button
            className="btn"
            disabled={(step === 0 && !recipientReady) || (step === 1 && !linesReady)}
            onClick={() => setStep((s) => s + 1)}
          >
            Next: {STEPS[step + 1]} <IconArrow width={14} height={14} />
          </button>
        ) : (
          <button className={`btn ${dryRun ? 'subtle' : ''}`} disabled={submitting} onClick={submit}>
            {submitting
              ? <><span className="spinner" /> {dryRun ? 'Running test…' : 'Submitting…'}</>
              : <><IconCheck width={16} height={16} /> {dryRun ? 'Run test (no changes)' : 'Submit order'}</>}
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Step 1: Recipient ────────────────────────────────────── */

function RecipientStep({
  contactSearchTerm, setContactSearchTerm, contact, pickContact,
  recipientName, setRecipientName, shipping, setShipping, sentVia, setSentVia,
  event, setEvent, notes, setNotes
}) {
  return (
    <div>
      <h3><IconUser /> Who is this order for?</h3>
      <Banner kind="info">
        Search the Contacts board to pre-fill the address, or type a name freely if the recipient isn't a saved contact.
      </Banner>

      <div className="field-row">
        <div className="field">
          <label>Search Contacts</label>
          <ContactSearch value={contactSearchTerm} onChange={setContactSearchTerm} onSelect={pickContact} />
          {contact && (
            <div className="help"><IconCheck width={12} height={12} style={{ verticalAlign: 'middle', color: 'var(--green)' }} /> Linked to <strong>{contact.name}</strong></div>
          )}
        </div>
        <div className="field">
          <label>Recipient name *</label>
          <input
            type="text"
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            placeholder="e.g. Royal Melbourne Hospital"
          />
          <div className="help">This is what shows on the Orders board.</div>
        </div>
      </div>

      <div className="field" style={{ marginTop: 16 }}>
        <label>Shipping address (optional)</label>
        <input
          type="text"
          value={shipping}
          onChange={(e) => setShipping(e.target.value)}
          placeholder="Street, suburb, state, postcode — leave blank for pickups or events"
        />
        {contact && contact.columnValues && (
          <div className="help">Pre-filled from contact. Edit if needed, or clear it for pickups/events.</div>
        )}
      </div>

      <div className="field-row" style={{ marginTop: 16 }}>
        <div className="field">
          <label><IconTruck width={12} height={12} style={{ verticalAlign: 'middle' }} /> Sent via</label>
          <input type="text" value={sentVia} onChange={(e) => setSentVia(e.target.value)} placeholder="e.g. AusPost express" />
        </div>
        <div className="field">
          <label><IconCal width={12} height={12} style={{ verticalAlign: 'middle' }} /> Event (optional)</label>
          <input type="text" value={event} onChange={(e) => setEvent(e.target.value)} placeholder="e.g. Aged Care Conference 2026" />
        </div>
      </div>

      <div className="field" style={{ marginTop: 16 }}>
        <label>Notes (optional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Anything you want recorded on this order"
        />
      </div>
    </div>
  );
}

/* ─── Step 2: Products ─────────────────────────────────────── */

function ProductsStep({ products, loading, lines, setLine, removeLine, addLine, overstockLines, totalUnits }) {
  return (
    <div>
      <h3><IconBox /> What are you sending?</h3>
      <Banner kind="info">
        Add a line per product. <strong>Print-on-demand</strong> items (flyers etc.) can be ordered in any quantity — they're printed when the order goes out. <strong>Out of Stock</strong> and <strong>On Order</strong> items prompt for confirmation. <strong>Discontinued</strong> items are hidden.
      </Banner>

      {loading ? (
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-soft)' }}>
          <span className="spinner" /> Loading products…
        </div>
      ) : (
        <>
          <div className="line-list">
            {lines.map((line, idx) => {
              const printOnDemand = line.product && isPrintOnDemand(line.product.name);
              const willGoNegative = line.product && !printOnDemand && line.quantity > line.product.stockOnHand;
              return (
              <div key={idx} className={`line-card${willGoNegative ? ' warn' : ''}`}>
                <div>
                  <ProductPicker
                    products={products}
                    value={line.product}
                    onChange={(p) => setLine(idx, { product: p })}
                  />
                  {line.product && (
                    <div className="stock-hint">
                      {printOnDemand ? (
                        <><span className="pill in_stock">Print on demand</span> any quantity · printed when ordered</>
                      ) : willGoNegative ? (
                        <><IconWarn width={12} height={12} style={{ verticalAlign: 'middle' }} /> Only {line.product.stockOnHand} on hand — stock will go negative</>
                      ) : (
                        <>{line.product.stockOnHand} on hand · <StatusPill statusKey={line.product.statusKey} /></>
                      )}
                    </div>
                  )}
                </div>
                <input
                  type="number"
                  min="1"
                  value={line.quantity}
                  onChange={(e) => setLine(idx, { quantity: Number(e.target.value) })}
                  aria-label="Quantity"
                />
                <button
                  className="icon-btn"
                  onClick={() => removeLine(idx)}
                  aria-label="Remove line"
                  disabled={lines.length === 1}
                >
                  <IconTrash width={16} height={16} />
                </button>
              </div>
              );
            })}
          </div>

          <button className="btn subtle" onClick={addLine} style={{ marginTop: 12 }}>
            <IconPlus width={14} height={14} /> Add another product
          </button>

          {overstockLines.length > 0 && (
            <Banner kind="warn" title="Stock will go negative" >
              {overstockLines.length} line{overstockLines.length > 1 ? 's' : ''} requested more than is on hand. You can still submit — the catalog records the negative balance.
            </Banner>
          )}

          {totalUnits > 0 && (
            <div className="summary-card" style={{ marginTop: 16 }}>
              <span className="label">Total units</span>
              <span className="value">{totalUnits}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ─── Step 3: Review ───────────────────────────────────────── */

function ReviewStep({ recipientName, contact, shipping, sentVia, event, notes, validLines, totalUnits, overstockLines, error }) {
  return (
    <div>
      <h3><IconClipboard /> Ready to submit?</h3>
      <Banner kind="info">
        On submit, stock is deducted, the order is created on the Orders board, and one Stock Movement is written per line.
        <strong> This can't be undone automatically.</strong>
      </Banner>

      <div className="card card-pad" style={{ background: 'var(--surface-2)', marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <ReviewField label="Recipient" value={recipientName} sub={contact ? `Linked to contact "${contact.name}"` : 'No contact link'} />
          <ReviewField label="Sent via" value={sentVia || '—'} />
          <ReviewField label="Shipping address" value={shipping} />
          {event && <ReviewField label="Event" value={event} />}
          {notes && <ReviewField label="Notes" value={notes} />}
        </div>
      </div>

      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>{validLines.length} line{validLines.length !== 1 ? 's' : ''} · {totalUnits} units</h3>
        </div>
        <table className="table" style={{ border: 'none' }}>
          <thead>
            <tr>
              <th>Product</th>
              <th className="text-right">Qty</th>
              <th className="text-right">After</th>
              <th>Status after</th>
            </tr>
          </thead>
          <tbody>
            {validLines.map((l, i) => {
              const after = l.product.stockOnHand - l.quantity;
              return (
                <tr key={i}>
                  <td><strong>{l.product.name}</strong></td>
                  <td className="text-right num">{l.quantity}</td>
                  <td className={`text-right num ${after < 0 ? 'delta-negative' : ''}`}>{after}</td>
                  <td>
                    <span className={`pill ${after <= 0 ? 'out_of_stock' : after < (l.product.reorderPoint ?? 25) ? 'low_stock' : 'in_stock'}`}>
                      {after <= 0 ? 'Out of Stock' : after < (l.product.reorderPoint ?? 25) ? 'Low Stock' : 'In Stock'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {overstockLines.length > 0 && (
        <Banner kind="warn">
          Heads up: {overstockLines.length} line{overstockLines.length > 1 ? 's' : ''} will leave stock negative.
        </Banner>
      )}

      {error && <Banner kind="error" title="Submission failed">{error}</Banner>}
    </div>
  );
}

function ReviewField({ label, value, sub }) {
  return (
    <div>
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-soft)', fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div style={{ fontWeight: 500 }}>{value || <span style={{ color: 'var(--text-soft)' }}>—</span>}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--text-soft)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

/* ─── Pickers ──────────────────────────────────────────────── */

function ContactSearch({ onSelect, value, onChange }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;
    setError(null);
    if (!value || value.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const r = await Contacts.search(value);
        if (!active) return;
        setResults(r.contacts || []);
      } catch (e) {
        if (!active) return;
        console.error('[contacts.search]', e);
        setError(e.message || 'Could not load contacts');
        setResults([]);
      } finally {
        if (active) setLoading(false);
      }
    }, 200);
    return () => { active = false; clearTimeout(timer); };
  }, [value]);

  const showDropdown = open && (loading || results.length > 0 || error || (value && value.length >= 2));

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-soft)', pointerEvents: 'none' }}>
          <IconSearch width={14} height={14} />
        </span>
        <input
          type="text"
          placeholder="Type 2+ letters to search…"
          value={value}
          onChange={(e) => { onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          style={{ paddingLeft: 36 }}
        />
      </div>
      {showDropdown && (
        <div className="search-results">
          {loading && <div className="result" style={{ color: 'var(--text-soft)' }}><span className="spinner" /> Searching…</div>}
          {!loading && error && (
            <div className="result" style={{ color: 'var(--red)' }}>
              <strong>Couldn't load contacts: {error}</strong>
              <div className="meta">Type the name manually — order still works.</div>
            </div>
          )}
          {!loading && !error && results.length === 0 && value.length >= 2 && (
            <div className="result" style={{ color: 'var(--text-soft)' }}>
              No contacts match "{value}". Type a name manually below.
            </div>
          )}
          {!loading && !error && results.map((c) => (
            <div key={c.id} className="result" onMouseDown={() => { onSelect(c); setOpen(false); }}>
              <strong>{c.name}</strong>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProductPicker({ products, value, onChange }) {
  const [search, setSearch] = useState(value ? value.name : '');
  const [open, setOpen] = useState(false);

  useEffect(() => { if (value) setSearch(value.name); }, [value]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products
      .filter((p) => p.statusKey !== 'Discontinued')
      .filter((p) => !term || p.name.toLowerCase().includes(term))
      .slice(0, 30);
  }, [products, search]);

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-soft)', pointerEvents: 'none' }}>
          <IconSearch width={14} height={14} />
        </span>
        <input
          type="text"
          placeholder="Pick a product…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          style={{ paddingLeft: 36 }}
        />
      </div>
      {open && (
        <div className="search-results">
          {filtered.map((p) => {
            const printOnDemand = isPrintOnDemand(p.name);
            return (
              <div
                key={p.productId}
                className="result"
                onMouseDown={() => {
                  if (p.statusKey === 'OnOrder' && !window.confirm(`${p.name} is currently On Order. Add anyway?`)) return;
                  if (!printOnDemand && p.statusKey === 'OutOfStock' && !window.confirm(
                    `${p.name} is Out of Stock. Submitting will leave stock negative — only do this if you're sure. Add anyway?`
                  )) return;
                  onChange(p);
                  setSearch(p.name);
                  setOpen(false);
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <strong>{p.name}</strong>
                  {printOnDemand
                    ? <span className="pill in_stock">Print on demand</span>
                    : <StatusPill statusKey={p.statusKey} />}
                </div>
                <div className="meta">
                  {printOnDemand ? 'Printed when ordered — any quantity' : `${p.stockOnHand} on hand`}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="result" style={{ color: 'var(--text-soft)' }}>No products match.</div>
          )}
        </div>
      )}
    </div>
  );
}
