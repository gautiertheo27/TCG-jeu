// Comptes joueurs via Supabase : Google, Discord, e-mail + mot de passe.
// Le stock de boosters et la collection sont gérés par le serveur (fonctions SQL sécurisées).
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

export const configured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
const SDK = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/+esm";
let sb = null;
const here = () => location.origin + location.pathname;
const fail = (error) => { if (error) { const e = new Error(error.message || String(error)); e.code = error.code; throw e; } };

export async function initAccount({ onSession, onRecovery, client } = {}) {
  if (!configured && !client) return null;
  try {
    if (client) sb = client;
    else { const { createClient } = await import(SDK); sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" } }); }
  } catch (e) { console.error("Supabase indisponible", e); return null; }
  sb.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") onRecovery?.();
    // différé : ne pas appeler Supabase depuis le callback lui-même
    if (["INITIAL_SESSION", "SIGNED_IN", "SIGNED_OUT", "USER_UPDATED"].includes(event)) setTimeout(() => onSession?.(session, event), 0);
  });
  return sb;
}

export const auth = {
  oauth: async (provider) => { fail((await sb.auth.signInWithOAuth({ provider, options: { redirectTo: here() } })).error); },
  signUp: async (email, password, username) => {
    const { data, error } = await sb.auth.signUp({ email, password, options: { data: { full_name: username }, emailRedirectTo: here() } });
    fail(error); return { needsConfirmation: !data.session };
  },
  signIn: async (email, password) => { fail((await sb.auth.signInWithPassword({ email, password })).error); },
  reset: async (email) => { fail((await sb.auth.resetPasswordForEmail(email, { redirectTo: here() })).error); },
  setPassword: async (password) => { fail((await sb.auth.updateUser({ password })).error); },
  signOut: async () => { fail((await sb.auth.signOut()).error); },
};

const rpc = async (fn, args) => { const { data, error } = await sb.rpc(fn, args); fail(error); return data; };
export const api = {
  getState: () => rpc("get_state"),
  openBooster: () => rpc("open_booster"),
  recordDuel: (won) => rpc("record_duel", { won }),
  importLocal: (save) => rpc("import_local", { save }),
  setUsername: async (username, uid) => { fail((await sb.from("profiles").update({ username }).eq("id", uid)).error); },
};

export function providerLabel(user) {
  const p = user?.app_metadata?.provider; return p === "google" ? "Google" : p === "discord" ? "Discord" : "e-mail";
}

// Fournisseurs de connexion réellement activés dans le projet (Google, Discord) : évite d'afficher un bouton qui ne marche pas.
let provCache = null;
export async function enabledProviders() {
  if (provCache) return provCache;
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SUPABASE_ANON_KEY } });
    const d = await r.json(); provCache = ["google", "discord"].filter((p) => d.external?.[p]);
  } catch (_) { provCache = []; }
  return provCache;
}
