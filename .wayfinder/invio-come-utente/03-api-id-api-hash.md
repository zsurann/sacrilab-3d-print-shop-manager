---
id: 03
title: Ottenere api_id e api_hash del proprietario da my.telegram.org
labels: [wayfinder:task]
parent: map
status: closed
assignee: zsurann
blocked-by: [02]
---

## Question

Il proprietario registra un'applicazione su https://my.telegram.org (API development tools) con il suo numero e conserva api_id e api_hash in un posto sicuro (non nel repository). Serve prima di qualsiasi prova reale di invio. Checklist precisa da preparare dopo la ricerca sulle regole.

## Resolution

Fatto dal proprietario (2026-11-14): app registrata su my.telegram.org con il suo numero personale, api_id e api_hash salvati da lui fuori dal repository (posto non indicato in chat), checklist della ricerca seguita (2FA attiva, /start inviato a @FlashShoppBot). I valori serviranno come segreti lato server nella prova di invio; non vanno mai scritti nel repository né in chat.
