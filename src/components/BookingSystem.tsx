"use client";

import React, { useState, useEffect } from 'react';
import styles from './BookingSystem.module.css';

interface Booking {
  date: string;
  time: string;
  client: string;
}

interface BookingSystemProps {
  shopId: string;
  name: string;
  phone: string;
  schedule: { start: number; end: number; interval: number };
  initialBookings: Booking[];
}

export default function BookingSystem({ shopId, name, phone, schedule, initialBookings }: BookingSystemProps) {
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [bookings, setBookings] = useState<Booking[]>(initialBookings);
  const [showConfirm, setShowConfirm] = useState<string | null>(null);
  const [clientName, setClientName] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [referenceStyle, setReferenceStyle] = useState<{name: string, url: string} | null>(null);

  useEffect(() => {
    // Retrieve the style the user chose in the studio
    const style = sessionStorage.getItem('trimatch_selected_style');
    const ref = sessionStorage.getItem('trimatch_reference_style');
    if (style) setSelectedStyle(style);
    if (ref) setReferenceStyle(JSON.parse(ref));
  }, []);

  const upcomingDays = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d.toISOString().split('T')[0];
  });

  const generateTimeSlots = () => {
    const slots = [];
    let currentMins = schedule.start * 60;
    const endMins = schedule.end * 60;

    while (currentMins < endMins) {
      const h = Math.floor(currentMins / 60);
      const m = currentMins % 60;
      const timeString = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      slots.push(timeString);
      currentMins += schedule.interval;
    }
    return slots;
  };

  const timeSlots = generateTimeSlots();

  const handleBook = (time: string) => {
    if (!clientName.trim()) {
      alert("Por favor ingresa tu nombre para la reserva.");
      return;
    }

    // 1. WhatsApp Logic
    const dateObj = new Date(selectedDate + "T12:00:00Z");
    const formattedDate = dateObj.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
    
    let message = `Hola ${name}, me gustaría reservar un turno para el ${formattedDate} a las ${time}.\n\n`;
    message += `Mi nombre es: ${clientName}\n`;
    
    if (selectedStyle) {
        message += `Elegí este estilo en Trimatch: ${selectedStyle}\n`;
    }
    
    if (referenceStyle) {
        message += `Tengo esta referencia visual: ${referenceStyle.name} (${referenceStyle.url})\n`;
    }

    message += `\n¿Me confirman si tienen disponibilidad? Gracias!`;

    const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    
    // 2. Client-side update for immediate feedback
    const newBooking = { date: selectedDate, time, client: clientName };
    setBookings(prev => [...prev, newBooking]);
    setShowConfirm(null);
    setClientName('');

    // 3. Open WhatsApp
    window.open(waUrl, '_blank');
  };

  return (
    <div className={styles.bookingContainer}>
      <h3 className={styles.title}>Agenda Abierta: Selecciona tu Turno</h3>
      
      {selectedStyle && (
          <div className={styles.selectionInfo}>
            Reserva para: <strong>{selectedStyle}</strong> {referenceStyle && `(+ Referencia: ${referenceStyle.name})`}
          </div>
      )}

      {/* Selector de días */}
      <div className={styles.dateSelector}>
        {upcomingDays.map((dateStr) => {
          const dateObj = new Date(dateStr + "T12:00:00Z");
          const dayName = dateObj.toLocaleDateString('es-ES', { weekday: 'short' }).toUpperCase();
          const dayNum = dateObj.getDate();
          return (
            <button 
              key={dateStr}
              className={`${styles.dateBtn} ${selectedDate === dateStr ? styles.dateBtnActive : ''}`}
              onClick={() => { setSelectedDate(dateStr); setShowConfirm(null); }}
            >
              <span className={styles.dayName}>{dayName}</span>
              <span className={styles.dayNum}>{dayNum}</span>
            </button>
          );
        })}
      </div>

      {/* Lista de Turnos */}
      <div className={styles.slotsGrid}>
        {timeSlots.map(time => {
          const bookingInfo = bookings.find(b => b.date === selectedDate && b.time === time);
          const isBusy = !!bookingInfo;

          if (showConfirm === time) {
            return (
              <div key={time} className={styles.confirmBox}>
                <p>Confirmar turno para las <strong>{time}</strong></p>
                <input 
                  type="text" 
                  placeholder="Escribe tu Nombre" 
                  value={clientName} 
                  onChange={(e) => setClientName(e.target.value)}
                  className={styles.inputField}
                  autoFocus
                />
                <div className={styles.confirmActions}>
                  <button className={styles.cancelBtn} onClick={() => setShowConfirm(null)}>X Cancelar</button>
                  <button className={styles.confirmBtn} onClick={() => handleBook(time)}>✓ Reservar vía WhatsApp</button>
                </div>
              </div>
            );
          }

          if (isBusy) {
            return (
              <div key={time} className={`${styles.slot} ${styles.slotBusy}`}>
                <span className={styles.timeLabel}>{time}</span>
                <span className={styles.busyLabel}>Ocupado {bookingInfo.client && `: ${bookingInfo.client}`}</span>
              </div>
            );
          }

          return (
            <button key={time} className={`${styles.slot} ${styles.slotFree}`} onClick={() => { setShowConfirm(time); setClientName(''); }}>
              <span className={styles.timeLabel}>{time}</span>
              <span className={styles.freeLabel}>Turno Libre (+ Agendar)</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
