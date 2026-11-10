# Sacrilab 3D Print Shop Manager

PWA per scegliere i modelli 3D più vendibili da [MakerWorld](https://makerworld.com/it), dare un prezzo e pubblicarli sul bot Telegram [@FlashShoppBot](https://t.me/FlashShoppBot) con foto e didascalia «titolo, prezzo€».

## Come funziona

- **GitHub Actions** (3 volte al giorno) analizza MakerWorld e salva la selezione in `data/products.json`.
- **Cloudflare Pages** pubblica l'app e si aggiorna da solo a ogni nuovo catalogo.
- **L'app** invia a Telegram foto + «titolo, prezzo€» tramite @FlashShoppBot.

1. **Scraper** (`scraper/`): un browser headless visita MakerWorld (pagine di tendenza e ricerche per categoria), intercetta le risposte JSON del sito e raccoglie i modelli con statistiche (download, stampe, like, collezioni).
2. **Selezione** (`scraper/score.mjs`): ogni modello riceve un punteggio di vendibilità da 35 a 99 basato su:
   - popolarità (download, stampe, like, collezioni, commenti, in scala logaritmica);
   - rapporto stampe/download e like/download (modelli che le persone stampano davvero);
   - novità (pubblicati negli ultimi 30/90 giorni);
   - parole chiave che indicano oggetti utili, da regalo, da esposizione o facili da stampare.
   
   **Nessun articolo viene escluso.** I modelli con marchi o personaggi di terzi e quelli con licenza *NonCommercial* restano nel catalogo con un badge giallo di avviso; file di test e ricambi per stampanti ricevono solo una penalità di punteggio. Le esclusioni si possono riattivare in `FILTERS` dentro `scraper/config.mjs`. La selezione è bilanciata tra 11 categorie (Casa, Cucina, Utensili, Gadget, Tech, Decorazione, Giochi, Giardino, Veicoli, Animali, Regali).
3. **App**: mostra gli articoli selezionati; per ognuno puoi modificare il titolo, inserire il prezzo (solo il numero, in euro) e premere **Pubblica**, oppure **Scarta**. Pubblicati e scartati spariscono dalla lista e restano consultabili nelle rispettive schede (con possibilità di ripristino).

Tutte le regole (categorie, parole chiave, limiti) sono in `scraper/config.mjs`.

## Messa online su Cloudflare Pages

1. Su GitHub, **Settings → Actions → General → Workflow permissions: Read and write** (serve allo scraper per salvare il catalogo).
2. **Actions → «Aggiorna catalogo MakerWorld» → Run workflow** per generare il primo catalogo (poi gira da solo alle 05:17, 11:17 e 17:17 UTC).
3. Su [dash.cloudflare.com](https://dash.cloudflare.com): **Workers & Pages → Create → Pages → Connect to Git**, autorizza GitHub e scegli `zsurann/sacrilab-3d-print-shop-manager`.
4. Impostazioni di build:
   | Campo | Valore |
   |---|---|
   | Production branch | `main` |
   | Framework preset | `None` |
   | Build command | `bash scripts/build-site.sh` |
   | Build output directory | `_site` |
5. **Save and Deploy.** L'app sarà su `https://<nome-progetto>.pages.dev`. Ogni commit su `main` (compresi gli aggiornamenti automatici del catalogo) pubblica una nuova versione.
6. (Facoltativo) **Custom domains** per usare un tuo dominio.
7. Installa l'app:
   - **iPhone**: Safari → Condividi → *Aggiungi alla schermata Home*;
   - **Android**: Chrome → menu → *Installa app*;
   - **PC**: icona di installazione nella barra degli indirizzi di Chrome/Edge.

Il file `_headers` imposta la cache per Cloudflare (catalogo e service worker sempre aggiornati). In alternativa a Cloudflare puoi usare GitHub Pages avviando a mano il workflow «Pubblica PWA su GitHub Pages».

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

Le esclusioni automatiche sono disattivate: prima di vendere una stampa controlla la licenza del modello su MakerWorld (badge su ogni scheda e link «apri su MakerWorld»). I badge gialli segnalano licenze *NonCommercial* e marchi/personaggi di terzi, la cui vendita può violare i diritti dell'autore o del titolare del marchio.
