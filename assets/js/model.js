// assets/js/model.js
const supabase = window.supabase;

let currentModel = null;
let rawInput = '';
let currentPayCode = '';
let pollInterval = null;
let pollFailures = 0;

// =========================
// DOM
// =========================

const loaderOverlay = document.getElementById('loader-overlay');
const errorScreen = document.getElementById('error-screen');

const step1 = document.getElementById('step1');
const step2 = document.getElementById('step2');
const step3 = document.getElementById('step3');

const modelNameEl = document.getElementById('model-name');
const avatarTextEl = document.getElementById('avatar-text');

const amountDisplay = document.getElementById('amountDisplay');
const navAmount = document.getElementById('navAmount');

const payBtn = document.getElementById('payBtn');
const payBtnText = document.getElementById('payBtnText');

const successAmount = document.getElementById('successAmount');

// =========================
// HELPERS
// =========================

const SUCCESS_STATUSES = [
    'settled',
    'processing',
    'completed',
    'paid',
    'confirmed'
];

function showStep(step) {
    if (step1) step1.style.display = step === 1 ? 'flex' : 'none';
    if (step2) step2.style.display = step === 2 ? 'flex' : 'none';
    if (step3) step3.style.display = step === 3 ? 'flex' : 'none';
}

function showError(message = 'Model not found or inactive.') {
    if (loaderOverlay) {
        loaderOverlay.style.display = 'none';
    }
    
    if (errorScreen) {
        const errorText = errorScreen.querySelector('p');
        if (errorText) {
            errorText.textContent = message;
        }
        errorScreen.style.display = 'flex';
    }
}

function resetPolling() {
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }
    pollFailures = 0;
}

// =========================
// LOAD MODEL
// =========================

async function loadModelData() {
    try {
        const params = new URLSearchParams(window.location.search);
        
        // URL Slug Sanitization
        const slug = params.get('slug')?.trim()?.toLowerCase();

        if (!slug) {
            showError('Missing model link.');
            return;
        }

        const { data: model, error } = await supabase
            .from('models')
            .select('*')
            .eq('slug', slug)
            .eq('status', 'active')
            .single();

        if (error) throw error;

        if (!model) {
            showError('Model not found.');
            return;
        }

        // Data Validation (Production Ready)
        if (!model.id) {
            throw new Error('Missing model id');
        }
        if (!model.slug) {
            throw new Error('Missing model slug');
        }
        if (!model.model_name) {
            throw new Error('Invalid model name');
        }

        currentModel = model;

        // UI Text Updates (Safe Checks)
        if (modelNameEl) {
            modelNameEl.textContent = model.model_name;
        }
        
        if (avatarTextEl) {
            avatarTextEl.textContent = model.avatar_text || '?';
        }

        // Theme Apply
        const themeColor = model.theme_color || '#00D632';
        document.documentElement.style.setProperty('--theme', themeColor);
        document.body.style.background = themeColor;

        const wrapper = document.getElementById('app-wrapper');
        if (wrapper) {
            wrapper.style.background = themeColor;
        }

        // Meta Theme Color Update (Android Browser Support)
        document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColor);

        // Meta Tags Update (SEO & Open Graph)
        document.title = `Pay ${model.model_name}`;
        
        document.querySelector('meta[property="og:title"]')?.setAttribute('content', `Pay ${model.model_name}`);
        document.querySelector('meta[property="og:description"]')?.setAttribute('content', `Send payment to ${model.model_name}`);
        
        // Safe OG Image URL Resolution
        const ogImageUrl = currentModel.og_image
            ? new URL(currentModel.og_image, window.location.origin + '/').href
            : `${window.location.origin}/preview.png`;

        document.querySelector('meta[property="og:image"]')?.setAttribute('content', ogImageUrl);

        if (loaderOverlay) {
            loaderOverlay.style.display = 'none';
        }
        
        showStep(1);

    } catch (err) {
        console.error('Model Load Failed:', err);
        showError('Unable to load this model.');
    }
}

// =========================
// DISPLAY
// =========================

function updateDisplay() {
    const value = parseFloat(rawInput) || 0;

    if (amountDisplay) {
        amountDisplay.textContent = rawInput === '' 
            ? '$0' 
            : rawInput === '.' 
            ? '$0.' 
            : `$${rawInput}`;
    }

    if (navAmount) {
        navAmount.textContent = value > 0 ? `$${value.toFixed(2)}` : '$0';
    }
}

// =========================
// KEYPAD
// =========================

document.querySelectorAll('.key').forEach(btn => {
    btn.addEventListener('click', e => {
        const key = e.currentTarget.dataset.key;

        if (key === 'back') {
            rawInput = rawInput.slice(0, -1);
        } else if (key === '.') {
            if (!rawInput.includes('.')) {
                rawInput += '.';
            }
        } else {
            if (rawInput.includes('.') && rawInput.split('.')[1].length >= 2) {
                return;
            }
            
            // Keypad Safe Float Check
            const nextValue = Number(rawInput + key);
            if (!Number.isNaN(nextValue) && nextValue > 2000) {
                return;
            }
            
            rawInput += key;
        }

        updateDisplay();
    });
});

// =========================
// BTCPAY
// =========================

if (payBtn) {
    payBtn.addEventListener('click', async () => {
        
        // Prevent double-click race condition
        if (payBtn.disabled) {
            return;
        }

        try {
            const amount = parseFloat(rawInput) || 0;

            if (amount < 2) {
                alert('Minimum payment amount is $2');
                return;
            }

            if (!currentModel) {
                alert('Model not loaded.');
                return;
            }

            if (payBtn) {
                payBtn.disabled = true;
                payBtn.classList.add('loading');
            }
            
            if (payBtnText) {
                payBtnText.textContent = 'Generating...';
            }

            const { data, error } = await supabase.functions.invoke('btcpay-webhook', {
                body: {
                    action: 'create_invoice',
                    amount,
                    modelId: currentModel.id,
                    paymentType: 'lightning',
                    source: window.location.origin
                }
            });

            if (error) throw error;

            if (!data?.invoiceId) {
                throw new Error('Invoice creation failed');
            }

            currentPayCode = data.lightningCode || data.btcAddress;

            if (!currentPayCode) {
                throw new Error('No payment code returned');
            }

            if (currentPayCode.toLowerCase().startsWith('lightning:')) {
                currentPayCode = currentPayCode.slice(10);
            }

            const cashAppUrl = `https://cash.app/launch/lightning/${currentPayCode}`;
            
            // QR Element Check
            const qrBox = document.getElementById('qrcode');
            if (!qrBox) {
                throw new Error('QR container not found');
            }
            qrBox.innerHTML = '';

            new QRCode(qrBox, {
                text: cashAppUrl,
                width: 190,
                height: 190
            });

            // QR Link Element Check
            const qrLink = document.getElementById('qrLink');
            if (!qrLink) {
                throw new Error('QR link element missing');
            }
            qrLink.href = cashAppUrl;
            
            showStep(2);
            startPolling(data.invoiceId, amount);

        } catch (err) {
            console.error('Invoice Error:', err);
            alert('Unable to create invoice.');
        } finally {
            if (payBtn) {
                payBtn.disabled = false;
                payBtn.classList.remove('loading');
            }
            if (payBtnText) {
                payBtnText.textContent = 'Pay';
            }
        }
    });
}

// =========================
// POLLING
// =========================

function startPolling(invoiceId, amount) {
    resetPolling();

    pollInterval = setInterval(async () => {
        try {
            const { data } = await supabase.functions.invoke('btcpay-webhook', {
                body: { checkStatus: true, invoiceId }
            });

            // Success Status Check (Future Ready)
            const status = String(data?.status || '').toLowerCase();
            
            if (SUCCESS_STATUSES.includes(status)) {
                resetPolling();
                
                // Loader hide on polling success
                if (loaderOverlay) {
                    loaderOverlay.style.display = 'none';
                }

                if (successAmount) {
                    successAmount.textContent = `$${amount.toFixed(2)}`;
                }
                
                showStep(3);
            }

        } catch (err) {
            pollFailures++;
            console.error('Polling Error:', err);

            if (pollFailures >= 5) {
                resetPolling();
                alert('Connection lost. Please refresh.');
            }
        }
    }, 5000);
}

// =========================
// BUTTONS
// =========================

document.getElementById('cancelBtn')?.addEventListener('click', () => {
    resetPolling();
    showStep(1);
});

document.getElementById('doneBtn')?.addEventListener('click', () => {
    window.location.reload();
});

document.getElementById('copyBtn')?.addEventListener('click', async () => {
    if (!currentPayCode) return;
    
    try {
        await navigator.clipboard.writeText(currentPayCode);
        const btn = document.getElementById('copyBtn');
        if (btn) {
            btn.textContent = 'Copied!';
            
            setTimeout(() => {
                if (btn) btn.textContent = 'Copy address';
            }, 2000);
        }
    } catch (err) {
        console.error('Clipboard Error:', err);
    }
});

document.getElementById('openCashAppBtn')?.addEventListener('click', () => {
    const qrLink = document.getElementById('qrLink');
    if (qrLink?.href) {
        window.location.href = qrLink.href;
    }
});

// =========================
// CLEANUP & START
// =========================

window.addEventListener('beforeunload', () => {
    resetPolling();
});

loadModelData();
