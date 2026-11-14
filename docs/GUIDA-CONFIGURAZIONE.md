# Guida alla configurazione

Questa guida spiega, passo per passo, come mettere online Sacrilab 3D Print Shop Manager e collegarla al tuo account Telegram, così che gli articoli arrivino a **@FlashShoppBot inviati da te**. Va fatta **una volta sola**. Tempo necessario: circa 40 minuti.

Ti servono:
- un account **GitHub** (dove si trova il progetto);
- un account **Cloudflare** gratuito (dove girano il sito e il servizio di invio): [dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up);
- **Telegram** sul telefono, con il tuo account personale.

Prepara in un posto sicuro (es. un gestore di password) queste cose che userai più avanti:
- **la password del proprietario**: una password solo tua, che funzionerà sempre;
- **tre codici casuali**, ognuno di almeno 40 lettere e numeri a caso, senza spazi:
  - il **codice di collegamento** (`INGEST_TOKEN`): serve a GitHub per inviare i nuovi articoli al sito;
  - la **chiave del servizio** (`SENDER_KEY`): serve al sito per usare il servizio di invio;
  - la **chiave della sessione** (`SESSION_KEY`): cifra l'accesso al tuo account Telegram.

---

## Parte 1 — Credenziali Telegram (api_id e api_hash)

Servono perché il servizio possa inviare dal tuo account.

1. Apri [my.telegram.org](https://my.telegram.org), inserisci il tuo numero con il prefisso (es. `+39…`) e il codice che ti arriva nell'app Telegram.
2. Apri **API development tools**.
3. Compila: *App title* `Sacrilab Shop Publisher`, *Short name* `sacrilabpub`, *URL* vuoto, *Platform* `Web`, *Description* `invio annunci al mio bot @FlashShoppBot`. Non usare la parola «Telegram» nel nome.
4. Salva e copia **api_id** (un numero) e **api_hash** nel tuo gestore di password. Non condividerli con nessuno.
5. Se il modulo dà «ERROR»: togli la VPN, prova un altro browser o un altro *Short name*, oppure riprova più tardi. Ogni numero può avere un solo api_id.
6. Nell'app Telegram attiva la **verifica in due passaggi** (Impostazioni → Privacy e sicurezza) e apri **@FlashShoppBot** premendo **Avvia**.

---

## Parte 2 — Creare il sito su Cloudflare

### 2.1 Collegare il progetto
1. Entra su [dash.cloudflare.com](https://dash.cloudflare.com).
2. Nel menu a sinistra apri **Workers & Pages** → **Create** → scheda **Pages** → **Connect to Git**.
3. Collega il tuo account GitHub e scegli il repository `sacrilab-3d-print-shop-manager`.
4. Compila i campi così:

   | Campo | Cosa scrivere |
   |---|---|
   | Project name | `sacrilab` (diventerà l'indirizzo, es. `sacrilab.pages.dev`) |
   | Production branch | `main` |
   | Framework preset | `None` |
   | Build command | `bash scripts/build-site.sh` |
   | Build output directory | `_site` |

5. Premi **Save and Deploy**. **Annota l'indirizzo del sito.**

### 2.2 Creare il database
1. Nel menu a sinistra apri **Storage & Databases → KV**.
2. Premi **Create**, scrivi il nome `sacrilab` e conferma.

---

## Parte 3 — Creare il servizio di invio

È il pezzo che invia gli articoli dal tuo account. Gira su Cloudflare, separato dal sito, ed è l'unico posto dove resta salvato l'accesso al tuo account Telegram.

1. **Workers & Pages** → **Create** → scheda **Workers** → **Import a repository**.
2. Scegli `sacrilab-3d-print-shop-manager` → **Next**.
3. Compila:
   - *Project name*: `sacrilab-sender` (esattamente così)
   - *Build command*: vuoto
   - *Deploy command*: `cd sender && npm ci && npx wrangler deploy`
4. Premi **Deploy** e aspetta che finisca.
5. Apri il Worker **sacrilab-sender** → **Settings** → **Variables and Secrets** → **Add**, tipo **Secret**:

   | Variable name | Value |
   |---|---|
   | `API_ID` | il tuo api_id (Parte 1) |
   | `API_HASH` | il tuo api_hash (Parte 1) |
   | `SESSION_KEY` | la chiave della sessione |
   | `SENDER_KEY` | la chiave del servizio |

6. Salva e rifai il deploy: **Deployments** → ultimo deploy → **⋯** → **Retry deployment**.

---

## Parte 4 — Collegare tutto al sito

Torna in **Workers & Pages** → progetto **sacrilab** (il sito):

1. **Settings** → **Bindings** → **Add**:
   - **KV namespace**: *Variable name* `KV`, namespace `sacrilab` → **Save**.
   - **Service binding**: *Variable name* `SENDER`, servizio `sacrilab-sender` → **Save**.
2. **Settings** → **Variables and Secrets** → **Add**, tipo **Secret**:

   | Variable name | Value |
   |---|---|
   | `OWNER_PASSWORD` | la password del proprietario |
   | `INGEST_TOKEN` | il codice di collegamento |
   | `SENDER_KEY` | la **stessa** chiave del servizio usata nella Parte 3 |

3. **Deployments** → ultimo deploy → **⋯** → **Retry deployment**.

---

## Parte 5 — Collegare l'aggiornamento automatico (GitHub)

È GitHub che, ogni 30 minuti, cerca nuovi articoli su MakerWorld e li manda al sito.

1. Apri il repository su GitHub → **Settings** → **Secrets and variables** → **Actions**.
2. Scheda **Secrets** → **New repository secret**: *Name* `INGEST_TOKEN`, *Secret* lo **stesso** codice di collegamento usato su Cloudflare.
3. Scheda **Variables** → **New repository variable**: *Name* `SITE_URL`, *Value* l'indirizzo del sito, es. `https://sacrilab.pages.dev` (senza `/` finale).
4. Scheda **Actions** → **Aggiorna catalogo MakerWorld** → **Run workflow**.

Il primo giro dura circa 15 minuti. Quando la riga diventa verde ✅ il catalogo è pronto; poi riparte da solo ogni 30 minuti.

---

## Parte 6 — Primo accesso

1. **Il gestore** apre l'indirizzo del sito: compare **«Benvenuto! Crea la password del gestore»**. Sceglie una password (almeno 6 caratteri), la ripete e preme **Crea password ed entra**. Trova subito i primi 5 articoli, ma «Pubblica» resta bloccato finché il proprietario non collega il suo account.
2. **Il proprietario** apre il sito ed entra con la **sua** password. Si apre **Impostazioni → Account Telegram**:
   - scrive il suo numero con il prefisso (`+39…`) → **Invia codice**;
   - inserisce il codice arrivato nell'app Telegram → **Conferma**;
   - se richiesta, inserisce la password della verifica in due passaggi → **Conferma**.

   Compare **«Collegato»** con il suo nome: da ora «Pubblica» funziona per tutti, su tutti i dispositivi.

La password del gestore viene chiesta **solo la prima volta in assoluto**: dopo, su questo e su tutti gli altri dispositivi, l'app chiede soltanto di inserirla.

---

## Parte 7 — Usare l'app su altri dispositivi

Apri l'indirizzo del sito e inserisci la password del gestore (oppure quella del proprietario). Per averla come app:
- **iPhone**: Safari → *Condividi* → *Aggiungi alla schermata Home*;
- **Android**: Chrome → menu ⋮ → *Installa app*;
- **Computer**: icona di installazione nella barra degli indirizzi di Chrome o Edge.

L'accesso resta memorizzato per un anno su ogni dispositivo.

---

## Domande frequenti

**Il gestore ha dimenticato la password.**
Entra con la password del proprietario → **Impostazioni** → *Nuova password del gestore* → **Cambia**.

**Voglio cambiare la password del proprietario.**
Su Cloudflare: progetto **sacrilab** → **Settings → Variables and Secrets** → modifica `OWNER_PASSWORD`, poi **Retry deployment**.

**Voglio scollegare il mio account Telegram.**
Entra con la password del proprietario → **Impostazioni** → **Scollega account Telegram**. In emergenza anche da Telegram: Impostazioni → Dispositivi → termina la sessione «mtcute».

**«Pubblica» dice «Telegram chiede di attendere N secondi».**
Telegram limita temporaneamente gli invii troppo ravvicinati: aspetta il tempo indicato e riprova. L'articolo resta da valutare.

**«Account Telegram scollegato»** o **«In attesa che il proprietario colleghi l'account Telegram»**.
La sessione non vale più (es. è stata terminata da Telegram → Dispositivi): il proprietario deve ricollegarla dalle Impostazioni.

**«Servizio di invio non collegato».**
Manca il *Service binding* `SENDER` o il segreto `SENDER_KEY` nel progetto **sacrilab** (Parte 4), oppure non è stato rifatto il deploy.

**«SENDER_KEY diversa tra il sito e il servizio di invio».**
La chiave del servizio deve essere identica nel Worker **sacrilab-sender** (Parte 3) e nel sito **sacrilab** (Parte 4).

**Non compaiono articoli.**
Su GitHub, scheda **Actions**, l'ultima esecuzione di *Aggiorna catalogo MakerWorld* deve essere verde ✅. Se è rossa ❌, di solito `INGEST_TOKEN` è diverso tra GitHub e Cloudflare, oppure `SITE_URL` è scritto male.

**Compare «Database non collegato».**
Manca il binding KV `KV` (Parte 4) oppure non è stato rifatto il deploy.

**Sul telefono vedo ancora una versione vecchia.**
Chiudi l'app del tutto e riaprila con internet attivo.

**Dopo due mesi gli articoli non arrivano più.**
GitHub sospende gli aggiornamenti automatici dopo 60 giorni senza modifiche al repository: **Actions → Aggiorna catalogo MakerWorld → Enable workflow**.
