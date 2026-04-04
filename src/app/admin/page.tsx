"use client";
import { useState } from 'react';
import Link from 'next/link';
import { mockBarbershops } from '@/utils/supabase';
import styles from './page.module.css';

export default function AdminRootPanel() {
  const [shops, setShops] = useState(
    mockBarbershops.map(s => ({ ...s, active: true, plan: s.id === 'studio-one' ? 'PRO' : 'FREE' }))
  );

  const toggleActive = (id: string) => {
    setShops(shops.map(s => s.id === id ? { ...s, active: !s.active } : s));
  };

  const togglePlan = (id: string) => {
    setShops(shops.map(s => s.id === id ? { ...s, plan: s.plan === 'PRO' ? 'FREE' : 'PRO' } : s));
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.logo}>Trimatch <span className={styles.adminBadge}>Admin</span></div>
        <Link href="/" className={styles.backLink}>Volver a la App</Link>
      </header>
      
      <main className={styles.main}>
        <div className={styles.topRow}>
          <h1 className={styles.title}>Panel de Control Root</h1>
          <div className={styles.globalStats}>
            <span>Total Barberías: {shops.length}</span>
            <span>Planes PRO: {shops.filter(s=>s.plan === 'PRO').length}</span>
          </div>
        </div>

        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Barbería</th>
                <th>Estado</th>
                <th>Plan</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {shops.map(shop => (
                <tr key={shop.id} className={shop.active ? '' : styles.inactiveRow}>
                  <td>
                    <strong>{shop.name}</strong>
                    <div className={styles.tableSubtext}>{shop.location}</div>
                  </td>
                  <td>
                    <span className={`${styles.statusBadge} ${shop.active ? styles.statusActive : styles.statusInactive}`}>
                      {shop.active ? 'Activo' : 'Suspendido'}
                    </span>
                  </td>
                  <td>
                    <span className={`${styles.planBadge} ${shop.plan === 'PRO' ? styles.planPro : styles.planFree}`}>
                      {shop.plan}
                    </span>
                  </td>
                  <td>
                    <div className={styles.actionBtns}>
                      <button onClick={() => toggleActive(shop.id)} className={styles.actionBtn}>
                        {shop.active ? 'Suspender' : 'Activar'}
                      </button>
                      <button onClick={() => togglePlan(shop.id)} className={styles.actionBtn}>
                        Hacer {shop.plan === 'PRO' ? 'Free' : 'Pro'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
