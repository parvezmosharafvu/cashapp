document.addEventListener("DOMContentLoaded", async () => {
    if (!window.newSupabase) {
        console.error("newSupabase not found. Check config.js");
        return;
    }

    const { data: { session } } = await window.newSupabase.auth.getSession();
    if (session && !window.location.href.includes('dashboard.html')) {
        window.location.href = 'dashboard.html';
        return;
    }

    // ==========================================
    // LOGIN FLOW
    // ==========================================
    const loginForm = document.getElementById("login-form");
    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const email = document.getElementById("login-email").value.trim();
            const password = document.getElementById("login-password").value;
            const btn = document.getElementById("login-btn");
            const errBox = document.getElementById("login-error");

            btn.disabled = true; btn.textContent = "Logging in...";
            if(errBox) errBox.style.display = "none";

            const { error } = await window.newSupabase.auth.signInWithPassword({ email, password });

            if (error) {
                if(errBox) { errBox.textContent = error.message; errBox.style.display = "block"; }
                btn.disabled = false; btn.textContent = "Log in";
                return;
            }
            window.location.href = 'dashboard.html';
        });
    }

    // ==========================================
    // REGISTRATION & AUTO MODEL ASSIGN
    // ==========================================
    const regForm = document.getElementById("register-form");
    if (regForm) {
        regForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const name = document.getElementById("reg-name").value.trim();
            const email = document.getElementById("reg-email").value.trim();
            const password = document.getElementById("reg-password").value;
            const confirm = document.getElementById("reg-confirm") ? document.getElementById("reg-confirm").value : password;
            const btn = document.getElementById("reg-btn");
            const errBox = document.getElementById("reg-error");
            const successBox = document.getElementById("reg-success");

            if (password !== confirm) {
                if(errBox) { errBox.textContent = "Passwords do not match."; errBox.style.display = "block"; } return;
            }

            btn.disabled = true; btn.textContent = "Creating Account...";
            if(errBox) errBox.style.display = "none";

            const { data: authData, error: authError } = await window.newSupabase.auth.signUp({
                email, password, options: { data: { full_name: name } }
            });

            if (authError) {
                if(errBox) { errBox.textContent = authError.message; errBox.style.display = "block"; }
                btn.disabled = false; btn.textContent = "Register";
                return;
            }

            if (authData.user) {
                const userId = authData.user.id;
                await window.newSupabase.from('profiles').upsert({ id: userId, full_name: name, email, status: 'active' });

                const defaultModels = [
                    { name: 'Alisha', slug: 'alisha' }, // ✅ Alisha মডেলটি যুক্ত করা হয়েছে
                    { name: 'Crystal', slug: 'Crystal' }, { name: 'Linda', slug: 'Linda' },
                    { name: 'LoveMe', slug: 'LoveMe' }, { name: 'Night Queen', slug: 'NightQueen' },
                    { name: 'Red Rose', slug: 'RedRose' }, { name: 'Rose', slug: 'Rose' },
                    { name: 'Sophia', slug: 'Sophia' }, { name: 'Beauty Girl', slug: 'beauty-girl' },
                    { name: 'Beauty Queen', slug: 'beauty-queen' }, { name: 'Cute Queen', slug: 'cute-queen' },
                    { name: 'Emma', slug: 'emma' }, { name: 'Horny Queen', slug: 'horny-queen' }
                ];

                const modelsToInsert = defaultModels.map(m => ({ owner_id: userId, model_name: m.name, slug: m.slug, status: 'active' }));
                await window.newSupabase.from('models').insert(modelsToInsert);
            }

            if(successBox) successBox.style.display = "block";
            setTimeout(() => { window.location.href = 'login.html'; }, 1500);
        });
    }
});
