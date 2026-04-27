import React, { useEffect, useState } from 'react';
import Catalog from './views/Catalog.jsx';
import ProductDetail from './views/ProductDetail.jsx';
import NewOrder from './views/NewOrder.jsx';
import History from './views/History.jsx';
import ConfigView from './views/Config.jsx';
import Toast from './components/Toast.jsx';
import { getCurrentUser } from './lib/api.js';

const ROUTES = [
  { key: 'catalog', label: 'Catalog' },
  { key: 'new_order', label: 'New order' },
  { key: 'history', label: 'History' },
  { key: 'config', label: 'Settings' }
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
        <div className="brand">EOLE Stock Catalog</div>
        <div className="brand-sub">{actor.name}</div>
        <nav className="nav">
          {ROUTES.map((r) => (
            <button key={r.key} className={route === r.key ? 'active' : ''} onClick={() => navigate(r.key)}>
              {r.label}
            </button>
          ))}
        </nav>
      </aside>
      <main className="main">
        {route === 'catalog' && (
          <Catalog
            key={refreshKey}
            onOpenProduct={openProduct}
            onViewHistory={viewHistoryFor}
          />
        )}
        {route === 'new_order' && (
          <NewOrder
            actor={actor}
            onSubmitted={(r) => {
              setToast({ kind: 'success', message: r.linkedOrderItemId ? 'Order submitted ✓' : 'Done' });
              setRefreshKey((k) => k + 1);
              navigate('catalog');
            }}
          />
        )}
        {route === 'history' && <History filterProductId={historyFilterProductId} />}
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
