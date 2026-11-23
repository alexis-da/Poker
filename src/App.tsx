import {
  BarChartIcon,
  CardStackIcon,
  DesktopIcon,
  HomeIcon,
  MixerHorizontalIcon,
  MoonIcon,
  ReaderIcon,
  SunIcon,
  TargetIcon,
} from '@radix-ui/react-icons';
import { Badge, DropdownMenu, IconButton, TabNav } from '@radix-ui/themes';
import { useAppearance } from './appearance';
import { useEffect, useRef, useState, type ComponentType } from 'react';
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

const ROUTES: Record<string, { view: ComponentType; nav: string }> = {
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
  { id: 'accueil', label: 'Accueil', icon: HomeIcon },
  { id: 'jouer', label: 'Jouer', icon: CardStackIcon },
  { id: 'exercices', label: 'Exercices', icon: TargetIcon },
  { id: 'outils', label: 'Outils', icon: MixerHorizontalIcon, href: 'calculateur' },
  { id: 'apprendre', label: 'Leçons', icon: ReaderIcon },
  { id: 'stats', label: 'Stats', icon: BarChartIcon },
];

const APPEARANCES = [
  { value: 'system', label: 'Thème du système', icon: DesktopIcon },
  { value: 'light', label: 'Clair', icon: SunIcon },
  { value: 'dark', label: 'Sombre', icon: MoonIcon },
] as const;

/** Choix du thème : système, clair ou sombre. */
function ThemeToggle() {
  const [settings, setSettings] = useSettings();
  const resolved = useAppearance();
  const Current = resolved === 'dark' ? MoonIcon : SunIcon;
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        <IconButton variant="ghost" color="gray" size="2" className="theme-toggle" aria-label="Changer de thème">
          <Current width="18" height="18" />
        </IconButton>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end">
        <DropdownMenu.Label>Apparence</DropdownMenu.Label>
        <DropdownMenu.RadioGroup
          value={settings.appearance}
          onValueChange={(v) => setSettings({ appearance: v as typeof settings.appearance })}
        >
          {APPEARANCES.map((a) => (
            <DropdownMenu.RadioItem key={a.value} value={a.value}>
              <a.icon /> {a.label}
            </DropdownMenu.RadioItem>
          ))}
        </DropdownMenu.RadioGroup>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}

function readRoute(): string {
  const h = window.location.hash.replace(/^#/, '');
  return ROUTES[h] ? h : 'accueil';
}

export function App() {
  const [route, setRoute] = useState(readRoute);
  const [visit, setVisit] = useState(0);
  const headerRef = useRef<HTMLElement>(null);

  // Hauteur réelle de la barre du haut, pour que l'écran de jeu tienne dans la fenêtre.
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const apply = () => document.documentElement.style.setProperty('--topbar-h', `${el.offsetHeight}px`);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const [settings] = useSettings();
  const session = useSession();

  useEffect(() => {
    if (settings.cardStyle === 'illustre') preloadCards();
  }, [settings.cardStyle]);

  useEffect(() => {
    const onHash = () => {
      setRoute(readRoute());
      setVisit((v) => v + 1);
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const { view: View, nav } = ROUTES[route];

  return (
    <div className={`app ${settings.fourColor ? 'four-color' : ''} app--${nav}`}>
      <header className="topbar" ref={headerRef}>
        <div className="topbar__inner">
          <a href="#accueil" className="brand">
            <span className="brand__mark" aria-hidden="true">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 3c3 4 7 6 7 10a4 4 0 0 1-6.5 3.1L13.5 21h-3l1-4.9A4 4 0 0 1 5 13c0-4 4-6 7-10z" />
              </svg>
            </span>
            <span className="brand__name">Coach Hold’em</span>
          </a>
          <TabNav.Root className="topnav" aria-label="Navigation principale">
            {NAV.map((n) => (
              <TabNav.Link key={n.id} href={`#${n.href ?? n.id}`} active={nav === n.id}>
                <span className="topnav__item">
                  <n.icon aria-hidden="true" />
                  {n.label}
                </span>
              </TabNav.Link>
            ))}
          </TabNav.Root>
          {session.game && (
            <a href="#jouer" className="topbar__session">
              <Badge size="2" color={session.netBB >= 0 ? 'grass' : 'tomato'} variant="soft">
                {nav === 'jouer' ? 'Session' : `Table en cours · main ${session.game.handNumber} ·`}{' '}
                {session.netBB > 0 ? '+' : session.netBB < 0 ? '−' : ''}
                {Math.abs(session.netBB).toLocaleString('fr-FR')} BB
              </Badge>
            </a>
          )}
          <ThemeToggle />
        </div>
      </header>
      <main className="content">
        {nav === 'outils' && (
          <TabNav.Root className="subnav" aria-label="Outils">
            <TabNav.Link href="#calculateur" active={route === 'calculateur'}>
              Calculateur d’équité
            </TabNav.Link>
            <TabNav.Link href="#ranges" active={route === 'ranges'}>
              Tableaux de ranges
            </TabNav.Link>
          </TabNav.Root>
        )}
        <View key={`${route}-${visit}`} />
      </main>
    </div>
  );
}
