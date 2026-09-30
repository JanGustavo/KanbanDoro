import { normalizeBubblePreferences, type BubblePreferences } from './bubbleSettings';
type TimerSession = {
  phase: string;
  endsAt: number;
  stepEndsAt?: number;
  pauseEndsAt?: number;
  pauseStartedAt?: number;
};
let session: TimerSession | null = null;
let preferences: BubblePreferences = normalizeBubblePreferences(null);
let renderKey = '';
let clockNode: HTMLElement | null = null;
async function setMode(mode: BubblePreferences['mode']) {
  try {
    const result = await chrome.runtime.sendMessage({
      type: 'SET_BUBBLE_SETTINGS',
      preferences: { ...preferences, mode },
    });
    if (result?.preferences) {
      preferences = normalizeBubblePreferences(result.preferences);
      render();
    }
  } catch {
    /* Keep the existing mode if the extension was reloaded. */
  }
}
function openBoard() {
  void chrome.runtime.sendMessage({ type: 'OPEN_BOARD' }).catch(() => {});
}
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
  .timer-body { width:100%; border:0; background:transparent; color:inherit; font:inherit; cursor:pointer; text-align:left; display:flex; align-items:center; gap:10px; padding:12px; }
  .timer-ring { display:grid; place-items:center; width:45px; height:45px; flex:none; border-radius:50%; background:conic-gradient(#d5a343 75%,#69404d 75%); }
  .timer-ring > span { width:36px; height:36px; display:grid; place-items:center; border-radius:50%; background:#292329; font-size:11px; font-weight:800; }
  .timer-label { display:flex; flex-direction:column; gap:2px; }
  .timer-label small { color:#e5ae6a; font-size:10px; font-weight:800; letter-spacing:.13em; }
  .timer-label strong { font-variant-numeric:tabular-nums; font-size:18px; }
  .timer-actions { display:flex; gap:6px; padding:10px 12px; border-top:1px solid #ffffff19; }
  .timer-actions button { border:1px solid #795f66; border-radius:7px; background:#352b30; color:#fff3e9; padding:6px 8px; font:inherit; cursor:pointer; }
  .timer:focus-visible,.timer-body:focus-visible { outline:2px solid #d5a343; outline-offset:3px; }
  .timer-actions button:hover,.timer-actions button:focus-visible { border-color:#d5a343; outline:none; }
  .timer-actions button:first-child { background:#d5a343; border-color:#d5a343; color:#291e20; font-weight:750; }
`;
const bubble = document.createElement('div');
shadow.appendChild(style);
shadow.appendChild(bubble);
(document.body || document.documentElement).appendChild(host);

function render() {
  const active =
    session && ['running', 'decision', 'break', 'intermission', 'intermission-done'].includes(session.phase);
  const mode = preferences.mode;
  if (!active || mode === 'hidden') {
    host.style.display = 'none';
    return;
  }
  host.style.display = 'block';
  host.style.cssText = `position:fixed;bottom:20px;${preferences.position}:20px;z-index:2147483647;display:block`;
  const remaining =
    session!.phase === 'decision' || session!.phase === 'intermission-done'
      ? 0
      : Math.max(
          0,
          (session!.phase === 'running'
            ? Math.min(session!.stepEndsAt ?? session!.endsAt, session!.endsAt)
            : session!.phase === 'intermission'
              ? (session!.pauseEndsAt ?? Date.now())
              : session!.endsAt) - Date.now(),
        );
  const clock = `${String(Math.floor(remaining / 60_000)).padStart(2, '0')}:${String(Math.floor(remaining / 1_000) % 60).padStart(2, '0')}`;
  const label = session!.phase.startsWith('intermission')
    ? 'PAUSA RÁPIDA'
    : session!.phase === 'break'
      ? 'PAUSA'
      : session!.phase === 'decision'
        ? 'DECIDIR'
        : 'FOCO';
  const key = `${mode}:${preferences.position}:${session!.phase}`;
  if (renderKey === key && clockNode) {
    clockNode.textContent = clock;
    return;
  }
  renderKey = key;
  bubble.replaceChildren();
  bubble.removeAttribute('role');
  bubble.removeAttribute('tabindex');
  bubble.removeAttribute('aria-label');
  bubble.title = '';
  bubble.onkeydown = null;
  bubble.className = `timer ${mode}`;
  if (mode === 'compact') {
    const icon = document.createElement('img');
    icon.src = chrome.runtime.getURL('icon.svg');
    icon.alt = '';
    const text = document.createElement('span');
    text.className = 'timer-label';
    const phase = document.createElement('small');
    phase.textContent = label;
    const time = document.createElement('strong');
    time.textContent = clock;
    clockNode = time;
    text.append(phase, time);
    bubble.append(icon, text);
    bubble.title = 'Expandir ciclo atual';
    bubble.setAttribute('role', 'button');
    bubble.tabIndex = 0;
    bubble.setAttribute('aria-label', 'Expandir cronômetro do ciclo');
    bubble.onclick = () => {
      void setMode('open');
    };
    bubble.onkeydown = event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        void setMode('open');
      }
    };
    return;
  }
  bubble.onclick = null;
  const top = document.createElement('div');
  top.className = 'timer-top';
  const icon = document.createElement('img');
  icon.src = chrome.runtime.getURL('icon.svg');
  icon.alt = '';
  const heading = document.createElement('span');
  heading.textContent = 'KANBANDORO / CICLO ATUAL';
  top.append(icon, heading);
  bubble.appendChild(top);
  const body = document.createElement('button');
  body.type = 'button';
  body.className = 'timer-body';
  body.setAttribute('aria-label', 'Abrir ciclo no quadro KanbanDoro');
  body.onclick = openBoard;
  const ring = document.createElement('span');
  ring.className = 'timer-ring';
  const mark = document.createElement('span');
  mark.textContent = 'K';
  ring.appendChild(mark);
  const text = document.createElement('span');
  text.className = 'timer-label';
  const phase = document.createElement('small');
  phase.textContent = label;
  const time = document.createElement('strong');
  time.textContent = clock;
  clockNode = time;
  text.append(phase, time);
  body.append(ring, text);
  bubble.appendChild(body);
  const actions = document.createElement('div');
  actions.className = 'timer-actions';
  const button = (text: string, action: () => void) => {
    const element = document.createElement('button');
    element.textContent = text;
    element.onclick = action;
    actions.appendChild(element);
  };
  button('Abrir quadro', openBoard);
  button('Recolher', () => {
    void setMode('compact');
  });
  button('Ocultar', () => {
    void setMode('hidden');
  });
  bubble.appendChild(actions);
}

chrome.runtime
  .sendMessage({ type: 'GET_TIMER' })
  .then(response => {
    session = response?.session || null;
    preferences = normalizeBubblePreferences(response?.preferences);
    render();
  })
  .catch(() => {});
chrome.runtime.onMessage.addListener(
  (message: { type?: string; session?: TimerSession; preferences?: BubblePreferences }, _sender, sendResponse) => {
    if (message.type === 'PING_TIMER') {
      sendResponse({ ready: true });
      return;
    }
    if (message.type === 'SHOW_TIMER') {
      preferences = { ...preferences, mode: 'open' };
      render();
    }
    if (message.type === 'BUBBLE_SETTINGS_CHANGED') {
      preferences = normalizeBubblePreferences(message.preferences);
      render();
    }
    if (message.type === 'TIMER_CHANGED') {
      session = message.session || null;
      render();
    }
  },
);
window.setInterval(render, 1_000);
