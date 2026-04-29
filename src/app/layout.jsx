// src/app/layout.jsx
'use client';
import './globals.css';
import { AuthProvider } from '@/lib/AuthContext';
import { useEffect } from 'react';

// Registra il Service Worker per la cache locale degli asset Cloudinary
function ServiceWorkerRegistrar() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => console.log('[SW] Registrato, scope:', reg.scope))
        .catch((err) => console.warn('[SW] Registrazione fallita:', err));
    }
  }, []);
  return null;
}

export default function RootLayout({ children }) {
  return (
    <html lang="it">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        {/* 14: colore status bar PWA iPhone — corrisponde al colore --bg-deep del tema */}
        <meta name="theme-color" content="#06030f" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body>
        <AuthProvider>
          <ServiceWorkerRegistrar />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
