---
id: 06
title: Che fine fa il token del bot
labels: [wayfinder:grilling]
parent: map
status: closed
assignee: zsurann
blocked-by: []
---

## Question

Se i messaggi partono dall'account del proprietario, il token del bot serve ancora (oggi è obbligatorio al primo accesso del gestore)? Va tolto, reso facoltativo, o tenuto per altro (es. verificare che @FlashShoppBot riceva i messaggi)? E la scelta della «chat di destinazione» nelle impostazioni: diventa fissa su @FlashShoppBot o resta configurabile?

## Resolution

Deciso dal proprietario (2026-11-14):
- **Token del bot eliminato**: non serve più per inviare. Via dal primo accesso del gestore e dalle Impostazioni (insieme a «Trova» chat e «Messaggio di prova» via bot).
- **Destinazione fissa: @FlashShoppBot.** Niente scelta della chat nelle Impostazioni.
- **Primo accesso del gestore senza account collegato**: il gestore crea la password ed entra, vede e scarta gli articoli; «Pubblica» resta bloccato con l'avviso «In attesa che il proprietario colleghi l'account Telegram». Lo stesso vale se l'account viene scollegato in seguito.
