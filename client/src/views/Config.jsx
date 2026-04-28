import React, { useEffect, useMemo, useState } from 'react';
import { Config, Install } from '../lib/api.js';
import Banner from '../components/Banner.jsx';
import { IconCheck, IconRefresh, IconAlert } from '../components/Icons.jsx';

const HELP = {
  ORDERS_BOARD_ID:                 'monday board where new orders are written.',
  INVENTORY_BOARD_ID:              'monday board that holds the merchandise items (the source of stock).',
  CONTACTS_BOARD_ID:               'monday board used by the recipient picker on the New Order screen.',
  MOVEMENTS_BOARD_ID:              'monday board that records every stock change (the audit log).',
  INVENTORY_NAME_COLUMN_ID:        'Column on Inventory holding the product name. Usually "name".',
  INVENTORY_STOCK_ON_HAND_COLUMN_ID: 'Numeric column showing current stock on hand.',
  INVENTORY_STOCK_IN_USE_COLUMN_ID:  'Numeric column tracking lifetime cumulative outbound.',
  INVENTORY_STATUS_COLUMN_ID:      'Status column with the In Stock / Low Stock / etc. labels.',
  INVENTORY_REORDER_POINT_COLUMN_ID: 'Optional per-product low-stock threshold. Created automatically on first install.',
  INVENTORY_LAST_MOVEMENT_COLUMN_ID: 'Date column showing when stock last changed. Created automatically on first install.',
  ORDERS_DATE_SENT_COLUMN_ID:      'Date column on the Orders board (legacy auto-deduction trigger).',
  ORDERS_RECIPIENT_COLUMN_ID:      'Text column for the recipient name.',
  ORDERS_SHIPPING_ADDRESS_COLUMN_ID: 'Text column for the shipping address.',
  ORDERS_SENT_VIA_COLUMN_ID:       'Text column for courier / delivery method.',
  ORDERS_CONTACT_COLUMN_ID:        'Board-relation column linking the order to a Contact.',
  ORDERS_NOTES_COLUMN_ID:          'Long-text column for notes.',
  ORDERS_EVENT_COLUMN_ID:          'Text column for the event name (optional).',
  DEFAULT_LOW_STOCK_THRESHOLD:     'Used only when a product has no per-product Reorder Point.',
  SYNC_LOOP_GUARD_SECONDS:         "Reverse-sync ignores changes within this window of one of the app's own writes — prevents the inventory board edit → recalc → board edit loop.",
  COLUMN_CACHE_TTL_SECONDS:        'How long the Product → Orders-board column resolution is cached.',
  RETRY_MAX_ATTEMPTS:              'Failed inventory writes are retried this many times via the monday code Queue.',
  RETRY_INITIAL_DELAY_MS:          'Initial delay before the first retry (doubles each attempt).'
};

export default function ConfigView() {
  const [cfg, setCfg] = useState(null);
  const [groups, setGroups] = useState({});
  const [defaults, setDefaults] = useState({});
  const [original, setOriginal] = useState({});
  const [activeTab, setActiveTab] = useState(null);
  const [saving, setSaving] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    Config.get().then((r) => {
      setCfg(r.config);
      setOriginal(r.config);
      setGroups(r.groups);
      setDefaults(r.defaults);
      setActiveTab(Object.keys(r.groups)[0] || null);
    });
  }, []);

  const dirty = useMemo(() => {
    if (!cfg) return false;
    return Object.keys(cfg).some((k) => String(cfg[k] ?? '') !== String(original[k] ?? ''));
  }, [cfg, original]);

  function set(key, value) {
    setCfg((c) => ({ ...c, [key]: value }));
  }

  async function save() {
    setSaving(true);
    try {
      const r = await Config.put(cfg);
      setCfg(r.config);
      setOriginal(r.config);
      setMessage({ kind: 'success', text: 'Settings saved.' });
    } catch (e) {
      setMessage({ kind: 'error', text: e.message });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 4000);
    }
  }

  async function runInstall() {
    setInstalling(true);
    try {
      const r = await Install.run(false);
      setMessage({ kind: 'success', text: `Initial sync: ${r.productsScanned} scanned, ${r.productsNewlySynced} newly synced.` });
    } catch (e) {
      setMessage({ kind: 'error', text: e.message });
    } finally {
      setInstalling(false);
      setTimeout(() => setMessage(null), 6000);
    }
  }

  if (!cfg) return <div style={{ padding: 56, textAlign: 'center', color: 'var(--text-soft)' }}><span className="spinner" /> Loading config…</div>;

  const tabs = Object.keys(groups);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Settings</h1>
          <div className="sub">Board IDs, column IDs, and behaviour. Defaults match the EOLE workspace.</div>
        </div>
        <div className="page-actions">
          <button className="btn ghost" disabled={installing} onClick={runInstall}>
            {installing ? <><span className="spinner" /> Running…</> : <><IconRefresh width={14} height={14} /> Run initial sync</>}
          </button>
          <button className="btn" disabled={saving || !dirty} onClick={save}>
            {saving ? <><span className="spinner" /> Saving…</> : <><IconCheck width={14} height={14} /> Save changes</>}
          </button>
        </div>
      </div>

      {message && <Banner kind={message.kind}>{message.text}</Banner>}

      <Banner kind="info">
        These map the app to your monday boards. <strong>Don't change anything here unless you've added/renamed a board or column in monday.</strong> Use "Run initial sync" once after a fresh install (or after adding new inventory items).
      </Banner>

      <div className="tabs">
        {tabs.map((tab) => (
          <button key={tab} className={activeTab === tab ? 'active' : ''} onClick={() => setActiveTab(tab)}>
            {tab}
          </button>
        ))}
      </div>

      <div className="card card-pad-lg">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px 28px' }}>
          {(groups[activeTab] || []).map((key) => {
            const isDefault = String(cfg[key] ?? '') === String(defaults[key] ?? '');
            return (
              <div key={key} className="field">
                <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{key}</span>
                  {!isDefault && <span style={{ color: 'var(--orange)', fontWeight: 600 }}>customised</span>}
                </label>
                <input
                  type={typeof defaults[key] === 'number' ? 'number' : 'text'}
                  value={cfg[key] ?? ''}
                  placeholder={String(defaults[key] ?? '')}
                  onChange={(e) => {
                    const v = typeof defaults[key] === 'number' ? Number(e.target.value) : e.target.value;
                    set(key, v);
                  }}
                />
                {HELP[key] && <div className="help">{HELP[key]}</div>}
              </div>
            );
          })}
        </div>
      </div>

      {dirty && (
        <Banner kind="warn" title="Unsaved changes">
          You have unsaved changes. Click <strong>Save changes</strong> at the top right to apply them.
        </Banner>
      )}
    </div>
  );
}
