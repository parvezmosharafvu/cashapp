document.addEventListener("DOMContentLoaded", async () => {
    if (!window.supabase) {
        console.error("Supabase not found. Check config.js");
        return;
    }

    // Redirect to dashboard if already logged in
    const { data: { session } } = await window.supabase.auth.getSession();
    if (session) {
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

            btn.disabled = true;
            btn.textContent = "Logging in...";
            if(errBox) errBox.style.display = "none";

            const { error } = await window.supabase.auth.signInWithPassword({
                email: email,
                password: password,
            });

            if (error) {
                console.error(error);
                if(errBox) {
                    errBox.textContent = error.message;
                    errBox.style.display = "block";
                } else {
                    alert(error.message);
                }
                btn.disabled = false;
                btn.textContent = "Log in";
                return;
            }

            window.location.href = 'dashboard.html';
        });
    }

    // ==========================================
    // REGISTRATION FLOW & AUTO MODEL ASSIGN
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
                if(errBox) { errBox.textContent = "Passwords do not match."; errBox.style.display = "block"; }
                return;
            }

            btn.disabled = true;
            btn.textContent = "Creating Account...";
            if(errBox) errBox.style.display = "none";

            // 1. Create User in Supabase Auth
            const { data: authData, error: authError } = await window.supabase.auth.signUp({
                email: email,
                password: password,
                options: { data: { full_name: name } }
            });

            if (authError) {
                if(errBox) { errBox.textContent = authError.message; errBox.style.display = "block"; }
                btn.disabled = false;
                btn.textContent = "Register";
                return;
            }

            if (authData.user) {
                const userId = authData.user.id;

                // 2. Insert into profiles table
                await window.supabase.from('profiles').upsert({
                    id: userId,
                    full_name: name,
                    email: email,
                    status: 'active'
                });

                // 3. AUTO-ASSIGN DEFAULT MODELS (From your GitHub repo)
                const defaultModels = [
                    { name: 'Crystal', slug: 'Crystal' },
                    { name: 'Linda', slug: 'Linda' },
                    { name: 'LoveMe', slug: 'LoveMe' },
                    { name: 'Night Queen', slug: 'NightQueen' },
                    { name: 'Red Rose', slug: 'RedRose' },
                    { name: 'Rose', slug: 'Rose' },
                    { name: 'Sophia', slug: 'Sophia' },
                    { name: 'Beauty Girl', slug: 'beauty-girl' },
                    { name: 'Beauty Queen', slug: 'beauty-queen' },
                    { name: 'Cute Queen', slug: 'cute-queen' },
                    { name: 'Emma', slug: 'emma' },
                    { name: 'Horny Queen', slug: 'horny-queen' }
                ];

                const modelsToInsert = defaultModels.map(model => ({
                    owner_id: userId,
                    model_name: model.name,
                    slug: model.slug,
                    status: 'active'
                }));

                const { error: modelError } = await window.supabase.from('models').insert(modelsToInsert);

                if (modelError) {
                    console.error("Failed to auto-assign models:", modelError);
                }
            }

            // 4. Success & Redirect
            if(successBox) successBox.style.display = "block";
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 1500);
        });
    }
});
