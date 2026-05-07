# Roadmap M21 — Test Distribuzione Reale

Stato: in corso  
Aggiornato: 2026-05-07

---

## FASE 0 — Obiettivo corretto

NON stiamo cercando follower, viralità o monetizzazione.  
Stiamo cercando:

- Pattern di hook che fermano il lettore
- Temi AI che generano attenzione reale
- Formato migliore (carousel / reel / thread / video)
- Segnali di retention autentici (bookmark, reply, tempo di permanenza)

Questo cambia radicalmente l'interpretazione dei numeri.

---

## PRE-M21 — Intervento prompt (blocante)

**Da completare prima di pubblicare qualsiasi thread su X.**

L'analisi su 3 articoli reali (governance AI agent, CopilotKit, Fervo Energy) ha evidenziato tre problemi strutturali che renderebbero i dati raccolti in M21 poco affidabili:

### Problema 1 — Le slide sono titoli di giornale, non micro-hook
Le slide attuali descrivono il contenuto invece di creare tensione.  
Esempio sbagliato: "Aziende devono testare e limitare"  
Esempio corretto: slide che lascia una domanda aperta o un'informazione incompleta che si risolve solo con la slide successiva.

**Fix:** aggiungere in `generateSlides()` un vincolo esplicito con esempio negativo/positivo: ogni slide deve contenere tensione irrisolta o informazione incompleta.

### Problema 2 — I thread finiscono con frasi valutative vuote
Il tweet 5 collassa sistematicamente in chiusure generiche tipo "L'AI non è più solo un sogno" o "Ed è appena diventato un affare pubblico."  
Queste frasi azzerano la tensione costruita nei tweet precedenti.

**Fix:** nel prompt `generateFormats`, specificare che il tweet 5 deve chiudere con un fatto netto, una conseguenza concreta o una domanda aperta — mai con una valutazione editoriale. Aggiungere esempio sbagliato/giusto esplicito.

### Problema 3 — Il thread non amplifica le slide, le riscrive da zero
`generateFormats` riceve le slide come input ma le ignora. Il thread dovrebbe partire dalla slide con più tensione (non necessariamente la slide 1) e usarla come Tweet 1.

**Fix:** nel prompt `generateFormats`, aggiungere istruzione esplicita: "Scegli come Tweet 1 la slide con più tensione narrativa, indipendentemente dalla sua posizione. Ricostruisci l'arco del thread intorno a quella slide."

### Output atteso dopo il fix
Rieseguire `generateSlides` + `generateFormats` sui 3 articoli di test e verificare:
- La slide 1 crea curiosità senza risolvere nulla?
- Il tweet 5 finisce con un fatto o una conseguenza, non una valutazione?
- Il Tweet 1 corrisponde alla slide con più tensione (anche se è la 3 o la 5)?

Se almeno 2/3 articoli superano questi criteri, si procede con M21.

---

## FASE 1 — Scelta piattaforma (deciso)

**X/Twitter** è il banco di prova iniziale.  
Motivazioni:

- I `thread_text` sono già pronti → zero attrito
- L'algoritmo premia il contenuto più della dimensione dell'account
- Il ciclo di feedback è immediato (impression, bookmark, reply)
- Permette di separare la validazione del copy da quella del formato visuale
- È il canale più veloce per capire se l'hook funziona

**Instagram / TikTok** saranno attivati solo dopo M22, quando sapremo:
- quali hook performano
- quali temi generano interesse
- come tradurre il copy in formato visivo

---

## Regola di adattamento hook per canale

### Su Instagram (carousel visivo)
- Ogni slide è un **micro-hook** che deve riaprire l'attenzione
- Le 5 slide seguono l'ordine narrativo M14: hook → contesto → sorpresa → pratico → takeaway
- Tutte e 5 vengono usate come previsto dal sistema

### Su X (thread testuale)
- **Un solo hook principale** per il Tweet 1
- Le altre 4 frasi diventano **beat narrativi di progressione**, non hook indipendenti:
  - Tweet 2: contesto / perché importa
  - Tweet 3: svolta / punto controintuitivo
  - Tweet 4: conseguenza pratica
  - Tweet 5: takeaway con fatto netto o domanda aperta — mai valutazione editoriale
- Il `thread_text` generato da M16 segue già questa struttura

### Come si sceglie l'hook per X
Per ogni articolo, si esamina quale slide ha più tensione immediata — indipendentemente dalla posizione.

Priorità:
1. **Domanda provocatoria** — "Questa AI può sostituire Excel?"
2. **Conseguenza personale** — "Questo cambia come lavori ogni giorno."
3. **Contrasto forte** — "Non è più un chatbot. È un collega."
4. **Numero o fatto sorprendente** — "Costa meno di un caffè."
5. **Takeaway netto** — "L'automazione non è più opzionale."

### L'ordine delle slide non è vincolante
Se la slide 3 o la slide 5 ha più forza della slide 1, **su X si usa quella come apertura**.  
L'arco narrativo del thread viene ricostruito intorno all'hook scelto, non all'ordine originale.

---

## FASE 2 — Validazione hook su X (10–15 giorni)

**Durata:** 10–15 post (esteso rispetto alla versione precedente — vedi nota sotto)  
**Frequenza:** 1 thread al giorno  
**Obiettivo:** ottenere dati sufficienti per distinguere un segnale dal rumore.

> **Nota sulla durata:** con un account nuovo, i primi 3-4 thread hanno reach organica quasi nulla (spesso sotto 50 impression). Con 10 post si rischia di prendere decisioni su 6-7 dati puliti, insufficienti per categorizzare 5 tipi di hook. 15 post garantiscono almeno 10-11 punti dati utilizzabili dopo il warm-up iniziale.

### Cosa pubblicare
- Usare i `thread_text` generati automaticamente, con adattamenti minimi
- Aprire **subito** con l'hook selezionato (niente introduzioni filler)
- Chiudere con una CTA costante (es. "Segui per più AI news quotidiane")
- Mantenere la stessa struttura tutti i giorni per isolare l'effetto del contenuto

> **Nota sulla CTA:** su un account con 0 follower la CTA finale ha impatto trascurabile. Non distorce i dati in modo significativo, ma mantienila per coerenza — non per controllo statistico.

### Quando pubblicare
- Scegliere un orario e mantenerlo fisso per tutti i post
- Annotarlo in `test-distribuzione.md` per valutare eventuali effetti giorno feriale / weekend

### Attenzione al rumore iniziale
- I primi 2–3 thread su account nuovo avranno reach molto bassa
- Non eliminare hook solo perché il thread n.2 è andato male: aspetta almeno 5-6 post
- Mitigazione: usare nei primi 2 giorni gli hook più forti emersi dai test offline

### Criterio di stop anticipato
Se dopo 5 thread si registrano 0 bookmark e 0 reply su tutti e 5, si interviene prima della fine:
- Verificare se il problema è l'account (reach zero), il topic o la qualità del copy
- Non continuare meccanicamente se il segnale è assente

### Tracciamento meticoloso
Ogni thread va registrato in `test-distribuzione.md`:

| Thread | Data | Hook (Tweet 1) | Slide origine | Hook type | Impression | Bookmark | Reply | Repost | Note |
|--------|------|----------------|---------------|-----------|------------|----------|-------|--------|------|
| 1 | ... | "..." | Slide X | tipo | ... | ... | ... | ... | ... |

La colonna **"Slide origine"** è essenziale per M22: sapremo quale posizione nella curva narrativa produce l'apertura migliore per X.

**I bookmark e le reply sono i segnali di retention più forti.**

---

## FASE 3 — Identificazione pattern (2 giorni)

Con i 15 thread completi, si compila un'analisi strutturata.

### Cosa estrarre
- **Hook che fermano**: esempi concreti e loro tipo
- **Hook deboli**: troppo descrittivi, troppo tecnici, troppo neutri
- **Slide che diventano aperture migliori**: la slide 1 vince sempre o la 3/5 la supera spesso?
- **Topic migliori**: coding AI, agenti, produttività, sostituzione del lavoro, costi AI, OpenAI/Gemini
- **Topic deboli**: bassa interazione o nessun bookmark

### Output
Una sezione "Pattern vincenti" e "Pattern da evitare" in `test-distribuzione.md`, input diretto per M22.

---

## FASE 4 — M22 (iterazione prompt)

Obiettivo: aggiornare `generateSlides()` e `generateFormats()` con i dati reali.

### Cosa fare
- Arricchire il prompt M14 con una tassonomia di hook basata sui risultati
- Forzare/evitare certi tipi di hook in base al titolo
- Eliminare gli hook che non hanno mai performato su X
- Se la slide 3 o 5 risulta sistematicamente migliore come apertura, aggiungere un layer automatico `selectBestHookForX(slides)` che riordina l'output per canale
- Migliorare la chiusura dei thread (tweet 5) sulla base dei pattern osservati

---

## FASE 5 — Secondo canale (Instagram o TikTok)

**Solo dopo M22 completato e validato.**

### Adattamento formato
- **Instagram**: caroselli automatici dalle slide + caption breve da thread_text; Reel da video_script
- **TikTok**: video con TTS, testo in overlay, ritmo rapido da video_script

---

## FASE 6 — Automazione

**Solo quando soddisfatte tutte queste condizioni:**
- 2–3 pattern di hook vincenti e stabili
- Un canale che converte meglio (o mix canali)
- Un formato definitivo (thread, carosello, video)
- Un layer di selezione automatica dell'hook per canale (da M22)

---

## Riepilogo cronologico

```
PRE-M21
  └── fix prompt generateSlides() — vincolo micro-hook con tensione irrisolta
  └── fix prompt generateFormats() — tweet 5 con fatto netto, tweet 1 dalla slide con più tensione
  └── test su 3 articoli esistenti → verifica criteri
        └── se OK → si procede

M21
├── X/Twitter → 15 thread, test hook (15 giorni)
├── criterio di stop anticipato attivo (0 bookmark/reply dopo 5 post → si interviene)
├── analisi pattern → compilazione test-distribuzione.md
├── M22 → update prompt con dati reali (generateSlides + generateFormats)
├── Instagram Reels / TikTok → adattamento formato
├── confronto retention tra canali
└── automazione (solo se sostenibile)
```

---

## Prossimi passi immediati

1. Fix prompt `generateSlides()` — aggiungere vincolo tensione irrisolta + esempio negativo/positivo
2. Fix prompt `generateFormats()` — tweet 5 con fatto netto, tweet 1 dalla slide con più tensione
3. Rieseguire sui 3 articoli di test e validare i criteri
4. Creare account X e popolare il profilo con bio coerente
5. Preparare i primi 3 thread scegliendo manualmente l'hook più forte
6. Iniziare a pubblicare registrando subito i dati in `test-distribuzione.md`
