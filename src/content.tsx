import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

function Bubble() {
  const [session, setSession] = useState<any>(null);
  const [now, setNow] = useState(Date.now());
  const [minimized, setMinimized] = useState(false);

  useEffect(() => {
    chrome.storage.local.get('session').then(({ session }) => setSession(session || null));
    const listener = (changes: any, area: string) => {
      if (area === 'local' && changes.session) setSession(changes.session.newValue || null);
    };
    chrome.storage.onChanged.addListener(listener);
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      chrome.storage.onChanged.removeListener(listener);
      window.clearInterval(timer);
    };
  }, []);

  if (!session || (session.phase !== 'running' && session.phase !== 'break')) return null;

  const remaining = Math.max(0, session.endsAt - now);
  const m = Math.floor(remaining / 60000).toString().padStart(2, '0');
  const s = Math.floor((remaining % 60000) / 1000).toString().padStart(2, '0');
  const isFocus = session.phase === 'running';

  if (minimized) {
    return (
      <div 
        style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 2147483647, background: isFocus ? '#8f2948' : '#321d28', color: '#fff', padding: '5px 10px', borderRadius: '20px', cursor: 'pointer', fontFamily: 'sans-serif', fontSize: '14px', fontWeight: 'bold', boxShadow: '0 4px 10px rgba(0,0,0,0.5)' }} 
        onClick={() => setMinimized(false)}
        title="Restaurar KanbanDoro"
      >
        {m}:{s}
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 2147483647, background: '#17181b', color: '#f5eee8', padding: '15px', borderRadius: '12px', border: `1px solid ${isFocus ? '#9c5065' : '#463238'}`, fontFamily: 'sans-serif', boxShadow: '0 8px 22px rgba(0,0,0,0.6)', width: '180px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <strong style={{ fontSize: '12px', color: isFocus ? '#e1bbc4' : '#cc9950', letterSpacing: '1px' }}>{isFocus ? 'FOCO' : 'PAUSA'}</strong>
        <button onClick={() => setMinimized(true)} style={{ background: 'transparent', border: 'none', color: '#a9a2a1', cursor: 'pointer', fontSize: '16px', lineHeight: 1, padding: '0 5px' }} title="Minimizar">_</button>
      </div>
      <div style={{ fontSize: '32px', fontWeight: 'bold', fontVariantNumeric: 'tabular-nums', textAlign: 'center', marginBottom: '5px' }}>{m}:{s}</div>
    </div>
  );
}

const host = document.createElement('div');
host.id = 'kanbandoro-bubble-host';
document.body.appendChild(host);
const shadow = host.attachShadow({ mode: 'open' });
const root = document.createElement('div');
shadow.appendChild(root);
createRoot(root).render(<React.StrictMode><Bubble /></React.StrictMode>);
