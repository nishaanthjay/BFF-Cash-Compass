import { MotionConfig } from 'framer-motion';
import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { DemoBanner } from './components/DemoBanner';
import { ErrorBoundary } from './components/ErrorBoundary';
import { IS_DEMO } from './api';
import { ItemPreview, RevealPreview } from './preview/Preview';
import { Join } from './screens/student/Join';
import { Run } from './screens/student/Run';

// Staff pages (charts, QR) load on demand so students on slow wifi download less.
const Facilitator = lazy(() => import('./screens/facilitator/Facilitator').then((m) => ({ default: m.Facilitator })));
const Analysis = lazy(() => import('./screens/analysis/Analysis').then((m) => ({ default: m.Analysis })));

const guard = (el: ReactNode) => (
  <ErrorBoundary>
    <Suspense fallback={null}>{el}</Suspense>
  </ErrorBoundary>
);

export function App() {
  return (
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        {IS_DEMO && <DemoBanner />}
        <Routes>
          <Route path="/" element={guard(<Join />)} />
          <Route path="/run" element={guard(<Run />)} />
          <Route path="/facilitator" element={guard(<Facilitator />)} />
          <Route path="/analysis" element={guard(<Analysis />)} />
          {IS_DEMO && <Route path="/preview/item" element={guard(<ItemPreview />)} />}
          {IS_DEMO && <Route path="/preview/reveal" element={guard(<RevealPreview />)} />}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </MotionConfig>
  );
}
