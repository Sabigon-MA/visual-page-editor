import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { initDesktop } from './components/Shell/fileActions';
import './index.css';
import { loadEditorFonts } from './model/fonts';

initDesktop();
loadEditorFonts();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
