import React, { useEffect, useState } from 'react';
import Catalog from './views/Catalog.jsx';
import ProductDetail from './views/ProductDetail.jsx';
import NewOrder from './views/NewOrder.jsx';
import History from './views/History.jsx';
import ConfigView from './views/Config.jsx';
import Toast from './components/Toast.jsx';
import { IconCatalog, IconPlus, IconHistory, IconSettings, IconCheck, IconAlert } from './components/Icons.jsx';
import { getCurrentUser } from './lib/api.js';

const ROUTES = [
  { key: 'catalog',   label: 'Catalog',   icon: IconCatalog },
  { key: 'new_order', label: 'New order', icon: IconPlus },
  { key: 'history',   label: 'History',   icon: IconHistory },
  { key: 'config',    label: 'Settings',  icon: IconSettings }
];

export default function App() {
  const initialRoute = window.location.hash.replace('#/', '') || 'catalog';
  const [route, setRoute] = useState(ROUTES.some((r) => r.key === initialRoute) ? initialRoute : 'catalog');
  const [actor, setActor] = useState({ id: 'local', name: 'Loading…' });
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [historyFilterProductId, setHistoryFilterProductId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    getCurrentUser().then(setActor);
  }, []);

  useEffect(() => {
    const onHash = () => {
      const r = window.location.hash.replace('#/', '') || 'catalog';
      if (ROUTES.some((x) => x.key === r)) setRoute(r);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  function navigate(next) {
    setRoute(next);
    window.location.hash = `#/${next}`;
  }

  function openProduct(p) { setSelectedProduct(p); }
  function closeProduct() { setSelectedProduct(null); }
  function viewHistoryFor(p) {
    setHistoryFilterProductId(p.linkedInventoryItemId);
    setSelectedProduct(null);
    navigate('history');
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">EO</div>
          <div className="brand-text">
            <span className="title">Stock Catalog</span>
            <span className="sub">End of Life Essentials</span>
          </div>
        </div>

        <nav className="nav" style={{ marginTop: 24 }}>
          {ROUTES.map((r) => {
            const Icon = r.icon;
            return (
              <button key={r.key} className={route === r.key ? 'active' : ''} onClick={() => navigate(r.key)}>
                <Icon className="nav-icon" />
                {r.label}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">v1.0 · monday code</div>
      </aside>

      <main className="main">
        {route === 'catalog' && (
          <Catalog
            key={refreshKey}
            onOpenProduct={openProduct}
            onNewOrder={() => navigate('new_order')}
          />
        )}
        {route === 'new_order' && (
          <NewOrder
            actor={actor}
            onCancel={() => navigate('catalog')}
            onToast={setToast}
            onSubmitted={(r, opts = {}) => {
              if (opts.dryRun) {
                setToast({
                  kind: 'info',
                  message: '🧪 Test successful — nothing was saved. Untick "Test mode" for real orders.'
                });
                return;
              }
              setToast({
                kind: 'success',
                message: r.linkedOrderItemId
                  ? `Order submitted ✓  ${r.movementsWritten || 0} stock movement(s) logged`
                  : 'Order submitted'
              });
              setRefreshKey((k) => k + 1);
              navigate('catalog');
            }}
          />
        )}
        {route === 'history' && (
          <History
            actor={actor}
            filterProductId={historyFilterProductId}
            clearProductFilter={() => setHistoryFilterProductId(null)}
            onToast={(t) => { setToast(t); setRefreshKey((k) => k + 1); }}
          />
        )}
        {route === 'config' && <ConfigView />}
      </main>

      {selectedProduct && (
        <ProductDetail
          product={selectedProduct}
          actor={actor}
          onClose={closeProduct}
          onSaved={() => {
            setToast({ kind: 'success', message: 'Adjustment saved ✓' });
            setRefreshKey((k) => k + 1);
            closeProduct();
          }}
          onViewHistory={viewHistoryFor}
        />
      )}

      <Toast {...(toast || {})} onDismiss={() => setToast(null)} />
    </div>
  );
}
