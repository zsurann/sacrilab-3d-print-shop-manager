---
id: 01
title: Un account Telegram personale può inviare da Cloudflare Pages Functions?
labels: [wayfinder:research]
parent: map
status: open
assignee:
blocked-by: []
---

## Question

Una libreria client MTProto (es. GramJS / pacchetto npm `telegram`, o alternative) può girare dentro Cloudflare Pages Functions / Workers per inviare una foto con didascalia da un account utente? Verificare: trasporto (niente TCP grezzo, serve WebSocket), compatibilità del runtime Workers, limiti di CPU del piano gratuito (10 ms) e a pagamento, tempi di connessione per singola richiesta, salvataggio della sessione (StringSession) in KV. Se non è fattibile, quali alternative realistiche esistono (browser con GramJS, piccolo server sempre acceso, Durable Objects).

Context: ricerca in corso sul branch `research/mtproto-su-cloudflare` (file `research/mtproto-su-cloudflare.md`).
