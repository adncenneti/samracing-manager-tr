
import { createClient } from '@supabase/supabase-js';

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

const url = getEnvValue('SUPABASE_URL') || getEnvValue('VITE_SUPABASE_URL');
const key = getEnvValue('API_KEY') || getEnvValue('VITE_SUPABASE_ANON_KEY');

const validUrl = (u: string) => {
    try { return u && u.startsWith('http'); } catch { return false; }
};

const finalUrl = validUrl(url) ? url : 'sb_publishable__ZUXekM5cAMTK69I30K6yw_PCwPgqi3';
const finalKey = key || 'sb_secret_qKDjbBrv62OzbffCz-kiKw__4IXZJCL';

export const supabase = createClient(finalUrl, finalKey);
