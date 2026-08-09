// assets/js/auth.js

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
            errBox.style.display = "none";

            const { data, error } = await window.supabase.auth.signInWithPassword({
                email: email,
                password: password,
            });

            if (error) {
                console.error(error);
                errBox.textContent = error.message;
                errBox.style.display = "block";
                btn.disabled = false;
                btn.textContent = "Log in";
                return;
            }

            window.location.href = 'dashboard.html';
        });
    }

    // ==========================================
    // REGISTRATION FLOW & PROFILE CREATION
    // ==========================================
    const regForm = document.getElementById("register-form");
    if (regForm) {
        regForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            
            const name = document.getElementById("reg-name").value.trim();
            const email = document.getElementById("reg-email").value.trim();
            const phone = document.getElementById("reg-phone").value.trim();
            const telegram = document.getElementById("reg-telegram").value.trim();
            const facebook = document.getElementById("reg-facebook").value.trim();
            const password = document.getElementById("reg-password").value;
            const confirm = document.getElementById("reg-confirm").value;
            
            const btn = document.getElementById("reg-btn");
            const errBox = document.getElementById("reg-error");
            const successBox = document.getElementById("reg-success");

            if (password !== confirm) {
                errBox.textContent = "Passwords do not match.";
                errBox.style.display = "block";
                return;
            }

            btn.disabled = true;
            btn.textContent = "Creating Account...";
            errBox.style.display = "none";

            // 1. Create User in Supabase Auth
            const { data: authData, error: authError } = await window.supabase.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: { full_name: name }
                }
            });

            if (authError) {
                errBox.textContent = authError.message;
                errBox.style.display = "block";
                btn.disabled = false;
                btn.textContent = "Register";
                return;
            }

            // 2. Insert into profiles table explicitly
            if (authData.user) {
                const { error: profileError } = await window.supabase
                    .from('profiles')
                    .upsert({
                        id: authData.user.id,
                        full_name: name,
                        email: email,
                        phone: phone || null,
                        facebook: facebook || null,
                        telegram: telegram || null,
                        status: 'active'
                    });

                if (profileError) {
                    console.error("Profile insertion error:", profileError);
                    errBox.textContent = "Profile error: " + profileError.message;
                    errBox.style.display = "block";
                    btn.disabled = false;
                    btn.textContent = "Register";
                    return;
                }
            }

            // 3. Success & Redirect
            successBox.style.display = "block";
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1500);
        });
    }
});
