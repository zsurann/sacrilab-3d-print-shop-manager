---
id: 05
title: Come si collega l'account del proprietario e dove si custodisce la sessione
labels: [wayfinder:grilling]
parent: map
status: closed
assignee: zsurann
blocked-by: [04]
---

## Question

Chi collega l'account (solo il proprietario, entrato con la sua password?), con quale flusso (numero → codice di Telegram → eventuale password 2FA) e dove viene salvata la sessione (che dà accesso completo all'account): cifrata in KV, segreto Cloudflare, altro? Come si scollega o si revoca.

## Resolution

Deciso dal proprietario (2026-11-14):
- **Collegamento dentro l'app**, nelle Impostazioni: numero di telefono → codice inviato da Telegram → password della verifica in due passaggi. Il login avviene dal servizio di invio su Cloudflare (un solo login, sempre dallo stesso posto, come da ricerca sulle regole).
- **Solo il proprietario** (entrato con la sua password) vede i comandi collega / ricollega / scollega. Il gestore vede solo lo stato «account collegato / non collegato».
- **La sessione resta solo nel servizio di invio** (memoria privata del Durable Object, cifrata). Il sito e il suo database KV non la vedono mai.
- Scollegamento: pulsante «Scollega» nell'app (chiude la sessione e la cancella); in emergenza anche da Telegram → Impostazioni → Dispositivi → termina la sessione.

Punto lasciato alla prova di invio: dove stanno api_id e api_hash (proposta: segreti del servizio di invio su Cloudflare).
