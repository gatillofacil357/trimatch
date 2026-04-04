"use client";

import dynamic from 'next/dynamic';
import styles from './page.module.css';

const TryOnStudio = dynamic(() => import('./TryOnStudio'), {
  ssr: false,
  loading: () => (
    <div className={styles.studioContainer}>
      <div className={styles.overlayLoading} style={{ position: 'relative', height: '300px', borderRadius: '1rem' }}>
        <div className={styles.spinner}></div>
        <p>Iniciando Motor AI...</p>
      </div>
    </div>
  ),
});

export default function ResultsPage() {
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.logo}>Trimatch</div>
      </header>
      
      <main className={styles.main}>
        <TryOnStudio />
      </main>
    </div>
  );
}
