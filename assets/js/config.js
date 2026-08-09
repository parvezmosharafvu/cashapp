// assets/js/config.js

const SUPABASE_URL =
'https://ohwzmxwsphsfzudmlins.supabase.co';

const SUPABASE_ANON_KEY =
'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9od3pteHdzcGhzZnp1ZG1saW5zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwMzE0MTksImV4cCI6MjEwMTYwNzQxOX0.frTl7qnDx7SK2IBMQxFCkKGe5u4XAQweRxPhQ-2r8rU';

window.supabase =
supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);

console.log('Supabase Ready');
