import React from 'react';

export default function StatCard({ label, value, tone = '', icon, active, onClick }) {
  return (
    <button
      type="button"
      className={`stat-card ${tone} ${active ? 'active' : ''}`}
      onClick={onClick}
      style={{ textAlign: 'left', font: 'inherit' }}
    >
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {icon && <div className="accent">{icon}</div>}
    </button>
  );
}
