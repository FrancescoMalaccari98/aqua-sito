# Lo specchio di Aqua

Specchio digitale: la webcam riprende chi c'è davanti e lo schermo mostra il riflesso con un filtro che deforma il volto (occhioni, faccia gonfia, faccia secca…).

## Come si apre

- **Online:** `https://francescomalaccari98.github.io/aqua-sito/smart-mirror/` (dopo il merge su `main`). Il sito del bar non ha link a questa pagina e Google non la indicizza.
- **In locale:** avviare il server di sviluppo e aprire `http://localhost:8080/smart-mirror/`.
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
| D | dati tecnici per le regolazioni (fps, volti, tempi del riconoscimento) |

Le impostazioni (filtro, intensità, videocamera, orientamento, cambio automatico, comandi nascosti) restano memorizzate sul computer dello specchio.

## Orientamento dello schermo

Nel pannello, alla voce **Orientamento schermo**:

- **Rotazione** 0°, 90° (senso orario), 180°, 270° (senso antiorario). Ruota solo l'immagine dello specchio e le scritte sopra, non il pannello. Serve quando la TV è montata in verticale ma il computer la vede ancora orizzontale, anche su Mac, dove spesso non si può ruotare un monitor esterno.
- **Immagine**: *Riempi* occupa tutto lo schermo e taglia i bordi che avanzano; *Contieni* mostra l'immagine intera, con bande scure dove non arriva.
- **Ripristina** torna a 0°.
- **Scritte sullo specchio**: se disattivate, sullo schermo resta solo l'immagine della webcam.

Per una TV montata in verticale: si sceglie la rotazione con cui il volto appare dritto. Se la TV è girata in senso antiorario serve 90°, se è girata in senso orario serve 270°. La rotazione cambia solo il disegno finale: il riconoscimento del volto lavora sempre sull'immagine originale della webcam.

## Prova senza webcam

`.../smart-mirror/?prova` mostra una griglia con un volto finto al posto della webcam: serve per controllare i filtri senza nessuno davanti allo schermo.

## Come funziona

- `index.html`, `mirror.css`, `mirror.js`: pagina, stile e funzionamento.
- `vendor/mediapipe/`: libreria e modello di riconoscimento del volto (Google MediaPipe, licenza Apache 2.0), salvati qui così lo specchio funziona anche senza Internet. Vedi `vendor/mediapipe/NOTICE.md`.
- Ogni filtro è una combinazione di deformazioni locali (ingrandire, rimpicciolire, allungare, spostare) intorno a occhi, naso, bocca, guance, mento e fronte. Si aggiungono o regolano nella funzione `warpFace` di `mirror.js`.

## Privacy

Le immagini sono elaborate solo nel browser del computer dello specchio: niente viene registrato, salvato o inviato. Il riconoscimento trova la posizione di occhi, naso e bocca, ma non identifica le persone. Conviene comunque mettere un cartello vicino allo specchio, per esempio: "Specchio digitale con filtri: le immagini non vengono registrate".
