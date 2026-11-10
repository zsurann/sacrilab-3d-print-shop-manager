# Guida alla configurazione

Questa guida spiega, passo per passo, come mettere online Sacrilab 3D Print Shop Manager e collegarla al bot Telegram. Va fatta **una volta sola**. Tempo necessario: circa 30 minuti.

Ti servono:
- un account **GitHub** (dove si trova il progetto);
- un account **Cloudflare** gratuito (dove gira il sito): [dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up);
- **Telegram** sul telefono, con l'account che ha creato il bot.

Prepara anche, in un posto sicuro, due cose che userai più avanti:
- **la password del proprietario**: una password solo tua, che funzionerà sempre;
- **il codice di collegamento**: una sequenza lunga di lettere e numeri a caso (almeno 40 caratteri, senza spazi), che serve a GitHub per inviare i nuovi articoli al sito. Ad esempio puoi farla generare dal tuo gestore di password.

---

## Parte 1 — Trovare il token del bot Telegram

Il token è la "chiave" che permette all'app di pubblicare a nome del bot. Ha questo aspetto: `123456789:AAH4kZx…` (un numero, i due punti e una lunga serie di lettere e numeri).

1. Apri Telegram e cerca **@BotFather** (ha la spunta blu di verifica). Aprilo e premi **Avvia**.
2. Scrivi `/mybots` e invia.
3. Compare l'elenco dei tuoi bot: tocca **FlashShoppBot**.
4. Tocca **API Token**.
5. BotFather risponde con il token: tienilo premuto e copialo.

Il token servirà al gestore nella Parte 5. Trattalo come una password: chi lo possiede può scrivere a nome del bot.

**Il bot non compare in `/mybots`?** Solo l'account che ha creato il bot vede il token. Usa quell'account, oppure crea un nuovo bot: scrivi `/newbot` a BotFather, scegli un nome e un username che finisca con `bot`, e alla fine riceverai direttamente il token.

**Il token è finito in mani sbagliate?** In BotFather: `/mybots` → il bot → **API Token** → **Revoke current token**. Riceverai un token nuovo: inseriscilo nell'app in **Impostazioni → Token del bot → Collega**.

---

## Parte 2 — Creare il sito su Cloudflare

### 2.1 Collegare il progetto
1. Entra su [dash.cloudflare.com](https://dash.cloudflare.com).
2. Nel menu a sinistra apri **Workers & Pages** → **Create** → scheda **Pages** → **Connect to Git** (a volte si chiama *Import an existing Git repository*).
3. Collega il tuo account GitHub e autorizza il repository `sacrilab-3d-print-shop-manager`.
4. Compila i campi così:

   | Campo | Cosa scrivere |
   |---|---|
   | Project name | `sacrilab` (diventerà l'indirizzo, es. `sacrilab.pages.dev`) |
   | Production branch | `main` |
   | Framework preset | `None` |
   | Build command | `bash scripts/build-site.sh` |
   | Build output directory | `_site` |

5. Premi **Save and Deploy** e aspetta che finisca (circa un minuto). **Annota l'indirizzo del sito** che Cloudflare ti mostra.

### 2.2 Creare il database
1. Nel menu a sinistra apri **Storage & Databases → KV** (in alcune versioni è dentro *Workers & Pages → KV*).
2. Premi **Create**, scrivi il nome `sacrilab` e conferma.

### 2.3 Collegare il database al sito
1. Torna in **Workers & Pages** → apri il progetto **sacrilab** → **Settings** → **Bindings** → **Add** → **KV namespace**.
2. *Variable name*: `KV` (esattamente così, maiuscolo). *KV namespace*: `sacrilab`.
3. Premi **Save**.

### 2.4 Inserire le password segrete
Sempre nel progetto: **Settings** → **Variables and Secrets** → **Add**. Aggiungi due variabili, scegliendo come tipo **Secret**:

| Variable name | Value |
|---|---|
| `OWNER_PASSWORD` | la password del proprietario |
| `INGEST_TOKEN` | il codice di collegamento |

Premi **Save**.

### 2.5 Pubblicare di nuovo
Vai su **Deployments**, sull'ultima pubblicazione premi **⋯** → **Retry deployment**. Senza questo passaggio il database e le password non vengono letti.

---

## Parte 3 — Collegare l'aggiornamento automatico (GitHub)

È GitHub che, ogni 30 minuti, cerca nuovi articoli su MakerWorld e li manda al sito.

1. Apri il repository su GitHub → **Settings** → **Secrets and variables** → **Actions**.
2. Scheda **Secrets** → **New repository secret**:
   - *Name*: `INGEST_TOKEN`
   - *Secret*: lo **stesso** codice di collegamento usato su Cloudflare.
3. Scheda **Variables** → **New repository variable**:
   - *Name*: `SITE_URL`
   - *Value*: l'indirizzo del sito annotato prima, ad esempio `https://sacrilab.pages.dev` (senza `/` finale).
4. Apri la scheda **Actions** del repository → **Aggiorna catalogo MakerWorld** → **Run workflow** → **Run workflow**.

Il primo giro dura circa 15 minuti e analizza tutte le categorie. Quando la riga diventa verde ✅ il catalogo è pronto. Da qui in poi parte da solo ogni 30 minuti.

Se il sito su GitHub Pages era stato attivato in passato, spegnilo: **Settings → Pages → Source: None**.

---

## Parte 4 — Scegliere dove pubblicare su Telegram

Il bot può pubblicare in tre posti. Decidi prima quale vuoi usare:

- **Chat privata con il bot** (solo tu vedi i messaggi): apri il bot su Telegram, premi **Avvia** e scrivi un messaggio qualsiasi, ad esempio `ciao`.
- **Gruppo**: aggiungi il bot al gruppo, poi scrivi nel gruppo `/start@FlashShoppBot` (così il bot "vede" il gruppo).
- **Canale**: apri il canale → *Amministratori* → aggiungi il bot come amministratore con il permesso **Pubblica messaggi**. Poi pubblica un messaggio qualsiasi nel canale.

---

## Parte 5 — Primo accesso del gestore

1. Il gestore apre l'indirizzo del sito.
2. Compare **«Benvenuto! Crea la password del gestore e collega il bot»**:
   - sceglie una password (almeno 6 caratteri) e la ripete;
   - incolla il **token del bot** della Parte 1. È **obbligatorio**: senza un token valido non si può proseguire. Se non sai dove trovarlo, tocca **«Come trovo il token?»** sotto il campo.
3. Preme **Crea password ed entra**. Compaiono subito i primi 5 articoli.
4. Si apre il pannello **Impostazioni**:
   - premi **Trova**: compare l'elenco delle chat che hanno scritto al bot (Parte 4). Tocca quella giusta;
   - premi **Salva**, poi **Messaggio di prova**: su Telegram deve arrivare «✅ Sacrilab 3D Print Shop Manager è collegato a questa chat».

**«Trova» non mostra la chat o dà errore?** Puoi scrivere il chat ID a mano nel campo *Chat di destinazione*:
- per un **canale pubblico** basta il suo nome con la chiocciola, es. `@miocanale`;
- per una **chat privata o un gruppo**, inoltra un messaggio di quella chat al bot [@userinfobot](https://t.me/userinfobot): ti risponde con l'ID (un numero, per i gruppi negativo, es. `-1001234567890`).

La password viene chiesta **solo la prima volta in assoluto**: dopo, su questo e su tutti gli altri dispositivi, l'app chiede soltanto di inserirla.

---

## Parte 6 — Usare l'app su altri dispositivi

Apri l'indirizzo del sito e inserisci la password del gestore (oppure quella del proprietario). Per averla come app:
- **iPhone**: Safari → *Condividi* → *Aggiungi alla schermata Home*;
- **Android**: Chrome → menu ⋮ → *Installa app*;
- **Computer**: icona di installazione nella barra degli indirizzi di Chrome o Edge.

L'accesso resta memorizzato per un anno su ogni dispositivo.

---

## Domande frequenti

**Il gestore ha dimenticato la password.**
Entra con la password del proprietario → **Impostazioni** → *Nuova password del gestore* → **Cambia**. I dispositivi del gestore dovranno entrare di nuovo con la nuova password.

**Voglio cambiare la password del proprietario.**
Su Cloudflare: progetto **sacrilab** → **Settings → Variables and Secrets** → modifica `OWNER_PASSWORD`, poi **Deployments → Retry deployment**.

**Voglio cambiare il bot o il token.**
**Impostazioni → Token del bot** → incolla il nuovo token → **Collega**.

**Non compaiono articoli.**
Controlla su GitHub, scheda **Actions**, che l'ultima esecuzione di *Aggiorna catalogo MakerWorld* sia verde ✅. Se è rossa ❌, aprila e controlla l'errore: di solito `INGEST_TOKEN` è diverso tra GitHub e Cloudflare, oppure `SITE_URL` è scritto male.

**Compare «Database non collegato».**
Manca il collegamento del database (Parte 2.3) oppure non è stato rifatto il deploy (Parte 2.5).

**La password del proprietario non funziona.**
Controlla `OWNER_PASSWORD` su Cloudflare (maiuscole e minuscole contano) e rifai il deploy.

**Sul telefono vedo ancora una versione vecchia.**
Chiudi l'app del tutto e riaprila con internet attivo: carica da sola l'ultima versione.

**Dopo due mesi gli articoli non arrivano più.**
GitHub sospende gli aggiornamenti automatici dopo 60 giorni senza modifiche al repository. Vai in **Actions → Aggiorna catalogo MakerWorld** e premi **Enable workflow**.
