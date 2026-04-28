import React, { useEffect, useMemo, useState } from 'react';
import { Products } from '../lib/api.js';
import StatusPill from '../components/StatusPill.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Banner from '../components/Banner.jsx';
import { SkeletonRows, SkeletonStats } from '../components/Skeleton.jsx';
import { IconBox, IconAlert, IconCheck, IconSearch, IconWarn, IconRefresh, IconArrow } from '../components/Icons.jsx';
import { formatDate, formatNumber } from '../lib/format.js';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'OutOfStock', label: 'Out of Stock' },
  { key: 'LowStock', label: 'Low Stock' },
  { key: 'InStock', label: 'In Stock' },
  { key: 'OnOrder', label: 'On Order' },
  { key: 'Discontinued', label: 'Discontinued' }
];

export default function Catalog({ onOpenProduct, onNewOrder }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState(null);

  const load = () => {
    setLoading(true);
    Products.list()
      .then((r) => { setProducts(r.products); setError(null); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const counts = useMemo(() => {
    const acc = { total: products.length, OutOfStock: 0, LowStock: 0, InStock: 0, OnOrder: 0, Discontinued: 0 };
    for (const p of products) acc[p.statusKey] = (acc[p.statusKey] || 0) + 1;
    return acc;
  }, [products]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products
      .filter((p) => filter === 'all' || p.statusKey === filter)
      .filter((p) => !term || p.name.toLowerCase().includes(term));
  }, [products, search, filter]);

  if (error) {
    return (
      <Banner kind="error" title="Could not load the catalog">
        {error}
        <div style={{ marginTop: 8 }}>
          <button className="btn ghost sm" onClick={load}>
            <IconRefresh width={14} height={14} /> Try again
          </button>
        </div>
      </Banner>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Catalog</h1>
          <div className="sub">
            {loading ? 'Loading products…' : `${counts.total} products · click a row to adjust stock`}
          </div>
        </div>
        <div className="page-actions">
          <button className="btn ghost sm" onClick={load} aria-label="Refresh">
            <IconRefresh width={14} height={14} /> Refresh
          </button>
          <button className="btn" onClick={onNewOrder}>
            <IconArrow width={14} height={14} /> New order
          </button>
        </div>
      </div>

      {loading && !products.length ? (
        <>
          <SkeletonStats count={4} />
          <SkeletonRows rows={8} />
        </>
      ) : (
        <>
          <div className="stat-grid">
            <Stat tone=""        label="Total"          value={counts.total}        active={filter === 'all'}        onClick={() => setFilter('all')}        icon={<IconBox width={18} height={18}/>} />
            <Stat tone="red"     label="Out of Stock"  value={counts.OutOfStock || 0} active={filter === 'OutOfStock'} onClick={() => setFilter('OutOfStock')} icon={<IconAlert width={18} height={18}/>} />
            <Stat tone="orange"  label="Low Stock"     value={counts.LowStock || 0}   active={filter === 'LowStock'}   onClick={() => setFilter('LowStock')}    icon={<IconWarn width={18} height={18}/>} />
            <Stat tone="green"   label="In Stock"      value={counts.InStock || 0}    active={filter === 'InStock'}    onClick={() => setFilter('InStock')}     icon={<IconCheck width={18} height={18}/>} />
          </div>

          <div className="toolbar">
            <div className="search">
              <span className="search-icon"><IconSearch width={16} height={16} /></span>
              <input
                type="search"
                placeholder="Search products by name…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="chip-row">
              {FILTERS.map((f) => (
                <button key={f.key} className={`chip ${filter === f.key ? 'active' : ''}`} onClick={() => setFilter(f.key)}>
                  {f.label}
                  <span className="count">
                    {f.key === 'all' ? counts.total : counts[f.key] || 0}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={<IconBox width={28} height={28} />}
              title={search ? `No products match "${search}"` : `No ${FILTERS.find((f) => f.key === filter)?.label || ''} products`}
              description={search ? 'Try a different search term, or clear filters.' : 'Switch filter or check the inventory board.'}
              actions={(search || filter !== 'all') && (
                <button className="btn ghost sm" onClick={() => { setSearch(''); setFilter('all'); }}>
                  Clear filters
                </button>
              )}
            />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th className="text-right">Stock on Hand</th>
                    <th className="text-right">Stock in Use</th>
                    <th className="text-right">Reorder Point</th>
                    <th>Status</th>
                    <th>Last Movement</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr key={p.productId} onClick={() => onOpenProduct(p)}>
                      <td>
                        <div className="row-name">
                          <strong>{p.name}</strong>
                          <span className="row-meta">#{p.linkedInventoryItemId}</span>
                        </div>
                      </td>
                      <td className="text-right num">{formatNumber(p.stockOnHand)}</td>
                      <td className="text-right num">{formatNumber(p.stockInUse)}</td>
                      <td className="text-right num">
                        {p.reorderPoint != null ? formatNumber(p.reorderPoint) : <span style={{ color: 'var(--text-soft)' }}>default</span>}
                      </td>
                      <td><StatusPill statusKey={p.statusKey} /></td>
                      <td style={{ color: 'var(--text-soft)' }}>{formatDate(p.lastMovementAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ tone, label, value, active, onClick, icon }) {
  return (
    <button type="button" className={`stat-card ${tone} ${active ? 'active' : ''}`} onClick={onClick}>
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {icon && <div className="accent">{icon}</div>}
    </button>
  );
}
