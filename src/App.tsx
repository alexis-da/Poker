import { useEffect, useState } from 'react';
import { Icon } from './components/Icons';
import { useSettings } from './store/store';
import { Home } from './views/Home';
import { Learn } from './views/Learn';
import { Play } from './views/play/Play';
import { Stats } from './views/Stats';
import { EquityCalculator } from './views/tools/EquityCalculator';
import { RangeViewer } from './views/tools/RangeViewer';
import { EquityQuiz } from './views/training/EquityQuiz';
import { OutsQuiz } from './views/training/OutsQuiz';
import { PotOddsQuiz } from './views/training/PotOddsQuiz';
import { PreflopQuiz } from './views/training/PreflopQuiz';
import { TrainingHub } from './views/training/TrainingHub';
import { WinnerQuiz } from './views/training/WinnerQuiz';

const ROUTES: Record<string, { view: () => JSX.Element; nav: string }> = {
  accueil: { view: Home, nav: 'accueil' },
  jouer: { view: Play, nav: 'jouer' },
  exercices: { view: TrainingHub, nav: 'exercices' },
  'quiz-preflop': { view: PreflopQuiz, nav: 'exercices' },
  'quiz-outs': { view: OutsQuiz, nav: 'exercices' },
  'quiz-cotes': { view: PotOddsQuiz, nav: 'exercices' },
  'quiz-gagnant': { view: WinnerQuiz, nav: 'exercices' },
  'quiz-equite': { view: EquityQuiz, nav: 'exercices' },
  calculateur: { view: EquityCalculator, nav: 'outils' },
  ranges: { view: RangeViewer, nav: 'outils' },
  apprendre: { view: Learn, nav: 'apprendre' },
  stats: { view: Stats, nav: 'stats' },
};

const NAV = [
  { id: 'accueil', label: 'Accueil', icon: 'home' as const },
  { id: 'jouer', label: 'Jouer', icon: 'play' as const },
  { id: 'exercices', label: 'Exercices', icon: 'target' as const, href: 'exercices' },
  { id: 'outils', label: 'Outils', icon: 'tools' as const, href: 'calculateur' },
  { id: 'apprendre', label: 'Leçons', icon: 'book' as const },
  { id: 'stats', label: 'Stats', icon: 'chart' as const },
];

function readRoute(): string {
  const h = window.location.hash.replace(/^#/, '');
  return ROUTES[h] ? h : 'accueil';
}

export function App() {
  const [route, setRoute] = useState(readRoute);
  const [settings, setSettings] = useSettings();

  useEffect(() => {
    const onHash = () => {
      setRoute(readRoute());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const { view: View, nav } = ROUTES[route];

  return (
    <div className={`app ${settings.fourColor ? 'four-color' : ''}`}>
      <nav className="rail" aria-label="Navigation principale">
        <a href="#accueil" className="brand">
          <span className="brand__mark" aria-hidden="true">
            <Icon name="spade" size={18} />
          </span>
          <span className="brand__name">Coach Hold’em</span>
        </a>
        <ul className="rail__list">
          {NAV.map((n) => (
            <li key={n.id}>
              <a href={`#${n.href ?? n.id}`} className={`rail__link ${nav === n.id ? 'rail__link--on' : ''}`} aria-current={nav === n.id ? 'page' : undefined}>
                <Icon name={n.icon} />
                <span>{n.label}</span>
              </a>
            </li>
          ))}
        </ul>
        <label className="rail__toggle">
          <input type="checkbox" id="four-color" checked={settings.fourColor} onChange={(e) => setSettings({ fourColor: e.target.checked })} />
          <span>Jeu 4 couleurs</span>
        </label>
      </nav>
      <main className="content">
        {nav === 'outils' && (
          <div className="subnav" role="tablist" aria-label="Outils">
            <a href="#calculateur" role="tab" aria-selected={route === 'calculateur'} className={route === 'calculateur' ? 'on' : ''}>
              Calculateur d’équité
            </a>
            <a href="#ranges" role="tab" aria-selected={route === 'ranges'} className={route === 'ranges' ? 'on' : ''}>
              Tableaux de ranges
            </a>
          </div>
        )}
        <View key={route} />
      </main>
    </div>
  );
}
