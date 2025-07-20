// _shared/deps.ts
export { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
export { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// Import from the local vendored file for maximum reliability
export { GoogleAuth } from './vendor/google_auth.ts';
export { corsHeaders } from './cors.ts'; 

// Export Deno-specific types by re-exporting from a module that uses them.
// This helps the type checker recognize the Deno global namespace.
export * from "https://deno.land/x/dotenv/mod.ts";

// Export Zod for input validation
export { z } from "https://deno.land/x/zod@v3.23.4/mod.ts"; 