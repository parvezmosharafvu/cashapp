// assets/js/dashboard.js

import { supabase } from './config.js';

// ===========================
// SESSION CHECK
// ===========================

const {
    data: { session },
    error: sessionError
} = await supabase.auth.getSession();

if (sessionError) {
    console.error('Session Error:', sessionError);
}

if (!session) {
    window.location.href = 'login.html';
    throw new Error('No active session');
}

// ===========================
// USER INFO
// ===========================

const emailEl = document.getElementById('userEmail');
const roleEl = document.getElementById('userRole');
const modelsList = document.getElementById('models-list');

if (emailEl) {
    emailEl.textContent =
        session?.user?.email || '-';
}

try {

    const {
        data: profile,
        error: profileError
    } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

    if (profileError) {
        console.error('Profile Error:', profileError);
    }

    if (roleEl) {
        roleEl.textContent =
            profile?.role || 'member';
    }

} catch (err) {

    console.error(
        'Profile Load Failed:',
        err
    );

    if (roleEl) {
        roleEl.textContent = 'member';
    }

}

// ===========================
// LOAD MODELS
// ===========================

async function loadModels() {

    if (!modelsList) return;

    modelsList.innerHTML = `
        <p style="color: var(--text-muted);">
            Loading your models...
        </p>
    `;

    try {

        const {
            data: models,
            error
        } = await supabase
            .from('models')
            .select('*')
            .eq(
                'owner_id',
                session.user.id
            )
            .order(
                'created_at',
                {
                    ascending: false
                }
            );

        if (error) {
            throw error;
        }

        // Empty State
        if (!models || models.length === 0) {

            modelsList.innerHTML = `
                <div style="
                    text-align:center;
                    padding:40px 0;
                    background:rgba(255,255,255,.02);
                    border-radius:16px;
                    border:1px dashed var(--border);
                ">
                    <p style="
                        color:var(--text-muted);
                        margin-bottom:16px;
                    ">
                        You haven't created any models yet.
                    </p>

                    <a href="create-model.html"
                       class="btn btn-outline"
                       style="
                        width:auto;
                        padding:10px 24px;
                       ">
                        Create Your First Model
                    </a>
                </div>
            `;

            return;
        }

        const domain =
            window.location.origin;

        modelsList.innerHTML = models.map(m => {

            const modelLink =
                `${domain}/model.html?slug=${m.slug}`;

            return `
                <div style="
                    background:rgba(255,255,255,.05);
                    border:1px solid var(--border);
                    border-radius:16px;
                    padding:20px;
                    margin-bottom:16px;
                    display:flex;
                    justify-content:space-between;
                    align-items:center;
                ">

                    <div style="
                        display:flex;
                        align-items:center;
                        gap:16px;
                    ">

                        <div style="
                            width:50px;
                            height:50px;
                            background:${m.theme_color || '#00D632'};
                            color:#000;
                            border-radius:50%;
                            display:flex;
                            align-items:center;
                            justify-content:center;
                            font-weight:800;
                            font-size:20px;
                        ">
                            ${m.avatar_text || '?'}
                        </div>

                        <div>

                            <h3 style="
                                margin-bottom:4px;
                                font-size:18px;
                            ">
                                ${m.model_name}
                            </h3>

                            ${modelLink}
                                ${modelLink}
                            </a>

                        </div>

                    </div>

                    <div style="text-align:right;">

                        <div style="
                            font-size:24px;
                            font-weight:700;
                            color:${m.theme_color || '#00D632'};
                        ">
                            $${Number(
                                m.total_balance || 0
                            ).toFixed(2)}
                        </div>

                        <div style="
                            font-size:12px;
                            color:var(--text-muted);
                        ">
                            Available Balance
                        </div>

                    </div>

                </div>
            `;

        }).join('');

    } catch (err) {

        console.error(
            'Model Load Failed:',
            err
        );

        modelsList.innerHTML = `
            <div class="msg error">
                Failed to load models.
                Please refresh the page.
            </div>
        `;

    }

}

await loadModels();

// ===========================
// LOGOUT
// ===========================

const logoutBtn =
    document.getElementById('logout-btn');

if (logoutBtn) {

    logoutBtn.addEventListener(
        'click',
        async () => {

            try {

                const { error } =
                    await supabase
                        .auth
                        .signOut();

                if (error) {
                    throw error;
                }

                window.location.href =
                    'login.html';

            } catch (err) {

                console.error(
                    'Logout Failed:',
                    err
                );

                alert(
                    'Unable to logout. Please try again.'
                );

            }

        }
    );

}
