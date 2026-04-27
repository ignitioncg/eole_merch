import React from 'react';
import { STATUS_KEY_TO_LABEL, STATUS_KEY_TO_CLASS } from '../lib/format.js';

export default function StatusPill({ statusKey }) {
  const cls = STATUS_KEY_TO_CLASS[statusKey] || 'in_stock';
  const label = STATUS_KEY_TO_LABEL[statusKey] || statusKey;
  return <span className={`pill ${cls}`}>{label}</span>;
}
