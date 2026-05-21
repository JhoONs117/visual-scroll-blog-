# Visual AI Scroll Blog

Sistema automatico che recupera articoli da feed RSS ogni 2 ore (AI News, Food, Fitness), genera 5 slide + thread X + script video per ciascuno, e li mostra come feed scrollabile stile Instagram Stories su Railway.

**Stack:** Node.js · DeepSeek · OpenAI TTS · GitHub Actions · Railway

---

## Documentazione

| Documento | Contenuto |
|---|---|
| [`PROJECT.md`](PROJECT.md) | Stato attuale, roadmap, architettura, riferimento tecnico completo |
| [`MANUAL.md`](MANUAL.md) | Manuale operativo — come eseguire ogni operazione (30 sezioni) |

## Avvio rapido

```bash
# Pipeline manuale (locale)
node run.js

# Video (dopo aver salvato le slide dal browser)
node video/render-pending.js

# Build data per frontend
node scripts/build-data-agents.js
```

Pipeline automatica ogni 2 ore via GitHub Actions → autodeploy Railway.
