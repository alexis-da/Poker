import { ArrowRightIcon } from '@radix-ui/react-icons';
import { Badge, Button, Card, DataList, Flex, Heading, Link, Text } from '@radix-ui/themes';
import { CardRow } from '../components/PlayingCard';
import Counter from '../components/reactbits/Counter';
import GlareHover from '../components/reactbits/GlareHover';
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

  const stats = [
    { label: 'Mains jouées', value: play.hands, suffix: '', decimals: 0 },
    { label: 'Gain net', value: play.netBB, suffix: ' BB', decimals: 1, tone: play.netBB >= 0 ? 'pos' : 'neg' },
    { label: 'Décisions validées par le coach', value: coachTotal ? Math.round((play.coach.bon / coachTotal) * 100) : null, suffix: ' %', decimals: 0 },
    { label: 'Réussite aux exercices', value: totalQuiz ? Math.round((totalCorrect / totalQuiz) * 100) : null, suffix: ' %', decimals: 0 },
  ];

  return (
    <div className="page home">
      <section className="hero">
        <div className="hero__text">
          <Text size="2" color="gray">
            No-Limit Texas Hold’em · 6-max
          </Text>
          <Heading size="9" className="hero__title">
            Lisez la table.
            <br />
            <span>Prenez la bonne décision.</span>
          </Heading>
          <Text as="p" size="4" color="gray" className="lede">
            Jouez contre des bots aux styles différents avec un coach qui commente vos choix, enchaînez des exercices ciblés et vérifiez
            vos calculs avec le calculateur d’équité.
          </Text>
          <Flex gap="3" wrap="wrap">
            <Button size="4" asChild>
              <a href="#jouer">
                {session.game ? 'Reprendre la partie' : 'Jouer une session'} <ArrowRightIcon />
              </a>
            </Button>
            <Button size="4" variant="soft" color="gray" asChild>
              <a href={`#${suggestion.route}`}>Exercice : {suggestion.title.toLowerCase()}</a>
            </Button>
          </Flex>
        </div>
        <div className="hero__scene" aria-hidden="true">
          <div className="scene">
            <div className="scene__felt">
              <span className="pot">Pot 38,5 BB</span>
              <CardRow cards={HERO_BOARD} size="md" placeholders={5} />
            </div>
            <div className="scene__hand">
              <GlareHover borderRadius="14px" glareOpacity={0.6} mode="loop" interval={4}>
                <CardRow cards={HERO_CARDS} size="xl" fan />
              </GlareHover>
            </div>
            <Card size="2" className="scene__badge">
              <DataList.Root size="2">
                <DataList.Item>
                  <DataList.Label minWidth="70px">Main</DataList.Label>
                  <DataList.Value>Quinte hauteur As</DataList.Value>
                </DataList.Item>
                <DataList.Item>
                  <DataList.Label minWidth="70px">Rang</DataList.Label>
                  <DataList.Value>
                    <Badge color="grass" variant="soft">
                      le jeu max
                    </Badge>
                  </DataList.Value>
                </DataList.Item>
              </DataList.Root>
            </Card>
          </div>
        </div>
      </section>

      <section className="section">
        <Flex justify="between" align="baseline" gap="3" wrap="wrap">
          <Heading size="5" as="h2">
            Votre progression
          </Heading>
          <Link href="#stats" size="2">
            Toutes les statistiques
          </Link>
        </Flex>
        <div className="tiles">
          {stats.map((s) => (
            <Card key={s.label} size="3" className="tile">
              <Text size="2" color="gray">
                {s.label}
              </Text>
              <span className={`tile__value ${s.tone ?? ''}`}>
                {s.value === null ? (
                  '—'
                ) : (
                  <Counter value={s.value} decimals={Number.isInteger(s.value) ? 0 : s.decimals} locale="fr-FR" fontSize={34} fontWeight={600} suffix={s.suffix} />
                )}
              </span>
            </Card>
          ))}
        </div>
      </section>

      <section className="section">
        <Heading size="5" as="h2">
          Par où commencer
        </Heading>
        <div className="paths">
          {[
            { href: '#apprendre', title: 'Je débute', text: 'Règles, classement des mains et vocabulaire, puis l’exercice « Quelle main gagne ? ».' },
            { href: '#exercices', title: 'Je connais les règles', text: 'Outs, cotes du pot et ranges d’ouverture : les trois calculs qui font gagner des jetons.' },
            { href: '#jouer', title: 'Je veux jouer', text: 'Une table 6-max avec le coach en mode « correction après coup » pour vous tester.' },
          ].map((p) => (
            <Card key={p.title} size="3" asChild className="path">
              <a href={p.href}>
                <Flex direction="column" gap="2">
                  <Flex justify="between" align="center">
                    <Heading size="4" as="h3">
                      {p.title}
                    </Heading>
                    <ArrowRightIcon className="module__arrow" />
                  </Flex>
                  <Text size="2" color="gray">
                    {p.text}
                  </Text>
                </Flex>
              </a>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
