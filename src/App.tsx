import { MotionConfig } from 'framer-motion';
import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { DemoBanner } from './components/DemoBanner';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Spinner } from './components/Spinner';
import { IS_CONFIGURED, IS_DEMO } from './api';
import { Join } from './screens/student/Join';
import { Run } from './screens/student/Run';

// Staff pages (charts, QR) load on demand so students on slow wifi download less.
const Facilitator = lazy(() => import('./screens/facilitator/Facilitator').then((m) => ({ default: m.Facilitator })));
const Analysis = lazy(() => import('./screens/analysis/Analysis').then((m) => ({ default: m.Analysis })));
const ItemPage = lazy(() => import('./screens/analysis/ItemPage').then((m) => ({ default: m.ItemPage })));

const guard = (el: ReactNode) => (
  <ErrorBoundary>
    <Suspense fallback={<Spinner />}>{el}</Suspense>
  </ErrorBoundary>
);

function SetupNeeded() {
  return (
    <main style={{ maxWidth: 560, margin: '15vh auto', padding: 'var(--space-6)' }}>
      <h1>Not set up yet</h1>
      <p>This site has no database connected. The site owner needs to set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY and redeploy.</p>
    </main>
  );
}

export function App() {
  if (!IS_DEMO && !IS_CONFIGURED) return <SetupNeeded />;
  return (
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        {IS_DEMO && <DemoBanner />}
        <Routes>
          <Route path="/" element={guard(<Join />)} />
          <Route path="/run" element={guard(<Run />)} />
          <Route path="/facilitator" element={guard(<Facilitator />)} />
          <Route path="/analysis" element={guard(<Analysis />)} />
          <Route path="/analysis/item/:id" element={guard(<ItemPage />)} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </MotionConfig>
  );
}
