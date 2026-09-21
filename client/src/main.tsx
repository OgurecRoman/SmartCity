import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router'
import { MaxUI } from '@maxhub/max-ui';
import '@maxhub/max-ui/dist/styles.css';
import './global.css'
import App from './App';

createRoot(document.getElementById('root')).render(
    <HashRouter>
        <StrictMode>
            <MaxUI>
                <App/>
            </MaxUI>
        </StrictMode>
    </HashRouter>
)