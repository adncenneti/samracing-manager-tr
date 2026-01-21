
import { createClient } from '@supabase/supabase-js';

const getEnv = (key: string) => {
  try {
    // @ts-ignore
    if (typeof process !== 'undefined' && process?.env && process.env[key]) {
      // @ts-ignore
      return process.env[key];
    }
  } catch (e) {}
  
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta?.env && import.meta.env[key]) {
      // @ts-ignore
      return import.meta.env[key];
    }
  } catch (e) {}
  
  return '';
};

const rawUrl = getEnv('SUPABASE_URL') || getEnv('VITE_SUPABASE_URL');
const rawKey = getEnv('API_KEY') || getEnv('VITE_SUPABASE_ANON_KEY');

if (!rawUrl || rawUrl.includes('placeholder')) {
  console.error("CRITICAL: SUPABASE_URL eksik veya geçersiz!");
}
if (!rawKey || rawKey === 'placeholder') {
  console.error("CRITICAL: SUPABASE_ANON_KEY eksik veya geçersiz!");
}

const isValidUrl = (urlString: string) => {
  try { 
    return Boolean(new URL(urlString)); 
  } catch(e){ 
    return false; 
  }
};

const SUPABASE_URL = isValidUrl(rawUrl) ? rawUrl : 'sb_publishable__ZUXekM5cAMTK69I30K6yw_PCwPgqi3';
const SUPABASE_ANON_KEY = rawKey || 'sb_secret_qKDjbBrv62OzbffCz-kiKw__4IXZJCL';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
