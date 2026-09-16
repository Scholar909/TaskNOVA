/* =========================================================
   TASKNOVA — SHARED SUPABASE CLIENT
   One client instance, imported by any page that needs to call a
   Supabase Edge Function. Firestore stays the data store for
   everything else — this file exists only for the "cloud
   functions + keys" half of the new architecture (Flutterwave
   deposit/withdrawal verification, bank account resolve, force-
   logout-everyone, the 3-month data-retention job, etc.), so that
   secret keys never have to live in Firebase Cloud Functions.

   Nothing calls this yet — home.js doesn't need an edge function.
   wallet.js will be the first real consumer, since Flutterwave's
   secret key has to be used from a server context, never here.
   ========================================================= */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://esvmdzsnvcjfsnoznyfb.supabase.co";
// This is the publishable/anon-equivalent key — safe to ship in
// frontend code. The service-role/secret key must never appear in
// any file that reaches the browser; it only lives inside Supabase
// Edge Function environment variables, set from the Supabase
// dashboard directly, never committed to this codebase.
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_f0IUok5-R5wSrwXwSB1kAQ_8Gzfrp0S";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

/**
 * Calls a Supabase Edge Function by name and returns its JSON
 * response, throwing on any error the function reports.
 *
 * @param {string} functionName - the Edge Function's slug, e.g. "resolve-bank-account"
 * @param {object} [body] - JSON-serializable request body
 * @returns {Promise<any>}
 */
export async function callEdgeFunction(functionName, body) {
  const { data, error } = await supabase.functions.invoke(functionName, {
    body: body ?? {}
  });
  if (error) throw error;
  return data;
}

/* ===========================================================
   NOTES
   ===========================================================
   - No Edge Functions exist in the Supabase project yet — this
     file only sets up the client side. Each function referenced
     from any page's CLOUD_FN-style constant (resolveBankAccount,
     verifyDeposit/verifyFlutterwaveDeposit, requestWithdrawal,
     forceLogoutAll, and eventually the 3-month retention sweep)
     needs to actually be written and deployed in Supabase
     (`supabase functions new <name>`, then `supabase functions
     deploy <name>`) before any page calling it will work — the
     CLI login/init/link commands from the provided Supabase data
     are the first three steps of that.

   - Auth: these Edge Functions will need to verify the caller is
     a real signed-in TaskNOVA user (and, for admin-only ones,
     that they're an admin) before doing anything privileged.
     Since auth here is Firebase Auth (not Supabase Auth), the
     pattern is: get a Firebase ID token client-side
     (`await user.getIdToken()`), send it as a Bearer token (see
     callEdgeFunction usage in whichever page needs this), and
     have the Edge Function verify that token against Firebase's
     public keys (Firebase Admin SDK can run inside a Supabase
     Edge Function, or the token can be verified manually against
     Google's JWKS endpoint) rather than trusting it blindly.

   - The 3-month Firestore + Cloudinary retention sweep mentioned
     in chat isn't a per-page concern — it's a scheduled Edge
     Function (Supabase supports cron-triggered functions) that
     runs independently of any page load. It'll need a Firebase
     service-account key stored as a Supabase secret so it can
     delete old Firestore docs, plus the Cloudinary API
     secret to delete old media — neither of those keys belongs in
     any file that reaches the browser.
   =========================================================== */
