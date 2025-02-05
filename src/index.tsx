import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './components/Pages/App/App';
import reportWebVitals from './reportWebVitals';
import { BrowserRouter as Router } from 'react-router-dom';
import { Provider } from 'react-redux';
import { compose, createStore } from 'redux';
import { setupStore } from './services/store';

import { PrimeReactProvider } from 'primereact/api';
import 'primeflex/primeflex.css';
import 'primereact/resources/primereact.css';
import 'primereact/resources/themes/lara-light-indigo/theme.css';


const composeEnhancers =
  typeof window === "object" && (window as any).__REDUX_DEVTOOLS_EXTENSION_COMPOSE__
    ? (window as any).__REDUX_DEVTOOLS_EXTENSION_COMPOSE__({})
    : compose;

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
<PrimeReactProvider>
   <Provider store={setupStore()}>
    <Router>
    <App/>
    </Router>
    </Provider>
    </PrimeReactProvider>
  </React.StrictMode>
);


reportWebVitals();
