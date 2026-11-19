/**
 * Guida alle riprese: come filmare perché tutti i video siano confrontabili.
 * Si apre con il link .../sci-carving-app/#guida, così il maestro la può condividere.
 */
export function Guida() {
  return (
    <main className="guida">
      <a className="back" href="#">Torna all'analisi</a>
      <header className="mast">
        <p className="eyebrow">Guida alle riprese</p>
        <h1>Come filmare <span>una sciata</span></h1>
        <p className="lede">Stesse regole per tutti: così il punteggio è giusto e le classifiche sono confrontabili.</p>
      </header>

      <section className="card">
        <h2>La ripresa standard</h2>
        <p>Chi filma sta <b>fermo, a valle dello sciatore e un po' di lato</b> (di tre quarti), a 15-30 metri.
          Lo sciatore scende verso di lui facendo almeno 5 curve di fila, senza fermarsi.</p>
        <svg className="schema" viewBox="0 0 320 200" role="img" aria-label="Chi filma sta a valle, di tre quarti rispetto alla traccia">
          <text x="160" y="16" textAnchor="middle" className="s-lab">monte</text>
          <path d="M150 30 C110 55 190 75 150 100 C110 125 190 145 150 170" className="s-traccia" />
          <path d="M156 30 C116 55 196 75 156 100 C116 125 196 145 156 170" className="s-traccia" />
          <circle cx="252" cy="178" r="7" className="s-cam" />
          <path d="M246 172 L172 120" className="s-vista" />
          <path d="M248 170 L214 92" className="s-vista" />
          <text x="252" y="198" textAnchor="middle" className="s-lab">chi filma</text>
          <text x="104" y="104" textAnchor="end" className="s-lab">5+ curve</text>
        </svg>
      </section>

      <section className="card">
        <h2>Le regole</h2>
        <dl className="regole">
          <dt>Telefono</dt><dd>In verticale, tenuto dritto: l'orizzonte deve restare orizzontale, serve per giudicare le spalle in bolla.</dd>
          <dt>Qualità</dt><dd>1080p, 60 fotogrammi al secondo se il telefono lo permette. Niente zoom durante la ripresa.</dd>
          <dt>Inquadratura</dt><dd>Lo sciatore intero, dagli sci al casco, alto almeno un terzo dell'immagine. Segui lo sciatore ruotando il telefono, senza camminare.</dd>
          <dt>Curve</dt><dd>Almeno 5 curve di fila per entrare in classifica (4 per avere il punteggio). Meglio 6-8.</dd>
          <dt>Pista</dt><dd>Battuta, pendenza media, con poca gente sullo sfondo: il programma potrebbe confondersi con altri sciatori.</dd>
          <dt>Luce</dt><dd>Sole alle spalle di chi filma o cielo coperto. Evita il controluce. Una tuta scura sulla neve si vede meglio.</dd>
          <dt>Nell'app</dt><dd>Scorri fino al primo fotogramma in cui lo sciatore si vede bene e toccalo: l'analisi parte da lì.</dd>
        </dl>
      </section>

      <section className="card">
        <h2>Due riprese, quando vuoi il referto completo</h2>
        <p>Alcuni criteri si vedono meglio da un lato preciso.</p>
        <ul className="due">
          <li><b>Da valle, di fronte</b>: spalle in bolla, busto verso gli sci, sci paralleli.</li>
          <li><b>Di lato</b>: bacino sopra i piedi, posizione pronta, flesso-estensione.</li>
        </ul>
        <p className="note">Quando un criterio non si può giudicare da quell'angolo, il referto lo scrive invece di indovinare.</p>
      </section>
    </main>
  );
}
