// Configuration des comptes (Supabase). Ces deux valeurs sont PUBLIQUES par conception :
// la sécurité repose sur les règles du serveur (voir supabase/schema.sql), pas sur le secret de la clé.
// Tant qu'elles sont vides, le jeu fonctionne en mode invité (progression dans le navigateur) et le bouton de connexion est masqué.
// Où les trouver : Supabase → Project Settings → API → « Project URL » et « anon public ».
export const SUPABASE_URL = "";
export const SUPABASE_ANON_KEY = "";
