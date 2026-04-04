"use client";

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './page.module.css';

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target?.result as string);
      };
      reader.readAsDataURL(selected);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const selected = e.dataTransfer.files[0];
      setFile(selected);
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target?.result as string);
      };
      reader.readAsDataURL(selected);
    }
  };

  const handleContinue = () => {
    if (file && preview) {
      sessionStorage.setItem('trimatch_image', preview);
      router.push('/analyze');
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <Link href="/" className={styles.backButton}>← Volver</Link>
        <div className={styles.logo}>Trimatch</div>
        <div style={{ width: '60px' }}></div> {/* Spacer */}
      </header>

      <main className={styles.main}>
        <h1 className={styles.title}>Subí tu foto</h1>
        <p className={styles.subtitle}>Asegurate de que tu rostro se vea claramente y de frente.</p>

        <div 
          className={`${styles.uploadArea} ${preview ? styles.hasPreview : ''}`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {preview ? (
            <img src={preview} alt="Preview" className={styles.previewImage} />
          ) : (
            <div className={styles.uploadPrompt}>
              <div className={styles.uploadIcon}>📷</div>
              <p>Hacé clic para elegir una foto o arrastrala aquí</p>
            </div>
          )}
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept="image/*" 
            capture="user"
            className={styles.hiddenInput}
          />
        </div>

        {preview && (
          <button onClick={handleContinue} className={styles.continueButton}>
            Analizar Rostro
          </button>
        )}
      </main>
    </div>
  );
}
