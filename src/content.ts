type TimerSession = { phase: string; endsAt: number };
let session: TimerSession | null = null;
let mode: 'open' | 'compact' | 'hidden' = 'open';
const host = document.createElement('div');
host.id = 'kanbandoro-bubble-host';
const shadow = host.attachShadow({ mode: 'closed' });
const style = document.createElement('style');
style.textContent = `
  .timer { box-sizing:border-box; display:flex; align-items:center; gap:10px; padding:10px 12px; border:1px solid #a07b65; border-radius:14px; background:linear-gradient(135deg,#382a30,#231f23); box-shadow:0 14px 38px #0009,0 0 30px #842b4530; color:#fff3e9; font:13px system-ui,sans-serif; }
  .timer * { box-sizing:border-box; }
  .timer.compact { cursor:pointer; }
  .timer.open { display:block; min-width:215px; padding:0; overflow:hidden; }
  .timer-top { display:flex; align-items:center; gap:7px; padding:10px 12px; border-bottom:1px solid #ffffff19; color:#e5ae6a; font-size:10px; font-weight:800; letter-spacing:.13em; }
  .timer-top img,.timer.compact img { width:19px; height:19px; flex:none; }
  .timer-body { display:flex; align-items:center; gap:10px; padding:12px; }
  .timer-ring { display:grid; place-items:center; width:45px; height:45px; flex:none; border-radius:50%; background:conic-gradient(#d5a343 75%,#69404d 75%); }
  .timer-ring > span { width:36px; height:36px; display:grid; place-items:center; border-radius:50%; background:#292329; font-size:11px; font-weight:800; }
  .timer-label { display:flex; flex-direction:column; gap:2px; }
  .timer-label small { color:#e5ae6a; font-size:10px; font-weight:800; letter-spacing:.13em; }
  .timer-label strong { font-variant-numeric:tabular-nums; font-size:18px; }
  .timer-actions { display:flex; gap:6px; padding:10px 12px; border-top:1px solid #ffffff19; }
  .timer-actions button { border:1px solid #795f66; border-radius:7px; background:#352b30; color:#fff3e9; padding:6px 8px; font:inherit; cursor:pointer; }
  .timer-actions button:hover,.timer-actions button:focus-visible { border-color:#d5a343; outline:none; }
  .timer-actions button:first-child { background:#d5a343; border-color:#d5a343; color:#291e20; font-weight:750; }
`;
const bubble = document.createElement('div');
shadow.appendChild(style);
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
  const label = session!.phase === 'break' ? 'PAUSA' : 'FOCO';
  bubble.replaceChildren();
  bubble.className = `timer ${mode}`;
  if (mode === 'compact') {
    const icon = document.createElement('img');
    icon.src = chrome.runtime.getURL('icon.svg'); icon.alt = '';
    const text = document.createElement('span'); text.className = 'timer-label';
    const phase = document.createElement('small'); phase.textContent = label;
    const time = document.createElement('strong'); time.textContent = clock;
    text.append(phase, time); bubble.append(icon, text);
    bubble.title = 'Expandir ciclo atual';
    bubble.onclick = () => { mode = 'open'; render(); };
    return;
  }
  bubble.onclick = null;
  const top = document.createElement('div'); top.className = 'timer-top';
  const icon = document.createElement('img'); icon.src = chrome.runtime.getURL('icon.svg'); icon.alt = '';
  const heading = document.createElement('span'); heading.textContent = 'KANBANDORO / CICLO ATUAL';
  top.append(icon, heading); bubble.appendChild(top);
  const body = document.createElement('div'); body.className = 'timer-body';
  const ring = document.createElement('span'); ring.className = 'timer-ring';
  const mark = document.createElement('span'); mark.textContent = 'K'; ring.appendChild(mark);
  const text = document.createElement('span'); text.className = 'timer-label';
  const phase = document.createElement('small'); phase.textContent = label;
  const time = document.createElement('strong'); time.textContent = clock;
  text.append(phase, time); body.append(ring, text); bubble.appendChild(body);
  const actions = document.createElement('div');
  actions.className = 'timer-actions';
  const button = (text: string, action: () => void) => {
    const element = document.createElement('button');
    element.textContent = text;
    element.onclick = action;
    actions.appendChild(element);
  };
  button('Abrir', () => chrome.runtime.sendMessage({ type: 'OPEN_BOARD' }));
  button('Recolher', () => { mode = 'compact'; render(); });
  button('Ocultar', () => { mode = 'hidden'; render(); });
  bubble.appendChild(actions);
}

chrome.runtime.sendMessage({ type: 'GET_TIMER' }).then((response) => {
  session = response?.session || null;
  render();
}).catch(() => {});
chrome.runtime.onMessage.addListener((message: { type?: string; session?: TimerSession }, _sender, sendResponse) => {
  if (message.type === 'PING_TIMER') {
    sendResponse({ ready: true });
    return;
  }
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
