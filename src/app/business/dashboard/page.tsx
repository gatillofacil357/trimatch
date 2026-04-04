"use client";
import Link from 'next/link';
import styles from './page.module.css';

export default function BusinessDashboard() {
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.logo}>Trimatch <span className={styles.proBadge}>Business</span></div>
        <div className={styles.userMenu}>Studio One Barbershop</div>
      </header>

      <main className={styles.main}>
        <div className={styles.topRow}>
          <h1 className={styles.title}>Hola, Studio One 👋</h1>
          <a href="https://buy.stripe.com/test_12345" target="_blank" rel="noopener noreferrer" className={styles.upgradeBtn}>
            ⭐ Mejorar a Plan PRO
          </a>
        </div>

        <div className={styles.grid}>
          {/* Stats Card */}
          <div className={styles.card}>
            <h2>Rendimiento</h2>
            <div className={styles.stats}>
              <div className={styles.statBox}>
                <span className={styles.statNumber}>142</span>
                <span className={styles.statLabel}>Vistas al Perfil</span>
              </div>
              <div className={styles.statBox}>
                <span className={styles.statNumber}>28</span>
                <span className={styles.statLabel}>Clics en WhatsApp</span>
              </div>
            </div>
            <p className={styles.hint}>Actualizá a PRO para aparecer primero en las recomendaciones de tu zona.</p>
          </div>

          {/* Edit Profile */}
          <div className={styles.card}>
            <h2>Editar Perfil</h2>
            <form className={styles.form}>
              <div className={styles.inputGroup}>
                <label>Nombre del Local</label>
                <input type="text" className={styles.input} defaultValue="Studio One Barbershop" />
              </div>
              <div className={styles.inputGroup}>
                <label>Número de WhatsApp (con código de país)</label>
                <input type="tel" className={styles.input} defaultValue="5491122334455" />
              </div>
              <div className={styles.inputGroup}>
                <label>Ubicación</label>
                <input type="text" className={styles.input} defaultValue="Palermo Chico, CABA" />
              </div>
              <button type="button" className={styles.saveBtn} onClick={() => alert('Datos guardados en Supabase (Simulado)')}>Guardar Cambios</button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
