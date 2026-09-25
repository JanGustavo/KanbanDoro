function beep(freq, duration, delay) {
  setTimeout(() => {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.05);
    osc.onended = () => ctx.close();
  }, delay);
}

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== 'PLAY_ALERT') return;
  if (message.variant === 'break') {
    beep(660, 0.18, 0);
    beep(880, 0.22, 220);
  } else {
    beep(520, 0.15, 0);
    beep(520, 0.15, 200);
    beep(760, 0.25, 400);
  }
});
