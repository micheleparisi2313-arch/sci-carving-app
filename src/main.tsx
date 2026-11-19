import { Component, StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

/** Se qualcosa si rompe, mostra cosa è successo invece di una pagina vuota. */
class Paracadute extends Component<{ children: ReactNode }, { errore: string | null }> {
  state = { errore: null as string | null };
  static getDerivedStateFromError(e: unknown) { return { errore: e instanceof Error ? e.message : String(e) }; }
  render() {
    if (!this.state.errore) return this.props.children;
    return (
      <main>
        <section className="card">
          <h2>Qualcosa non ha funzionato</h2>
          <p className="err">{this.state.errore}</p>
          <p className="note">Fai uno screenshot di questa schermata e mandalo a Michele, poi ricarica la pagina.</p>
          <button onClick={() => location.reload()}>Ricarica</button>
        </section>
      </main>
    );
  }
}

createRoot(document.getElementById('root')!).render(<StrictMode><Paracadute><App /></Paracadute></StrictMode>);
