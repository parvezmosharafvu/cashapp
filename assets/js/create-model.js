// assets/js/create-model.js
import { supabase } from './config.js';

const form = document.getElementById('model-form');
const modelNameInput = document.getElementById('modelName');
const radioInputs = document.querySelectorAll('input[name="slugStyle"]');
const msgDiv = document.getElementById('msg');
const submitBtn = document.getElementById('submit-btn');

// --- Utilities ---
function makeInitials(name) {
    if (!name) return '?';
    return name.trim().split(' ').slice(0, 2).map(v => v[0]).join('').toUpperCase();
}

function slugDashed(name) {
    return name.trim().toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, '-');
}

function slugFlat(name) {
    return name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function makeUniqueSlug(slug) {
    let finalSlug = slug;
    let count = 2;

    while (true) {
        const { data } = await supabase
            .from('models')
            .select('id')
            .eq('slug', finalSlug);

        if (!data || !data.length) {
            break;
        }
        finalSlug = `${slug}-${count}`;
        count++;
    }
    return finalSlug;
}

// --- Live Preview Logic ---
function updatePreview() {
    const name = modelNameInput.value;
    const style = document.querySelector('input[name="slugStyle"]:checked').value;
    
    document.getElementById('previewName').textContent = name || 'Model Name';
    document.getElementById('previewAvatar').textContent = makeInitials(name);
    
    let tempSlug = style === 'dash' ? slugDashed(name) : slugFlat(name);
    document.getElementById('previewSlug').textContent = tempSlug || 'link';
}

modelNameInput.addEventListener('input', updatePreview);
radioInputs.forEach(radio => radio.addEventListener('change', updatePreview));

// --- Form Submit Logic ---
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    submitBtn.disabled = true;
    submitBtn.textContent = 'Generating...';
    msgDiv.textContent = '';
    msgDiv.className = 'msg';

    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        location.href = 'login.html';
        return;
    }

    const modelName = modelNameInput.value;
    const style = document.querySelector('input[name="slugStyle"]:checked').value;

    // Generate Initial Slug
    let slug = style === 'dash' ? slugDashed(modelName) : slugFlat(modelName);
    
    // Fallback if name has no valid characters
    if (!slug) slug = 'model';

    // Ensure Uniqueness (e.g., cute-queen-2)
    slug = await makeUniqueSlug(slug);

    const avatar = makeInitials(modelName);
    const ogImage = `${slug}.svg`; // For future auto SVG generation storage

    // Save to Database
    const { error } = await supabase
        .from('models')
        .insert({
            owner_id: session.user.id,
            model_name: modelName,
            slug: slug,
            avatar_text: avatar,
            og_image: ogImage
        });

    if (error) {
        msgDiv.textContent = error.message;
        msgDiv.className = 'msg error';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Model';
        return;
    }

    msgDiv.textContent = `Success! Link: /${slug}`;
    msgDiv.className = 'msg success';
    
    setTimeout(() => {
        location.href = 'dashboard.html';
    }, 1500);
});
