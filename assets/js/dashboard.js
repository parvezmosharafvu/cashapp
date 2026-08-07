// assets/js/dashboard.js
import { supabase } from './config.js';

// ১. Session Check & Profile Load
const { data: { session } } = await supabase.auth.getSession();

if (!session) {
    window.location.href = 'login.html';
}

const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();

// Update UI with user info
document.getElementById('userEmail').textContent = session.user.email;
document.getElementById('userRole').textContent = profile?.role || 'member';

// ২. Load User's Models
async function loadModels() {
    const modelsList = document.getElementById('models-list');
    modelsList.innerHTML = '<p style="color: var(--text-muted);">Loading your models...</p>';

    // ডাটাবেস থেকে শুধু এই ইউজারের মডেলগুলো আনবে
    const { data: models, error } = await supabase
        .from('models')
        .select('*')
        .eq('owner_id', session.user.id)
        .order('created_at', { ascending: false });

    if (error) {
        modelsList.innerHTML = '<p class="msg error">Failed to load models.</p>';
        console.error(error);
        return;
    }

    // যদি কোনো মডেল না থাকে
    if (!models || models.length === 0) {
        modelsList.innerHTML = `
            <div style="text-align: center; padding: 40px 0; background: rgba(255,255,255,0.02); border-radius: 16px; border: 1px dashed var(--border);">
                <p style="color: var(--text-muted); margin-bottom: 16px;">You haven't created any models yet.</p>
                <a href="create-model.html" class="btn btn-outline" style="width: auto; padding: 10px 24px;">Create Your First Model</a>
            </div>
        `;
        return;
    }

    // মডেল থাকলে কার্ড আকারে রেন্ডার করবে
    modelsList.innerHTML = models.map(m => `
        <div style="background: rgba(255,255,255,0.05); border: 1px solid var(--border); border-radius: 16px; padding: 20px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 16px;">
                <div style="width: 50px; height: 50px; background: var(--primary); color: #000; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 20px;">
                    ${m.avatar_text}
                </div>
                <div>
                    <h3 style="margin-bottom: 4px; font-size: 18px;">${m.model_name}</h3>
                    <a href="/${m.slug}" target="_blank" style="font-size: 14px; opacity: 0.8;">pay-cashapp.buzz/${m.slug}</a>
                </div>
            </div>
            <div style="text-align: right;">
                <div style="font-size: 24px; font-weight: 700; color: var(--primary);">$${m.total_balance || '0.00'}</div>
                <div style="font-size: 12px; color: var(--text-muted);">Available Balance</div>
            </div>
        </div>
    `).join('');
}

loadModels();

// ৩. Logout Logic
document.getElementById('logout-btn').addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = 'login.html';
});
