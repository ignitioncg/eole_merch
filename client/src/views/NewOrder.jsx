import React, { useEffect, useMemo, useState } from 'react';
import { Contacts, Orders, Products } from '../lib/api.js';
import StatusPill from '../components/StatusPill.jsx';

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
      <input
        type="text"
        placeholder="Search contacts…"
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        style={{ width: '100%' }}
      />
      {showDropdown && (
        <div className="search-results">
          {loading && <div className="result" style={{ color: 'var(--text-soft)' }}>Searching…</div>}
          {!loading && error && (
            <div className="result" style={{ color: 'var(--red)' }}>
              <strong>Error: {error}</strong>
              <div style={{ fontSize: 12 }}>Type the name manually below — order will still go through without a contact link.</div>
            </div>
          )}
          {!loading && !error && results.length === 0 && value.length >= 2 && (
            <div className="result" style={{ color: 'var(--text-soft)' }}>
              No contacts match "{value}". Type a name manually.
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
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products
      .filter((p) => p.statusKey !== 'Discontinued')
      .filter((p) => !term || p.name.toLowerCase().includes(term));
  }, [products, search]);

  return (
    <div style={{ position: 'relative' }}>
      <input
        type="text"
        placeholder="Pick product…"
        value={search}
        onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        style={{ width: '100%' }}
      />
      {open && (
        <div className="search-results">
          {filtered.map((p) => (
            <div
              key={p.productId}
              className="result"
              style={{ opacity: p.statusKey === 'OutOfStock' ? 0.4 : 1, cursor: p.statusKey === 'OutOfStock' ? 'not-allowed' : 'pointer' }}
              onMouseDown={() => {
                if (p.statusKey === 'OutOfStock') return;
                if (p.statusKey === 'OnOrder' && !window.confirm(`${p.name} is currently On Order. Add anyway?`)) return;
                onChange(p);
                setSearch(p.name);
                setOpen(false);
              }}
            >
              <strong>{p.name}</strong>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-soft)' }}>
                <span>{p.stockOnHand} on hand</span>
                <StatusPill statusKey={p.statusKey} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function NewOrder({ actor, onSubmitted }) {
  const [products, setProducts] = useState([]);
  const [contactSearchTerm, setContactSearchTerm] = useState('');
  const [contact, setContact] = useState(null);
  const [recipientName, setRecipientName] = useState('');
  const [shipping, setShipping] = useState('');
  const [sentVia, setSentVia] = useState('');
  const [event, setEvent] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState([{ product: null, quantity: 1 }]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [warnings, setWarnings] = useState([]);

  useEffect(() => {
    Products.list().then((r) => setProducts(r.products));
  }, []);

  function pickContact(c) {
    setContact(c);
    setContactSearchTerm(c.name);
    setRecipientName(c.name);
    const addrCol = (c.columnValues || []).find((cv) => /address/i.test(cv.id) || /address/i.test(cv.text || ''));
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
  const overstockWarnings = validLines.filter((l) => l.quantity > l.product.stockOnHand);

  const canSubmit = recipientName.trim() && shipping.trim() && validLines.length > 0;

  async function submit() {
    setSubmitting(true);
    setError(null);
    setWarnings([]);
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
      const r = await Orders.submit(order, actor, false);
      if (r.warnings && r.warnings.length) setWarnings(r.warnings);
      onSubmitted && onSubmitted(r);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>New order</h1>
          <div className="sub">Submit deducts stock immediately and creates the order on the Orders board.</div>
        </div>
      </div>

      <div className="card" style={{ padding: 24, marginBottom: 16 }}>
        <div className="order-form">
          <div className="field">
            <label>Recipient — search Contacts or type name</label>
            <ContactSearch value={contactSearchTerm} onChange={setContactSearchTerm} onSelect={pickContact} />
            <input
              type="text"
              placeholder="Recipient name"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              style={{ marginTop: 6 }}
            />
          </div>
          <div className="field">
            <label>Sent via</label>
            <input type="text" placeholder="e.g. AusPost express" value={sentVia} onChange={(e) => setSentVia(e.target.value)} />
          </div>
          <div className="field full">
            <label>Shipping address</label>
            <input type="text" value={shipping} onChange={(e) => setShipping(e.target.value)} placeholder="Street, suburb, state, postcode" />
          </div>
          <div className="field">
            <label>Event (optional)</label>
            <input type="text" value={event} onChange={(e) => setEvent(e.target.value)} />
          </div>
          <div className="field">
            <label>Notes (optional)</label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 24, marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Lines</h3>
        <div>
          {lines.map((line, idx) => (
            <div key={idx} className={`line-row${line.product && line.quantity > line.product.stockOnHand ? ' warn' : ''}`}>
              <div>
                <ProductPicker products={products} value={line.product} onChange={(p) => setLine(idx, { product: p })} />
                {line.product && (
                  <div className="stock-hint">
                    {line.quantity > line.product.stockOnHand
                      ? `Only ${line.product.stockOnHand} on hand — stock will go negative`
                      : `${line.product.stockOnHand} on hand`}
                  </div>
                )}
              </div>
              <input type="number" min="1" value={line.quantity} onChange={(e) => setLine(idx, { quantity: Number(e.target.value) })} />
              <div></div>
              <button className="btn ghost" onClick={() => removeLine(idx)} aria-label="Remove">✕</button>
            </div>
          ))}
        </div>
        <button className="btn subtle" onClick={addLine} style={{ marginTop: 12 }}>+ Add line</button>
      </div>

      {overstockWarnings.length > 0 && (
        <div className="card" style={{ padding: 16, marginBottom: 16, background: 'var(--orange-soft)', borderColor: 'var(--orange)' }}>
          <strong>Heads up:</strong> {overstockWarnings.length} line{overstockWarnings.length > 1 ? 's' : ''} request more stock than available. You can still submit.
        </div>
      )}
      {warnings.length > 0 && (
        <div className="card" style={{ padding: 16, marginBottom: 16, background: 'var(--orange-soft)', borderColor: 'var(--orange)' }}>
          {warnings.map((w, i) => <div key={i}>{w}</div>)}
        </div>
      )}
      {error && <div style={{ color: 'var(--red)', marginBottom: 12 }}>{error}</div>}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button className="btn" disabled={!canSubmit || submitting} onClick={submit}>
          {submitting ? <><span className="spinner" /> Submitting…</> : 'Submit order'}
        </button>
      </div>
    </div>
  );
}
