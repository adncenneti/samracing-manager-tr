
import { createClient } from '@supabase/supabase-js';

// Güvenli ortam değişkeni alma fonksiyonu
const getEnvValue = (key: string): string => {
  // @ts-ignore
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    // @ts-ignore
    return process.env[key];
  }
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
    // @ts-ignore
    return import.meta.env[key];
  }
  return '';
};

const supabaseUrl = getEnvValue('SUPABASE_URL') || getEnvValue('VITE_SUPABASE_URL') || '';
const supabaseAnonKey = getEnvValue('API_KEY') || getEnvValue('VITE_SUPABASE_ANON_KEY') || '';

// URL geçerlilik kontrolü
const isValidUrl = (url: string) => {
  try {
    return url.startsWith('http');
  } catch {
    return false;
  }
};

if (!isValidUrl(supabaseUrl)) {
  console.error("Supabase URL ayarlanmamış veya geçersiz! Lütfen ayarları kontrol edin.");
}

// Boş değerler durumunda çökmemesi için placeholder kullanıyoruz
export const supabase = createClient(
  isValidUrl(supabaseUrl) ? supabaseUrl : 'sb_publishable__ZUXekM5cAMTK69I30K6yw_PCwPgqi3',
  supabaseAnonKey || 'sb_secret_qKDjbBrv62OzbffCz-kiKw__4IXZJCL'
);
