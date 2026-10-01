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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
