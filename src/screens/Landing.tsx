import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { Clock, EyeOff, Target } from 'lucide-react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Footer } from '../components/Footer';
import { IconBadge } from '../components/IconBadge';
import { Screen } from '../components/Screen';
import { StudentShell } from '../components/StudentShell';
import s from './Landing.module.css';

const POINTS = [
  { icon: Clock, tone: 'gold', title: 'Short', text: 'About 10 minutes of real-life money questions.' },
  { icon: Target, tone: 'blue', title: 'No grades', text: 'Nothing is scored in front of you. Just your best estimate.' },
  { icon: EyeOff, tone: 'mint', title: 'Private', text: 'No names, no emails. You get a random code.' },
] as const;

/** Home page. Old QR links (/?c=CODE) still work: they go straight to the join screen. */
export function Landing() {
  const [params] = useSearchParams();
  const c = params.get('c');
  if (c) return <Navigate to={`/join?c=${encodeURIComponent(c)}`} replace />;
  return (
    <StudentShell decor="landing" wiggle>
      <Screen>
        <div className={s.hero}>
          <p className="eyebrow">BFF of America · Cash Compass</p>
          <h1 className={s.title}>
            How good is your <mark>money sense?</mark>
          </h1>
          <p className={s.lede}>A quick check-in for grades 6 to 8. Your chapter leader will give you a join code.</p>
          <div className={s.cta}>
            <Link to="/join" className={s.ctaLink}>
              <Button size="lg" block tabIndex={-1}>
                Join a workshop
              </Button>
            </Link>
            <Link to="/facilitator" className={s.ctaLink}>
              <Button size="lg" variant="secondary" block tabIndex={-1}>
                Facilitator log in
              </Button>
            </Link>
          </div>
        </div>
        <div className={s.cards}>
          {POINTS.map((p) => (
            <Card key={p.title} tight className={s.card}>
              <IconBadge icon={p.icon} tone={p.tone} />
              <h2 className={s.h2}>{p.title}</h2>
              <p>{p.text}</p>
            </Card>
          ))}
        </div>
        <Footer />
      </Screen>
    </StudentShell>
  );
}
