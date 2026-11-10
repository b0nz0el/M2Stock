/* ═══════════════════════════════════════════════════
   M2Stock — supabase-client.js
   Inisialisasi klien Supabase via ESM CDN (vanilla JS)
   ═══════════════════════════════════════════════════ */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://kvdktgknwxmqpankwpre.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2ZGt0Z2tud3htcXBhbmt3cHJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQyOTAxMDUsImV4cCI6MjEwOTg2NjEwNX0.7ccHydwl5Qpm9ZgbFqwjRdxWgtRFfXh4lcf-FVRzfm0';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

if (typeof window !== 'undefined') {
  window.supabase = supabase;
}
