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
        <p>Si filma <b>da davanti</b>: chi filma sta <b>fermo, a valle, sulla linea di discesa dello sciatore</b>, a 15-30 metri.
          Lo sciatore scende verso di lui facendo almeno 5 curve di fila, senza fermarsi.
          Da davanti si vedono bene spalle, busto, ginocchia e sci: i criteri più importanti del referto.</p>
        <svg className="schema" viewBox="0 0 320 200" role="img" aria-label="Chi filma sta a valle, di fronte allo sciatore">
          <text x="160" y="16" textAnchor="middle" className="s-lab">monte</text>
          <path d="M150 30 C110 55 190 75 150 100 C110 125 190 145 150 170" className="s-traccia" />
          <path d="M156 30 C116 55 196 75 156 100 C116 125 196 145 156 170" className="s-traccia" />
          <circle cx="153" cy="186" r="7" className="s-cam" />
          <path d="M147 179 L104 40" className="s-vista" />
          <path d="M159 179 L202 40" className="s-vista" />
          <text x="200" y="190" className="s-lab">chi filma</text>
          <text x="96" y="104" textAnchor="end" className="s-lab">5+ curve</text>
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
          <dt>Arco</dt><dd>Arco corto o arco medio: l'app lo riconosce dal ritmo delle curve, ma puoi sceglierlo tu prima di analizzare.</dd>
          <dt>Nell'app</dt><dd>Scorri fino al primo fotogramma in cui lo sciatore si vede bene e toccalo: l'analisi parte da lì e legge fino a 25 secondi di sciata.</dd>
        </dl>
      </section>

      <section className="card">
        <h2>Una seconda ripresa, se vuoi il referto completo</h2>
        <p>La ripresa da davanti è lo standard, e vale per la classifica. Una ripresa di lato in più aiuta su due criteri.</p>
        <ul className="due">
          <li><b>Da davanti (standard)</b>: spalle in bolla, busto verso gli sci, sci paralleli, angolo di spigolo, tempismo.</li>
          <li><b>Di lato (facoltativa)</b>: bacino sopra i piedi e posizione pronta, che di lato si leggono meglio.</li>
        </ul>
        <p className="note">Quando un criterio non si può giudicare da quell'angolo, il referto lo scrive invece di indovinare.</p>
      </section>
    </main>
  );
}
