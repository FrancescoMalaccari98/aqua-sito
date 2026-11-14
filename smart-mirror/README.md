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
| F | schermo intero |
| Spazio | avvia / ferma il cambio automatico del filtro |
| D | dati tecnici per le regolazioni (fps, volti, tempi del riconoscimento) |

Le impostazioni (filtro, intensità, videocamera, cambio automatico, comandi nascosti) restano memorizzate sul computer dello specchio.

## Prova senza webcam

`.../smart-mirror/?prova` mostra una griglia con un volto finto al posto della webcam: serve per controllare i filtri senza nessuno davanti allo schermo.

## Come funziona

- `index.html`, `mirror.css`, `mirror.js`: pagina, stile e funzionamento.
- `vendor/mediapipe/`: libreria e modello di riconoscimento del volto (Google MediaPipe, licenza Apache 2.0), salvati qui così lo specchio funziona anche senza Internet. Vedi `vendor/mediapipe/NOTICE.md`.
- Ogni filtro è una combinazione di deformazioni locali (ingrandire, rimpicciolire, allungare, spostare) intorno a occhi, naso, bocca, guance, mento e fronte. Si aggiungono o regolano nella funzione `warpFace` di `mirror.js`.

## Privacy

Le immagini sono elaborate solo nel browser del computer dello specchio: niente viene registrato, salvato o inviato. Il riconoscimento trova la posizione di occhi, naso e bocca, ma non identifica le persone. Conviene comunque mettere un cartello vicino allo specchio, per esempio: "Specchio digitale con filtri: le immagini non vengono registrate".
