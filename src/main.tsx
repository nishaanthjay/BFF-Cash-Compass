import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/outfit/700.css';
import '@fontsource/outfit/800.css';
import '@fontsource/plus-jakarta-sans/400.css';
import '@fontsource/plus-jakarta-sans/500.css';
import '@fontsource/plus-jakarta-sans/600.css';
import '@fontsource/plus-jakarta-sans/700.css';
import './styles/global.css';
import { injectCssVars } from './styles/tokens';
import { App } from './App';

injectCssVars();

// Fetch every font weight up front so a student who loses wifi mid-run never hits a missing font.
for (const spec of ['700 1em Outfit', '800 1em Outfit', '400 1em "Plus Jakarta Sans"', '500 1em "Plus Jakarta Sans"', '600 1em "Plus Jakarta Sans"', '700 1em "Plus Jakarta Sans"']) {
  void document.fonts?.load(spec).catch(() => undefined);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
