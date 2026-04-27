import React, { useEffect, useMemo, useState } from 'react';
import { Products } from '../lib/api.js';
import StatusPill from '../components/StatusPill.jsx';
import { formatDate, formatNumber } from '../lib/format.js';

export default function Catalog({ onOpenProduct, onViewHistory }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    Products.list()
      .then((r) => setProducts(r.products))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return products;
    return products.filter((p) => p.name.toLowerCase().includes(term));
  }, [products, search]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Catalog</h1>
          <div className="sub">{products.length} products · sorted by status</div>
        </div>
      </div>

      <div className="toolbar">
        <input
          type="search"
          placeholder="Search products…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading && <div className="empty-state">Loading products…</div>}
      {error && <div className="empty-state">Failed to load: {error}</div>}

      {!loading && !error && (
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th style={{ textAlign: 'right' }}>Stock on Hand</th>
              <th style={{ textAlign: 'right' }}>Stock in Use</th>
              <th style={{ textAlign: 'right' }}>Reorder Point</th>
              <th>Status</th>
              <th>Last Movement</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.productId} onClick={() => onOpenProduct(p)}>
                <td><strong>{p.name}</strong></td>
                <td style={{ textAlign: 'right' }}>{formatNumber(p.stockOnHand)}</td>
                <td style={{ textAlign: 'right' }}>{formatNumber(p.stockInUse)}</td>
                <td style={{ textAlign: 'right' }}>
                  {p.reorderPoint != null ? formatNumber(p.reorderPoint) : <span style={{ color: 'var(--text-soft)' }}>default</span>}
                </td>
                <td><StatusPill statusKey={p.statusKey} /></td>
                <td>{formatDate(p.lastMovementAt)}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="empty-state">No products match "{search}"</td></tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
