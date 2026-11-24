import { useEffect } from 'react';
import './engines';
import { Layout } from './components/Layout';
import { PrefsRuntime } from './components/PrefsRuntime';
import { useLang } from './lib/i18n';
import { useRoute } from './lib/router';
import { useSettings } from './lib/settings';
import { EnginesPage } from './pages/EnginesPage';
import { HistoryPage } from './pages/HistoryPage';
import { HomePage } from './pages/HomePage';
import { OpponentsPage } from './pages/OpponentsPage';
import { PlayPage } from './pages/PlayPage';
import { ReplayPage } from './pages/ReplayPage';
import { SettingsPage } from './pages/SettingsPage';

export default function App() {
  const route = useRoute();
  const settings = useSettings();
  const lang = useLang();

  // Aplica o tema (e a cor da barra do navegador).
  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', settings.theme === 'dark' ? '#0a0c11' : '#f3efe6');
  }, [settings.theme]);

  // Volta ao topo ao trocar de tela.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [route.name, route.param]);

  let page;
  switch (route.name) {
    case 'play':
      page = <PlayPage />;
      break;
    case 'opponents':
      page = <OpponentsPage />;
      break;
    case 'settings':
      page = <SettingsPage />;
      break;
    case 'history':
      page = <HistoryPage />;
      break;
    case 'replay':
      page = <ReplayPage id={route.param ?? ''} />;
      break;
    case 'engines':
      page = <EnginesPage />;
      break;
    default:
      page = <HomePage />;
  }
  return (
    <>
      <PrefsRuntime />
      {/* key={lang}: troca de idioma remonta apenas a interface; a partida (GameController) e as preferências persistem. */}
      <div key={lang} style={{ display: 'contents' }}>
        <Layout>{page}</Layout>
      </div>
    </>
  );
}
