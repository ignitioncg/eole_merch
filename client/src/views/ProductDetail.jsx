import React, { useState } from 'react';
import { Products } from '../lib/api.js';
import StatusPill from '../components/StatusPill.jsx';
import { formatDate, formatNumber } from '../lib/format.js';

const REASONS = [
  { value: 'stocktake_adjustment', label: 'Stocktake adjustment' },
  { value: 'new_shipment', label: 'New shipment received' },
  { value: 'manual_correction', label: 'Manual correction' }
];

export default function ProductDetail({ product, actor, onClose, onSaved, onViewHistory }) {
  const [newStock, setNewStock] = useState(String(product.stockOnHand));
  const [reason, setReason] = useState('stocktake_adjustment');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const delta = Number(newStock) - product.stockOnHand;
  const dirty = !Number.isNaN(Number(newStock)) && Number(newStock) !== product.stockOnHand;

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await Products.adjust(product.productId, {
        newStockOnHand: Number(newStock),
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <h2>{product.name}</h2>
            <div style={{ color: 'var(--text-soft)', fontSize: 13 }}>Inventory item #{product.linkedInventoryItemId}</div>
          </div>
          <button className="btn ghost" onClick={onClose}>Close</button>
        </div>

        <div className="row"><span>Status</span><StatusPill statusKey={product.statusKey} /></div>
        <div className="row"><span>Stock on Hand</span><strong>{formatNumber(product.stockOnHand)}</strong></div>
        <div className="row"><span>Stock in Use (lifetime)</span><strong>{formatNumber(product.stockInUse)}</strong></div>
        <div className="row"><span>Reorder Point</span><strong>{product.reorderPoint != null ? formatNumber(product.reorderPoint) : 'default'}</strong></div>
        <div className="row"><span>Last Movement</span><span>{formatDate(product.lastMovementAt)}</span></div>

        <div style={{ marginTop: 28 }}>
          <h3 style={{ fontSize: 14, marginBottom: 12 }}>Adjust stock</h3>
          <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <label>New stock on hand</label>
              <input type="number" value={newStock} onChange={(e) => setNewStock(e.target.value)} />
            </div>
            <div style={{ width: 100, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
              <label>Δ</label>
              <div style={{ padding: '9px 10px' }}>
                {dirty && (
                  <span className={delta >= 0 ? 'delta-positive' : 'delta-negative'}>
                    {delta > 0 ? '+' : ''}{delta}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label>Reason</label>
            <select value={reason} onChange={(e) => setReason(e.target.value)} style={{ width: '100%' }}>
              {REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label>Note (optional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Found 12 short during stocktake on 27 Apr…"
              style={{ width: '100%' }}
            />
          </div>
          {error && <div style={{ color: 'var(--red)', marginBottom: 12 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" disabled={!dirty || saving} onClick={submit}>
              {saving ? <><span className="spinner" /> Saving…</> : 'Save adjustment'}
            </button>
            <button className="btn ghost" onClick={() => onViewHistory(product)}>View movement history</button>
          </div>
        </div>
      </div>
    </>
  );
}
