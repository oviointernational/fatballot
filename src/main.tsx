import React from 'react';
import ReactDOM from 'react-dom/client';
import { supabaseConfigError } from './lib/supabase';
import App from './App';
import './styles/index.css';

const rootElement = document.getElementById('root')!;

ReactDOM.createRoot(rootElement).render(
  supabaseConfigError ? (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f8fafc',
        fontFamily: 'Inter, sans-serif',
        padding: 24
      }}
    >
      <div style={{ maxWidth: 560, textAlign: 'center' }}>
        <div style={{ fontSize: 48 }}>🗳️</div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', margin: '16px 0 8px' }}>
          FatBallot is not configured
        </h1>
        <p style={{ color: '#475569', fontSize: 14, lineHeight: 1.6 }}>{supabaseConfigError}</p>
        <p style={{ color: '#64748b', fontSize: 13, marginTop: 16 }}>
          After adding the variables, trigger a new deployment in Vercel.
        </p>
      </div>
    </div>
  ) : (
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
);