document.addEventListener("DOMContentLoaded", () => {
    alert("JS LOADED");

    if (!window.supabase) {
        console.error("Supabase client is missing!");
        return;
    }

    const form = document.getElementById("create-model-form");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        // 1. Debug: Form Submitted
        alert("FORM SUBMITTED");

        const btn = document.getElementById("btn-submit");
        const originalBtnText = btn.textContent;
        const errBox = document.getElementById("error-msg");

        btn.disabled = true;
        btn.textContent = "Generating...";
        errBox.style.display = "none";

        try {
            // 2. Debug: Session Check Start
            alert("SESSION CHECK");
            
            const { data: { session }, error: authError } = await window.supabase.auth.getSession();
            
            if (authError || !session) {
                throw new Error("Authentication failed. Please log in again.");
            }
            
            // 3. Debug: Session OK
            alert("SESSION OK");

            const modelName = document.getElementById("model-name").value.trim();
            const themeColor = document.getElementById("theme-color").value;
            const linkStyle = document.querySelector('input[name="link-style"]:checked').value;
            
            let baseSlug = modelName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
            if (!baseSlug) baseSlug = "model";

            // Temporary Fix: Bypass unique check for debugging
            const finalSlug = await makeUniqueSlug(baseSlug, linkStyle);

            const initialAvatarText = modelName.substring(0, 2).toUpperCase();

            // 4. Debug: Start Insert
            alert("START INSERT");

            const { error: insertError } = await window.supabase
                .from('models')
                .insert({
                    owner_id: session.user.id,
                    model_name: modelName,
                    slug: finalSlug,
                    slug_style: linkStyle,
                    theme_color: themeColor,
                    avatar_text: initialAvatarText,
                    status: 'active'
                });

            if (insertError) {
                console.error("Insert Error:", insertError);
                throw insertError;
            }

            // 5. Debug: Insert Complete
            alert("INSERT COMPLETE");

            // Redirect to dashboard
            window.location.href = `dashboard.html?v=${new Date().getTime()}`;

        } catch (err) {
            console.error("Error creating model:", err);
            errBox.textContent = err.message || "Failed to create model. Check console for details.";
            errBox.style.display = "block";
            btn.disabled = false;
            btn.textContent = originalBtnText;
        }
    });

    // Handle Link Style Preview updates
    const nameInput = document.getElementById("model-name");
    const styleRadios = document.querySelectorAll('input[name="link-style"]');
    
    function updatePreviews() {
        let val = nameInput.value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
        if (!val) val = "model-name";
        
        document.getElementById("preview-flat").textContent = `cioup.com/${val}`;
        document.getElementById("preview-dash").textContent = `cioup.com/${val}-1`;
    }

    nameInput.addEventListener("input", updatePreviews);
    styleRadios.forEach(r => r.addEventListener("change", updatePreviews));
});

// Temporary Bypass Version
async function makeUniqueSlug(slug, style) {
    return slug;
}
