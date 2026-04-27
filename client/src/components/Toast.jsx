import React, { useEffect } from 'react';

export default function Toast({ message, kind = '', onDismiss, duration = 3500 }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDismiss, duration);
    return () => clearTimeout(t);
  }, [message, onDismiss, duration]);
  if (!message) return null;
  return <div className={`toast ${kind}`}>{message}</div>;
}
