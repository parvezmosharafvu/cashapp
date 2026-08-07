// assets/js/model.js

import { supabase } from './config.js';

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

const successAmount =
    document.getElementById('successAmount');

// =========================
// HELPERS
// =========================

function showStep(step) {
    step1.style.display = step === 1 ? 'flex' : 'none';
    step2.style.display = step === 2 ? 'flex' : 'none';
    step3.style.display = step === 3 ? 'flex' : 'none';
}

function showError(message = 'Model not found or inactive.') {

    loaderOverlay.style.display = 'none';

    const errorText =
        errorScreen.querySelector('p');

    if (errorText) {
        errorText.textContent = message;
    }

    errorScreen.style.display = 'flex';
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

        const params =
            new URLSearchParams(
                window.location.search
            );

        const slug =
            params.get('slug');

        if (!slug) {

            showError(
                'Missing model link.'
            );

            return;
        }

        const {
            data: model,
            error
        } = await supabase
            .from('models')
            .select('*')
            .eq('slug', slug)
            .eq('status', 'active')
            .single();

        if (error) {
            throw error;
        }

        if (!model) {

            showError(
                'Model not found.'
            );

            return;
        }

        currentModel = model;

        modelNameEl.textContent =
            model.model_name;

        avatarTextEl.textContent =
            model.avatar_text || '?';

        const themeColor =
            model.theme_color || '#00D632';

        document.documentElement
            .style
            .setProperty(
                '--theme',
                themeColor
            );

        document.body.style.background =
            themeColor;

        const wrapper =
            document.getElementById(
                'app-wrapper'
            );

        if (wrapper) {
            wrapper.style.background =
                themeColor;
        }

        document.title =
            `Pay ${model.model_name}`;

        document
            .querySelector(
                'meta[property="og:title"]'
            )
            ?.setAttribute(
                'content',
                `Pay ${model.model_name}`
            );

        loaderOverlay.style.display =
            'none';

        showStep(1);

    } catch (err) {

        console.error(
            'Model Load Failed:',
            err
        );

        showError(
            'Unable to load this model.'
        );
    }
}

// =========================
// DISPLAY
// =========================

function updateDisplay() {

    const value =
        parseFloat(rawInput) || 0;

    amountDisplay.textContent =
        rawInput === ''
            ? '$0'
            : rawInput === '.'
            ? '$0.'
            : `$${rawInput}`;

    navAmount.textContent =
        value > 0
            ? `$${value.toFixed(2)}`
            : '$0';
}

// =========================
// KEYPAD
// =========================

document
.querySelectorAll('.key')
.forEach(btn => {

    btn.addEventListener(
        'click',
        e => {

            const key =
                e.currentTarget
                    .dataset.key;

            if (key === 'back') {

                rawInput =
                    rawInput.slice(0, -1);

            } else if (key === '.') {

                if (
                    !rawInput.includes('.')
                ) {
                    rawInput += '.';
                }

            } else {

                if (
                    rawInput.includes('.') &&
                    rawInput
                        .split('.')[1]
                        .length >= 2
                ) {
                    return;
                }

                if (
                    parseFloat(
                        rawInput + key
                    ) > 2000
                ) {
                    return;
                }

                rawInput += key;
            }

            updateDisplay();

        }
    );

});

// =========================
// BTCPAY
// =========================

payBtn.addEventListener(
    'click',
    async () => {

        try {

            const amount =
                parseFloat(rawInput) || 0;

            if (amount < 2) {

                alert(
                    'Minimum payment amount is $2'
                );

                return;
            }

            if (!currentModel) {

                alert(
                    'Model not loaded.'
                );

                return;
            }

            payBtn.disabled = true;
            payBtn.classList.add(
                'loading'
            );

            payBtnText.textContent =
                'Generating...';

            const {
                data,
                error
            } =
            await supabase.functions.invoke(
                'btcpay-webhook',
                {
                    body: {
                        action:
                            'create_invoice',
                        amount,
                        modelId:
                            currentModel.id,
                        paymentType:
                            'lightning',
                        source:
                            window.location.origin
                    }
                }
            );

            if (error) {
                throw error;
            }

            if (!data?.invoiceId) {

                throw new Error(
                    'Invoice creation failed'
                );
            }

            currentPayCode =
                data.lightningCode
                || data.btcAddress
                || '';

            if (
                currentPayCode
                    .toLowerCase()
                    .startsWith(
                        'lightning:'
                    )
            ) {

                currentPayCode =
                    currentPayCode.slice(10);
            }

            const cashAppUrl =
                `https://cash.app/launch/lightning/${currentPayCode}`;

            const qrBox =
                document.getElementById(
                    'qrcode'
                );

            qrBox.innerHTML = '';

            new QRCode(
                qrBox,
                {
                    text: cashAppUrl,
                    width: 190,
                    height: 190
                }
            );

            document
                .getElementById(
                    'qrLink'
                )
                .href =
                cashAppUrl;

            showStep(2);

            startPolling(
                data.invoiceId,
                amount
            );

        } catch (err) {

            console.error(
                'Invoice Error:',
                err
            );

            alert(
                'Unable to create invoice.'
            );

        } finally {

            payBtn.disabled = false;

            payBtn.classList.remove(
                'loading'
            );

            payBtnText.textContent =
                'Pay';
        }

    }
);

// =========================
// POLLING
// =========================

function startPolling(
    invoiceId,
    amount
) {

    resetPolling();

    pollInterval =
    setInterval(
        async () => {

            try {

                const { data }
                    =
                    await supabase
                    .functions
                    .invoke(
                        'btcpay-webhook',
                        {
                            body: {
                                checkStatus:
                                    true,
                                invoiceId
                            }
                        }
                    );

                if (
                    data &&
                    (
                        data.status
                        === 'settled'
                        ||
                        data.status
                        === 'Processing'
                    )
                ) {

                    resetPolling();

                    successAmount.textContent =
                        `$${amount.toFixed(2)}`;

                    showStep(3);
                }

            } catch (err) {

                pollFailures++;

                console.error(
                    'Polling Error:',
                    err
                );

                if (
                    pollFailures >= 5
                ) {

                    resetPolling();

                    alert(
                        'Connection lost. Please refresh.'
                    );
                }

            }

        },
        5000
    );

}

// =========================
// BUTTONS
// =========================

document
.getElementById('cancelBtn')
?.addEventListener(
    'click',
    () => {

        resetPolling();

        showStep(1);
    }
);

document
.getElementById('doneBtn')
?.addEventListener(
    'click',
    () => {

        window.location.reload();
    }
);

document
.getElementById('copyBtn')
?.addEventListener(
    'click',
    async () => {

        try {

            await navigator
                .clipboard
                .writeText(
                    currentPayCode
                );

            const btn =
                document
                .getElementById(
                    'copyBtn'
                );

            btn.textContent =
                'Copied!';

            setTimeout(() => {

                btn.textContent =
                    'Copy address';

            }, 2000);

        } catch (err) {

            console.error(
                'Clipboard Error:',
                err
            );

        }

    }
);

document
.getElementById(
    'openCashAppBtn'
)
?.addEventListener(
    'click',
    () => {

        const url =
            document
            .getElementById(
                'qrLink'
            )
            ?.href;

        if (url) {
            window.location.href =
                url;
        }

    }
);

// =========================
// START
// =========================

loadModelData();

