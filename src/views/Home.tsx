import { CardRow } from '../components/PlayingCard';
import { parseCards } from '../engine/cards';
import { useAppData } from '../store/store';
import { useSession } from './play/session';
import { QUIZZES } from './training/QuizShell';

const HERO_CARDS = parseCards('AsKh');
const HERO_BOARD = parseCards('Qd Js 7c Th');

export function Home() {
  const { play, quizzes } = useAppData();
  const session = useSession();
  // Exercice suggéré : le moins réussi (ou le premier jamais tenté).
  const suggestion =
    QUIZZES.find((q) => quizzes[q.id].attempts === 0) ??
    QUIZZES.slice().sort(
      (a, b) => quizzes[a.id].correct / quizzes[a.id].attempts - quizzes[b.id].correct / quizzes[b.id].attempts,
    )[0];
  const coachTotal = play.coach.bon + play.coach.discutable + play.coach.erreur;
  const totalQuiz = Object.values(quizzes).reduce((a, q) => a + q.attempts, 0);
  const totalCorrect = Object.values(quizzes).reduce((a, q) => a + q.correct, 0);

  return (
    <div className="page home">
      <section className="hero">
        <div className="hero__text">
          <p className="eyebrow">No-Limit Texas Hold’em · 6-max</p>
          <h1>
            Chaque main est une décision.
            <br />
            Entraînez-vous à bien les prendre.
          </h1>
          <p className="lede">
            Jouez contre des bots aux styles différents avec un coach qui commente vos choix, enchaînez des exercices ciblés et vérifiez
            vos calculs avec le calculateur d’équité.
          </p>
          <div className="button-row">
            <a href="#jouer" className="btn btn--primary btn--lg">
              {session.game ? 'Reprendre la partie' : 'Jouer une session'}
            </a>
            <a href={`#${suggestion.route}`} className="btn btn--ghost btn--lg">
              Exercice : {suggestion.title.toLowerCase()}
            </a>
          </div>
        </div>
        <div className="hero__table" aria-hidden="true">
          <div className="mini-felt">
            <CardRow cards={HERO_BOARD} size="sm" placeholders={5} />
            <div className="mini-felt__hand">
              <CardRow cards={HERO_CARDS} size="lg" />
            </div>
            <span className="mini-felt__caption">Quinte hauteur As · le jeu max</span>
          </div>
        </div>
      </section>

      <section className="section">
        <h2>Votre progression</h2>
        <div className="tiles tiles--4">
          <div className="tile">
            <span className="tile__label">Mains jouées</span>
            <span className="tile__value">{play.hands.toLocaleString('fr-FR')}</span>
          </div>
          <div className="tile">
            <span className="tile__label">Gain net</span>
            <span className={`tile__value ${play.netBB >= 0 ? 'pos' : 'neg'}`}>
              {play.netBB > 0 ? '+' : ''}
              {play.netBB.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} BB
            </span>
          </div>
          <div className="tile">
            <span className="tile__label">Décisions validées par le coach</span>
            <span className="tile__value">{coachTotal ? `${Math.round((play.coach.bon / coachTotal) * 100)} %` : '—'}</span>
          </div>
          <div className="tile">
            <span className="tile__label">Réussite aux exercices</span>
            <span className="tile__value">{totalQuiz ? `${Math.round((totalCorrect / totalQuiz) * 100)} %` : '—'}</span>
          </div>
        </div>
        <a href="#stats" className="link-more">
          Toutes les statistiques
        </a>
      </section>

      <section className="section">
        <h2>Par où commencer</h2>
        <div className="paths">
          <a href="#apprendre" className="path">
            <strong>Je débute</strong>
            <span>Règles, classement des mains et vocabulaire, puis l’exercice « Quelle main gagne ? ».</span>
          </a>
          <a href="#exercices" className="path">
            <strong>Je connais les règles</strong>
            <span>Outs, cotes du pot et ranges d’ouverture : les trois calculs qui font gagner des jetons.</span>
          </a>
          <a href="#jouer" className="path">
            <strong>Je veux jouer</strong>
            <span>Une table 6-max avec le coach en mode « correction après coup » pour vous tester.</span>
          </a>
        </div>
      </section>
    </div>
  );
}
