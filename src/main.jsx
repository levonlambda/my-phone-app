// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './styles.css';
// Import the GlobalStateProvider from our consolidated file
import { GlobalStateProvider } from './context/GlobalStateContext';
// Import the AuthProvider
import { AuthProvider } from './context/AuthContext';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <GlobalStateProvider>
        <App />
      </GlobalStateProvider>
    </AuthProvider>
  </React.StrictMode>
);