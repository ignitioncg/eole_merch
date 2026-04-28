import React, { useState } from 'react';
import { Products } from '../lib/api.js';
import StatusPill from '../components/StatusPill.jsx';
import Banner from '../components/Banner.jsx';
import { IconClose, IconHistory, IconCheck, IconArrow, IconArrowDown, IconAlert } from '../components/Icons.jsx';
import { formatDate, formatNumber } from '../lib/format.js';

const REASONS = [
  { value: 'stocktake_adjustment', title: 'Stocktake adjustment', desc: 'You counted physically and the number is different.' },
  { value: 'new_shipment',         title: 'New shipment',          desc: 'New stock arrived from a supplier.' },
  { value: 'manual_correction',    title: 'Manual correction',     desc: 'Fixing a typo or anything else.' }
];

export default function ProductDetail({ product, actor, onClose, onSaved, onViewHistory }) {
  const [newStock, setNewStock] = useState(String(product.stockOnHand));
  const [reason, setReason] = useState('stocktake_adjustment');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const numericStock = Number(newStock);
  const valid = !Number.isNaN(numericStock);
  const delta = valid ? numericStock - product.stockOnHand : 0;
  const dirty = valid && numericStock !== product.stockOnHand;

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await Products.adjust(product.productId, {
        newStockOnHand: numericStock,
        reason,
        note: note || null,
        actor
      });
      onSaved && onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="detail-panel">
        <div className="detail-header">
          <div>
            <h2>{product.name}</h2>
            <div className="meta">Inventory item #{product.linkedInventoryItemId}</div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <IconClose width={16} height={16} />
          </button>
        </div>

        <div className="detail-body">
          <div style={{ marginBottom: 20 }}>
            <StatusPill statusKey={product.statusKey} />
          </div>

          <div className="stat-row">
            <div className="stat">
              <div className="label">Stock on Hand</div>
              <div className="value">{formatNumber(product.stockOnHand)}</div>
            </div>
            <div className="stat">
              <div className="label">Stock in Use (lifetime)</div>
              <div className="value">{formatNumber(product.stockInUse)}</div>
            </div>
            <div className="stat">
              <div className="label">Reorder Point</div>
              <div className="value">{product.reorderPoint != null ? formatNumber(product.reorderPoint) : <span style={{ color: 'var(--text-soft)', fontWeight: 500, fontSize: 13 }}>default</span>}</div>
            </div>
            <div className="stat">
              <div className="label">Last Movement</div>
              <div className="value" style={{ fontSize: 13 }}>{formatDate(product.lastMovementAt)}</div>
            </div>
          </div>

          <h3 style={{ marginTop: 4, marginBottom: 12 }}>Adjust stock on hand</h3>
          <Banner kind="info">
            Use this to record stocktake counts, new shipments, or fix mistakes. The change is logged to the Stock Movements board with your name and reason.
          </Banner>

          <div className="field-row" style={{ marginBottom: 16 }}>
            <div className="field">
              <label>Current</label>
              <input value={product.stockOnHand} disabled style={{ background: 'var(--surface-3)' }} />
            </div>
            <div className="field">
              <label>New</label>
              <input
                type="number"
                value={newStock}
                onChange={(e) => setNewStock(e.target.value)}
              />
              {dirty && (
                <div className="help">
                  <span className={delta > 0 ? 'delta-positive' : delta < 0 ? 'delta-negative' : 'delta-zero'}>
                    {delta > 0 ? '+' : ''}{delta} change
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="field" style={{ marginBottom: 16 }}>
            <label className="field-label">Why are you adjusting?</label>
            <div className="reason-grid">
              {REASONS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  className={`reason-card ${reason === r.value ? 'active' : ''}`}
                  onClick={() => setReason(r.value)}
                >
                  <div className="reason-title">{r.title}</div>
                  <div className="reason-desc">{r.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="field" style={{ marginBottom: 16 }}>
            <label>Note (optional but recommended)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="e.g. Stocktake on 27 Apr — found 12 short"
            />
            <div className="help">Future-you (and Brittny) will appreciate context.</div>
          </div>

          {error && <Banner kind="error">{error}</Banner>}
        </div>

        <div className="sticky-actions">
          <button className="btn ghost" onClick={() => onViewHistory(product)}>
            <IconHistory width={14} height={14} /> Movement history
          </button>
          <button className="btn" disabled={!dirty || saving} onClick={submit}>
            {saving ? <><span className="spinner" /> Saving…</> : <><IconCheck width={14} height={14} /> Save adjustment</>}
          </button>
        </div>
      </div>
    </>
  );
}
