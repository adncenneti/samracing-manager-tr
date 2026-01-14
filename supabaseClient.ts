
import { createClient } from '@supabase/supabase-js';

// Bu değerleri Supabase Dashboard -> Project Settings -> API kısmından almalısınız.
const SUPABASE_URL = 'https://givgvetxaxyrpramvbzp.supabase.co'; 
const SUPABASE_ANON_KEY = 'sb_publishable__ZUXekM5cAMTK69I30K6yw_PCwPgqi3';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
