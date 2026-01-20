
import { createClient } from '@supabase/supabase-js';

// URL ve Key'in çevre değişkenlerinden (env) geldiğinden emin olun.
// Bu değişkenler vite/nextjs/cra ortamına göre VITE_SUPABASE_URL vb. olabilir.
const SUPABASE_URL = process.env.SUPABASE_URL || 'sb_publishable__ZUXekM5cAMTK69I30K6yw_PCwPgqi3'; 
const SUPABASE_ANON_KEY = process.env.API_KEY || 'sb_secret_qKDjbBrv62OzbffCz-kiKw__4IXZJCL';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn("Supabase credentials (URL or API_KEY) are missing in environment variables.");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
