---
labels: [wayfinder:map]
title: Pubblicare su @FlashShoppBot come persona, non come bot
---

## Destination

Una decisione chiara e completa su come, premendo «Pubblica», l'account Telegram personale del proprietario invii in automatico foto + «titolo, prezzo€» nella chat privata con @FlashShoppBot (oggi è il bot che scrive in chat). Alla fine della mappa non resta nulla da decidere prima di scrivere il codice.

## Notes

- Dominio: PWA su Cloudflare Pages (Functions + KV), vedi `functions/api/publish.js` e `lib/server/telegram.js` per l'invio attuale via Bot API.
- Risposte del proprietario: @FlashShoppBot è suo; i messaggi devono partire dal **suo** account personale; invio **automatico** (accettato il login una tantum con codice di Telegram e il rischio di limitazioni).
- Tracker: file markdown in `.wayfinder/invio-come-utente/` (GitHub non raggiungibile dalla sessione che ha creato la mappa). Blocchi: riga `blocked-by:` nel front matter. Presa in carico: `assignee:`. Chiusura: `status: closed` + sezione `## Resolution`.
- Ticket «grilling»: usare le skill «grilling» e «domain-modeling».

## Decisions so far

- [Regole e rischi di Telegram per un account personale automatizzato](02-regole-telegram-account-automatici.md): consentito, rischio basso a questo ritmo; evitare numeri nuovi/VoIP, sessioni multiple, IP variabili; un api_id per numero.

## Not yet specified

- Cosa vede il gestore quando l'account del proprietario è scollegato o la sessione scade (blocco dell'app? avviso? coda di invii?).
- Come passare dalla configurazione attuale (token del bot obbligatorio al primo accesso) a quella nuova senza rompere i siti già configurati.
- Limiti di frequenza e gestione errori/ritentativi degli invii dall'account personale.

## Out of scope

- Cambiare cosa fa @FlashShoppBot con i messaggi che riceve: il bot e il suo backend restano come sono.
