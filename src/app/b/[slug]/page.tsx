"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase, Barber, Review } from '@/utils/supabase';
import styles from './page.module.css';

export default function BarberProfile() {
  const { slug } = useParams();
  const router = useRouter();
  const [barber, setBarber] = useState<Barber | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [voted, setVoted] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [userSessionId, setUserSessionId] = useState<string>('');

  // Form states
  const [newRating, setNewRating] = useState(5);
  const [newComment, setNewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    // Get or Create Session ID
    let sid = localStorage.getItem('trimatch_sid');
    if (!sid) {
      sid = Math.random().toString(36).substring(2, 15);
      localStorage.setItem('trimatch_sid', sid);
    }
    setUserSessionId(sid);

    const fetchData = async () => {
      if (!slug) return;

      try {
        // 1. Fetch Barber
        const { data: barberData, error: bError } = await supabase
          .from('barbers')
          .select('*')
          .eq('slug', slug)
          .single();

        if (bError) throw bError;
        setBarber(barberData);

        // 2. Fetch Reviews
        const { data: reviewsData, error: rError } = await supabase
          .from('reviews')
          .select('*')
          .eq('barber_id', barberData.id)
          .order('created_at', { ascending: false });

        if (rError) throw rError;
        setReviews(reviewsData || []);

        // 3. Fetch Votes
        const { data: voteData } = await supabase
          .from('votes')
          .select('id')
          .eq('barber_id', barberData.id)
          .eq('user_session_id', sid);

        if (voteData && voteData.length > 0) {
          setVoted(true);
        }

        // 4. Calculate Stats for this barber
        const { count: totalVotes } = await supabase
          .from('votes')
          .select('*', { count: 'exact', head: true })
          .eq('barber_id', barberData.id);

        setBarber(prev => prev ? { 
          ...prev, 
          votes: totalVotes || 0,
          review_count: reviewsData?.length || 0,
          rating: reviewsData?.length ? reviewsData.reduce((acc, r) => acc + r.rating, 0) / reviewsData.length : 0
        } : null);

      } catch (err) {
        console.error("Error fetching barber:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [slug]);

  const handleVote = async () => {
    if (voted || !barber) return;
    
    const { error } = await supabase
      .from('votes')
      .insert({
        barber_id: barber.id,
        user_session_id: userSessionId
      });

    if (!error) {
      setVoted(true);
      setBarber(prev => prev ? { ...prev, votes: (prev.votes || 0) + 1 } : null);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barber) return;
    setSubmittingReview(true);

    const { data: review, error } = await supabase
      .from('reviews')
      .insert({
        barber_id: barber.id,
        user_session_id: userSessionId,
        rating: newRating,
        comment: newComment
      })
      .select()
      .single();

    if (!error && review) {
      setReviews([review as Review, ...reviews]);
      setShowReviewForm(false);
      setNewComment('');
      // Update barber rating live
      const newCount = reviews.length + 1;
      const newAvg = (reviews.reduce((acc, r) => acc + r.rating, 0) + newRating) / newCount;
      setBarber(prev => prev ? { ...prev, review_count: newCount, rating: newAvg } : null);
    }
    setSubmittingReview(false);
  };

  if (loading) return <div className={styles.loading}>Cargando Perfil...</div>;
  if (!barber) return <div className={styles.loading}>Barbería no encontrada.</div>;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <Link href="/barbers" className={styles.backButton}>← Volver al Ranking</Link>
        <div style={{ fontWeight: 800 }}>Trimatch</div>
        <div style={{ width: '80px' }}></div>
      </header>

      <main className={styles.main}>
        <section className={styles.profileHero}>
          <div className={styles.imageWrapper}>
             <img src={barber.image_url} alt={barber.name} className={styles.image} />
          </div>
          <div className={styles.profileInfo}>
            <h1 className={styles.name}>{barber.name}</h1>
            <p className={styles.location}>📍 {barber.location}</p>
            
            <div className={styles.statsRow}>
               <div className={styles.statItem}>
                  <span className={styles.statValue}>⭐ {barber.rating ? barber.rating.toFixed(1) : 'N/A'}</span>
                  <span className={styles.statLabel}>Rating</span>
               </div>
               <div className={styles.statItem}>
                  <span className={styles.statValue}>🔥 {barber.votes || 0}</span>
                  <span className={styles.statLabel}>Votos</span>
               </div>
               <div className={styles.statItem}>
                  <span className={styles.statValue}>{barber.average_price}</span>
                  <span className={styles.statLabel}>Precio</span>
               </div>
            </div>

            <p className={styles.description}>{barber.description || "Sin descripción disponible."}</p>
            
            <div className={styles.specialties}>
               {barber.specialties?.map(s => <span key={s} className={styles.specialtyTag}>{s}</span>)}
            </div>
          </div>
        </section>

        <section className={styles.actionsSection}>
           <button 
             onClick={handleVote} 
             className={`${styles.voteBtn} ${voted ? styles.voted : ''}`}
             disabled={voted}
           >
             {voted ? '✅ Votado' : '🔥 Votar por esta Barbería'}
           </button>
           <button 
             onClick={() => setShowReviewForm(!showReviewForm)} 
             className={styles.reviewBtn}
           >
             💬 Dejar Reseña
           </button>
        </section>

        {showReviewForm && (
          <section className={styles.reviewForm}>
            <h3>Escribir una reseña</h3>
            <form onSubmit={handleSubmitReview}>
              <div className={styles.ratingSelect}>
                {[1, 2, 3, 4, 5].map(star => (
                   <span 
                    key={star} 
                    className={`${styles.star} ${newRating >= star ? styles.starActive : ''}`}
                    onClick={() => setNewRating(star)}
                   >
                     ⭐
                   </span>
                ))}
              </div>
              <textarea 
                className={styles.textarea} 
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                placeholder="¿Cómo fue tu experiencia?"
                required
              />
              <button 
                type="submit" 
                className={styles.submitReviewBtn}
                disabled={submittingReview}
              >
                {submittingReview ? 'Enviando...' : 'Publicar Reseña'}
              </button>
            </form>
          </section>
        )}

        <section className={styles.reviewsSection}>
          <h2 className={styles.sectionTitle}>Reseñas de la Comunidad ({barber.review_count})</h2>
          <div className={styles.reviewList}>
            {reviews.map(review => (
              <div key={review.id} className={styles.reviewCard}>
                <div className={styles.reviewHeader}>
                  <span className={styles.reviewRating}>{'⭐'.repeat(review.rating)}</span>
                  <span className={styles.reviewDate}>{new Date(review.created_at).toLocaleDateString()}</span>
                </div>
                <p className={styles.reviewComment}>{review.comment}</p>
              </div>
            ))}
            {reviews.length === 0 && <p style={{ color: '#666' }}>Aún no hay reseñas. ¡Sé el primero!</p>}
          </div>
        </section>
      </main>
    </div>
  );
}
