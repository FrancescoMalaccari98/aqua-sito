# Aqua — Documentazione del sito

Documentazione tecnica del sito di **Aqua cocktail bar** (Corso Umberto I, 31 · Civitanova Marche):
com'è fatto, come si aggiorna e come si pubblica su **Aruba Hosting Linux (hosting condiviso)**.

Cosa manca ancora per andare online (dati, decisioni, passaggi tecnici): vedi
[CHECKLIST-MESSA-ONLINE.md](CHECKLIST-MESSA-ONLINE.md).

Aggiornata al 25/11/2026.

---

## Indice

1. [In breve](#1-in-breve)
2. [Le pagine](#2-le-pagine)
3. [Struttura delle cartelle](#3-struttura-delle-cartelle)
4. [Come funziona](#4-come-funziona)
5. [Aggiornare i contenuti](#5-aggiornare-i-contenuti)
6. [Sviluppo e pubblicazione attuale (GitHub)](#6-sviluppo-e-pubblicazione-attuale-github)
7. [Pubblicazione su Aruba Hosting Linux](#7-pubblicazione-su-aruba-hosting-linux)
8. [Il file .htaccess](#8-il-file-htaccess)
9. [Controlli dopo la pubblicazione](#9-controlli-dopo-la-pubblicazione)
10. [Aggiornamenti successivi](#10-aggiornamenti-successivi)
11. [Problemi frequenti](#11-problemi-frequenti)

---

## 1. In breve

- È un **sito statico**: solo file HTML, CSS, JavaScript, immagini, video e font.
  **Niente database, niente PHP, niente installazioni**: basta copiare i file sul server.
- **Nessuna fase di compilazione**: i file nella cartella del progetto sono già quelli da pubblicare.
- **Nessun servizio esterno**: font, foto e video sono serviti dal sito stesso. Non ci sono cookie,
  statistiche, mappe incorporate o contenuti social incorporati (solo semplici link a Google Maps e Instagram).
- I **contenuti che cambiano spesso** (carta dei drink, menu food, foto) stanno in file di testo nella
  cartella `data/`, modificabili senza toccare il codice.
- Funziona con i browser moderni (Chrome, Safari, Firefox, Edge, anche su iPhone e Android).

---

## 2. Le pagine

| File | Indirizzo | Contenuto |
|---|---|---|
| `index.html` | `/` | Home: copertina con video, conto alla rovescia per l'inaugurazione, Filosofia, Il rito, citazione, Il bar, Dove siamo (orari, contatti), menu di navigazione |
| `carta.html` | `/carta.html` | **Carta dei drink** (pagina del QR code): Signature, Pre dinner, After dinner, Gin tonic, Caffetteria, Pasticceria, Salato, Beverage |
| `food.html` | `/food.html` | **Menu food** |
| `privacy.html` | `/privacy.html` | Informativa privacy e cookie policy |
| `404.html` | qualsiasi indirizzo inesistente | Pagina "non trovata" con il ritorno al sito |

File di servizio, anch'essi da pubblicare:

| File | A cosa serve |
|---|---|
| `manifest.webmanifest` | Nome e icone quando il sito viene aggiunto alla schermata Home del telefono |
| `robots.txt` | Indicazioni per i motori di ricerca e posizione della sitemap |
| `sitemap.xml` | Elenco delle pagine per Google |

---

## 3. Struttura delle cartelle

```
aqua-sito/
├── index.html              Home
├── carta.html              Carta dei drink
├── food.html               Menu food
├── privacy.html            Privacy e cookie
├── 404.html                Pagina non trovata
├── manifest.webmanifest    Icona/nome per la schermata Home
├── robots.txt              Motori di ricerca
├── sitemap.xml             Elenco pagine per Google
├── .htaccess               Configurazione del server Apache (Aruba), vedi capitolo 8
│
├── data/                   CONTENUTI MODIFICABILI (file di testo)
│   ├── menu.properties     Carta dei drink
│   ├── food.properties     Menu food
│   └── foto.properties     Quale foto/video compare in ogni punto del sito
│
└── assets/                 RISORSE DEL SITO
    ├── css/
    │   ├── style.css       Tutto lo stile del sito
    │   └── fonts.css       Dichiarazione dei font
    ├── js/
    │   ├── main.js         Funzioni della home (intro, video, menu, orari, conto alla rovescia…)
    │   ├── carta.js        Costruisce carta e menu food dai file .properties
    │   └── properties.js   Legge i file .properties
    ├── fonts/              Cormorant Garamond e Manrope (.woff2), serviti dal sito
    ├── img/                Foto del sito
    ├── video/              Video della copertina (formati H.264 e HEVC, desktop e mobile)
    ├── icons/              Icone dei bicchieri e del menu, icone dell'app (192/512 px, Apple)
    ├── brand/logo.svg      Logo AQUA e stemma Q
    └── favicon.svg         Icona della scheda del browser

deploy/crea-pacchetto-aruba.sh   Crea il pacchetto aqua-aruba.zip da caricare su Aruba (non è parte del sito)
```

Nella cartella del progetto ci sono anche **file di lavoro che non fanno parte del sito** e non vanno
pubblicati (vedi [7.4](#74-cosa-contiene-il-pacchetto-e-cosa-no)).

---

## 4. Come funziona

### 4.1 Contenuti dai file `.properties`

I file in `data/` sono semplici file di testo nel formato `chiave = valore`; le righe che iniziano con `#`
sono commenti. All'apertura della pagina, `assets/js/properties.js` li scarica e li legge:

- `carta.js` costruisce **la carta** da `data/menu.properties` e **il menu food** da `data/food.properties`
  (la pagina indica quale file usare con l'attributo `data-source`);
- `main.js` e `carta.js` prendono da `data/foto.properties` il percorso di ogni foto e video.

Ogni file contiene in cima le istruzioni per modificarlo. Vanno salvati in **UTF-8** (per lettere
accentate e simbolo €).

### 4.2 La carta e il menu food

Per ogni voce si possono scrivere: `nome`, `ingredienti`, `prezzo`, `bicchiere` (icona: coppa, martini,
calice, flute, tumbler, highball) e `gruppo` (titoletto interno, usato per le famiglie dei gin).
Le categorie compaiono come schede in alto nell'ordine della riga `categorie`; con una sola categoria
(il menu food) la barra delle schede non compare.

Per passare da una categoria all'altra, oltre alle schede:
- **sul telefono** si scorre col dito sulla carta: verso sinistra si va alla categoria successiva
  (es. da Pre dinner ad After dinner), verso destra alla precedente. I gesti verticali, quelli sulla
  barra delle schede e quelli che partono dal bordo dello schermo (riservati al "torna indietro" del
  browser) vengono ignorati;
- **sul computer** si usano i tasti freccia **→** e **←**.

La riga degli ingredienti si adatta alla larghezza: 16 px su computer (su una riga), almeno 14 px su
telefono (le ricette lunghe vanno a capo).

### 4.3 La home

`assets/js/main.js` gestisce:

- **intro** con il logo (solo alla prima apertura nella sessione);
- **video della copertina**: sceglie il formato HEVC (più leggero) se il browser lo supporta,
  altrimenti H.264; versione desktop o mobile in base allo schermo. Se il video non può partire
  (risparmio dati, animazioni ridotte) mostra la foto del drink finito;
- **intestazione** che si nasconde scorrendo verso il basso e ricompare salendo;
- **menu di navigazione mobile**;
- **animazioni di comparsa** delle sezioni;
- **conto alla rovescia** fino all'inaugurazione (26/11/2026 ore 19:00); finita l'attesa scompare;
- **stato "aperto/chiuso"** calcolato sugli orari, sempre nell'ora italiana;
- **anno** nel piè di pagina.

### 4.4 Versioni dei file (`?v=…`)

Nelle pagine i fogli di stile e gli script sono richiamati con un numero di versione, per esempio
`assets/css/style.css?v=47`. Quando si modifica un file CSS o JS bisogna **aumentare quel numero in
tutte le pagine** che lo usano (`?v=48`): così i browser scaricano la versione nuova invece di usare
quella vecchia in memoria. Lo stesso vale per una foto o un video sostituiti mantenendo lo stesso nome
(vedi le istruzioni in `data/foto.properties`).

| File | Pagine che lo richiamano |
|---|---|
| `assets/css/style.css` | tutte e 5 le pagine HTML |
| `assets/css/fonts.css` | tutte e 5 le pagine HTML |
| `assets/js/carta.js` | `carta.html`, `food.html` |
| `assets/js/main.js`, `assets/js/properties.js` | `index.html` (properties.js anche carta e food) |
| `assets/icons/bicchieri.svg` | `index.html` e `assets/js/carta.js` |

### 4.5 Pagina 404

`404.html` contiene un piccolo script che fa puntare tutti i collegamenti alla radice del sito,
così grafica e link funzionano anche quando la pagina compare a un indirizzo profondo
(es. `/cartella/inesistente`). Funziona sia su GitHub (`/aqua-sito/`) sia su un dominio proprio (`/`).
Su Aruba va attivata con il file `.htaccess` (vedi [capitolo 8](#8-il-file-htaccess)).

### 4.6 Privacy

Il sito non usa cookie né archivi del browser per tracciare: usa solo la memoria di sessione per
ricordare che l'intro è già stata vista. La pagina `privacy.html` lo spiega.

---

## 5. Aggiornare i contenuti

| Cosa | Dove | Note |
|---|---|---|
| Drink, prezzi, ingredienti, bicchieri | `data/menu.properties` | Istruzioni in cima al file |
| Menu food | `data/food.properties` | Istruzioni in cima al file |
| Foto e video | `data/foto.properties` + file in `assets/img` / `assets/video` | Dimensioni consigliate indicate per ogni foto; JPG sotto 500 KB. La foto di copertina della home è scritta anche in `index.html` (per farla comparire subito): se la si cambia, aggiornarla in entrambi i punti |
| Orari di apertura | **3 punti**: tabella "Orari" in `index.html`; costante `HOURS` in `assets/js/main.js` (calcolo aperto/chiuso); `openingHoursSpecification` nei dati strutturati in cima a `index.html` | Vanno cambiati tutti e tre insieme |
| Data dell'inaugurazione | `index.html`: attributo `data-countdown` e testo "Inaugurazione…" | Dopo l'inaugurazione il conto alla rovescia sparisce da solo |
| Telefono, email, Instagram | `index.html`, sezione "Dove siamo" (`#contatti`) | **Oggi sono segnaposto** (`+39 000 000 0000`, `ciao@aqua.bar`, `instagram.com`): completarli prima della pubblicazione |
| Testi della home | `index.html` | |
| Privacy | `privacy.html` | **Ci sono campi da completare** evidenziati (titolare, indirizzo, email) e la parte sull'hosting da aggiornare per Aruba (vedi [7.2](#72-prima-di-caricare-completare-i-contenuti)) |

Dopo ogni modifica conviene provare il sito in locale (vedi [6.3](#63-provare-il-sito-sul-proprio-computer)).

---

## 6. Sviluppo e pubblicazione attuale (GitHub)

### 6.1 Branch

- **`devops`**: sviluppo, si lavora qui.
- **`main`**: versione per il cliente; si aggiorna facendo merge di `devops` in `main`.

### 6.2 GitHub Pages

Oggi il sito è pubblicato con GitHub Pages dal branch `main`:
`https://francescomalaccari98.github.io/aqua-sito/` (carta: `…/carta.html`, menu food: `…/food.html`).
Ogni push su `main` aggiorna il sito in circa un minuto. Il file `.nojekyll` serve solo a GitHub Pages.

### 6.3 Provare il sito sul proprio computer

Il sito va aperto da un piccolo server locale (aprendo direttamente il file `index.html` il browser
blocca il caricamento dei file `.properties`). Dal Terminale, nella cartella del progetto:

```bash
python3 -m http.server 8080 --bind 127.0.0.1
```

poi aprire `http://localhost:8080/`. Per fermarlo: `Ctrl+C`.

---

## 7. Pubblicazione su Aruba Hosting Linux

Il sito non richiede PHP né database: va bene **qualsiasi piano Hosting Linux** di Aruba.
I file si caricano via **FTP** (consigliato FileZilla) o con il **File Manager** del pannello Aruba.

Nel resto del capitolo `www.tuodominio.it` indica il dominio definitivo del locale.

### 7.1 Cosa serve

- Il **dominio** con l'**Hosting Linux** attivo su Aruba.
- Le **credenziali FTP**: le trovi nell'Area Clienti / pannello di controllo Aruba
  (host `ftp.tuodominio.it`, utente nel formato `1234567@aruba.it`, password).
  Se il servizio è "Hosting Windows + Linux", per lo spazio Linux l'host è `ftplnx.tuodominio.it`.
- Un client FTP, per esempio **FileZilla** (gratuito, Mac e Windows).
- Il **certificato SSL** attivo sul dominio (per l'indirizzo `https://`): si attiva/verifica dal
  pannello Aruba. Il sito funziona anche senza, ma il browser lo segnala come "non sicuro".

### 7.2 Prima di caricare: completare i contenuti

Queste modifiche si fanno nei file del progetto (sul branch `devops`, poi merge in `main`), **prima**
di creare il pacchetto:

**1. Completare i contatti** in `index.html` (telefono, email, link Instagram reale).

**2. Aggiornare `privacy.html`:**
- completare titolare, indirizzo ed email (campi evidenziati come "da completare");
- sezione 5 "Chi può trattarli": il fornitore di hosting diventa **Aruba S.p.A.** (non più GitHub, Inc.);
- sezione 6 "Trasferimento fuori dall'Unione europea": con Aruba i server sono in Italia, quindi il
  testo su GitHub e Stati Uniti va tolto o sostituito (da verificare con le condizioni del contratto Aruba);
- indicare il fornitore della posta elettronica.

Il file `.htaccess` è già pronto nel progetto (vedi [capitolo 8](#8-il-file-htaccess)).

### 7.3 Creare il pacchetto per Aruba

Il pacchetto si crea con uno script che copia **solo** i file del sito pubblico in un file
**`aqua-aruba.zip`**, nella cartella del progetto. Lo zip **non va su Git** (è escluso con `.gitignore`):
si ricrea ogni volta che serve. Dal Terminale, nella cartella del progetto:

```bash
deploy/crea-pacchetto-aruba.sh tuodominio.it
```

(con il dominio reale, senza `https://` e senza `www`). Lo script:

1. copia nel pacchetto i file elencati al punto 7.4, senza i file di sistema del Mac;
2. esclude i file "calice" (video precedente della copertina, circa 26 MB) se `data/foto.properties`
   non li usa;
3. **scrive il dominio definitivo** al posto dell'indirizzo GitHub, solo nella copia del pacchetto
   (il progetto resta com'è, perché la versione su GitHub continua a funzionare):

   | File | Cosa cambia |
   |---|---|
   | `index.html` | anteprima social (`og:image`, `og:url`), `canonical`, dati strutturati (`url`, `image`, `hasMenu`) |
   | `carta.html`, `food.html` | `og:image`, `og:url`, `canonical` |
   | `robots.txt` | riga `Sitemap:` |
   | `sitemap.xml` | tutte le righe `<loc>` |
   | `.htaccess` | il dominio nel blocco HTTPS (che resta disattivato, vedi capitolo 8) |

4. **avvisa** se trova ancora contatti segnaposto, campi "da completare" nella privacy o GitHub
   indicato come hosting.

Senza il dominio (`deploy/crea-pacchetto-aruba.sh`) il pacchetto mantiene gli indirizzi GitHub:
va bene per una prova, non per la pubblicazione definitiva.

Aprendo lo zip si ottiene la cartella **`aqua-aruba`**: su Aruba va caricato il **suo contenuto**,
non la cartella stessa. Il file `.htaccess` inizia con un punto ed è nascosto nel Finder:
per vederlo premere **Cmd + Maiusc + .** (punto).

### 7.4 Cosa contiene il pacchetto (e cosa no)

Il pacchetto contiene **solo** questi file e cartelle, con struttura e nomi esatti
(sul server Linux le **maiuscole/minuscole contano**: `Foto.jpg` e `foto.jpg` sono file diversi):

```
.htaccess                 (configurazione del server, vedi capitolo 8)
index.html
carta.html
food.html
privacy.html
404.html
manifest.webmanifest
robots.txt
sitemap.xml
assets/                   (tutta la cartella, con tutte le sottocartelle)
data/                     (tutta la cartella)
```

Peso: circa **25 MB** compressi (58 file), quasi tutto video.

Tutto il resto della cartella del progetto **non va caricato** e non è nel pacchetto. In particolare:

| File / cartella | Perché |
|---|---|
| `.git/`, `.gitattributes`, `.gitignore` | File di Git (storia del progetto): non servono al sito e non devono essere pubblici |
| `.nojekyll` | Serve solo a GitHub Pages |
| `.claude/` | Configurazione degli strumenti di sviluppo |
| `.DS_Store` (in qualsiasi cartella) | File di sistema del Mac |
| `README.md`, `DOCUMENTAZIONE.md`, `CHECKLIST-MESSA-ONLINE.md` | Documentazione interna |
| `deploy/` | Lo script che crea il pacchetto |
| `aqua-aruba.zip` | Il pacchetto stesso |
| `Aqua_checklist_messa_online.docx` | Documento di lavoro |
| `8449557-uhd_3840_2160_25fps.mp4` | Video originale in 4K (23 MB) da cui sono ricavati i video del sito: non è usato dalle pagine |
| Qualsiasi altra cartella non elencata sopra | Non fa parte del sito pubblico |

### 7.5 Caricamento con FileZilla

1. **Configurare la connessione** (File › Gestore siti › Nuovo sito):
   - Protocollo: **FTP**
   - Host: `ftp.tuodominio.it` (o `ftplnx.tuodominio.it`, vedi 7.1)
   - Crittografia: **"Richiedi FTP esplicito su TLS"** (FTPS, più sicuro); se non si connette, "Usa FTP semplice"
   - Tipo di accesso: Normale · Utente e Password dal pannello Aruba
2. **Mostrare i file nascosti**, altrimenti `.htaccess` non si vede: menu *Server › Forza visualizzazione file nascosti*.
3. **Entrare nella cartella del sito**: è la cartella principale dello spazio web del dominio
   (quella che contiene la pagina provvisoria di Aruba, di solito un `index.html` o `index.php`).
   A seconda della configurazione può comparire direttamente, oppure dentro una cartella con il nome
   del dominio o chiamata `web`/`htdocs`: in caso di dubbio verificarlo nel pannello Aruba.
   **Non caricare nulla nelle cartelle di sistema o di log.**
4. **Eliminare la pagina provvisoria di Aruba** (`index.html` / `index.php` di benvenuto), così non
   resta un file che prende il posto della home.
5. **Trascinare** sul server tutto il **contenuto** della cartella `aqua-aruba` (estratta dallo zip),
   compreso `.htaccess`.
   FileZilla trasferisce i video in modalità binaria in automatico: lasciare l'impostazione predefinita
   (*Trasferimento › Tipo di trasferimento › Automatico*).
6. Al termine controllare nella coda di FileZilla che non ci siano **trasferimenti falliti**.

**Permessi:** quelli predefiniti di Aruba vanno bene (cartelle 755, file 644). Non servono permessi
speciali perché il sito non scrive niente sul server.

**In alternativa a FTP:** il **File Manager** del pannello Aruba permette di caricare file e cartelle
dal browser; comodo per piccoli aggiornamenti, più lento per il primo caricamento.

### 7.6 HTTPS e indirizzo con/senza www

- Attivare il certificato SSL dal pannello e attendere che sia operativo (`https://www.tuodominio.it`
  si apre senza avvisi).
- **Solo dopo** attivare il reindirizzamento a `https://` nel `.htaccess` (blocco già pronto nel
  capitolo 8): se lo si attiva prima, il sito diventa irraggiungibile.
- Scegliere un indirizzo principale (consigliato **con www**, quello scritto dallo script del punto 7.3)
  e usarlo ovunque, anche nel QR code.

### 7.7 QR code della carta

Se i QR code già stampati puntano all'indirizzo GitHub (`…github.io/aqua-sito/carta.html`):
- **lasciare attivo GitHub Pages** finché i QR vecchi sono in circolazione, così continuano a funzionare;
- per i nuovi QR usare `https://www.tuodominio.it/carta.html`
  (e `https://www.tuodominio.it/food.html` per il menu food).

Le pagine indicano a Google l'indirizzo principale (`canonical`), quindi le due copie non si fanno
concorrenza nei risultati di ricerca.

---

## 8. Il file `.htaccess`

Il file `.htaccess` è già pronto nella cartella principale del progetto (accanto a `index.html`) ed è
incluso nel pacchetto per Aruba. Il server Apache di Aruba lo legge da solo. Il file:

- mostra la **pagina 404** del sito per gli indirizzi inesistenti;
- dichiara i **tipi di file** e la codifica **UTF-8** (lettere accentate e €);
- attiva la **compressione** e la **cache** del browser (pagine e file `data/*.properties` sempre
  aggiornati; stili, script, font, foto e video conservati 30 giorni, i font un anno);
- aggiunge alcune **protezioni di base** e impedisce l'elenco dei file nelle cartelle;
- contiene, **disattivato**, il reindirizzamento di tutto il sito a `https://www.`.

**Attivare il reindirizzamento HTTPS** (solo dopo che il certificato SSL funziona, vedi 7.6):
aprire `.htaccess` con un editor di testo, togliere il `#` all'inizio delle 6 righe del blocco
"HTTPS e www", sostituire `tuodominio.it` con il dominio reale e ricaricare il file.
Il pacchetto creato con il dominio (punto 7.3) ha già il dominio scritto: resta solo da togliere i `#`.

Se dopo l'attivazione il browser mostra "troppi reindirizzamenti", su quel server la connessione
sicura arriva tramite un proxy: sostituire la riga `RewriteCond %{HTTPS} off [OR]` con
`RewriteCond %{HTTP:X-Forwarded-Proto} !https [OR]`. Per tornare indietro basta rimettere i `#`.

Se il server rispondesse con "500 Internal Server Error" dopo il caricamento del `.htaccess`,
rinominarlo temporaneamente (es. `htaccess.txt`) per rimettere online il sito e verificare con
l'assistenza Aruba quale istruzione non è ammessa.

---

## 9. Controlli dopo la pubblicazione

Da computer e da telefono (in una finestra anonima, per non vedere versioni in memoria):

- [ ] `https://www.tuodominio.it/` si apre con il lucchetto, senza avvisi
- [ ] La home mostra l'intro, poi il **video** della copertina (anche su iPhone)
- [ ] Il **menu mobile** si apre e tutte le voci portano alla sezione giusta
- [ ] **Orari**, conto alla rovescia / stato aperto-chiuso e **contatti** corretti
- [ ] `…/carta.html`: la carta si carica con tutte le categorie, icone dei bicchieri e prezzi con €
- [ ] `…/food.html`: menu food con lo sfondo e i prezzi
- [ ] Le lettere accentate (Curaçao, è, à…) si vedono correttamente
- [ ] `…/privacy.html`: nessun campo "da completare" rimasto, hosting indicato come Aruba
- [ ] `…/pagina-che-non-esiste`: compare la **pagina 404** con grafica e link funzionanti
- [ ] `http://tuodominio.it` porta a `https://www.tuodominio.it` (dopo l'attivazione del punto 7.6)
- [ ] `…/robots.txt` e `…/sitemap.xml` si aprono e contengono il nuovo dominio
- [ ] Il **QR code** della carta apre la pagina giusta
- [ ] Condividendo il link su WhatsApp compare l'anteprima con foto e titolo

**Google:** registrare il dominio in **Google Search Console** e inviare la sitemap
`https://www.tuodominio.it/sitemap.xml`. Utile anche aggiornare la scheda **Google Business Profile**
del locale con il nuovo indirizzo del sito.

---

## 10. Aggiornamenti successivi

1. Modificare i file sul branch `devops`, provarli in locale, poi merge in `main`.
2. Ricreare il pacchetto con `deploy/crea-pacchetto-aruba.sh tuodominio.it`.
3. Caricare su Aruba, **dalla cartella `aqua-aruba` del pacchetto**, solo i file cambiati,
   sovrascrivendo quelli sul server (FileZilla chiede conferma: scegliere "Sovrascrivi").
   Le pagine HTML vanno prese sempre dal pacchetto e non dal progetto, perché solo nel pacchetto
   hanno il dominio definitivo.

| Modifica | Cosa caricare |
|---|---|
| Carta, prezzi, menu food | Solo `data/menu.properties` o `data/food.properties` |
| Foto nuova | Il file in `assets/img/` + `data/foto.properties` |
| Testi della home / orari / contatti | `index.html` (e `assets/js/main.js` se cambiano gli orari) |
| Stile o funzioni | I file in `assets/css/` o `assets/js/` **e** le pagine HTML in cui è stato aumentato il `?v=…` |

I file `.properties` e le pagine HTML non vengono conservati in memoria dal browser (vedi `.htaccess`),
quindi le modifiche ai contenuti si vedono subito.

---

## 11. Problemi frequenti

| Problema | Causa probabile | Soluzione |
|---|---|---|
| Si vede ancora la pagina di benvenuto di Aruba | È rimasto il file provvisorio, o i file sono nella cartella sbagliata | Eliminare l'`index.html`/`index.php` di Aruba; verificare che `index.html` del sito sia nella cartella principale del dominio |
| "Non riusciamo a caricare la carta in questo momento" | Manca `data/menu.properties` (o `food.properties`), oppure nome/maiuscole diversi | Ricaricare la cartella `data/` con i nomi esatti |
| Foto o video mancanti | File non caricato, trasferimento interrotto, o maiuscole diverse dal percorso in `foto.properties` | Controllare la coda di FileZilla e i nomi dei file |
| Lettere accentate sbagliate nella carta | File `.properties` salvato non in UTF-8 | Risalvarlo in UTF-8 e ricaricarlo |
| Dopo una modifica allo stile si vede la versione vecchia | Numero `?v=` non aumentato | Aumentarlo in tutte le pagine e ricaricarle |
| La pagina 404 è senza grafica | `.htaccess` mancante o senza la riga `ErrorDocument` | Caricare il `.htaccess` del capitolo 8 |
| "Troppi reindirizzamenti" | Variante del reindirizzamento HTTPS | Vedi le note al capitolo 8 |
| Errore 500 su tutto il sito | Un'istruzione del `.htaccess` non è accettata | Rinominare il `.htaccess` e verificare con l'assistenza Aruba |
| Il video non parte su iPhone | File `.hevc.mp4` o `.mp4` mancante o caricato male | Ricaricare la cartella `assets/video/` |
