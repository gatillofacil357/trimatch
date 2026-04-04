import Link from 'next/link';
import styles from './page.module.css';

export default function Home() {
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.logo}>Trimatch</div>
        <Link href="/register-barber" className={styles.barberLink}>Sos Barbero? 💈</Link>
      </header>
      
      <main className={styles.main}>
        <div className={styles.hero}>
          <h1 className={styles.title}>
            Descubrí el corte que realmente <span className={styles.highlight}>te queda bien</span>
          </h1>
          <p className={styles.subtitle}>
            Subí una foto y probá estilos antes de ir a la barbería.
          </p>
          
          <div className={styles.ctaGroup}>
            <Link href="/upload" className={styles.ctaButton}>
              Usar Foto
            </Link>
            <Link href="/live" className={styles.liveCtaButton}>
              Cámara AR en Vivo
            </Link>
            <Link href="/barbers" className={styles.directoryButton}>
              Reservar Barbero
            </Link>
          </div>
        </div>
        
        <div className={styles.features}>
          <div className={styles.featureCard}>
            <h3>1. Subí tu foto</h3>
            <p>Una selfie frontal clara es todo lo que necesitamos.</p>
          </div>
          <div className={styles.featureCard}>
            <h3>2. Análisis IA</h3>
            <p>Detectamos la forma de tu rostro al instante.</p>
          </div>
          <div className={styles.featureCard}>
            <h3>3. Elegí tu estilo</h3>
            <p>Recibí recomendaciones hechas a tu medida.</p>
          </div>
        </div>
      </main>
      
      <footer className={styles.footer}>
        <p>© {new Date().getFullYear()} Trimatch. Todos los derechos reservados.</p>
      </footer>
    </div>
  );
}
