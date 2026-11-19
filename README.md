# Sci Carving

Prototipo web gratuito: l'allievo carica un video di sciata, tocca lo sciatore e riceve un referto sulla tecnica di carving basato sui 5 criteri del maestro Michele.

- Il riconoscimento della postura (MediaPipe Pose) gira nel browser: nessun server a pagamento, il video non lascia il telefono.
- Criteri e soglie: `src/rules.ts`. Misure del corpo: `src/metrics.ts`. Divisione in curve: `src/turns.ts`.
- Pubblicazione automatica su GitHub Pages a ogni modifica del ramo `main`.

## Sviluppo

```
npm install
npm run dev
npm test
```
