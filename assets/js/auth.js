// assets/js/auth.js
import { supabase } from './config.js';

const registerForm = document.getElementById('register-form');
const loginForm = document.getElementById('login-form');
const msgDiv = document.getElementById('msg');

// Message Helper
function showMessage(text, isError = false) {
    msgDiv.textContent = text;
    msgDiv.className = `msg ${isError ? 'error' : 'success'}`;
}

// Handle Registration
if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const btn = document.getElementById('register-btn');

        btn.disabled = true;
        btn.textContent = 'Creating Account...';
        msgDiv.textContent = '';

        const { data, error } = await supabase.auth.signUp({
            email: email,
            password: password,
        });

        if (error) {
            showMessage(error.message, true);
            btn.disabled = false;
            btn.textContent = 'Sign Up';
        } else {
            showMessage('Success! Redirecting to login...', false);
            // Supabase auto-profile trigger will handle the database entry
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 1500);
        }
    });
}

// Handle Login
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const btn = document.getElementById('login-btn');

        btn.disabled = true;
        btn.textContent = 'Authenticating...';
        msgDiv.textContent = '';

        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (error) {
            showMessage(error.message, true);
            btn.disabled = false;
            btn.textContent = 'Login';
        } else {
            showMessage('Login successful! Redirecting...', false);
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1000);
        }
    });
}

// Session Check: If already logged in, send directly to dashboard
async function checkSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session && (window.location.pathname.includes('login.html') || window.location.pathname.includes('register.html'))) {
        window.location.href = 'dashboard.html';
    }
}

checkSession();
