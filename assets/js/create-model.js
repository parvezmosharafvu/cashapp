// assets/js/create-model.js

window.addEventListener('DOMContentLoaded', () => {
    
    if (!window.supabase) {
        console.error("Supabase client is missing! Ensure CDN is loaded before config.js");
        return;
    }

    const form = document.getElementById('model-form');

    if (!form) {
        console.error("Form 'model-form' not found in the HTML.");
        return;
    }

    // Attach Submit Event
    form.addEventListener('submit', async (e) => {
        e.preventDefault(); 
        
        const btn = document.getElementById('submit-btn');
        const originalBtnText = btn ? btn.textContent : "Create Model";
        const errBox = document.getElementById("msg");

        if (btn) {
            btn.disabled = true;
            btn.textContent = "Generating...";
        }
        if (errBox) errBox.style.display = "none";

        try {
            const { data: { session }, error: authError } = await window.supabase.auth.getSession();
            
            if (authError || !session) {
                throw new Error("Authentication failed. Please log in again.");
            }

            // FIXED: Using correct ID from HTML -> 'modelName'
            const nameInput = document.getElementById("modelName");
            if (!nameInput) throw new Error("Model name input is missing.");
            
            const modelName = nameInput.value.trim();
            
            // FIXED: Using correct Name from HTML -> 'slugStyle'
            const styleRadio = document.querySelector('input[name="slugStyle"]:checked');
            const linkStyle = styleRadio ? styleRadio.value : "dash";
            
            // Base slug generation
            let baseSlug = modelName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
            if (!baseSlug) baseSlug = "model";

            // Get Unique Slug
            const finalSlug = await makeUniqueSlug(baseSlug, linkStyle);
            
            // Avatar Text (First 2 letters)
            const initialAvatarText = modelName.substring(0, 2).toUpperCase();

            // Default theme color since it's removed from HTML
            const themeColor = "#00d26a";

            // Insert into Database
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
                throw insertError;
            }

            // Redirect to dashboard
            window.location.href = `dashboard.html?v=${new Date().getTime()}`;

        } catch (err) {
            console.error("Error creating model:", err);
            
            if (errBox) {
                errBox.textContent = err.message || "Failed to create model.";
                errBox.style.display = "block";
                errBox.style.color = "red";
            } else {
                alert("Error: " + (err.message || "Failed to create model."));
            }
            
            if (btn) {
                btn.disabled = false;
                btn.textContent = originalBtnText;
            }
        }
    });

    // ==========================================
    // PREVIEW UPDATER LOGIC
    // ==========================================
    
    // FIXED IDs here as well
    const nameInput = document.getElementById("modelName");
    const styleRadios = document.querySelectorAll('input[name="slugStyle"]');
    
    function updatePreviews() {
        if (!nameInput) return;
        
        const modelNameText = nameInput.value.trim();
        let val = modelNameText.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
        if (!val) val = "link";
        
        const activeStyle = document.querySelector('input[name="slugStyle"]:checked');
        const styleVal = activeStyle ? activeStyle.value : 'dash';
        
        let finalPreviewSlug = val;
        // Just for visual preview, append something if needed or keep raw base slug
        if (styleVal === 'dash') {
            // Usually dash format is already handled by the regex
            finalPreviewSlug = val; 
        } else if (styleVal === 'flat') {
            finalPreviewSlug = val.replace(/-/g, '');
        }

        const previewNameEl = document.getElementById("previewName");
        const previewSlugEl = document.getElementById("previewSlug");
        const previewAvatarEl = document.getElementById("previewAvatar");
        
        if (previewNameEl) previewNameEl.textContent = modelNameText || "Model Name";
        if (previewSlugEl) previewSlugEl.textContent = finalPreviewSlug;
        
        if (previewAvatarEl) {
            previewAvatarEl.textContent = modelNameText ? modelNameText.substring(0, 2).toUpperCase() : "?";
        }
    }

    if (nameInput) {
        nameInput.addEventListener("input", updatePreviews);
    }
    styleRadios.forEach(r => r.addEventListener("change", updatePreviews));
});

// Function to generate unique slug
async function makeUniqueSlug(slug, style) {
    let finalSlug = slug;
    
    if (style === 'flat') {
        finalSlug = slug.replace(/-/g, '');
    }

    let currentSlug = finalSlug;
    let count = 2;

    while (true) {
        const { data } = await window.supabase
            .from('models')
            .select('id')
            .eq('slug', currentSlug)
            .maybeSingle();

        if (!data) break; // Slug is available

        if (style === 'flat') {
            currentSlug = `${finalSlug}${count}`;
        } else {
            currentSlug = `${finalSlug}-${count}`;
        }
        count++;
    }

    return currentSlug;
}
