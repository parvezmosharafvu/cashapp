// assets/js/dashboard.js

// Global state variables
let currentModel = null;
let currentSettings = null;
let currentPayUrl = "";

document.addEventListener("DOMContentLoaded", async () => {
    // 1. SPA TAB SWITCHING SYSTEM
    initTabSystem();

    // 2. CHECK SUPABASE CLIENT INITIALIZATION
    if (!window.supabase) {
        console.error("CRITICAL ERROR: Supabase client is missing. Ensure config.js is loaded first.");
        return;
    }

    // 3. AUTHENTICATION SESSION CHECK
    const { data: { session }, error: authError } = await window.supabase.auth.getSession();
    
    if (authError || !session) {
        window.location.href = 'login.html';
        return;
    }

    const user = session.user;
    
    // Bind profile information
    initProfileUI(user);

    // 4. LOAD GLOBAL APP SETTINGS (Admin Notice, USD Rate, Allowed Domains)
    await loadAppSettings();

    // 5. LOAD USER MODEL & DASHBOARD DATA
    await loadDashboardData(user.id);

    // 6. INITIALIZE EVENT LISTENERS (Domain selector, Withdrawal Form)
    initDomainSelector();
    initWithdrawalForm(user.id);
});

// ==========================================
// 1. TAB SYSTEM & NAVIGATION HELPERS
// ==========================================
function initTabSystem() {
    const navItems = document.querySelectorAll(".bottom-nav .nav-item[data-target]");
    const tabContents = document.querySelectorAll(".tab-content");
    const pageTitle = document.getElementById("page-title");

    navItems.forEach(item => {
        item.addEventListener("click", (e) => {
            e.preventDefault();
            
            // Remove active status
            navItems.forEach(nav => nav.classList.remove("active"));
            tabContents.forEach(content => content.classList.remove("active"));
            
            // Activate clicked item
            item.classList.add("active");
            
            const targetId = item.getAttribute("data-target");
            const targetContent = document.getElementById(targetId);
            if (targetContent) {
                targetContent.classList.add("active");
            }
            
            // Update Top Bar Title
            if (pageTitle) {
                const titleText = item.querySelector("span") ? item.querySelector("span").textContent : "Dashboard";
                pageTitle.textContent = titleText;
            }
        });
    });
}

// Global helper for HTML inline onclick switching
window.switchTab = function(tabId) {
    const targetNav = document.querySelector(`.bottom-nav .nav-item[data-target="${tabId}"]`);
    if (targetNav) {
        targetNav.click();
    }
};

// ==========================================
// 2. GLOBAL APP SETTINGS (Admin Panel Values)
// ==========================================
async function loadAppSettings() {
    try {
        const { data, error } = await window.supabase
            .from("app_settings")
            .select("*")
            .eq("id", 1)
            .maybeSingle();

        if (error) {
            console.error("Error fetching app_settings:", error);
            return;
        }

        if (data) {
            currentSettings = data;

            // Render Global Notice Banner if present
            const noticeBanner = document.getElementById("notice-banner");
            const noticeText = document.getElementById("notice-text");
            if (data.global_notice && data.global_notice.trim() !== "") {
                if (noticeText) noticeText.textContent = data.global_notice;
                if (noticeBanner) noticeBanner.style.display = "block";
            } else if (noticeBanner) {
                noticeBanner.style.display = "none";
            }

            // Render Exchange Rate
            const rateEl = document.getElementById("display-exchange-rate");
            if (rateEl && data.exchange_rate) {
                rateEl.textContent = `${data.exchange_rate} TK`;
            }

            // Render Admin Allowed Domains into Selector
            if (data.allowed_domains && Array.isArray(data.allowed_domains)) {
                const domainSelect = document.getElementById("domain-select");
                if (domainSelect) {
                    domainSelect.innerHTML = data.allowed_domains
                        .map((domain, index) => `<option value="${domain}" ${index === 0 ? 'selected' : ''}>${domain}</option>`)
                        .join("");
                }
            }
        }
    } catch (err) {
        console.error("Unexpected error in loadAppSettings:", err);
    }
}

// ==========================================
// 3. DASHBOARD DATA & BALANCES BINDING
// ==========================================
async function loadDashboardData(userId) {
    try {
        // Fetch model profile using maybeSingle() to prevent crash on new users
        const { data: modelData, error: modelError } = await window.supabase
            .from("models")
            .select("id, slug, total_balance, total_pending, total_paid, total_withdrawn, owner_id")
            .eq("owner_id", userId)
            .maybeSingle();

        if (modelError) {
            console.error("Error fetching model profile:", modelError);
        }

        currentModel = modelData;

        const linkEl = document.getElementById("primary-pay-link");
        const listContainer = document.getElementById("recent-payments-list");

        if (modelData) {
            // Safely Bind Balances & Stats
            setElText("display-balance", formatMoney(modelData.total_balance));
            setElText("display-pending", formatMoney(modelData.total_pending));
            setElText("display-paid", formatMoney(modelData.total_paid));
            setElText("display-withdrawn", formatMoney(modelData.total_withdrawn));
            setElText("withdraw-available-balance", formatMoney(modelData.total_balance));

            // Update Dynamic Public Link
            updatePayLink();

            // Fetch Recent Payments, Full Payments History, and Withdrawal History
            loadRecentPayments(modelData.id);
            loadAllPayments(modelData.id);
            loadWithdrawalHistory(modelData.id);
        } else {
            if (linkEl) {
                linkEl.innerHTML = `
                    <a href="create-model.html" style="color: var(--primary); text-decoration: underline;">
                       Create your first model →
                    </a>
                `;
            }

            if (listContainer) {
                listContainer.innerHTML =
                `<p class="text-muted text-sm py-2">
                    Setup your profile to start receiving payments.
                </p>`;
            }
        }
    } catch (err) {
        console.error("Dashboard Load Error:", err);
    }
}

// ==========================================
// 4. DYNAMIC DOMAIN & PAY LINK MANAGER
// ==========================================
function initDomainSelector() {
    const domainSelect = document.getElementById("domain-select");
    if (domainSelect) {
        domainSelect.addEventListener("change", () => {
            updatePayLink();
        });
    }
}

function updatePayLink() {
    if (!currentModel || !currentModel.slug) return;
    
    const domainSelect = document.getElementById("domain-select");
    const selectedDomain = domainSelect ? domainSelect.value : window.location.host;
    const protocol = window.location.protocol;
    
    // Updated route format
    const generatedUrl = `${protocol}//${selectedDomain}/model.html?slug=${currentModel.slug}`;
    
    setElText("primary-pay-link", generatedUrl);
    window.currentPayUrl = generatedUrl;
}

window.copyPayLink = function() {
    if (window.currentPayUrl) {
        navigator.clipboard.writeText(window.currentPayUrl).then(() => {
            alert("Payment link copied to clipboard!");
        }).catch(err => {
            console.error('Failed to copy: ', err);
        });
    }
};

// ==========================================
// 5. RECENT & ALL PAYMENTS FETCHERS
// ==========================================
async function loadRecentPayments(modelId) {
    const container = document.getElementById("recent-payments-list");
    if (!container) return;

    const { data: payments, error } = await window.supabase
        .from("payments")
        .select("invoice_id, amount, status, created_at, payment_method")
        .eq("model_id", modelId)
        .order("created_at", { ascending: false })
        .limit(5);

    if (error) {
        container.innerHTML = `<p class="text-muted text-sm py-2">Failed to load recent payments.</p>`;
        return;
    }

    if (!payments || payments.length === 0) {
        container.innerHTML = `<p class="text-muted text-sm py-2">No payments received yet.</p>`;
        return;
    }

    container.innerHTML = ""; // Clear Skeleton Loader
    payments.forEach(payment => {
        container.insertAdjacentHTML('beforeend', renderPaymentRow(payment));
    });
}

async function loadAllPayments(modelId) {
    const container = document.getElementById("all-payments-list");
    if (!container) return;

    const { data: payments, error } = await window.supabase
        .from("payments")
        .select("invoice_id, amount, status, created_at, payment_method")
        .eq("model_id", modelId)
        .order("created_at", { ascending: false });

    if (error) {
        container.innerHTML = `<p class="text-muted text-sm py-2">Failed to load full payment history.</p>`;
        return;
    }

    if (!payments || payments.length === 0) {
        container.innerHTML = `<p class="text-muted text-sm py-2">No transaction history found.</p>`;
        return;
    }

    container.innerHTML = "";
    payments.forEach(payment => {
        container.insertAdjacentHTML('beforeend', renderPaymentRow(payment));
    });
}

function renderPaymentRow(payment) {
    const isPaid = payment.status === 'paid' || payment.status === 'settled';
    const badgeClass = isPaid ? 'badge-paid' : 'badge-pending';
    const amountClass = isPaid ? 'text-green' : 'text-main';
    const amountPrefix = isPaid ? '+' : '';
    const methodDisplay = payment.payment_method || 'Crypto Invoice';
    const shortInvoice = payment.invoice_id ? payment.invoice_id.substring(0, 8) : 'N/A';

    return `
        <div class="tx-item">
            <div class="tx-left">
                <span class="tx-title">${escapeHtml(methodDisplay)}</span>
                <span class="text-xs text-muted">${formatDate(payment.created_at)} • Inv: ${shortInvoice}...</span>
            </div>
            <div class="tx-right">
                <span class="tx-amount ${amountClass}">${amountPrefix}${formatMoney(payment.amount)}</span>
                <span class="badge ${badgeClass}">${payment.status}</span>
            </div>
        </div>
    `;
}

// ==========================================
// 6. WITHDRAWAL SUBMISSION & VALIDATION FLOW
// ==========================================
function initWithdrawalForm(userId) {
    const form = document.getElementById("withdrawal-form");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const submitBtn = document.getElementById("btn-submit-withdraw");

        if (!currentModel) {
            alert("Model profile not found. Please setup your profile first.");
            return;
        }

        const amountInput = document.getElementById("withdraw-amount");
        const methodInput = document.getElementById("withdraw-method");
        const detailsInput = document.getElementById("withdraw-details");
        const noteInput = document.getElementById("withdraw-note");

        const amount = parseFloat(amountInput.value);
        const method = methodInput.value.trim();
        const details = detailsInput.value.trim();
        const note = noteInput ? noteInput.value.trim() : "";

        // VALIDATION 1: Minimum and Numerical Amount
        if (isNaN(amount) || amount <= 0) {
            alert("Please enter a valid withdrawal amount.");
            return;
        }

        // VALIDATION 2: Check Amount vs Available Balance
        const availableBalance = Number(currentModel.total_balance || 0);
        if (amount > availableBalance) {
            alert(`Insufficient balance! Your available balance is ${formatMoney(availableBalance)}.`);
            return;
        }

        try {
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = "Checking pending requests...";
            }

            // VALIDATION 3: Cooldown Check (Prevent multiple pending requests)
            const { data: pendingRequests, error: pendingErr } = await window.supabase
                .from("withdrawals")
                .select("id")
                .eq("model_id", currentModel.id)
                .eq("status", "pending");

            if (pendingErr) {
                console.error("Pending withdrawal check error:", pendingErr);
            }

            if (pendingRequests && pendingRequests.length > 0) {
                alert("You already have a pending withdrawal request! Please wait until the admin processes your existing request before submitting a new one.");
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = "Submit request";
                }
                return;
            }

            // SUBMIT TO DATABASE
            if (submitBtn) submitBtn.textContent = "Submitting request...";

            const { error: insertErr } = await window.supabase
                .from("withdrawals")
                .insert({
                    owner_id: userId,
                    model_id: currentModel.id,
                    amount: amount,
                    method: method,
                    payout_details: details,
                    note: note,
                    status: "pending"
                });

            if (insertErr) {
                alert("Failed to submit request: " + insertErr.message);
            } else {
                alert("Withdrawal request submitted successfully! Admin will review and process your payout.");
                form.reset();
                
                // Refresh dashboard balances and withdrawal list
                await loadDashboardData(userId);
            }

        } catch (err) {
            console.error("Withdrawal error:", err);
            alert("An unexpected error occurred. Please try again.");
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = "Submit request";
            }
        }
    });
}

async function loadWithdrawalHistory(modelId) {
    const container = document.getElementById("withdrawal-history-list");
    if (!container) return;

    const { data: withdrawals, error } = await window.supabase
        .from("withdrawals")
        .select("id, amount, method, status, created_at, payout_details")
        .eq("model_id", modelId)
        .order("created_at", { ascending: false });

    if (error) {
        container.innerHTML = `<p class="text-muted text-sm py-2">Failed to load withdrawal history.</p>`;
        return;
    }

    if (!withdrawals || withdrawals.length === 0) {
        container.innerHTML = `<p class="text-muted text-sm py-2">No withdrawal requests yet.</p>`;
        return;
    }

    container.innerHTML = "";
    withdrawals.forEach(w => {
        let badgeClass = "badge-pending";
        if (w.status === "approved") badgeClass = "badge-approved";
        if (w.status === "completed" || w.status === "paid") badgeClass = "badge-paid";
        if (w.status === "rejected") badgeClass = "badge-rejected";
        
        const html = `
            <div class="tx-item">
                <div class="tx-left">
                    <span class="tx-title">${escapeHtml(w.method || 'Payout')}</span>
                    <span class="text-xs text-muted">${formatDate(w.created_at)}</span>
                </div>
                <div class="tx-right">
                    <span class="tx-amount text-main">${formatMoney(w.amount)}</span>
                    <span class="badge ${badgeClass}">${w.status}</span>
                </div>
            </div>
        `;
        container.insertAdjacentHTML("beforeend", html);
    });
}

// ==========================================
// 7. PROFILE & UTILITY HELPERS
// ==========================================
function initProfileUI(user) {
    setElText("user-email-display", user.email);
    setElText("profile-email", user.email);
    setElText("profile-name", user.user_metadata?.full_name || "Creator Account");
}

window.logoutUser = async function() {
    if (window.supabase) {
        await window.supabase.auth.signOut();
    }
    window.location.href = 'login.html';
};

// Helper function to safely set innerText
function setElText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text || '';
}

// Helper function to format money securely
function formatMoney(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount || 0);
}

// Helper function to format date
function formatDate(dateString) {
    if (!dateString) return '';
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-US', options);
}

// HTML Sanitize helper to prevent XSS in text outputs
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
