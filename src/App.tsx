import { MotionConfig } from 'framer-motion';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { DemoBanner } from './components/DemoBanner';
import { ErrorBoundary } from './components/ErrorBoundary';
import { IS_DEMO } from './api';
import { ItemPreview, RevealPreview } from './preview/Preview';

export function App() {
  return (
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        {IS_DEMO && <DemoBanner />}
        <Routes>
          <Route path="/preview/item" element={<ErrorBoundary><ItemPreview /></ErrorBoundary>} />
          <Route path="/preview/reveal" element={<ErrorBoundary><RevealPreview /></ErrorBoundary>} />
          <Route path="*" element={<Navigate to="/preview/item" replace />} />
        </Routes>
      </BrowserRouter>
    </MotionConfig>
  );
}
