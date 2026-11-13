---
id: 01
title: Un account Telegram personale può inviare da Cloudflare Pages Functions?
labels: [wayfinder:research]
parent: map
status: closed
assignee:
blocked-by: []
---

## Question

Una libreria client MTProto (es. GramJS / pacchetto npm `telegram`, o alternative) può girare dentro Cloudflare Pages Functions / Workers per inviare una foto con didascalia da un account utente? Verificare: trasporto (niente TCP grezzo, serve WebSocket), compatibilità del runtime Workers, limiti di CPU del piano gratuito (10 ms) e a pagamento, tempi di connessione per singola richiesta, salvataggio della sessione (StringSession) in KV. Se non è fattibile, quali alternative realistiche esistono (browser con GramJS, piccolo server sempre acceso, Durable Objects).

Context: risultati sul branch `research/mtproto-su-cloudflare`, file `research/mtproto-su-cloudflare.md`.

## Resolution

Fattibile, ma non nelle Pages Functions del piano gratuito. Il trasporto non è un problema: i Workers aprono TCP in uscita (`connect()` / `node:net` con `nodejs_compat`) e WebSocket. Il limite è la CPU: 10 ms per richiesta sul piano gratuito non bastano nemmeno a caricare la libreria (~210–250 ms misurati in Node). Sul piano a pagamento (5 $/mese, 30 s di CPU) funziona: sessione salvata come segreto, foto inviata per URL (la scarica Telegram). Libreria consigliata: mtcute (mantenuta, crypto WASM, dichiara supporto Workers); GramJS è archiviato dal 14/07/2026. Opzione consigliata: un Worker separato con Durable Object che esegue mtcute, chiamato da `functions/api/publish.js` tramite binding; i Durable Objects SQLite sono nel piano gratuito con 30 s di CPU per richiesta, ma va confermato con un prototipo, altrimenti piano a pagamento. Escluso il client nel browser (chi ha la sessione controlla l'intero account). Server sempre acceso come ripiego. Non verificato: nessuna prova reale con Telegram né su Workers.
