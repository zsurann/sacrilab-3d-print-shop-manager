# Prova di invio dall'account personale

Prototipo usa-e-getta: serve solo a verificare che il **piano gratuito** di Cloudflare basti per inviare a @FlashShoppBot dal tuo account Telegram. Non è collegato all'app.

## 1. Crea il servizio su Cloudflare
1. [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → scheda **Workers** → **Import a repository**.
2. Scegli `sacrilab-3d-print-shop-manager` e compila:
   - **Project name**: `sacrilab-sender`
   - **Branch**: `prototype/invio-come-utente`
   - **Root directory** (in *Advanced settings*): `sender`
   - **Deploy command**: lascia `npx wrangler deploy`
3. **Deploy**. Annota l'indirizzo, tipo `https://sacrilab-sender.<tuo-nome>.workers.dev`.

## 2. Inserisci i segreti
Nel Worker **sacrilab-sender** → **Settings** → **Variables and Secrets** → **Add**, tipo **Secret**:

| Nome | Valore |
|---|---|
| `API_ID` | il tuo api_id di my.telegram.org |
| `API_HASH` | il tuo api_hash |
| `SESSION_KEY` | una stringa casuale lunga (cifra la sessione salvata) |
| `SENDER_KEY` | un'altra stringa casuale lunga (protegge il servizio) |

Salva, poi **Deployments** → ultimo deploy → **⋯** → **Retry deployment** (o rifai il deploy).

## 3. Fai la prova
1. Apri l'indirizzo del servizio: compare la pagina «Prova di invio dal tuo account».
2. Incolla `SENDER_KEY` → **Controlla collegamento** (deve dire `"linked": false`).
3. Numero con prefisso (es. `+39…`) → **Invia codice** → inserisci il codice arrivato su Telegram → **Conferma codice**.
4. Se risponde `"next": "password"`, inserisci la password della verifica in due passaggi → **Conferma password**.
5. **Invia prova**: nella chat con @FlashShoppBot deve comparire, **inviata da te**, una foto con «supporto tagliere, 7€».
6. Ripeti **Invia prova** 3–4 volte, anche a qualche minuto di distanza.

## 4. Cosa riportare
- I tempi mostrati in «Risultato» (`ms`) per collegamento e invii.
- Se il messaggio è arrivato come tuo e com'è fatto nella chat.
- Nel Worker → **Metrics**: il **CPU time** delle richieste e se compaiono errori tipo «exceeded CPU».
- Eventuali errori mostrati in «Risultato».

Dopo la prova: **Scollega account** dalla pagina, oppure Telegram → Impostazioni → Dispositivi → termina la sessione «mtcute».
