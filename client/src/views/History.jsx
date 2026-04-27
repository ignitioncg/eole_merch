import React, { useEffect, useState } from 'react';
import { Movements } from '../lib/api.js';
import { formatDate, formatNumber } from '../lib/format.js';

const REASON_OPTIONS = [
  { value: '', label: 'All reasons' },
  { value: 'Order Placed', label: 'Order Placed' },
  { value: 'New Shipment', label: 'New Shipment' },
  { value: 'Stocktake Adjustment', label: 'Stocktake Adjustment' },
  { value: 'Manual Correction', label: 'Manual Correction' },
  { value: 'Initial Sync', label: 'Initial Sync' }
];

export default function History({ filterProductId }) {
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState('');
  const [productId, setProductId] = useState(filterProductId || '');

  useEffect(() => {
    setProductId(filterProductId || '');
  }, [filterProductId]);

  useEffect(() => {
    setLoading(true);
    Movements.list({ productId: productId || undefined, reason: reason || undefined })
      .then((r) => setMovements(r.movements))
      .finally(() => setLoading(false));
  }, [productId, reason]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Movement history</h1>
          <div className="sub">{movements.length} movements</div>
        </div>
      </div>

      <div className="toolbar">
        <select value={reason} onChange={(e) => setReason(e.target.value)}>
          {REASON_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        {productId && (
          <button className="btn ghost" onClick={() => setProductId('')}>Clear product filter</button>
        )}
      </div>

      {loading && <div className="empty-state">Loading…</div>}
      {!loading && (
        <table className="table">
          <thead>
            <tr>
              <th>When</th>
              <th>Movement</th>
              <th>Reason</th>
              <th style={{ textAlign: 'right' }}>Δ</th>
              <th style={{ textAlign: 'right' }}>Before → After</th>
              <th>Actor</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {movements.map((m) => (
              <tr key={m.movementId}>
                <td>{formatDate(m.movementAt)}</td>
                <td><strong>{m.itemName}</strong></td>
                <td>{m.reason}</td>
                <td style={{ textAlign: 'right' }} className={m.delta >= 0 ? 'delta-positive' : 'delta-negative'}>
                  {m.delta > 0 ? '+' : ''}{m.delta}
                </td>
                <td style={{ textAlign: 'right' }}>{formatNumber(m.stockBefore)} → {formatNumber(m.stockAfter)}</td>
                <td>{m.actor || '—'}</td>
                <td style={{ color: 'var(--text-soft)' }}>{m.note || ''}</td>
              </tr>
            ))}
            {movements.length === 0 && (
              <tr><td colSpan={7} className="empty-state">No movements match the current filters.</td></tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
