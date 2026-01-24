
import { createClient } from '@supabase/supabase-js';

// Güvenli ortam değişkeni okuyucu
const getEnvValue = (key: string): string => {
  try {
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
  } catch (e) {
    console.warn('Env okuma hatası:', e);
  }
  return '';
};

const url = getEnvValue('SUPABASE_URL') || getEnvValue('VITE_SUPABASE_URL');
const key = getEnvValue('API_KEY') || getEnvValue('VITE_SUPABASE_ANON_KEY');

const isValidUrl = (urlString: string) => {
    try { 
      return urlString && urlString.startsWith('http'); 
    } catch { 
      return false; 
    }
};

// Eğer URL geçersizse placeholder kullanarak uygulamanın çökmesini engelle
const finalUrl = isValidUrl(url) ? url : 'sb_publishable__ZUXekM5cAMTK69I30K6yw_PCwPgqi3';
const finalKey = key || 'sb_secret_qKDjbBrv62OzbffCz-kiKw__4IXZJCL';

if (!isValidUrl(url)) {
  console.warn("Supabase URL'i bulunamadı veya geçersiz. Uygulama demo/offline modda çalışabilir.");
}

export const supabase = createClient(finalUrl, finalKey);
