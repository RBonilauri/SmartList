// SmartList : envoie la liste « à acheter » d'une liste partagée en notification
// push à tous les téléphones qui l'ont rejointe et ont activé les notifications.
//
// Secrets à définir dans Supabase (Edge Functions → Secrets) :
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (https://… ou mailto:…)
// SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont fournis automatiquement.
// La vérification JWT doit être désactivée : l'appli appelle avec la clé publique.

import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const SUBJECT = Deno.env.get("VAPID_SUBJECT") || "https://rbonilauri.github.io/SmartList/";
const MAX_LINES = 25;
const collator = new Intl.Collator("fr", { sensitivity: "base", numeric: true });

const db = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Même mise en forme que l'aperçu et les notifications locales (index.html).
function format(name: string, items: string[], note = "", from = "") {
  const sorted = items.map((s) => s.trim()).filter(Boolean).sort(collator.compare);
  const n = sorted.length;
  const lines = sorted.slice(0, MAX_LINES).map((s) => "• " + s);
  if (n > MAX_LINES) lines.push(`… et ${n - MAX_LINES} autre${n - MAX_LINES > 1 ? "s" : ""}`);
  return {
    title: `🛒 ${name} · ${n === 0 ? "rien à acheter" : n + " à acheter"}`,
    body: [note ? "💬 " + (from ? from + " : " : "") + note : "", n === 0 ? "Tout est dans le panier." : lines.join("\n")]
      .filter(Boolean).join("\n"),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply(405, { message: "Méthode non autorisée." });
  if (!PUBLIC_KEY || !PRIVATE_KEY) return reply(500, { message: "Clés VAPID absentes des secrets de la fonction." });

  let input: { code?: unknown; to?: unknown; note?: unknown; from?: unknown } = {};
  try { input = await req.json(); } catch { /* corps illisible */ }
  const code = input.code;
  if (typeof code !== "string" || !/^[a-z0-9-]{8,64}$/.test(code)) return reply(400, { message: "Code de liste invalide." });
  // Destinataires choisis (identifiants de sl_push_members) ; absent = tout le monde.
  let to: string[] | null = null;
  if (input.to !== undefined) {
    if (!Array.isArray(input.to) || input.to.length > 50 || !input.to.every((x) => typeof x === "string" && /^[0-9a-f]{16}$/.test(x))) {
      return reply(400, { message: "Destinataires invalides." });
    }
    if (!input.to.length) return reply(400, { message: "Choisis au moins un destinataire." });
    to = input.to as string[];
  }
  const clip = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
  const note = clip(input.note, 120), from = clip(input.from, 30);

  const { data, error } = await db.rpc("sl_notify_prepare", { p_code: code });
  if (error) return reply(500, { message: error.message });
  if (!data.allowed) return reply(429, { message: "Liste déjà envoyée il y a un instant.", retry_after: data.retry_after });

  const msg = format(data.name || "Liste partagée", data.items ?? [], note, from);
  const payload = JSON.stringify({ ...msg, tag: "smartlist-" + code, url: "./?list=" + code });

  webpush.setVapidDetails(SUBJECT, PUBLIC_KEY, PRIVATE_KEY);
  const all: { id: string; endpoint: string; keys: { p256dh: string; auth: string } }[] = data.subs ?? [];
  const subs = to ? all.filter((s) => to!.includes(s.id)) : all;
  const gone: string[] = [];
  const results = await Promise.allSettled(
    subs.map((s) =>
      webpush.sendNotification(s, payload, { TTL: 6 * 3600, urgency: "high" }).catch((e: { statusCode?: number }) => {
        if (e && (e.statusCode === 404 || e.statusCode === 410)) gone.push(s.endpoint);
        else console.error("Envoi refusé", s.endpoint.slice(0, 60), e);
        throw e;
      })
    ),
  );
  // Abonnements expirés (application désinstallée, notifications retirées) : on les oublie.
  if (gone.length) await db.rpc("sl_push_forget", { p_endpoints: gone });

  const sent = results.filter((r) => r.status === "fulfilled").length;
  return reply(200, { sent, total: subs.length, expired: gone.length });
});
