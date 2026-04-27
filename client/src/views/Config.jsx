import React, { useEffect, useState } from 'react';
import { Config, Install } from '../lib/api.js';

export default function ConfigView() {
  const [cfg, setCfg] = useState(null);
  const [groups, setGroups] = useState({});
  const [defaults, setDefaults] = useState({});
  const [saving, setSaving] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    Config.get().then((r) => {
      setCfg(r.config);
      setGroups(r.groups);
      setDefaults(r.defaults);
    });
  }, []);

  function set(key, value) {
    setCfg((c) => ({ ...c, [key]: value }));
  }

  async function save() {
    setSaving(true);
    try {
      const r = await Config.put(cfg);
      setCfg(r.config);
      setMessage({ kind: 'success', text: 'Config saved' });
    } catch (e) {
      setMessage({ kind: 'error', text: e.message });
    } finally {
      setSaving(false);
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
    }
  }

  if (!cfg) return <div className="empty-state">Loading config…</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Settings</h1>
          <div className="sub">Board IDs, column IDs, and behaviour. Defaults match the EOLE workspace.</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn ghost" disabled={installing} onClick={runInstall}>
            {installing ? <><span className="spinner" /> Running initial sync…</> : 'Run initial sync'}
          </button>
          <button className="btn" disabled={saving} onClick={save}>
            {saving ? <><span className="spinner" /> Saving…</> : 'Save changes'}
          </button>
        </div>
      </div>

      {message && (
        <div className="card" style={{ padding: 12, marginBottom: 16, background: message.kind === 'error' ? 'var(--red-soft)' : 'var(--green-soft)' }}>
          {message.text}
        </div>
      )}

      <div className="card" style={{ padding: 24 }}>
        <div className="config-grid">
          {Object.entries(groups).map(([groupName, keys]) => (
            <React.Fragment key={groupName}>
              <h3>{groupName}</h3>
              {keys.map((key) => (
                <div key={key} className="field">
                  <label>{key}</label>
                  <input
                    type={typeof defaults[key] === 'number' ? 'number' : 'text'}
                    value={cfg[key] ?? ''}
                    placeholder={String(defaults[key] ?? '')}
                    onChange={(e) => {
                      const v = typeof defaults[key] === 'number' ? Number(e.target.value) : e.target.value;
                      set(key, v);
                    }}
                  />
                </div>
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
