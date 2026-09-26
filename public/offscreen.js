// Audio lives in an offscreen document because Manifest V3 service workers have no AudioContext.
let context;
chrome.runtime.onMessage.addListener(message => {
  if (message?.type !== 'PLAY_ALERT') return;
  try {
    context ||= new AudioContext();
    void context.resume().then(() => {
      const notes = message.variant === 'break' ? [523, 659] : [659, 523, 392];
      const start = context.currentTime;
      notes.forEach((frequency, index) => {
        const oscillator = context.createOscillator();
        const volume = context.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = frequency;
        const at = start + index * 0.19;
        volume.gain.setValueAtTime(0.0001, at);
        volume.gain.exponentialRampToValueAtTime(0.10, at + 0.025);
        volume.gain.exponentialRampToValueAtTime(0.0001, at + 0.17);
        oscillator.connect(volume).connect(context.destination);
        oscillator.start(at);
        oscillator.stop(at + 0.18);
      });
    }).catch(() => {});
  } catch {
    // System notification is still delivered if the audio device is unavailable.
  }
});
