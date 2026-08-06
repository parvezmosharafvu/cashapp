// assets/js/config.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const supabaseUrl = 'https://ohwzmxwsphsfzudmlins.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9od3pteHdzcGhzZnp1ZG1saW5zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwMzE0MTksImV4cCI6MjEwMTYwNzQxOX0.frTl7qnDx7SK2IBMQxFCkKGe5u4XAQweRxPhQ-2r8rU';

export const supabase = createClient(supabaseUrl, supabaseKey);
