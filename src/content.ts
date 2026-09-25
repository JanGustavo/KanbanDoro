type TimerSession = { phase: string; endsAt: number };
let session: TimerSession | null = null;
let mode: 'open' | 'compact' | 'hidden' = 'open';
const host = document.createElement('div');
host.id = 'kanbandoro-bubble-host';
const shadow = host.attachShadow({ mode: 'closed' });
const bubble = document.createElement('div');
shadow.appendChild(bubble);
(document.body || document.documentElement).appendChild(host);

function render() {
  const active = session && ['running', 'break'].includes(session.phase);
  if (!active || mode === 'hidden') {
    host.style.display = 'none';
    return;
  }
  host.style.display = 'block';
  host.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:2147483647;display:block';
  const remaining = Math.max(0, session!.endsAt - Date.now());
  const clock = `${String(Math.floor(remaining / 60_000)).padStart(2, '0')}:${String(Math.floor(remaining / 1_000) % 60).padStart(2, '0')}`;
  bubble.replaceChildren();
  bubble.style.cssText = 'background:#17181b;color:#f5eee8;padding:12px;border-radius:14px;border:1px solid #9c5065;box-shadow:0 8px 22px #0009;font:14px system-ui,sans-serif;min-width:145px';
  const title = document.createElement('strong');
  title.textContent = `${session!.phase === 'running' ? 'FOCO' : 'PAUSA'} · ${clock}`;
  bubble.appendChild(title);
  const actions = document.createElement('div');
  actions.style.cssText = 'display:flex;gap:7px;margin-top:8px';
  const button = (text: string, action: () => void) => {
    const element = document.createElement('button');
    element.textContent = text;
    element.style.cssText = 'background:#842b45;color:#fff;border:0;border-radius:6px;padding:5px;cursor:pointer';
    element.onclick = action;
    actions.appendChild(element);
  };
  button('Abrir', () => chrome.runtime.sendMessage({ type: 'OPEN_BOARD' }));
  button(mode === 'open' ? 'Recolher' : 'Expandir', () => { mode = mode === 'open' ? 'compact' : 'open'; render(); });
  if (mode === 'open') button('Ocultar', () => { mode = 'hidden'; render(); });
  bubble.appendChild(actions);
}

chrome.runtime.sendMessage({ type: 'GET_TIMER' }).then((response) => {
  session = response?.session || null;
  render();
}).catch(() => {});
chrome.runtime.onMessage.addListener((message: { type?: string; session?: TimerSession }) => {
  if (message.type === 'SHOW_TIMER') {
    mode = 'open';
    render();
  }
  if (message.type === 'TIMER_CHANGED') {
    session = message.session || null;
    render();
  }
});
window.setInterval(render, 1_000);
