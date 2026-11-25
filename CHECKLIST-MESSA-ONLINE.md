# Aqua — Cosa manca per andare online

Elenco di tutto ciò che serve per pubblicare il sito sul dominio definitivo (Aruba Hosting Linux):
dati da ricevere, decisioni da prendere, passaggi tecnici e altri aspetti.
**Si aggiorna man mano**: quando arriva un'informazione la voce passa in fondo, tra le cose fatte;
quando emerge qualcosa di nuovo si aggiunge qui.

Ultimo aggiornamento: **25/11/2026** · Inaugurazione: **giovedì 3/12/2026, ore 19:00** (rimandata dal 26/11)
Riprende e aggiorna il documento `Aqua_checklist_messa_online.docx` del 13/11/2026.

**Legenda priorità**
- **BLOCCANTE**: senza, il sito non può andare online sul dominio definitivo
- **CONSIGLIATO**: il sito funziona anche senza, ma è meglio farlo
- **LO FACCIO IO**: lavoro tecnico che preparo io quando arrivano i dati o il via

Come si pubblica, passo per passo: [DOCUMENTAZIONE.md](DOCUMENTAZIONE.md), capitolo 7.

---

## 1. Dati e contenuti da ricevere

| # | Cosa manca | Dove va | Priorità |
|---|---|---|---|
| 1.1 | **Dominio definitivo** (es. `www.aquacocktailbar.it`) e scelta con/senza www | Pacchetto per Aruba, anteprime social, sitemap, QR code | BLOCCANTE |
| 1.2 | **Dati del titolare per la privacy**: ragione sociale, sede legale, email per la privacy, fornitore della casella email | `privacy.html`, punti 1 e 5 (oggi riquadri gialli "da completare", visibili a tutti) | BLOCCANTE |
| 1.3 | **Partita IVA e dati societari nel footer**: verificare con il commercialista se vanno indicati (art. 35 DPR 633/1972; per le società anche sede, REA e capitale sociale, art. 2250 c.c.) | Footer di tutte le pagine | BLOCCANTE |
| 1.4 | **Telefono per le prenotazioni** (ed eventualmente se risponde su WhatsApp e in che orari) | Home › Dove siamo › Scriveteci (oggi `+39 000 000 0000`, finto) e dati strutturati per Google | BLOCCANTE |
| 1.5 | **Email di contatto** | Home › Dove siamo (oggi `ciao@aqua.bar`, inesistente) | BLOCCANTE |
| 1.6 | **Profilo Instagram** (ed eventuali Facebook/TikTok) | Home › Dove siamo › Seguiteci (oggi porta alla home di Instagram) | BLOCCANTE |
| 1.7 | **Carta — Signature**: prezzi di tutte e 8; ingredienti e bicchiere di **Sofia**, **Rolex BR1**, **Old Man** | `data/menu.properties` | BLOCCANTE |
| 1.8 | **Carta — Vini: vendita al calice**. I prezzi inseriti il 25/11 sono alla bottiglia (confermato dal locale). Da sapere: si venderà anche al calice? Se sì, a che prezzo (il sito mostra calice e bottiglia insieme). Birre: la categoria "Birre e vini" resta nascosta finché è vuota | `data/menu.properties` | DA CONFERMARE |
| 1.8b | **Carta — Champagne: prezzi mancanti** di Dom Pérignon Rosé, Armand de Brignac, Laurent-Perrier Blanc de Blancs, Moët & Chandon Ice Impérial. Confermare che "Dom Pérignon Rosé" della lista quantità e "Dom Pérignon Vintage 2013 Luminous" della carta dei vini siano due bottiglie diverse, e che i Mandois (solo nella carta dei vini) siano disponibili | `data/menu.properties` | BLOCCANTE |
| 1.9 | **Carta — Campari Soda**: confermare (nella lista originale era segnato con "?") | `data/menu.properties`, Beverage | BLOCCANTE |
| 1.10 | **Testi della home da confermare** (scritti come esempio, sono affermazioni sul locale): "Miscelazione d'autore" e "L'arte del bere lentamente"; Filosofia: "Un bancone, poche sedute, nessuna fretta" e "produttori vicini, sciroppi fatti in casa, ghiaccio limpido tagliato a mano"; i numeri "**24** coperti, non uno di più" e "**0** preparati industriali"; didascalia "Old Fashioned affumicato al legno di ciliegio"; Il rito: "blocchi congelati per quarantotto ore", "pesato al grammo", "una guarnizione sola"; Il bar: "Luce bassa, ottone, legno scuro"; descrizione per Google e WhatsApp | `index.html` | BLOCCANTE |
| 1.11 | **Numero di signature in home**: dice "**5** signature della casa", ma ora la carta ne ha **8**. Confermare il numero giusto | `index.html`, Filosofia | BLOCCANTE |
| 1.12 | **Firma della citazione**: "L'arte più nobile è quella di rendere gli altri felici" è una frase nota attribuita a P. T. Barnum, ma è firmata "— Il nostro capo barman". Decidere: firmare con l'autore, con il nome del barman o togliere la firma | `index.html`, citazione | BLOCCANTE |
| 1.13 | **Descrizione delle Signature**: dice "chiedeteci come sono fatte", ma ora gli ingredienti sono scritti. Confermare o cambiare la frase | `data/menu.properties` | CONSIGLIATO |
| 1.14 | **Gin tonic**: bicchiere in cui si serve e se vale il supplemento per il servizio al tavolo (come per le altre categorie) | `data/menu.properties` | CONSIGLIATO |
| 1.15 | **Menu food**: se vale il supplemento per il servizio al tavolo | `data/food.properties` | CONSIGLIATO |
| 1.16 | **Orario della serata di inaugurazione** (giovedì 3/12): dalle 19:00 il sito mostra gli orari normali del giovedì ("Aperto ora · fino alle 22:00"). Se quella sera si chiude più tardi, imposto un orario speciale. Confermare anche che si inizia alle 19:00 | `assets/js/main.js`, `index.html` | CONSIGLIATO (entro il 3/12) |
| 1.17 | **Foto reali del locale**: oggi tutte le foto sono di archivio (Unsplash e Pexels), compresi lo sfondo della carta e quello del menu food. "Dove siamo" mostra un bancone che non è quello di Aqua. Servono JPG di almeno 1200 px, senza scritte; per persone riconoscibili serve il loro consenso scritto | `data/foto.properties`, `assets/img/` | CONSIGLIATO |

---

## 2. Passaggi tecnici per la pubblicazione su Aruba

| # | Cosa fare | Chi | Priorità |
|---|---|---|---|
| 2.1 | Acquistare/attivare **dominio + Hosting Linux** su Aruba | Titolare | BLOCCANTE |
| 2.2 | Recuperare le **credenziali FTP** dal pannello Aruba (host, utente, password) | Titolare / Francesco | BLOCCANTE |
| 2.3 | Attivare il **certificato SSL** sul dominio (per `https://`) | Pannello Aruba | BLOCCANTE |
| 2.4 | Creare la **casella email** sul dominio, se si usa quella come contatto (punto 1.5) | Pannello Aruba | CONSIGLIATO |
| 2.5 | Aggiornare la **privacy per Aruba**: hosting Aruba S.p.A. al posto di GitHub, togliere la parte sul trasferimento negli Stati Uniti, aggiungere il fornitore email | LO FACCIO IO, con i dati del punto 1.2 | BLOCCANTE |
| 2.6 | Completare i **dati strutturati per Google** (telefono, email; aggiungere anche il menu food) | LO FACCIO IO, con i dati dei punti 1.4 e 1.5 | CONSIGLIATO |
| 2.7 | **Rigenerare il pacchetto** `aqua-aruba.zip` con il dominio (`deploy/crea-pacchetto-aruba.sh tuodominio.it`) e controllare che non dia più avvisi | LO FACCIO IO, al tuo via | BLOCCANTE |
| 2.8 | **Caricare** il contenuto del pacchetto via FTP ed eliminare la pagina provvisoria di Aruba | DOCUMENTAZIONE.md, 7.5 | BLOCCANTE |
| 2.9 | **Attivare il reindirizzamento a `https://www`** nel `.htaccess`, solo dopo che l'SSL funziona | DOCUMENTAZIONE.md, capitolo 8 | CONSIGLIATO |
| 2.10 | **Controlli dopo la pubblicazione** (pagine, video, carta, 404, telefono, accenti, anteprime) | DOCUMENTAZIONE.md, capitolo 9 | BLOCCANTE |
| 2.11 | **Prova finale su un iPhone vero**: video in alto (anche con risparmio energetico), QR code stampato, tasti telefono ed email, scorrimento tra le categorie della carta | Francesco / titolare | CONSIGLIATO |
| 2.12 | **Google Search Console**: registrare il dominio e inviare la sitemap | Titolare / Francesco | CONSIGLIATO |
| 2.13 | Aggiornare le date `lastmod` della **sitemap** al momento della pubblicazione | LO FACCIO IO | CONSIGLIATO |

---

## 3. QR code, Google e altri aspetti

| # | Cosa fare | Priorità |
|---|---|---|
| 3.1 | **QR code della carta**: stampare i nuovi QR solo dopo aver scelto il dominio, puntando a `https://www.tuodominio.it/carta.html` (e `…/food.html` per il menu food). Se ci sono già QR stampati con l'indirizzo GitHub, tenere attivo GitHub Pages finché sono in circolazione | BLOCCANTE |
| 3.2 | Decidere **quando spegnere GitHub Pages** (dopo che i vecchi QR non sono più in uso) | CONSIGLIATO |
| 3.3 | **Scheda Google del locale** (Google Business Profile, su business.google.com): nome, indirizzo, telefono e orari identici al sito, con il link al nuovo dominio | CONSIGLIATO |
| 3.4 | Aggiornare il **link al sito** sui profili social | CONSIGLIATO |

---

## 4. Miglioramenti facoltativi

| # | Cosa | Note |
|---|---|---|
| 4.1 | Ricomprimere il video della copertina per computer (H.264, 8,9 MB) a circa 5 MB senza perdita visibile | Serve installare un programma di conversione video (ffmpeg) |
| 4.2 | Togliere dal progetto il video precedente "calice" (circa 26 MB, oggi non usato) | È già escluso dal pacchetto Aruba; su GitHub Pages è ancora presente. Tenerlo solo se si pensa di tornare a quel video |

---

## 5. Già fatto

- Carta reale del locale (Signature, Pre dinner, After dinner, Gin tonic, Champagne, Vini, Caffetteria, Pasticceria, Salato, Beverage) con bicchieri; ricette di Passion Aqua, Malessere, Ladies & Gentlemen, Scriptorium Sunset, Nautilus
- Prezzi dei cocktail ricontrollati sul listino del 25/11: tutti a 8 € tranne Boulevardier, Margarita, Martini Cocktail e Dirty Martini a 10 €, Sour a 9 €; gin tonic 8 / 10 / 12 € (base / premium / premium +). Vodka Tini tolto dalla carta (non è nel listino)
- Caffetteria, pasticceria e salato ricontrollati sul listino del 25/11; aggiunti Ginseng piccolo (1,50 €) e grande (1,80 €)
- Carta dei vini (25/11): sezione "Vini" con Bollicine, Bianchi, Rosati e Rossi, prezzi alla bottiglia (confermato); nomi confermati (Arsicci Verdicchio dei Castelli di Jesi Superiore, Château La Forchetière); gli champagne della carta dei vini sono nella sezione Champagne con i loro prezzi
- Menu di navigazione: "La carta" mostra le sue sezioni (sul telefono si aprono toccandola, sul computer passandoci sopra); il pulsante "Il sito" di carta e menu food apre il menu del sito
- Menu food (9 piatti a 3 € a porzione) con pagina e voce di menu dedicate
- Pagina 404, icone per la schermata Home del telefono, dati strutturati per Google, robots.txt e sitemap, anteprime social di home, carta e menu food
- Privacy senza cookie e senza servizi esterni (nessun banner necessario)
- Copertina della home scritta nella pagina (caricamento più rapido), video in HEVC e H.264
- `.htaccess` per Aruba, script e pacchetto `aqua-aruba.zip`, documentazione completa ([DOCUMENTAZIONE.md](DOCUMENTAZIONE.md))
