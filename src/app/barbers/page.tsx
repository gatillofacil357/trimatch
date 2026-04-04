"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase, Barber } from '@/utils/supabase';
import styles from './page.module.css';

export default function BarbersDirectory() {
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  
  useEffect(() => {
    const style = sessionStorage.getItem('trimatch_selected_style');
    if (style) setSelectedStyle(style);

    const fetchData = async () => {
      try {
        // 1. Fetch Barbers
        const { data: barbersData, error: bError } = await supabase
          .from('barbers')
          .select('*');

        if (bError) throw bError;

        // 2. Fetch Votes Count
        const { data: votesData, error: vError } = await supabase
          .from('votes')
          .select('barber_id');
        
        if (vError) throw vError;

        // 3. Fetch Reviews
        const { data: reviewsData, error: rError } = await supabase
          .from('reviews')
          .select('barber_id, rating');

        if (rError) throw rError;

        // Process Rankings
        const processed = (barbersData || []).map(barber => {
          const bVotes = votesData?.filter(v => v.barber_id === barber.id).length || 0;
          const bReviews = reviewsData?.filter(r => r.barber_id === barber.id) || [];
          const avgRating = bReviews.length > 0 
            ? bReviews.reduce((acc, r) => acc + r.rating, 0) / bReviews.length 
            : 0;
          
          // Bayesian Weighted Rating
          // WeightedRating = (v * R + m * C) / (v + m)
          const v = bReviews.length;
          const m = 2; // Min reviews for ranking
          const C = 4.0; // Global average baseline
          const R = avgRating || C;
          
          const score = (v * R + m * C) / (v + m);
          const finalScore = score + (bVotes * 0.1); // Popularity bonus

          return {
            ...barber,
            rating: Number(avgRating.toFixed(1)),
            votes: bVotes,
            review_count: v,
            score: finalScore
          } as Barber;
        });

        // Sort by Score
        setBarbers(processed.sort((a, b) => (b.score || 0) - (a.score || 0)));
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
     return <div className={styles.container}><div className={styles.loading}>Analizando Ranking...</div></div>;
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <Link href="/" className={styles.backButton}>← Inicio</Link>
        <div className={styles.logo}>Trimatch</div>
        <Link href="/register-barber" className={styles.registerLink}>Sos Barbero? 💈</Link>
      </header>
      
      <main className={styles.main}>
        <div className={styles.hero}>
          <h1 className={styles.title}>Ranking de Barberías</h1>
          <p className={styles.subtitle}>Basado en la calificación real de clientes y la popularidad de la comunidad.</p>
          
          {selectedStyle && (
            <div className={styles.selectionBadge}>
               📍 Recomendado para: <strong>{selectedStyle}</strong>
            </div>
          )}
        </div>

        <div className={styles.grid}>
          {barbers.map((shop, index) => {
            const matchesStyle = selectedStyle && shop.specialties?.some(s => 
                selectedStyle.toLowerCase().includes(s.toLowerCase())
            );

            const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : null;

            return (
                <Link key={shop.id} href={`/b/${shop.slug}`} className={`${styles.card} ${matchesStyle ? styles.matchedCard : ''}`}>
                   <div className={styles.imageWrapper}>
                      <img src={shop.image_url} alt={shop.name} className={styles.image}/>
                      {medal && <span className={styles.medalBadge}>{medal}</span>}
                      {index === 0 && <span className={styles.topVotedBadge}>Top Recomendada</span>}
                      {matchesStyle && <span className={styles.matchBadge}>✨ Especialista en {selectedStyle}</span>}
                   </div>
                   <div className={styles.info}>
                      <div className={styles.infoHead}>
                         <h3 className={styles.name}>{shop.name}</h3>
                         <span className={styles.price}>{shop.average_price}</span>
                      </div>
                      <p className={styles.location}>📍 {shop.location}</p>
                      <div className={styles.badgeRow}>
                        <span className={styles.rating}>⭐ {shop.rating || "N/A"}</span>
                        <span className={styles.reviews}>{shop.review_count} reseñas</span>
                        <span className={styles.votesCount}>🔥 {shop.votes} votos</span>
                      </div>
                      <div className={styles.stylesList}>
                        {shop.specialties?.map(s => <span key={s} className={styles.styleTag}>{s}</span>)}
                      </div>
                   </div>
                </Link>
            );
          })}
        </div>

        {barbers.length === 0 && (
          <div className={styles.emptyState}>
             <p>Aún no hay barberos en el ranking. ¡Sé el primero en unirte!</p>
             <Link href="/register-barber" className={styles.submitBtn}>Crear Perfil de Barbero</Link>
          </div>
        )}
      </main>
    </div>
  );
}
