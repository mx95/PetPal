import React from 'react';

/**
 * Rounded feature icon chip for account menu entries.
 * @param {{ children: React.ReactNode, tone?: 'lost' | 'shelter' | 'default' }} props
 */
export default function MenuFeatureIcon({ children, tone = 'default' }) {
  return <span className={`pp-menuFeatureIcon pp-menuFeatureIcon--${tone}`}>{children}</span>;
}
