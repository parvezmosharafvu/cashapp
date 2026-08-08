// assets/js/create-model.js
const supabase = window.supabase;

const form = document.getElementById('model-form');
const modelNameInput = document.getElementById('modelName');
const radioInputs = document.querySelectorAll('input[name="slugStyle"]');
const msgDiv = document.getElementById('msg');
const submitBtn = document.getElementById('submit-btn');

const domain = window.location.origin;

// Update static domain in HTML dynamically on load
document.addEventListener('DOMContentLoaded', () => {
    const previewBox = document.getElementById('previewSlug').parentElement;
    previewBox.innerHTML = `${domain}/<span id="previewSlug" style="color: var(--primary); font-weight: 700;">link</span>`;
});

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

async function makeUniqueSlug(slug, style) {
    let finalSlug = slug;
    let count = 2;

    while (true) {
        const { data } = await supabase.from('models').select('id').eq('slug', finalSlug);
        if (!data || !data.length) break;
        
        if (style === 'flat') {
            finalSlug = `${slug}${count}`;
        } else {
            finalSlug = `${slug}-${count}`;
        }
        count++;
    }
    return finalSlug;
}

function updatePreview() {
    const name = modelNameInput.value;
    const style = document.querySelector('input[name="slugStyle"]:checked').value;
    
    document.getElementById('previewName').textContent = name || 'Model Name';
    document.getElementById('previewAvatar').textContent = makeInitials(name);
    
    let tempSlug = style === 'dash' ? slugDashed(name) : slugFlat(name);
    const previewSlugEl = document.getElementById('previewSlug');
    if (previewSlugEl) previewSlugEl.textContent = tempSlug || 'link';
}

modelNameInput.addEventListener('input', updatePreview);
radioInputs.forEach(radio => radio.addEventListener('change', updatePreview));

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    submitBtn.disabled = true;
    submitBtn.textContent = 'Generating...';
    msgDiv.textContent = '';
    msgDiv.className = 'msg';

    // Fix 1: Model Name Validation
    const modelName = modelNameInput.value.trim();
    if(modelName.length < 3){
        msgDiv.textContent = 'Model name must be at least 3 characters';
        msgDiv.className = 'msg error';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Model';
        return;
    }

    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        location.href = 'login.html';
        return;
    }

    const { count } = await supabase
        .from('models')
        .select('*', { count: 'exact', head: true })
        .eq('owner_id', session.user.id);

    if (count >= 10) {
        msgDiv.textContent = 'Maximum 10 models allowed';
        msgDiv.className = 'msg error';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Model';
        return;
    }

    const style = document.querySelector('input[name="slugStyle"]:checked').value;
    let slug = style === 'dash' ? slugDashed(modelName) : slugFlat(modelName);
    if (!slug) slug = 'model';

    // Fix 2: Reserved Slug Block
    const reserved = ['admin', 'login', 'register', 'dashboard', 'create-model', 'assets', 'api'];
    if(reserved.includes(slug)){
        msgDiv.textContent = 'This link name is reserved';
        msgDiv.className = 'msg error';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Model';
        return;
    }

    slug = await makeUniqueSlug(slug, style);
    const avatar = makeInitials(modelName);
    const ogImage = `preview/${slug}.svg`;

    // Fix 3: Save Slug Style
    const { error } = await supabase
        .from('models')
        .insert({
            owner_id: session.user.id,
            model_name: modelName,
            slug: slug,
            avatar_text: avatar,
            og_image: ogImage,
            slug_style: style
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
