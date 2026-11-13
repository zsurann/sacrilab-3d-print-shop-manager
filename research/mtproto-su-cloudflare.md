# MTProto (account utente) su Cloudflare Pages Functions / Workers

Ticket: `.wayfinder/invio-come-utente/01-mtproto-su-cloudflare.md`
Domanda: un client MTProto come utente (GramJS / `telegram`, mtcute, ...) può girare in una Pages Function per inviare una foto con didascalia dal proprio account personale alla chat del bot?

Ricerca del 13/11/2026. Fonti principali: documentazione Cloudflare, registri npm/JSR, GitHub, codice dei pacchetti scaricati da npm. Non ho potuto raggiungere `core.telegram.org`, `mtcute.dev`, `cdn.jsdelivr.net` e `lobehub.com` (bloccati dalla rete di questa sessione): i punti relativi a Telegram si basano sul codice delle librerie, non sulla documentazione ufficiale di Telegram. **Non ho fatto un test reale contro Telegram** (rete bloccata): i tempi qui sotto sono misure locali in Node, non misure su Workers.

## 1. Trasporto: TCP o WebSocket?

- **I Workers hanno socket TCP in uscita.** Con `connect()` di `cloudflare:sockets` un Worker apre connessioni TCP verso qualunque host, tranne gli IP di Cloudflare e la porta 25 ([TCP sockets](https://developers.cloudflare.com/workers/runtime-apis/tcp-sockets/)). Con `nodejs_compat` c'è anche `node:net` (`net.Socket`) costruito sopra ([changelog node:net](https://developers.cloudflare.com/changelog/post/2025-01-28-nodejs-compat-improvements/)). I DC di Telegram (149.154.x.x) non sono IP di Cloudflare. Il presupposto del ticket ("niente TCP grezzo") quindi **non è più vero**.
- **Anche i WebSocket in uscita funzionano**: `new WebSocket(url)` oppure `fetch()` con `Upgrade: websocket` ([compatibility flags, sezione WebSocket](https://developers.cloudflare.com/workers/configuration/compatibility-flags/)). Contano nel limite di 6 connessioni simultanee ([limits](https://developers.cloudflare.com/workers/platform/limits/#simultaneous-open-connections)).
- **GramJS (`telegram` 2.26.22)**: decide la piattaforma con `isBrowser = typeof window !== "undefined"` (`platform.js`). In un Worker `window` non esiste, quindi GramJS si crede in Node e usa `PromisedNetSockets` (cioè `require("net")`) + `ConnectionTCPFull` verso `149.154.167.91`. Con `nodejs_compat` questo passa per i socket TCP di Workers. Il trasporto WebSocket (`PromisedWebSockets`, `wss://…/apiws`) esiste ed è selezionabile con l'opzione `networkSocket`.
- **mtcute (`@mtcute/web` 0.32.8)**: ha `WebSocketTransport` (`wss://{venus,…}.web.telegram.org/apiws`) che accetta un costruttore WebSocket personalizzato (`websocket.d.ts` nel pacchetto). Il pacchetto `@mtcute/core` su JSR si dichiara compatibile con Cloudflare Workers ([jsr.io/@mtcute/core](https://jsr.io/@mtcute/core)). È un'autodichiarazione sul registro, non una guida testata.

## 2. Compatibilità del runtime

- **`nodejs_compat`**: per i progetti con data di compatibilità ≥ 2026-08-04 è attivo di default anche su Pages, prima va aggiunto a mano nel `wrangler.toml` ([Node.js compatibility flag](https://developers.cloudflare.com/workers/configuration/compatibility-flags/#nodejs-compatibility-flag), [Pages wrangler config](https://developers.cloudflare.com/pages/functions/wrangler-configuration/)). GramJS ne ha bisogno per `Buffer`, `net` e `crypto`.
- **GramJS è archiviato**: il repo è in sola lettura dal 14/07/2026 e "no longer maintained". Il successore indicato è il fork `teleproto` ([github.com/gram-js/gramjs](https://github.com/gram-js/gramjs)). La PR "Add compatibility for Cloudflare Workers" ([#784](https://github.com/gram-js/gramjs/pull/784)) non è mai stata unita.
- **Prova sul campo per GramJS**: [mtourne/cf-worker-telegram-mcp](https://github.com/mtourne/cf-worker-telegram-mcp) (commit del 02/11/2025) usa GramJS con `StringSession` dentro un **Durable Object**, con `nodejs_compat` e le opzioni di default, quindi passa via TCP. Dal README: il client "cannot be serialized, must stay inside DO".
- **mtcute e WASM**: la crittografia (AES-IGE, ecc.) gira in WASM. Workers non permette di compilare WASM da byte scaricati a runtime e non supporta `instantiateStreaming`. Il `.wasm` va importato come modulo ([Bundling, moduli wasm](https://developers.cloudflare.com/workers/wrangler/bundling/#including-non-javascript-modules)). `WebCryptoProvider({ wasmInput })` accetta un `WebAssembly.Module`, quindi si può fare, ma va configurato a mano.
- **Dimensione bundle**: il limite è ora 64 MiB non compressi su tutti i piani, e il vecchio limite di 3 MB compressi sul Free non c'è più ([changelog 04/09/2026](https://developers.cloudflare.com/changelog/post/2026-09-04-increased-worker-size-limit/)). Misura locale: `@mtcute/web` con esbuild minificato ≈ 1,28 MB (≈ 300 KB gzip), quindi nessun problema. Tempo di avvio dello scope globale: max 1 s.

## 3. Limiti di CPU e tempi

- **Free: 10 ms di CPU per richiesta. Paid ($5/mese): 30 s di default, fino a 5 min** ([limits](https://developers.cloudflare.com/workers/platform/limits/#cpu-time)). L'attesa di rete non conta. Le Pages Functions sono fatturate e limitate come Workers ([Pages Functions pricing](https://developers.cloudflare.com/pages/functions/pricing/)).
- Misure locali (Node 22, CPU veloce, quindi indicative):

  | Operazione | CPU |
  |---|---|
  | `require('telegram')` (caricamento libreria + schema TL) | ~213 ms |
  | `import('@mtcute/web')` | ~246 ms |
  | AES-IGE 1 MB, GramJS (JS puro) | ~46 ms |
  | AES-IGE 1 MB, mtcute (WASM) | ~10 ms |
  | fattorizzazione pq (solo al primo login, senza sessione) | ~48 ms |

- Con una `StringSession` salvata la chiave di autorizzazione esiste già: niente scambio DH/RSA. Per richiesta restano: creazione del client, connessione TCP/WSS, `initConnection`/`invokeWithLayer` e `messages.sendMedia`, ogni messaggio cifrato con AES-IGE + SHA-256. La latenza reale è di qualche centinaio di ms fino a 1–2 s (round-trip verso il DC; il DC di Telegram per gli utenti europei è di solito in Olanda), ma quella è attesa, non CPU.
- **Foto per URL invece di upload**: con `InputMediaPhotoExternal` è Telegram a scaricare l'URL, quindi non si cifrano MB di upload. In GramJS basta passare l'URL a `sendFile`, in mtcute `InputMedia.photo('https://…')`. L'URL deve essere pubblico. Con i byte caricati serve `upload.saveFilePart` (blocchi da 512 KB, tutti cifrati).
- **Conclusione sulla CPU**: anche solo il caricamento della libreria (≫ 10 ms) e la cifratura dei messaggi superano il budget del piano Free. Cloudflare tollera sforamenti *occasionali*, ma non in modo stabile ([limits](https://developers.cloudflare.com/workers/platform/limits/#cpu-time)). Sul **Paid** (30 s) c'è margine di due-tre ordini di grandezza.

## 4. Dove salvare la sessione

- La `StringSession` (GramJS) o la sessione esportata di mtcute (`exportSession()`) è una stringa base64 di poche centinaia di byte che contiene la **auth key**. Chi la possiede controlla l'account (legge tutte le chat, invia messaggi, ecc.) senza password né 2FA.
- **Secret di Pages** (`wrangler pages secret put TG_SESSION`): cifrato, max 5 KB per variabile ([limits, environment variables](https://developers.cloudflare.com/workers/platform/limits/#environment-variables)). È l'opzione migliore se la sessione non cambia.
- **KV**: va bene se la sessione deve essere aggiornata da un flusso di login nell'app (KV è già usato dal progetto). Però è leggibile da chiunque abbia accesso al namespace e ha consistenza eventuale. Se si usa KV conviene cifrare il valore con una chiave tenuta in un secret.
- Nota: GramJS/mtcute aggiornano lo stato (DC, salt, ecc.). Se si ricrea il client a ogni richiesta dalla stessa stringa funziona, ma ogni volta si crea una nuova "connessione" lato Telegram.

## 5. Alternative

1. **Durable Object (stesso account Cloudflare)**: un Worker separato con una classe DO tiene il client connesso tra una richiesta e l'altra. La Pages Function lo chiama tramite binding con `script_name` (in un progetto Pages non si può dichiarare un DO: [Pages bindings, DO](https://developers.cloudflare.com/pages/functions/bindings/#durable-objects)). I DO con backend SQLite sono disponibili anche sul **Free** ([DO pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)), ma ogni richiesta o messaggio in arrivo concede **30 s di CPU** ([DO limits, nota 4](https://developers.cloudflare.com/durable-objects/platform/limits/)). Attenzione: un socket TCP aperto tiene vivo il DO (e lo fa fatturare a durata) fino a 15 min ([TCP sockets, considerations](https://developers.cloudflare.com/workers/runtime-apis/tcp-sockets/)). La WebSocket Hibernation non vale per i WebSocket in uscita ([hibernation](https://developers.cloudflare.com/durable-objects/examples/websocket-hibernation-server/)). È il modello già usato da `cf-worker-telegram-mcp`. Il limite di CPU di 30 s nei DO vale anche sul Free, ma va **verificato con un prototipo** prima di contarci.
2. **Client nel browser (PWA)**: GramJS/mtcute girano nel browser via WSS e non serve nessun server. Però la sessione sta nel browser (localStorage/IndexedDB). Una XSS, un'estensione o un dispositivo condiviso possono rubarla e prendersi **l'intero account Telegram**. Ogni dispositivo deve fare login (telefono + codice + 2FA) e creare una propria sessione. Accettabile solo se l'app è usata da una persona sola sui propri dispositivi.
3. **Piccolo server sempre acceso** (Node + GramJS/teleproto/mtcute, esposto con un endpoint protetto da token che la Pages Function chiama): VPS da ~4–5 €/mese (es. Hetzner), free tier come Oracle Cloud Always Free, oppure un Raspberry Pi in casa con Cloudflare Tunnel. È il setup più collaudato per gli userbot, ma è infrastruttura in più da mantenere. Prezzi non verificati in questa sessione.
4. **Restare sulla Bot API** (stato attuale, `lib/server/telegram.js`): zero rischi per l'account, ma il messaggio arriva dal bot e non dalla persona.

Rischio comune a tutte le opzioni MTProto: automatizzare un account utente è consentito dai termini API di Telegram solo entro certi limiti, e flood o spam portano a limitazioni o al ban. Serve un `api_id`/`api_hash` personale da my.telegram.org. Non ho potuto rileggere i [termini API](https://core.telegram.org/api/terms) in questa sessione.

## Conclusione

- **Piano Free, Pages Function diretta: non fattibile in modo affidabile.** Il trasporto non è un problema (TCP via `connect()`/`node:net` oppure WSS). Il limite è la CPU: 10 ms per richiesta non bastano nemmeno a inizializzare GramJS o mtcute e cifrare le richieste MTProto.
- **Piano Paid ($5/mese), Pages Function diretta: fattibile.** Con 30 s di CPU si fa connect + `sendMedia` con una `StringSession` salvata come secret. Conviene usare la **foto per URL** (`InputMediaPhotoExternal`) per evitare l'upload cifrato. Libreria consigliata: **mtcute** (mantenuta, WASM, transport WebSocket, dichiarata compatibile con Workers) invece di GramJS (archiviato a luglio 2026).
- **Free con Durable Object: plausibile ma non verificata.** I DO SQLite sono sul Free con 30 s di CPU per richiesta. Va provata con un prototipo prima di contarci.
- **Opzione raccomandata**: un **Worker separato con un Durable Object + mtcute**, chiamato dalla Pages Function di `publish` via binding, con la sessione in un secret (o cifrata nello storage del DO). Prima un prototipo sul Free; se la CPU o le regole dei DO creano problemi, passare al Workers Paid ($5/mese), che rende fattibile anche la versione più semplice dentro la Pages Function. Il client nel browser va scartato perché espone l'intero account, e il server sempre acceso resta il ripiego se Cloudflare non va bene.
