---
id: 02
title: Regole e rischi di Telegram per un account personale automatizzato
labels: [wayfinder:research]
parent: map
status: closed
assignee:
blocked-by: []
---

## Question

Cosa dicono i termini di Telegram (API Terms of Service, uso delle API client con account utente) sugli invii automatici da un account personale verso il proprio bot? Quali limiti di frequenza (flood wait) valgono per ~5–10 messaggi con foto ogni 30 minuti, e quali comportamenti portano a limitazioni o ban? Serve registrare un'app su my.telegram.org e con quali dati?

Context: risultati sul branch `research/regole-telegram`, file `research/regole-telegram.md`.

## Resolution

Consentito: i termini delle API vietano spam, flood e numeri gonfiati, non l'automazione del proprio account; gli account con client non ufficiali però sono «sotto osservazione». Rischio basso a ≤10 foto ogni 30 minuti inviate in sequenza. `FLOOD_WAIT` → attendere i secondi indicati e riprovare; `PEER_FLOOD` → account limitato, fermarsi. Da evitare: numeri nuovi o VoIP, invii di massa o a sconosciuti, login con QR da client non ufficiale, sessioni copiate o multiple, IP che cambiano spesso. my.telegram.org: un api_id per numero; titolo, nome breve (5–32 caratteri) e piattaforma obbligatori, niente «Telegram» nel nome; api_id/api_hash solo lato server. Checklist in 7 passi nel file di ricerca (2FA attiva, /start al bot, un solo login dal server). Fonti ufficiali lette solo da estratti: il proprietario rilegga https://core.telegram.org/api/terms e https://core.telegram.org/api/obtaining_api_id.
