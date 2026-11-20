# Lo specchio di Aqua

Specchio digitale: la webcam riprende chi c'è davanti e lo schermo mostra il riflesso con un filtro che deforma il volto (occhioni, faccia gonfia, faccia secca…).

## Come si apre

- **Online:** `https://francescomalaccari98.github.io/aqua-sito/smart-mirror/` (dopo il merge su `main`). Il sito del bar non ha link a questa pagina e Google non la indicizza.
- **Avvio rapido (consigliato), con doppio clic:**
  - **Mac:** `smart-mirror/avvia-specchio-mac.command`. Se macOS dice che non può aprirlo: clic destro › Apri.
  - **Windows:** `smart-mirror/avvia-specchio-windows.bat`. Se compare "Windows ha protetto il PC": Ulteriori informazioni › Esegui comunque. Non serve installare Python: il server è dentro lo script.
  - Il file avvia il server locale, apre Chrome (o Edge, se Chrome non c'è) a schermo intero sullo specchio e tiene acceso lo schermo. Chiudendo lo specchio (**Cmd+Q** su Mac, **Alt+F4** su Windows) il server si ferma da solo. Se lo specchio è già aperto, un secondo doppio clic non apre niente.
  - Il browser usa un profilo separato ("Aqua Specchio"): permesso della videocamera e impostazioni restano memorizzati, e il Chrome di tutti i giorni non viene toccato.
  - Lo schermo intero si apre sullo **schermo principale**: rendere principale la TV (Mac: Impostazioni di Sistema › Monitor; Windows: Impostazioni › Sistema › Schermo › "Imposta come schermo principale").
  - Non chiudere la finestra del Terminale / prompt mentre lo specchio è acceso: chiuderla chiude anche lo specchio.
  - Ogni avvio scrive un registro, utile se qualcosa non va: Mac `~/Library/Logs/Aqua Specchio.log`, Windows `%LOCALAPPDATA%\Aqua Specchio.log`.
  - Avvio automatico all'accensione: Mac › Impostazioni di Sistema › Generali › Elementi login › aggiungi il file; Windows › tasto Win+R, `shell:startup`, e mettere lì un collegamento al file `.bat`.
  - Windows: la videocamera deve essere consentita in Impostazioni › Privacy e sicurezza › Fotocamera › "Consenti alle app desktop di accedere alla fotocamera".
- **In locale, a mano:** avviare il server di sviluppo e aprire `http://localhost:8080/smart-mirror/`.
- La webcam funziona solo da `https://` o da `http://localhost`, non aprendo il file direttamente.
- Browser consigliati: Chrome o Edge aggiornati.

## Comandi

| Tasto | Cosa fa |
|---|---|
| H o M | nasconde / mostra i comandi (doppio clic sullo specchio li riapre) |
| ← → | filtro precedente / successivo |
| R | ruota l'immagine di 90° in senso orario (0° → 90° → 180° → 270°) |
| F | schermo intero |
| Spazio | avvia / ferma il cambio automatico del filtro |
| D | dati tecnici e diagnostica (vedi sotto) |
| E | modalità di test: con effetti → senza deformazioni → solo video |
| C | passa alla videocamera successiva (anche l'iPhone con Continuity Camera) |

Le impostazioni (filtro, intensità, videocamera, orientamento, cambio automatico, comandi nascosti) restano memorizzate sul computer dello specchio.

## Riconoscimento da lontano, con occhiali o in due

- **Distanza** (nel pannello): *Automatica* analizza tutta l'immagine e, se non trova nessuno, prova da sola uno zoom 1,8× al centro, così i volti lontani diventano abbastanza grandi per il riconoscimento. *Vicino*, *Lontano* (1,5×) e *Molto lontano* (2×) fissano la scelta. Lo zoom riguarda solo l'analisi: l'immagine dello specchio non cambia.
- Un volto che sfugge per un istante (occhiali, testa girata) conserva l'effetto per mezzo secondo invece di sparire e riapparire. Un volto nuovo riceve l'effetto solo dopo tre riconoscimenti di fila, così non compaiono deformazioni su volti "fantasma".
- Con più persone ognuna tiene il proprio effetto: i volti vengono riabbinati a ogni fotogramma in base alla posizione.
- Per i risultati migliori: videocamera all'altezza degli occhi e al centro dello schermo, viso illuminato da davanti (non luce alle spalle), non più di 3 persone insieme.
- Con il tasto D compaiono i dati tecnici: volti trovati, tempo di analisi, zoom in uso.

## Orientamento dello schermo

Nel pannello, alla voce **Orientamento schermo**:

- **Rotazione** 0°, 90° (senso orario), 180°, 270° (senso antiorario). Ruota solo l'immagine dello specchio e le scritte sopra, non il pannello. Serve quando la TV è montata in verticale ma il computer la vede ancora orizzontale, anche su Mac, dove spesso non si può ruotare un monitor esterno.
- **Immagine**: *Riempi* occupa tutto lo schermo e taglia i bordi che avanzano; *Contieni* mostra l'immagine intera, con bande scure dove non arriva.
- **Ripristina** torna a 0°.
- **Scritte sullo specchio**: se disattivate, sullo schermo resta solo l'immagine della webcam.

Per una TV montata in verticale: si sceglie la rotazione con cui il volto appare dritto. Se la TV è girata in senso antiorario serve 90°, se è girata in senso orario serve 270°. La rotazione cambia solo il disegno finale: il riconoscimento del volto lavora sempre sull'immagine originale della webcam.

## Diagnostica (tasto D)

Nel pannello, alla voce **Test e diagnostica › Apri**, ci sono i collegamenti agli indirizzi principali; quello aperto è evidenziato.

### Indirizzi

Tutti partono da `http://localhost:8080/smart-mirror/` e le opzioni si possono combinare con `&`.

| Opzione | Valori | Cosa fa |
|---|---|---|
| `diagnostica` | — | apre lo specchio con i dati tecnici già visibili |
| `sorgente` | `webcam` (predefinita), `griglia` | immagine della videocamera oppure griglia generata, senza videocamera |
| `volto` | `simulato` (predefinito con la griglia), `mediapipe` | con la griglia: volto simulato fisso oppure riconoscimento vero |
| `elaborazione` | `completa` (predefinita), `senza-deformazioni`, `solo-video` | parte già nella modalità di test indicata |
| `riconoscimento` | `worker` (predefinito), `sincrono` | dove gira MediaPipe: in un thread separato, oppure sul thread principale prima del disegno (com'era prima della Fase 2, per confronto) |

| Collegamento nel pannello | Indirizzo |
|---|---|
| Specchio | `…/smart-mirror/` |
| Diagnostica | `…/smart-mirror/?diagnostica` |
| Diagnostica · riconoscimento sincrono | `…/smart-mirror/?diagnostica&riconoscimento=sincrono` |
| Test filtri · griglia e volto simulato | `…/smart-mirror/?sorgente=griglia&volto=simulato` |
| Test riconoscimento · griglia e MediaPipe | `…/smart-mirror/?sorgente=griglia&volto=mediapipe` |

Esempi combinati: `?diagnostica&elaborazione=senza-deformazioni` (confronto senza effetti con i dati tecnici aperti), `?sorgente=griglia&volto=mediapipe&diagnostica` (tempi del riconoscimento senza videocamera). I vecchi indirizzi `?diag`, `?prova` e `?prova=ai` funzionano ancora.

Il tasto **D** (o il pulsante *Dati tecnici* nel pannello, oppure l'indirizzo `.../smart-mirror/?diagnostica`) apre il pannello **Dati tecnici**, che misura senza cambiare niente:

- **Videocamera:** nome, risoluzione effettiva (`getSettings()`), fps dichiarati e **fps reali**, intervallo tra i fotogrammi, fotogrammi non ricevuti, massimo possibile della videocamera.
- **Rendering e schermo:** fps del disegno, frequenza stimata dello schermo, vsync persi, tempo di disegno, risoluzione del canvas, finestra, schermo e GPU usata.
- **Riconoscimento:** dove gira (worker o sincrono), delegato (GPU o CPU), tempo di inferenza MediaPipe (media, p95, massimo), andata e ritorno verso il worker, analisi al secondo e analisi ripetute sullo stesso fotogramma, di quanto vengono spostati in avanti i punti del volto (previsione).
- **Thread principale:** blocchi dell'ultimo minuto e, dove disponibile, la pressione della CPU (calore).
- **Ritardo del video:** acquisizione → disegno, solo se il browser fornisce l'ora di acquisizione del fotogramma; altrimenti è scritto "non misurabile".
- **Orientamento e formato:** immagine diritta (deve essere 9:16 con la TV verticale), chi ruota (macOS o l'app), quanta parte della videocamera usa *Riempi* e di quanto viene ingrandita.

In alto compaiono gli **avvisi** (doppia rotazione, pochi fps per poca luce, schermo a 30 Hz, riconoscimento su CPU…). Sullo specchio compaiono i punti del volto, il bordo dell'immagine della videocamera e la scritta **↑ ALTO**, che deve puntare verso il soffitto.

Pulsanti: **Azzera** (le misure ripartono; succede da solo cambiando videocamera o modalità), **Copia report** (tutti i valori in testo, da incollare in un messaggio), **Scarica log** (un campione al secondo da quando il pannello è aperto, in JSON).

**Modalità di test** (tasto E o *Elaborazione* nel pannello): *Completa* (normale), *Senza deformazioni* (riconoscimento attivo, nessun effetto) e *Solo video* (nessuna elaborazione). Serve a confrontare nitidezza, ritardo e fluidità. Una targhetta in alto a destra ricorda che il test è attivo; ricaricando la pagina si torna sempre a *Completa*.

**TV verticale:** ruotare l'immagine **o** da macOS (Impostazioni di Sistema › Monitor › Rotazione) **o** dall'app (Rotazione 90°/270°), mai da entrambi. La diagnostica segnala la doppia rotazione.

**iPhone come videocamera (Continuity Camera):** iPhone vicino al Mac, stesso Apple ID, Wi-Fi e Bluetooth attivi, iPhone bloccato e fermo. Compare nel menu *Videocamera* (pulsante ↻ per aggiornare l'elenco) e si raggiunge anche con il tasto C.

## Prova senza webcam

`.../smart-mirror/?sorgente=griglia&volto=simulato` mostra una griglia con un volto simulato al posto della webcam: serve per controllare i filtri senza nessuno davanti allo schermo. `?sorgente=griglia&volto=mediapipe` usa la stessa griglia ma con il riconoscimento vero, per controllare che MediaPipe si avvii e misurarne i tempi.

## Come funziona

- `index.html`, `mirror.css`, `mirror.js`: pagina, stile e funzionamento.
- `vendor/mediapipe/`: libreria e modello di riconoscimento del volto (Google MediaPipe, licenza Apache 2.0), salvati qui così lo specchio funziona anche senza Internet. Vedi `vendor/mediapipe/NOTICE.md`.
- `face-worker.js`: il riconoscimento del volto (MediaPipe) in un thread separato. Ogni fotogramma nuovo della videocamera viene disegnato subito con gli ultimi punti del volto, spostati in avanti in base alla loro velocità (previsione), mentre il worker analizza il fotogramma. Così il riconoscimento (~20 ms) non ritarda più l'immagine. Se il worker non parte, lo specchio usa da solo il riconoscimento sul thread principale (la diagnostica lo segnala).
- `diagnostics.js`: la diagnostica (tasto D).
- Ogni filtro è una combinazione di deformazioni locali (ingrandire, rimpicciolire, allungare, spostare) intorno a occhi, naso, bocca, guance, mento e fronte. Si aggiungono o regolano nella funzione `warpFace` di `mirror.js`.

## Privacy

Le immagini sono elaborate solo nel browser del computer dello specchio: niente viene registrato, salvato o inviato. Il riconoscimento trova la posizione di occhi, naso e bocca, ma non identifica le persone. Conviene comunque mettere un cartello vicino allo specchio, per esempio: "Specchio digitale con filtri: le immagini non vengono registrate".
