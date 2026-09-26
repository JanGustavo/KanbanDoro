const seconds = document.getElementById('seconds');
let remaining = 5;
const countdown = setInterval(() => {
  remaining -= 1;
  seconds.textContent = String(remaining);
  if (remaining <= 0) {
    clearInterval(countdown);
    chrome.runtime.sendMessage({ type: 'FOCUS_NEW_TAB' });
  }
}, 1000);
document.getElementById('board').addEventListener('click', () => chrome.runtime.sendMessage({ type: 'OPEN_BOARD' }));
