import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Theme } from '@radix-ui/themes';
import '@radix-ui/themes/tokens/base.css';
import '@radix-ui/themes/tokens/colors/gray.css';
import '@radix-ui/themes/tokens/colors/sand.css';
import '@radix-ui/themes/tokens/colors/grass.css';
import '@radix-ui/themes/tokens/colors/tomato.css';
import '@radix-ui/themes/tokens/colors/amber.css';
import '@radix-ui/themes/tokens/colors/blue.css';
import '@radix-ui/themes/components.css';
import '@radix-ui/themes/utilities.css';
import { App } from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Theme accentColor="grass" grayColor="sand" radius="large" appearance="light" panelBackground="solid" scaling="100%">
      <App />
    </Theme>
  </StrictMode>,
);
