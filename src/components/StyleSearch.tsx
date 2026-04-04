"use client";

import React, { useState } from 'react';
import styles from './StyleSearch.module.css';

const MOCK_INTERNET_STYLES = [
  { id: 'ext1', name: 'Textured Crop', url: 'https://images.unsplash.com/photo-1622286330911-31ba11671759?w=400&q=80' },
  { id: 'ext2', name: 'Modern Pompadour', url: 'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=400&q=80' },
  { id: 'ext3', name: 'Buzz Cut with Line', url: 'https://images.unsplash.com/photo-1593702295094-ada74da4a39d?w=400&q=80' },
  { id: 'ext4', name: 'Long Flow', url: 'https://images.unsplash.com/photo-1583195764036-6dc248ac07d9?w=400&q=80' },
  { id: 'ext5', name: 'Skin Fade', url: 'https://images.unsplash.com/photo-1517832606299-7ae9b720a186?w=400&q=80' },
  { id: 'ext6', name: 'Curly Top', url: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=400&q=80' }
];

interface StyleSearchProps {
  onSelect: (style: { name: string, url: string }) => void;
  onClose: () => void;
}

export default function StyleSearch({ onSelect, onClose }: StyleSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(MOCK_INTERNET_STYLES);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) {
        setResults(MOCK_INTERNET_STYLES);
        return;
    }
    // Simple filter simulation
    const filtered = MOCK_INTERNET_STYLES.filter(s => 
        s.name.toLowerCase().includes(query.toLowerCase())
    );
    setResults(filtered);
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
            <h3>Buscar Inspiración</h3>
            <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>
        
        <form className={styles.searchForm} onSubmit={handleSearch}>
            <input 
                type="text" 
                placeholder="Ej: 'Fade corto', 'Mullet', 'Texturizado'..." 
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className={styles.searchInput}
            />
            <button type="submit" className={styles.searchBtn}>🔍</button>
        </form>

        <div className={styles.resultsGrid}>
            {results.length > 0 ? results.map(style => (
                <div key={style.id} className={styles.resultCard} onClick={() => onSelect(style)}>
                    <img src={style.url} alt={style.name} />
                    <div className={styles.styleName}>{style.name}</div>
                </div>
            )) : (
                <p className={styles.noResults}>No encontramos resultados exactos, prueba con palabras clave como 'Fade' o 'Corto'.</p>
            )}
        </div>
        
        <div className={styles.uploadSection}>
            <p>¿Tenes tu propia foto?</p>
            <label className={styles.uploadLabel}>
                Subir mi referencia 📤
                <input type="file" className={styles.hiddenInput} accept="image/*" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                        onSelect({ name: 'Foto de referencia', url: URL.createObjectURL(file) });
                    }
                }} />
            </label>
        </div>
      </div>
    </div>
  );
}
