import React from 'react';
import { IconCheck } from './Icons.jsx';

export default function Steps({ steps, current }) {
  return (
    <div className="steps">
      {steps.map((label, i) => {
        const cls = i < current ? 'step complete' : i === current ? 'step active' : 'step';
        return (
          <React.Fragment key={i}>
            <div className={cls}>
              <div className="step-circle">
                {i < current ? <IconCheck width={14} height={14} /> : i + 1}
              </div>
              <div className="step-label">{label}</div>
            </div>
            {i < steps.length - 1 && <div className={`step-line ${i < current ? 'done' : ''}`} />}
          </React.Fragment>
        );
      })}
    </div>
  );
}
