---
id: 04
title: Dove gira l'invio dall'account personale
labels: [wayfinder:grilling]
parent: map
status: closed
assignee: zsurann
blocked-by: [01]
---

## Question

Sulla base della ricerca sulla fattibilità: l'invio dall'account del proprietario parte dalle Functions di Cloudflare, dal browser di chi preme «Pubblica», o da un servizio separato sempre acceso? Pesare: funziona da qualsiasi dispositivo, chi può vedere la sessione dell'account (il gestore non deve avere accesso all'account personale del proprietario), costi, affidabilità.

## Resolution

Deciso dal proprietario (2026-11-14): l'invio gira in un **servizio separato su Cloudflare, piano gratuito**: un Worker con Durable Object che esegue mtcute con la sessione dell'account personale, chiamato da `functions/api/publish.js`. La sessione resta solo lì: né il browser né il gestore la vedono. La gratuità va confermata dalla prova di invio; se il piano gratuito non regge, si torna su questa scelta (alternativa già valutata: piano Workers Paid, 5 $/mese). Scartati: browser (sicurezza), server sempre acceso (manutenzione).

Se l'invio dall'account fallisce: **blocca e avvisa**. «Pubblica» mostra l'errore e l'articolo resta da valutare; nessun ripiego sul bot.
