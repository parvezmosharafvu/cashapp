window.addEventListener('DOMContentLoaded', () => {
    
    // বেসিক চেক
    alert("0. JS LOADED");

    // ১ নম্বর টেস্ট: Supabase অবজেক্ট চেক
    alert("1. Supabase Type: " + typeof window.supabase);

    // ২ নম্বর টেস্ট: ফর্ম ফাইন্ডিং চেক
    const form = document.getElementById('model-form');
    alert("2. " + (form ? "FORM FOUND" : "FORM NOT FOUND"));

    // ৩ নম্বর টেস্ট: মিনিমাল সাবমিট ইভেন্ট চেক
    if (form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            alert("3. FORM SUBMITTED (Refresh Prevented!)");
        });
    }

});
