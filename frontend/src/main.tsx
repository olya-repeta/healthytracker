import React from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import App from './App';
import './index.css';

const rawGoogleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const googleClientId =
  rawGoogleClientId.replace(/^["']|["']$/g, '').trim() ||
  'unconfigured-google-client-id';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={googleClientId}>
      <App />
    </GoogleOAuthProvider>
  </React.StrictMode>
);
