import { useEffect, useState } from 'react';
import { Icon } from './components/Icons';
import { preloadCards } from './components/PlayingCard';
import { useSettings } from './store/store';
import { Home } from './views/Home';
import { Learn } from './views/Learn';
import { Play } from './views/play/Play';
import { useSession } from './views/play/session';
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
  const [settings] = useSettings();
  const session = useSession();

  useEffect(() => {
    if (settings.cardStyle === 'illustre') preloadCards();
  }, [settings.cardStyle]);

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
    <div className={`app ${settings.fourColor ? 'four-color' : ''} app--${nav}`}>
      <header className="topbar">
        <div className="topbar__inner">
          <a href="#accueil" className="brand">
            <span className="brand__mark" aria-hidden="true">
              <Icon name="spade" size={16} />
            </span>
            <span className="brand__name">
              Coach <em>Hold’em</em>
            </span>
          </a>
          <nav className="topnav" aria-label="Navigation principale">
            {NAV.map((n) => (
              <a
                key={n.id}
                href={`#${n.href ?? n.id}`}
                className={`topnav__link ${nav === n.id ? 'topnav__link--on' : ''}`}
                aria-current={nav === n.id ? 'page' : undefined}
              >
                <Icon name={n.icon} size={18} />
                <span>{n.label}</span>
              </a>
            ))}
          </nav>
          {session.game && nav !== 'jouer' && (
            <a href="#jouer" className="topbar__live">
              <span className="live-dot" aria-hidden="true" /> Table en cours · main {session.game.handNumber}
            </a>
          )}
        </div>
      </header>
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
