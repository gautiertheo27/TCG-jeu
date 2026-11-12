// Onglet Amis + défis : recherche de joueurs par pseudo, demandes d'ami, joueurs en ligne, invitation à un duel et poignée de main.
import { makeNet, api } from "./account.js";

const $ = (s, r = document) => r.querySelector(s);

export function initFriends({ S, toast, esc, duel, modal, closeModal, showTab }) {
  let me = null, lobby = null, net = null, online = new Map(), friends = { friends: [], incoming: [], outgoing: [] }, poll = null;
  let busy = false;                                    // en duel ou en train d'inviter
  let pending = null;                                  // défi que j'ai envoyé : { to, matchId, timer, mc }
  const dot = (id) => (online.has(id) ? (online.get(id).busy ? "🟡" : "🟢") : "⚪");
  const isOnline = (id) => online.has(id);

  // ---------- connexion / déconnexion ----------
  async function start(user, username) {
    stop(); me = { id: user.id, name: username || "Joueur" }; net = makeNet();
    lobby = net.joinLobby(me, { onInvite, onReply, onPresence: (list) => { online = new Map(list.filter((u) => u.id !== me.id).map((u) => [u.id, u])); render(); } });
    await refresh(); poll = setInterval(refresh, 20000);
  }
  function stop() { clearInterval(poll); try { lobby?.leave(); } catch (_) {} lobby = null; me = null; online = new Map(); friends = { friends: [], incoming: [], outgoing: [] }; busy = false; pending = null; render(); }
  async function refresh() { if (!me) return; try { friends = await api.friendsList(); } catch (e) { console.error(e); } render(); }
  const setBusy = (b) => { busy = b; lobby?.setBusy(b); render(); };

  // ---------- recherche et amis ----------
  let results = [];
  async function search() {
    const q = $("#friSearch").value.trim(); if (q.length < 2) { results = []; render(); return toast("Tape au moins 2 lettres."); }
    try { results = await api.searchPlayers(q); } catch (e) { return toast("Recherche impossible : " + e.message); }
    if (!results.length) toast("Aucun joueur trouvé avec ce pseudo."); render();
  }
  async function act(fn, okMsg) { try { await fn(); if (okMsg) toast(okMsg); } catch (e) { toast(e.message); } await refresh(); if ($("#friSearch").value.trim().length >= 2) results = await api.searchPlayers($("#friSearch").value.trim()).catch(() => results); render(); }
  const row = (u, buttons) => `<div class="fri-row"><span class="fri-dot" title="${isOnline(u.id) ? (online.get(u.id).busy ? "en duel" : "en ligne") : "hors ligne"}">${dot(u.id)}</span>
    ${u.avatar ? `<img class="fri-av" src="${esc(u.avatar)}" alt="" referrerpolicy="no-referrer">` : '<span class="fri-av ph">👤</span>'}<b>${esc(u.username)}</b><span class="fri-btns">${buttons}</span></div>`;
  const duelBtn = (u) => (isOnline(u.id) && !online.get(u.id).busy && !busy ? `<button class="btn primary sm" data-duel="${u.id}" data-name="${esc(u.username)}">⚔ Défier</button>` : `<button class="btn sm" disabled>${isOnline(u.id) ? "en duel" : "hors ligne"}</button>`);
  function render() {
    if (!$("#friList")) return;
    const sect = (id, html, empty) => { $(id).innerHTML = html || `<p class="muted small">${empty}</p>`; };
    sect("#friIncoming", friends.incoming.map((u) => row(u, `<button class="btn primary sm" data-acc="${u.id}">Accepter</button><button class="btn sm" data-ref="${u.id}">Refuser</button>`)).join(""), "Aucune demande reçue.");
    sect("#friList", friends.friends.map((u) => row(u, `${duelBtn(u)}<button class="btn sm danger" data-rem="${u.id}" title="Retirer des amis">✕</button>`)).join(""), "Pas encore d'ami : cherche un pseudo ci-dessus.");
    sect("#friOutgoing", friends.outgoing.map((u) => row(u, `<span class="muted small">en attente…</span><button class="btn sm" data-rem="${u.id}">Annuler</button>`)).join(""), "Aucune demande envoyée.");
    sect("#friResults", results.map((u) => row(u, (u.relation === "none" ? `<button class="btn sm" data-add="${u.id}">+ Ami</button>` : u.relation === "pending_out" ? '<span class="muted small">demande envoyée</span>' : u.relation === "pending_in" ? `<button class="btn primary sm" data-acc="${u.id}">Accepter</button>` : '<span class="muted small">ami ✓</span>') + duelBtn(u))).join(""), "");
    const others = [...online.values()].filter((u) => !friends.friends.some((f) => f.id === u.id)).slice(0, 12);
    sect("#friOnline", others.map((u) => row({ id: u.id, username: u.name }, duelBtn({ id: u.id, username: u.name }))).join(""), "Personne d'autre en ligne pour l'instant.");
    $("#friCount").textContent = `${friends.friends.filter((f) => isOnline(f.id)).length} ami(s) en ligne`;
    const badge = $("#friBadge"); badge.textContent = friends.incoming.length; badge.classList.toggle("hidden", !friends.incoming.length);
  }
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-add],[data-acc],[data-ref],[data-rem],[data-duel]"); if (!t || !me) return;
    if (t.dataset.add) act(() => api.friendRequest(t.dataset.add), "Demande envoyée ✔");
    else if (t.dataset.acc) act(() => api.friendRespond(t.dataset.acc, true), "Vous êtes amis ✔");
    else if (t.dataset.ref) act(() => api.friendRespond(t.dataset.ref, false));
    else if (t.dataset.rem) { if (confirm("Retirer cette personne ?")) act(() => api.friendRemove(t.dataset.rem)); }
    else if (t.dataset.duel) challenge(t.dataset.duel, t.dataset.name);
  });
  $("#friSearchBtn").addEventListener("click", search);
  $("#friSearch").addEventListener("keydown", (e) => { if (e.key === "Enter") search(); });

  // ---------- défi : celui qui invite ----------
  const deckSelect = (id) => duel.deckPickerHTML(id);
  function challenge(toId, toName) {
    if (busy || pending) return toast("Tu es déjà en train d'inviter ou de jouer.");
    modal(`<h3>Défier ${esc(toName)}</h3><p class="muted small">Choisis ton deck. L'invitation expire au bout de 30 secondes.</p><div class="muted small">Ton deck</div>${deckSelect("chDeck")}
      <div class="btn-row"><button class="btn primary" id="chGo">Envoyer le défi</button><button class="btn" data-close>Annuler</button></div>`, (m) => {
      duel.wireDeckPicker(m);
      m.querySelector("#chGo").addEventListener("click", () => {
        const deck = duel.deckFor(m.querySelector("#chDeck").value), errs = duel.deckProblems(deck);
        if (errs.length) return toast(errs[0] + (m.querySelector("#chDeck").value === "collection" ? " Choisis un deck prêté ou ouvre des boosters." : ""));
        sendChallenge(toId, toName, deck);
      });
    });
  }
  function sendChallenge(toId, toName, deck) {
    const matchId = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now());
    const mc = net.openMatch(matchId, me, { onPeerLeft: () => duel.opponentLeft() }); const handshake = [];
    pending = { to: toId, matchId, mc, deck };
    setBusy(true); lobby.invite(toId, matchId, { deckName: deck.name || "ton deck" });
    pending.timer = setTimeout(() => { if (pending?.matchId === matchId) { cancelPending(); toast(`${toName} n'a pas répondu.`); } }, 30000);
    modal(`<h3>En attente de ${esc(toName)}…</h3><p class="muted">Il doit accepter le défi.</p><div class="btn-row"><button class="btn" id="chCancel">Annuler</button></div>`, (m) => m.querySelector("#chCancel").addEventListener("click", () => cancelPending()));
    // Poignée de main : l'invité répond { k:'hello', deck } sur le canal du match ; on lance alors la partie.
    mc.onMessage((m) => {
      if (m.k === "hello" && pending?.matchId === matchId) {
        const errs = duel.deckProblems(m.deck); if (errs.length) { toast("Le deck de l'adversaire est invalide : " + errs[0]); return cancelPending(); }
        clearTimeout(pending.timer); closeModal();
        const seed = Math.floor(Math.random() * 2 ** 31), names = [me.name, toName], decks = [deck, m.deck];
        mc.send({ k: "start", seed, decks, names });
        begin({ seat: 0, seed, decks, names, mc, matchId });
      } else handshake.push(m);                                  // messages de jeu arrivés trop tôt : rejoués au démarrage
    });
    pending.handshake = handshake;
  }
  function cancelPending() { if (!pending) return; clearTimeout(pending.timer); try { pending.mc.close(); } catch (_) {} pending = null; closeModal(); setBusy(false); }
  function onReply(r) { if (pending && r.matchId === pending.matchId && !r.ok) { const n = r.fromName || "Le joueur"; cancelPending(); toast(`${n} a refusé le défi.`); } }

  // ---------- défi : celui qui est invité ----------
  let incoming = null;
  function onInvite(inv) {
    if (busy || incoming || !me || duel.isPlaying()) return lobby.reply(inv.from, inv.matchId, false);
    incoming = inv; sfxPing();
    modal(`<h3>⚔ ${esc(inv.fromName)} te défie !</h3><p class="muted small">Choisis ton deck pour accepter.</p><div class="muted small">Ton deck</div>${deckSelect("inDeck")}
      <div class="btn-row"><button class="btn primary" id="inYes">Accepter</button><button class="btn" id="inNo">Refuser</button></div>`, (m) => {
      duel.wireDeckPicker(m);
      m.querySelector("#inNo").addEventListener("click", () => { lobby.reply(inv.from, inv.matchId, false); incoming = null; closeModal(); });
      m.querySelector("#inYes").addEventListener("click", () => accept(inv, m.querySelector("#inDeck").value));
    });
    setTimeout(() => { if (incoming === inv) { incoming = null; closeModal(); } }, 30000);       // l'invitation expire
  }
  function accept(inv, deckValue) {
    const deck = duel.deckFor(deckValue), errs = duel.deckProblems(deck);
    if (errs.length) return toast(errs[0] + (deckValue === "collection" ? " Choisis un deck prêté ou ouvre des boosters." : ""));
    incoming = null; closeModal(); setBusy(true);
    const mc = net.openMatch(inv.matchId, me, { onPeerLeft: () => duel.opponentLeft() }); const early = [];
    mc.onMessage((m) => {
      if (m.k === "start") { begin({ seat: 1, seed: m.seed, decks: m.decks, names: m.names, mc, matchId: inv.matchId, early }); }
      else early.push(m);
    });
    mc.ready.then(() => { lobby.reply(inv.from, inv.matchId, true); mc.send({ k: "hello", deck }); });
  }
  const sfxPing = () => { try { navigator.vibrate?.(200); } catch (_) {} };

  // ---------- lancement de la partie ----------
  function begin({ seat, seed, decks, names, mc, matchId, early = [] }) {
    const errs = [...duel.deckProblems(decks[0]), ...duel.deckProblems(decks[1])];
    if (errs.length) { toast("Deck invalide : " + errs[0]); try { mc.close(); } catch (_) {} pending = null; return setBusy(false); }
    const early2 = [...early, ...(pending?.handshake || [])]; pending = null; showTab("duel"); setBusy(true);
    duel.startOnline({ seat, seed, decks, names, net: mc, onEnd: () => { setBusy(false); } }).then(() => {}).catch((e) => { console.error(e); setBusy(false); });
    // les messages de jeu arrivés avant la création de la synchronisation sont rejoués
    setTimeout(() => { const s = window.__gmSync; if (s) early2.forEach((m) => s._recv(m)); }, 0);
  }
  return { start, stop, refresh, render };
}
