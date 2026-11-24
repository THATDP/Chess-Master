'use client';

import dynamic from 'next/dynamic';

// O Chess Master roda 100% no navegador (roteamento por hash, sem backend): carregado só no cliente.
const App = dynamic(() => import('@/cm/App'), { ssr: false });

export default function Page() {
  return <App />;
}
