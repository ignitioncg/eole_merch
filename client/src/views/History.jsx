import React, { useEffect, useMemo, useState } from 'react';
import { Movements } from '../lib/api.js';
import EmptyState from '../components/EmptyState.jsx';
import Banner from '../components/Banner.jsx';
import { SkeletonRows } from '../components/Skeleton.jsx';
import { IconHistory, IconRefresh } from '../components/Icons.jsx';
import { formatNumber } from '../lib/format.js';

const REASON_OPTIONS = [
  { value: '', label: 'All reasons', cls: '' },
  { value: 'Order Placed', label: 'Orders', cls: 'order_placed' },
  { value: 'New Shipment', label: 'Shipments', cls: 'new_shipment' },
  { value: 'Stocktake Adjustment', label: 'Stocktake', cls: 'stocktake_adjustment' },
  { value: 'Manual Correction', label: 'Corrections', cls: 'manual_correction' },
  { value: 'Initial Sync', label: 'Initial sync', cls: 'initial_sync' }
];

const REASON_TO_CLS = {
  'Order Placed': 'order_placed',
  'New Shipment': 'new_shipment',
  'Stocktake Adjustment': 'stocktake_adjustment',
  'Manual Correction': 'manual_correction',
  'Initial Sync': 'initial_sync'
};

const REVERTABLE_REASONS = new Set([
  'Order Placed',
  'New Shipment',
  'Stocktake Adjustment',
  'Manual Correction'
]);

export default function History({ filterProductId, clearProductFilter, actor, onToast }) {
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState('');
  const [error, setError] = useState(null);
  const [revertingId, setRevertingId] = useState(null);

  const load = () => {
    setLoading(true);
    Movements.list({ productId: filterProductId || undefined, reason: reason || undefined })
      .then((r) => { setMovements(r.movements); setError(null); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [filterProductId, reason]);

  async function revert(m) {
    const sign = m.delta > 0 ? '+' : '';
    const inverse = -m.delta;
    const inverseSign = inverse > 0 ? '+' : '';
    const ok = window.confirm(
      `Revert this movement?\n\n${m.itemName}\nReason: ${m.reason}\nOriginal change: ${sign}${m.delta}\n\nThis will adjust stock by ${inverseSign}${inverse} and write a "Manual Correction" entry showing the revert. The original movement stays in the history as a record.`
    );
    if (!ok) return;
    setRevertingId(m.movementId);
    try {
      const r = await Movements.revert(m.movementId, actor);
      onToast?.({ kind: 'success', message: `Reverted ✓  ${r.productName}: ${formatNumber(r.stockBefore)} → ${formatNumber(r.stockAfter)}` });
      load();
    } catch (e) {
      onToast?.({ kind: 'error', message: `Revert failed: ${e.message}` });
    } finally {
      setRevertingId(null);
    }
  }

  const grouped = useMemo(() => {
    const out = new Map();
    for (const m of movements) {
      const day = (m.movementAt || '').slice(0, 10) || 'Unknown';
      if (!out.has(day)) out.set(day, []);
      out.get(day).push(m);
    }
    return [...out.entries()];
  }, [movements]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>History</h1>
          <div className="sub">{loading ? 'Loading…' : `${movements.length} movement${movements.length === 1 ? '' : 's'} · click Revert to undo`}</div>
        </div>
        <div className="page-actions">
          <button className="btn ghost sm" onClick={load} aria-label="Refresh">
            <IconRefresh width={14} height={14} /> Refresh
          </button>
        </div>
      </div>

      {filterProductId && (
        <Banner kind="info">
          Filtered to one product.
          <button className="btn ghost sm" style={{ marginLeft: 12 }} onClick={clearProductFilter}>
            Clear product filter
          </button>
        </Banner>
      )}

      <div className="toolbar" style={{ marginBottom: 16 }}>
        <div className="chip-row">
          {REASON_OPTIONS.map((r) => (
            <button
              key={r.value}
              className={`chip ${reason === r.value ? 'active' : ''}`}
              onClick={() => setReason(r.value)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {error && <Banner kind="error">{error}</Banner>}

      {loading ? (
        <SkeletonRows rows={6} />
      ) : movements.length === 0 ? (
        <EmptyState
          icon={<IconHistory width={28} height={28} />}
          title="No movements yet"
          description="Stock movements appear here whenever someone places an order or adjusts stock."
        />
      ) : (
        <div className="table-wrap">
          {grouped.map(([day, items]) => (
            <div key={day}>
              <div className="timeline-day">{prettyDay(day)}</div>
              {items.map((m) => {
                const canRevert = REVERTABLE_REASONS.has(m.reason);
                return (
                  <div key={m.movementId} className={`movement-row ${REASON_TO_CLS[m.reason] || ''}`}>
                    <div className="dot" />
                    <div className="name">
                      <strong>{m.itemName}</strong>
                      <div className="meta">
                        {m.reason}{m.actor ? ` · ${m.actor}` : ''}{m.note ? ` · "${m.note}"` : ''}
                      </div>
                    </div>
                    <div className={`delta ${m.delta > 0 ? 'delta-positive' : m.delta < 0 ? 'delta-negative' : 'delta-zero'}`}>
                      {m.delta > 0 ? '+' : ''}{m.delta}
                    </div>
                    <div className="stocks">
                      {formatNumber(m.stockBefore)} → {formatNumber(m.stockAfter)}
                    </div>
                    <button
                      className="btn ghost sm revert-btn"
                      disabled={!canRevert || revertingId === m.movementId}
                      onClick={() => canRevert && revert(m)}
                      title={canRevert ? 'Undo this movement' : 'Initial Sync movements can\'t be reverted'}
                    >
                      {revertingId === m.movementId ? <><span className="spinner" /> Reverting…</> : 'Revert'}
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function prettyDay(iso) {
  if (!iso || iso === 'Unknown') return 'Unknown date';
  try {
    const d = new Date(iso + 'T00:00:00');
    const today = new Date(); today.setHours(0,0,0,0);
    const days = Math.floor((today - d) / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return d.toLocaleDateString('en-AU', { weekday: 'long' });
    return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch (_) {
    return iso;
  }
}
