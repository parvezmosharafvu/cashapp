// ====== SUPABASE CONFIGURATION ======
// Ensure this script is loaded AFTER the Supabase CDN in your HTML files.

// 🟢 NEW SYSTEM (Users, Auth, Withdrawals, Models)
const NEW_SUPABASE_URL = 'https://wutuvhepaeugsmdgfpuc.supabase.co';
const NEW_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1dHV2aGVwYWV1Z3NtZGdmcHVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4MTcyMTIsImV4cCI6MjEwMjM5MzIxMn0.wEpY4wJuhUNiDNWWCN4JuXcF6WyfkOXBuX69RSRp4XM';

// 🔴 OLD SYSTEM (Only for fetching Payments)
const OLD_SUPABASE_URL = 'https://ymdhewjlbofmeuhahkbw.supabase.co';
const OLD_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltZGhld2psYm9mbWV1aGFoa2J3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2NTgyNjcsImV4cCI6MjEwMDIzNDI2N30.1wuZwSTmmYn48U23bAnah2h-wDm-2hC4Omv_jUNic98';

if (window.supabase) {
    // ক্রিয়েট ক্লায়েন্টস (দুটো আলাদা ডাটাবেস)
    window.newSupabase = window.supabase.createClient(NEW_SUPABASE_URL, NEW_SUPABASE_ANON_KEY);
    window.oldSupabase = window.supabase.createClient(OLD_SUPABASE_URL, OLD_SUPABASE_ANON_KEY);
    console.log('Dual Supabase Config Ready');
} else {
    console.error("Supabase CDN not found! Add it before config.js");
}
