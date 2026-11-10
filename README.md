# Sacrilab 3D Print Shop Manager

PWA per scegliere i modelli 3D più vendibili da [MakerWorld](https://makerworld.com/it), dare un prezzo e pubblicarli sul bot Telegram [@FlashShoppBot](https://t.me/FlashShoppBot) con foto e didascalia «titolo, prezzo€».

## Come funziona

```
GitHub Actions (3 volte al giorno)          GitHub Pages                      Telegram
┌──────────────────────────────┐   commit   ┌──────────────────────┐  sendPhoto  ┌──────────────┐
│ scraper/ (Playwright)        │ ─────────▶ │ PWA + data/products  │ ──────────▶ │ @FlashShoppBot│
│ MakerWorld → selezione       │            │ prezzo / scarta      │             │ foto + "titolo, 7€" │
└──────────────────────────────┘            └──────────────────────┘             └──────────────┘
```

1. **Scraper** (`scraper/`): un browser headless visita MakerWorld (pagine di tendenza e ricerche per categoria), intercetta le risposte JSON del sito e raccoglie i modelli con statistiche (download, stampe, like, collezioni).
2. **Selezione** (`scraper/score.mjs`): ogni modello riceve un punteggio di vendibilità da 35 a 99 basato su:
   - popolarità (download, stampe, like, collezioni, commenti, in scala logaritmica);
   - rapporto stampe/download e like/download (modelli che le persone stampano davvero);
   - novità (pubblicati negli ultimi 30/90 giorni);
   - parole chiave che indicano oggetti utili, da regalo, da esposizione o facili da stampare.
   
   Vengono **esclusi**: modelli con proprietà intellettuale di terzi (Pokémon, Marvel, Disney, marchi auto…), ricambi per stampanti e file di test, modelli con licenza *NonCommercial*, modelli poco popolari. La selezione è bilanciata tra 11 categorie (Casa, Cucina, Utensili, Gadget, Tech, Decorazione, Giochi, Giardino, Veicoli, Animali, Regali).
3. **App**: mostra gli articoli selezionati; per ognuno puoi modificare il titolo, inserire il prezzo (solo il numero, in euro) e premere **Pubblica**, oppure **Scarta**. Pubblicati e scartati spariscono dalla lista e restano consultabili nelle rispettive schede (con possibilità di ripristino).

Tutte le regole (categorie, parole chiave, limiti) sono in `scraper/config.mjs`.

## Messa online

1. Crea la repository su GitHub e carica questo progetto:
   ```bash
   git remote add origin https://github.com/<utente>/sacrilab-3d-print-shop-manager.git
   git push -u origin main
   ```
2. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
3. **Settings → Actions → General → Workflow permissions: Read and write.**
4. **Actions → «Aggiorna catalogo MakerWorld» → Run workflow** per generare subito il primo catalogo (poi gira da solo alle 05:17, 11:17 e 17:17 UTC).
5. Apri `https://<utente>.github.io/sacrilab-3d-print-shop-manager/` e installa l'app:
   - **iPhone**: Safari → Condividi → *Aggiungi alla schermata Home*;
   - **Android**: Chrome → menu → *Installa app*;
   - **PC**: icona di installazione nella barra degli indirizzi di Chrome/Edge.

Se lo scraper non trova modelli (ad es. MakerWorld cambia struttura o blocca l'accesso), il catalogo esistente non viene sovrascritto. Avvia il workflow con l'opzione **debug** per ottenere screenshot e log delle API tra gli *artifact* dell'esecuzione.

## Configurare Telegram

1. Recupera il token del bot da [@BotFather](https://t.me/BotFather) (`/mybots` → FlashShoppBot → *API Token*).
2. Nell'app apri **Impostazioni** e incolla il token.
3. Scrivi un messaggio qualsiasi al bot (o aggiungilo al gruppo/canale dove vuoi pubblicare, come amministratore), poi premi **Trova** e seleziona la chat.
4. Premi **Invia messaggio di prova**, poi **Salva**.

Il token è salvato solo nel browser del dispositivo (localStorage), non nella repository. Configuralo su ogni dispositivo che usi. Lo stato (pubblicati/scartati) si può trasferire con **Esporta/Importa stato**.

Il formato della didascalia è personalizzabile (`{titolo}`, `{prezzo}`, `{link}`); quello predefinito è `{titolo}, {prezzo}€` → `supporto tagliere, 7€`.

## Sviluppo locale

```bash
python3 -m http.server 8080
```

```bash
cd scraper && npm install && npx playwright install chromium && npm test && npm run scrape
```

## Nota sulle licenze

Prima di vendere una stampa controlla sempre la licenza del modello su MakerWorld (badge mostrato su ogni scheda e link «apri su MakerWorld»): l'esclusione automatica copre le licenze *NonCommercial* esplicite, ma alcuni autori pongono condizioni aggiuntive.
