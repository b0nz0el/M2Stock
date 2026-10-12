/* ═══════════════════════════════════════════════════
   aQuaStock Pro — supabase-client.js
   Inisialisasi klien Supabase via ESM CDN (vanilla JS)
   ═══════════════════════════════════════════════════ */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://yscswrxgylkryvxmwlza.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzY3N3cnhneWxrcnl2eG13bHphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE3OTUwNDksImV4cCI6MjEwNzM3MTA0OX0.1TMiwmF0JhefAwXZZZjA1-382oYEnqdGwzDXeXWeZG0';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

if (typeof window !== 'undefined') {
  window.supabase = supabase;
}
