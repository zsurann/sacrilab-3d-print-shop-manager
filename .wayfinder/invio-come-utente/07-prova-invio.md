---
id: 07
title: Prova di invio dall'account personale a @FlashShoppBot
labels: [wayfinder:prototype]
parent: map
status: open
assignee: zsurann
blocked-by: [03, 04]
---

## Question

Un prototipo minimo che, con le credenziali reali del proprietario, invia una foto di MakerWorld con «titolo, prezzo€» a @FlashShoppBot dal suo account, in un Worker separato con Durable Object (mtcute) sul **piano gratuito** di Cloudflare. Serve a confermare che il piano gratuito basta (CPU per richiesta) e che la soluzione regge (tempi, errori, aspetto del messaggio nella chat) prima di decidere i dettagli finali.

Asset: prototipo sul branch `prototype/invio-come-utente`, cartella `sender/` (istruzioni in `sender/PROVA.md`). Verificato in locale: compila (≈450 KB gzip), parte nel runtime Cloudflare, chiave e cifratura della sessione funzionano, errori chiari con timeout di 25 s. Non verificato: connessione reale a Telegram e CPU sul piano gratuito (rete bloccata nella sessione) → li misura il proprietario.
