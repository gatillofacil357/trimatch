import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mock.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'mock-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Barber = {
  id: string;
  name: string;
  location: string;
  description: string;
  specialties: string[];
  average_price: string;
  image_url: string;
  slug: string;
  created_at: string;
  // Computed fields (not in DB)
  rating?: number;
  votes?: number;
  review_count?: number;
  score?: number;
};

export type Vote = {
  id: string;
  barber_id: string;
  user_session_id: string;
  created_at: string;
};

export type Review = {
  id: string;
  barber_id: string;
  user_session_id: string;
  rating: number;
  comment: string;
  created_at: string;
};

export const mockBarbershops = [
  {
    id: 'studio-one',
    slug: 'studio-one',
    name: 'Studio One Barbershop',
    location: 'Av. Artigas, Las Piedras',
    price_range: '$$',
    rating: 4.9,
    reviews: 142,
    styles: ['fade', 'undercut', 'buzz'],
    image: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800&q=80',
    phone: '5491122334455', // Example Argentinian phone with country code
    mapUrl: 'https://maps.google.com/maps?q=Av.%20Artigas,%20Las%20Piedras,%20Uruguay&t=&z=15&ie=UTF8&iwloc=&output=embed',
    schedule: { start: 10, end: 18, interval: 30 },
    bookings: [
        { date: new Date().toISOString().split('T')[0], time: '14:30', client: 'Carlos M.' },
        { date: new Date().toISOString().split('T')[0], time: '15:00', client: 'Martina F.' }
    ]
  },
  {
    id: 'urban-cut',
    slug: 'urban-cut',
    name: 'Urban Cut',
    location: 'Bulevar del Bicentenario, Las Piedras',
    price_range: '$',
    rating: 4.8,
    reviews: 98,
    styles: ['textured', 'fade', 'pompadour'],
    image: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=800&q=80',
    phone: '5491144556677',
    mapUrl: 'https://maps.google.com/maps?q=Bulevar%20del%20Bicentenario,%20Las%20Piedras,%20Uruguay&t=&z=15&ie=UTF8&iwloc=&output=embed',
    schedule: { start: 9, end: 17, interval: 45 },
    bookings: [
        { date: new Date().toISOString().split('T')[0], time: '10:30', client: 'Juan P.' }
    ]
  },
  {
    id: 'the-gentlemans-club',
    slug: 'the-gentlemans-club',
    name: 'The Gentleman\'s Club',
    location: 'Instrucciones del Año XIII, Las Piedras',
    price_range: '$$$',
    rating: 4.6,
    reviews: 56,
    styles: ['classic', 'long', 'fade'],
    image: 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=800&q=80',
    phone: '5491133445566',
    mapUrl: 'https://maps.google.com/maps?q=Instrucciones%20del%20A%C3%B1o%20XIII,%20Las%20Piedras,%20Uruguay&t=&z=15&ie=UTF8&iwloc=&output=embed',
    schedule: { start: 11, end: 20, interval: 30 },
    bookings: [
        { date: new Date().toISOString().split('T')[0], time: '14:00', client: 'Diego L.' }
    ]
  }
];
