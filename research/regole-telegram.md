# Regole Telegram per un account personale automatizzato

Ticket: `.wayfinder/invio-come-utente/02-regole-telegram-account-automatici.md`
Scenario: l'account **personale** del proprietario invia da una web app, tramite API client (MTProto, es. Telethon/GramJS), foto + didascalia "titolo, prezzo€" nella chat privata con il **proprio** bot @FlashShoppBot. Volume: 5–10 messaggi ogni 30 minuti al massimo.

> **Nota sulle fonti.** Da questa sessione `core.telegram.org`, `telegram.org` e `docs.telethon.dev` **non erano raggiungibili** (rete bloccata). Le citazioni delle pagine ufficiali vengono dagli estratti dei motori di ricerca e da documentazione di librerie su GitHub (raggiungibile). Prima di decidere conviene rileggere di persona le due pagine ufficiali linkate sotto.

## 1. Termini API e "userbot"

Fonte principale: [Telegram API Terms of Service](https://core.telegram.org/api/terms) (non letta direttamente, vedi nota).

- **Le API client sono aperte a terzi**: chiunque può scrivere un client o uno strumento che usa le API con un account utente, purché rispetti i termini. Non esiste un divieto esplicito di automatizzare il *proprio* account ("userbot").
- Obblighi principali per chi sviluppa un client (estratti secondari):
  - proteggere la privacy degli utenti e seguire le linee guida di sicurezza;
  - non usare "Telegram" nel nome dell'app se non preceduto da "Unofficial" (§2.3, fonte secondaria);
  - vietato usare i dati della piattaforma per addestrare modelli AI (§1.5 / [Content Licensing](https://telegram.org/tos/content-licensing));
  - in caso di violazione Telegram concede ~10 giorni per correggere, poi revoca l'accesso API (§4.2, fonte secondaria).
- **Divieto netto**: usare le API per *flooding, spam, gonfiare iscritti/visualizzazioni* → ban permanente ("you will be banned forever") — riportato da [Creating your Telegram Application](https://core.telegram.org/api/obtaining_api_id).
- **Sorveglianza automatica**: "all accounts that sign up or log in using unofficial Telegram API clients are automatically put under observation to avoid violations of the Terms of Service" ([obtaining_api_id](https://core.telegram.org/api/obtaining_api_id)). Quindi l'account *sarà* osservato: il rischio non è il divieto in sé ma i falsi positivi dell'anti-abuso.
- Il nostro caso (account proprio → bot proprio, pochi messaggi, nessun destinatario terzo) **non rientra** in spam/flood: nessun utente può segnalarlo come spam.

## 2. Registrazione app su my.telegram.org (api_id / api_hash)

Fonte: [Creating your Telegram Application](https://core.telegram.org/api/obtaining_api_id) (via estratti di ricerca).

- Si accede a [my.telegram.org](https://my.telegram.org) col numero dell'account; il codice arriva **nell'app Telegram** (non via SMS).
- In "API development tools" si compila il form: *App title*, *Short name* (5–32 caratteri alfanumerici), *URL* (facoltativo), *Platform* (es. "Web" o "Other"), *Description*.
- **Un solo api_id per numero di telefono** ("For the moment each number can only have one api_id connected to it").
- **Non usare gli api_id di esempio** dei sorgenti ufficiali: sono limitati lato server (errore `API_ID_PUBLISHED_FLOOD`).
- **api_id/api_hash vanno tenuti segreti** (mai nel frontend/JS pubblico, mai nel repo) — [gotd SUPPORT.md](https://github.com/gotd/td/blob/main/.github/SUPPORT.md), [WTelegramClient FAQ](https://github.com/wiz0u/WTelegramClient/blob/master/FAQ.md).
- Il form a volte risponde solo "ERROR" (problema noto: VPN/IP, browser, nomi già usati) — [telegramsoftware.pro](https://telegramsoftware.pro/blog/telegram-api-id-and-hash-one-per-number/), fonte non ufficiale.

## 3. Limiti di frequenza (FLOOD_WAIT) e cause di limitazione/ban

### Flood limits
- Telegram **non pubblica** i limiti numerici per gli account utente. L'errore `420 FLOOD_WAIT_X` indica di aspettare X secondi prima di ripetere quella chiamata ([Telethon – RPC Errors](https://docs.telethon.dev/en/stable/concepts/errors.html), [core.telegram.org/api/errors](https://core.telegram.org/api/errors)). Le librerie (Telethon, WTelegramClient) attendono e riprovano da sole per attese brevi.
- `PEER_FLOOD` è diverso: non ha durata, indica una **limitazione anti-spam dell'account** (di solito dopo segnalazioni o troppi contatti nuovi da account giovane) — [Telethon issue #59](https://codeberg.org/Lonami/Telethon/issues/59). Aspettare non basta; si verifica con @SpamBot.
- **Stima per il nostro volume**: 5–10 foto ogni 30 min (≈ 1 messaggio ogni 3–6 minuti in media) è **molto al di sotto** di qualsiasi soglia osservata: anche i bot hanno come riferimento ~1 messaggio/secondo per chat. Se si inviano i 10 messaggi "a raffica", c'è una probabilità bassa di un FLOOD_WAIT di pochi secondi; con 3–10 s tra un invio e l'altro è trascurabile. Gli upload di foto contano come più richieste (upload + invio), quindi meglio non parallelizzare.

### Comportamenti che portano a limitazioni o ban
Fonti: [WTelegramClient FAQ §7–8](https://github.com/wiz0u/WTelegramClient/blob/master/FAQ.md), [gotd SUPPORT.md](https://github.com/gotd/td/blob/main/.github/SUPPORT.md), Telethon docs.
- **Numeri nuovi**: "If a phone number is brand new, it will be closely monitored" — i client non ufficiali su account freschi sono trattati con sospetto.
- **Numeri VoIP/virtuali**: "Do not use VoIP numbers" (molto limitati).
- **Invio massivo / a sconosciuti**: flooding, spam, contatti a molti non‑contatti → `PEER_FLOOD`, ban permanente.
- **Login QR da client non ufficiale**: "Do not use QR code login, this will result in permaban" (WTelegramClient FAQ).
- **Sessioni multiple / copiate**: copiare file di sessione tra macchine causa `AUTH_KEY_DUPLICATED` e revoca ([Habr Q&A](https://qna.habr.com/q/1322076)); comprare sessioni o estrarre authkey dai client ufficiali è vietato.
- **IP da datacenter / cambi frequenti di IP**: fonti secondarie (vendor di proxy, [Habr](https://habr.com/en/articles/990262)) riportano più controlli su IP di datacenter e reset di sessione con IP che cambiano spesso. Non confermato ufficialmente, ma da considerare (es. funzioni serverless che girano su IP sempre diversi).
- **Azioni ripetitive/polling**: "Avoid repetitive polling or repetitive sequence of actions/requests".
- **Account congelati** (da maggio 2025): un account "frozen" non può accedere da nuovi dispositivi; ricorso tramite @SpamBot ([tginfo.me](https://tginfo.me/?p=8786)).

## 4. Raccomandazioni pratiche

1. **Usare l'account personale storico** (numero reale, non VoIP, attivo da tempo), mai un numero nuovo.
2. **Una sola sessione** per l'automazione, creata **una volta** con login via codice (non QR), salvata come *string session* in un segreto del server; riutilizzarla sempre, mai rifare il login a ogni invio.
3. **Server con IP stabile**; evitare login da IP che cambiano a ogni richiesta. Fare il primo login dallo stesso Paese/rete abituale, se possibile.
4. **Attivare la verifica in due passaggi (2FA)** sull'account: protegge se la sessione o le chiavi trapelano.
5. **Coda sequenziale con pausa** di 3–10 s (con un po' di variazione casuale) tra un messaggio e l'altro; tetto massimo di 10 messaggi ogni 30 minuti nel codice.
6. **Gestire `FLOOD_WAIT`**: attendere esattamente i secondi indicati e riprovare; se compare `PEER_FLOOD` o `USER_DEACTIVATED`/`AUTH_KEY_UNREGISTERED`, **fermare tutto** e avvisare, non riprovare.
7. **Solo verso il proprio bot**: mai estendere l'automazione a utenti/gruppi terzi.
8. **api_id/api_hash e sessione solo lato server** (variabili d'ambiente), mai nel repo o nel browser.
9. Opzionale (consiglio della community, non ufficiale): scrivere a `recover@telegram.org` descrivendo onestamente l'uso, e usare nel frattempo l'account normalmente anche dai client ufficiali.
10. Controllare ogni tanto in *Impostazioni → Dispositivi* che ci sia una sola sessione dell'app; revocarla da lì se necessario.

## Conclusione

- **Consentito?** Sì. I termini non vietano di automatizzare il proprio account con le API client; vietano spam, flooding e manipolazioni, che qui non ci sono (unico destinatario: il proprio bot).
- **Rischio: basso** con il volume previsto (≤ 10 messaggi/30 min, sequenziali), se l'account è vecchio, con numero reale e una sola sessione stabile. Il rischio che resta è un falso positivo dell'anti-abuso automatico, che "observes" tutti i client non ufficiali: poco probabile ma non nullo, e riguarderebbe l'account **personale** (conviene accettarlo consapevolmente).
- **Checklist su my.telegram.org**:
  1. Accedere a https://my.telegram.org con il numero dell'account personale; inserire il codice ricevuto nell'app Telegram.
  2. Aprire **API development tools**.
  3. Compilare: *App title* es. "Sacrilab Shop Publisher" (senza la parola "Telegram"), *Short name* es. `sacrilabpub`, *URL* facoltativo, *Platform* "Web" o "Other", *Description* breve e veritiera ("invio annunci al mio bot @FlashShoppBot").
  4. Salvare e copiare **api_id** e **api_hash** in un gestore di password / segreti del server; non condividerli e non metterli nel repo.
  5. Se il form dà "ERROR": disattivare VPN, provare un altro browser, cambiare *Short name*, riprovare più tardi.
  6. Ricordare che il numero può avere **un solo** api_id: non crearne altri.
  7. Subito dopo: attivare la **2FA** nell'app (*Impostazioni → Privacy e sicurezza → Verifica in due passaggi*), aprire @FlashShoppBot e premere **/start** dall'account personale, poi fare **un solo** login dal server per generare la sessione.
