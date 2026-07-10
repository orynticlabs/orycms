'use client';
import { useEffect } from 'react';

/** Dev-only: connect Reticle + install the React adapter, after hydration. */
export function ReticleDev() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    void import('@reticlehq/core').then(({ reticle, install }) => {
      install();
      reticle.connect({ projectId: 'orycms-fb419edb' });
    });
  }, []);
  return null;
}
