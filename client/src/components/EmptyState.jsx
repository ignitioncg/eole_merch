import React from 'react';

export default function EmptyState({ icon, title, description, actions }) {
  return (
    <div className="empty-state">
      {icon && <div className="icon-circle">{icon}</div>}
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {actions && <div className="actions">{actions}</div>}
    </div>
  );
}
