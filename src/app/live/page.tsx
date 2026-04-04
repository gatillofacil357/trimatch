"use client";

import Link from 'next/link';
import dynamic from 'next/dynamic';
import styles from './page.module.css';

const LiveEngine = dynamic(() => import('./LiveEngine'), { ssr: false });

export default function LivePage() {
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <Link href="/" className={styles.backButton}>← Volver</Link>
        <div className={styles.logo}>Trimatch <span className={styles.liveBadge}>LIVE AR</span></div>
        <div style={{ width: '60px' }}></div>
      </header>

      <main className={styles.main}>
        <LiveEngine />
      </main>
    </div>
  );
}
