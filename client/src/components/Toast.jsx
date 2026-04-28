import React, { useEffect } from 'react';
import { IconCheck, IconAlert, IconInfo } from './Icons.jsx';

const ICONS = {
  success: IconCheck,
  error: IconAlert,
  info: IconInfo
};

export default function Toast({ message, kind = 'info', onDismiss, duration = 4000 }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDismiss, duration);
    return () => clearTimeout(t);
  }, [message, onDismiss, duration]);
  if (!message) return null;
  const Icon = ICONS[kind] || IconInfo;
  return (
    <div className={`toast ${kind}`}>
      <Icon width={18} height={18} />
      <span>{message}</span>
    </div>
  );
}
