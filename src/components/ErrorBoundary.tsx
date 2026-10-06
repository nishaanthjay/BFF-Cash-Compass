import { Component, type ErrorInfo, type ReactNode } from 'react';
import { LifeBuoy } from 'lucide-react';
import { Button } from './Button';
import { Card } from './Card';
import { IconBadge } from './IconBadge';
import s from './ErrorBoundary.module.css';

type State = { error: Error | null };

/** Friendly fallback for student screens. Queued answers live in localStorage, so a retry loses nothing. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep a breadcrumb for facilitators debugging on-site; no student data is logged.
    console.warn('Cash Compass screen error', error.message, info.componentStack?.split('\n')[1]);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className={s.wrap}>
        <Card tone="featured" className={s.card}>
          <IconBadge icon={LifeBuoy} tone="pink" size="lg" />
          <h1 className={s.title}>Oops, that screen tripped.</h1>
          <p>Your answers so far are saved on this device. Tap below to pick up where you left off.</p>
          <Button size="lg" block onClick={() => this.setState({ error: null })}>
            Try again
          </Button>
          <Button variant="ghost" block onClick={() => window.location.assign('/')}>
            Back to start
          </Button>
        </Card>
      </div>
    );
  }
}
