// Transport des duels en ligne. Deux versions : Supabase Realtime (vraie) et BroadcastChannel (tests, entre deux onglets).
// Interface commune :
//   joinLobby(me, { onInvite, onReply, onPresence }) -> { invite(to, matchId, info), reply(to, matchId, ok), setBusy(b), leave() }
//   openMatch(matchId, me, { onPeerLeft }) -> { ready: Promise, send(msg), onMessage(fn), close() }
// Les messages reçus avant d'avoir branché onMessage sont gardés puis rejoués.

export function realNet(sb) {
  return {
    joinLobby(me, h) {
      const ch = sb.channel("gm-lobby", { config: { broadcast: { self: false }, presence: { key: me.id } } });
      let busy = false;
      ch.on("broadcast", { event: "invite" }, ({ payload }) => { if (payload.to === me.id) h.onInvite?.(payload); });
      ch.on("broadcast", { event: "reply" }, ({ payload }) => { if (payload.to === me.id) h.onReply?.(payload); });
      ch.on("presence", { event: "sync" }, () => h.onPresence?.(Object.values(ch.presenceState()).flat()));
      const track = () => ch.track({ id: me.id, name: me.name, busy });
      ch.subscribe((status) => { if (status === "SUBSCRIBED") track(); });
      const send = (event, payload) => ch.send({ type: "broadcast", event, payload: { ...payload, from: me.id, fromName: me.name } });
      return {
        invite: (to, matchId, info = {}) => send("invite", { to, matchId, ...info }),
        reply: (to, matchId, ok) => send("reply", { to, matchId, ok }),
        setBusy: (b) => { busy = b; track(); },
        leave: () => sb.removeChannel(ch),
      };
    },
    openMatch(matchId, me, h = {}) {
      const ch = sb.channel("gm-match-" + matchId, { config: { broadcast: { self: false, ack: true }, presence: { key: me.id } } });
      let handler = null; const buf = [];
      ch.on("broadcast", { event: "m" }, ({ payload }) => (handler ? handler(payload) : buf.push(payload)));
      ch.on("presence", { event: "leave" }, ({ key }) => { if (key !== me.id) h.onPeerLeft?.(); });
      const ready = new Promise((res) => ch.subscribe((st) => { if (st === "SUBSCRIBED") { ch.track({ id: me.id }); res(); } }));
      return {
        ready,
        send: (m) => ch.send({ type: "broadcast", event: "m", payload: m }),
        onMessage: (fn) => { handler = fn; buf.splice(0).forEach(fn); },
        close: () => sb.removeChannel(ch),
      };
    },
  };
}

// Version de test : deux onglets du même navigateur (BroadcastChannel). La présence est simulée par des signaux réguliers.
export function localNet() {
  return {
    joinLobby(me, h) {
      const bc = new BroadcastChannel("gm-lobby"); const seen = new Map(); let busy = false;
      const emit = () => h.onPresence?.([...seen.values()].filter((u) => Date.now() - u.t < 3000).map(({ t, ...u }) => u).concat([{ id: me.id, name: me.name, busy }]));
      const hello = () => bc.postMessage({ k: "hello", u: { id: me.id, name: me.name, busy } });
      bc.onmessage = ({ data }) => {
        if (data.k === "hello") { seen.set(data.u.id, { ...data.u, t: Date.now() }); emit(); }
        else if (data.k === "invite" && data.p.to === me.id) h.onInvite?.(data.p);
        else if (data.k === "reply" && data.p.to === me.id) h.onReply?.(data.p);
      };
      const timer = setInterval(() => { hello(); emit(); }, 800); hello();
      const send = (k, p) => bc.postMessage({ k, p: { ...p, from: me.id, fromName: me.name } });
      return { invite: (to, matchId, info = {}) => send("invite", { to, matchId, ...info }), reply: (to, matchId, ok) => send("reply", { to, matchId, ok }),
        setBusy: (b) => { busy = b; hello(); }, leave: () => { clearInterval(timer); bc.close(); } };
    },
    openMatch(matchId, me, h = {}) {
      const bc = new BroadcastChannel("gm-match-" + matchId); let handler = null; const buf = [];
      bc.onmessage = ({ data }) => { if (data.k === "bye") return h.onPeerLeft?.(); if (data.from === me.id) return; handler ? handler(data.m) : buf.push(data.m); };
      return { ready: Promise.resolve(), send: (m) => bc.postMessage({ from: me.id, m }), onMessage: (fn) => { handler = fn; buf.splice(0).forEach(fn); },
        close: () => { bc.postMessage({ k: "bye" }); bc.close(); } };
    },
  };
}
