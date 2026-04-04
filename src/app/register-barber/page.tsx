"use client";

import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/utils/supabase';
import styles from './page.module.css';

const SPECIALTIES = [
  { id: 'fade', name: 'Fade' },
  { id: 'buzz', name: 'Buzz Cut' },
  { id: 'undercut', name: 'Undercut' },
  { id: 'pompadour', name: 'Pompadour' },
  { id: 'textured', name: 'Texturizado' },
  { id: 'long', name: 'Pelo Largo' },
  { id: 'classic', name: 'Corte Clásico' },
  { id: 'beard', name: 'Barba' },
];

export default function RegisterBarber() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    description: '',
    average_price: '$$',
    image_url: '',
    specialties: [] as string[]
  });

  const toggleSpecialty = (id: string) => {
    setFormData(prev => ({
      ...prev,
      specialties: prev.specialties.includes(id)
        ? prev.specialties.filter(s => s !== id)
        : [...prev.specialties, id]
    }));
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^\w ]+/g, '')
      .replace(/ +/g, '-');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const slug = generateSlug(formData.name);

    const { error: sbError } = await supabase
      .from('barbers')
      .insert([
        {
          name: formData.name,
          location: formData.location,
          description: formData.description,
          specialties: formData.specialties,
          average_price: formData.average_price,
          image_url: formData.image_url || 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800&q=80',
          slug: slug
        }
      ]);

    if (sbError) {
      setError(sbError.message);
      setLoading(false);
    } else {
      setSuccess(true);
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className={styles.container}>
        <div className={styles.success}>
          <h2>¡Perfil Creado! 🎉</h2>
          <p>Tu barbería ya está disponible en Trimatch para que los usuarios te encuentren.</p>
          <div style={{ marginTop: '2rem' }}>
             <Link href="/barbers" className={styles.submitBtn}>Ver Ranking de Barberos</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <Link href="/" className={styles.backButton}>← Inicio</Link>
        <div className={styles.logo}>Trimatch</div>
        <div style={{ width: '40px' }}></div>
      </header>

      <main className={styles.formCard}>
        <h1 className={styles.title}>Posteá tu Perfil</h1>
        <p className={styles.subtitle}>Siguiente paso: unite a la comunidad y empezá a recibir clientes.</p>

        {error && <div className={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Nombre de la Barbería / Barbero</label>
            <input 
              required
              className={styles.input}
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
              placeholder="Ej: Urban Cut Studio"
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Ubicación</label>
            <input 
              required
              className={styles.input}
              value={formData.location}
              onChange={e => setFormData({...formData, location: e.target.value})}
              placeholder="Ej: Las Piedras, Uruguay"
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Descripción</label>
            <textarea 
              className={styles.textarea}
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
              placeholder="Contanos sobre tu estilo y experiencia..."
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Nivel de Precios</label>
            <select 
              className={styles.select}
              value={formData.average_price}
              onChange={e => setFormData({...formData, average_price: e.target.value})}
            >
              <option value="$">$ (Económico)</option>
              <option value="$$">$$ (Estándar)</option>
              <option value="$$$">$$$ (Premium)</option>
            </select>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Imagen de Perfil (URL)</label>
            <input 
              className={styles.input}
              value={formData.image_url}
              onChange={e => setFormData({...formData, image_url: e.target.value})}
              placeholder="https://..."
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Especialidades</label>
            <div className={styles.checkboxGrid}>
              {SPECIALTIES.map(s => (
                <div 
                  key={s.id} 
                  className={`${styles.checkboxItem} ${formData.specialties.includes(s.id) ? styles.checkedItem : ''}`}
                  onClick={() => toggleSpecialty(s.id)}
                >
                  <span>{formData.specialties.includes(s.id) ? '✅' : '⬜'}</span>
                  <span>{s.name}</span>
                </div>
              ))}
            </div>
          </div>

          <button type="submit" disabled={loading} className={styles.submitBtn}>
            {loading ? 'Creando Perfil...' : 'Crear mi Perfil'}
          </button>
        </form>
      </main>
    </div>
  );
}
