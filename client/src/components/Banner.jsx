import React from 'react';
import { IconInfo, IconAlert, IconCheck, IconWarn } from './Icons.jsx';

const ICONS = {
  info: IconInfo,
  warn: IconWarn,
  error: IconAlert,
  success: IconCheck
};

export default function Banner({ kind = 'info', title, children }) {
  const Icon = ICONS[kind] || IconInfo;
  return (
    <div className={`banner ${kind}`}>
      <Icon width={18} height={18} />
      <div className="body">
        {title && <strong>{title}</strong>}
        <div>{children}</div>
      </div>
    </div>
  );
}
