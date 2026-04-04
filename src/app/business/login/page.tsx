"use client";
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './page.module.css';

export default function BusinessLogin() {
  const router = useRouter();
  
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    router.push('/business/dashboard');
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.logo}>Trimatch <span className={styles.proBadge}>Business</span></div>
        <Link href="/" className={styles.backLink}>Volver a la App</Link>
      </header>

      <main className={styles.main}>
        <div className={styles.card}>
          <h1 className={styles.title}>Acceso para Barberos</h1>
          <p className={styles.subtitle}>Gestiona tu barbería, consigue nuevos clientes y destaca tu perfil.</p>
          
          <form onSubmit={handleLogin} className={styles.form}>
            <div className={styles.inputGroup}>
              <label>Email del Local</label>
              <input type="email" required className={styles.input} defaultValue="admin@studio-one.com"/>
            </div>
            
            <div className={styles.inputGroup}>
              <label>Contraseña</label>
              <input type="password" required className={styles.input} defaultValue="123456"/>
            </div>
            
            <button type="submit" className={styles.submitBtn}>Ingresar al Panel</button>
          </form>
          
          <div className={styles.mockAlert}>
            ⚠️ Modo MVP: Haz clic en Ingresar directamente, las credenciales están mockeadas.
          </div>
        </div>
      </main>
    </div>
  );
}
