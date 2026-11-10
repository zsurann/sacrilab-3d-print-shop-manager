# Sacrilab 3D Print Shop Manager

PWA per scegliere i modelli 3D più vendibili da [MakerWorld](https://makerworld.com/it), dare un prezzo e pubblicarli sul bot Telegram [@FlashShoppBot](https://t.me/FlashShoppBot) con foto e didascalia «titolo, prezzo€».

## Come funziona

- **Ogni 30 minuti** GitHub Actions analizza MakerWorld, aggiorna la selezione e la invia al sito su Cloudflare (`PUT /api/catalog`). Non fa commit: il sito non viene ricostruito a ogni aggiornamento.
- **Cloudflare Pages** ospita l'app e le API (`functions/`). Catalogo, articoli pubblicati/scartati e impostazioni sono salvati in **Cloudflare KV**, quindi sono uguali su tutti i dispositivi.
- **Il bot Telegram è collegato sul server**: il token è salvato su Cloudflare, non sui dispositivi. Da qualsiasi dispositivo basta entrare con la password del gestore o del proprietario.
- **L'app** si aggiorna da sola ogni minuto e quando la riapri: nuovi articoli e decisioni prese da altri dispositivi compaiono senza ricaricare.

### Selezione degli articoli

Ogni modello riceve un punteggio di vendibilità da 35 a 99 basato su:
- popolarità (download, stampe, like, collezioni, commenti, in scala logaritmica);
- rapporto stampe/download e like/download (modelli che le persone stampano davvero);
- novità (pubblicati negli ultimi 30/90 giorni);
- parole chiave che indicano oggetti utili, da regalo, da esposizione o facili da stampare.

**Nessun articolo viene escluso.** I modelli con marchi o personaggi di terzi e quelli con licenza *NonCommercial* hanno un badge giallo di avviso; file di test e ricambi per stampanti ricevono solo una penalità di punteggio. Le esclusioni si riattivano in `FILTERS` dentro `scraper/config.mjs`.

Ogni esecuzione analizza le pagine di tendenza più 2 categorie a rotazione (in circa 3 ore le copre tutte); gli articoli già trovati restano nel catalogo e vengono riclassificati a ogni giro. Avviando il workflow a mano con l'opzione **full** si analizzano tutte le categorie in una volta.

## Configurazione

### 1. Cloudflare Pages

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages → Create → Pages → Connect to Git** → scegli `zsurann/sacrilab-3d-print-shop-manager`.
2. Impostazioni di build:
   | Campo | Valore |
   |---|---|
   | Production branch | `main` |
   | Framework preset | `None` |
   | Build command | `bash scripts/build-site.sh` |
   | Build output directory | `_site` |
3. **Save and Deploy.**

### 2. Database KV

1. **Workers & Pages → KV → Create namespace**, nome ad esempio `sacrilab`.
2. Nel progetto Pages: **Settings → Bindings → Add → KV namespace**: *Variable name* `KV`, namespace `sacrilab`.

### 3. Variabili segrete del progetto Pages

**Settings → Variables and Secrets → Add**, tipo **Secret**, ambiente *Production*:

| Nome | Valore |
|---|---|
| `OWNER_PASSWORD` | la password del proprietario: funziona sempre, anche se il gestore cambia la sua |
| `INGEST_TOKEN` | una stringa casuale lunga, la stessa del passo 4 (es. generata con `openssl rand -hex 32`) |

Facoltativi: `TELEGRAM_BOT_TOKEN` (se preferisci tenere il token del bot qui invece di inserirlo dall'app), `TELEGRAM_CHAT_ID` (chat predefinita), `CAPTION_FORMAT` (didascalia predefinita).

Dopo aver aggiunto binding e variabili: **Deployments → … → Retry deployment**, perché le modifiche valgono dal deploy successivo.

### 4. GitHub (aggiornamento ogni 30 minuti)

Nel repository: **Settings → Secrets and variables → Actions**:
- scheda **Secrets** → *New repository secret* `INGEST_TOKEN` = lo stesso valore messo su Cloudflare;
- scheda **Variables** → *New repository variable* `SITE_URL` = l'indirizzo del sito, es. `https://sacrilab-3d-print-shop-manager.pages.dev`.

Poi **Actions → «Aggiorna catalogo MakerWorld» → Run workflow** (spunta *full* per il primo giro). Da lì in poi parte da solo ogni 30 minuti; GitHub può ritardare gli avvii programmati di qualche minuto.

> GitHub sospende i workflow programmati dopo 60 giorni senza commit sul repository: se succede, riattivalo da **Actions** con *Enable workflow*.

### 5. Primo accesso e Telegram

1. Il gestore apre il sito: la prima volta compare **«Benvenuto! Crea la password del gestore»**. Sceglie la password (almeno 6 caratteri) e può incollare subito il token del bot (da [@BotFather](https://t.me/BotFather) → `/mybots` → il bot → *API Token*), oppure farlo dopo dalle impostazioni.
2. Si aprono le **Impostazioni**: scrivi un messaggio qualsiasi a @FlashShoppBot (o aggiungilo come amministratore al gruppo/canale dove vuoi pubblicare), premi **Trova**, scegli la chat, **Salva** e poi **Messaggio di prova**.
3. Su ogni altro dispositivo si entra con la password del gestore **oppure** con quella del proprietario (`OWNER_PASSWORD`). L'accesso resta memorizzato per un anno.

Dalle impostazioni si può cambiare la password del gestore (lo può fare anche il proprietario): i dispositivi del gestore dovranno entrare di nuovo, quelli del proprietario no. La password del proprietario si cambia solo da Cloudflare.

Chat, token del bot e formato della didascalia (`{titolo}`, `{prezzo}`, `{link}`; predefinito `{titolo}, {prezzo}€` → `supporto tagliere, 7€`) valgono per tutti i dispositivi.

### 6. Installare l'app

- **iPhone**: Safari → Condividi → *Aggiungi alla schermata Home*;
- **Android**: Chrome → menu → *Installa app*;
- **PC**: icona di installazione nella barra degli indirizzi di Chrome/Edge.

## Problemi comuni

- **Catalogo vuoto**: controlla l'ultima esecuzione in *Actions*. Avviala con l'opzione **debug** per ottenere screenshot e log tra gli *artifact*. Se lo scraper non trova modelli il catalogo esistente non viene sovrascritto.
- **«Database non collegato»**: manca il binding KV con nome `KV`; aggiungilo e rifai il deploy.
- **La password del proprietario non funziona**: controlla `OWNER_PASSWORD` (maiuscole/minuscole contano) e rifai il deploy.
- **«Token di invio non valido» nel workflow**: `INGEST_TOKEN` su GitHub e su Cloudflare non coincidono.

## Sviluppo locale

```bash
cd scraper && npm install && npm test
```

```bash
bash scripts/build-site.sh
```

```bash
npx wrangler pages dev _site --kv KV --binding OWNER_PASSWORD=prova INGEST_TOKEN=prova
```

Per lo scraper in locale: `SITE_URL=http://localhost:8788 INGEST_TOKEN=prova npm run scrape` (dentro `scraper/`, dopo `npx playwright install chromium`).

## Nota sulle licenze

Prima di vendere una stampa controlla la licenza del modello su MakerWorld (badge su ogni scheda e link «apri su MakerWorld»). I badge gialli segnalano licenze *NonCommercial* e marchi/personaggi di terzi, la cui vendita può violare i diritti dell'autore o del titolare del marchio.
