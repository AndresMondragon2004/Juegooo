import Phaser from 'phaser';
import { gameConfig } from './config/gameConfig';

window.addEventListener('DOMContentLoaded', () => {
  const game = new Phaser.Game(gameConfig);

  // Fade out controls hint after first interaction or 6 seconds
  const hintEl = document.getElementById('controls-hint');
  if (hintEl) {
    const fadeHint = () => {
      hintEl.style.opacity = '0';
      setTimeout(() => hintEl.remove(), 600);
      window.removeEventListener('keydown', fadeHint);
      window.removeEventListener('pointerdown', fadeHint);
    };

    window.addEventListener('keydown', fadeHint, { once: true });
    window.addEventListener('pointerdown', fadeHint, { once: true });
    setTimeout(fadeHint, 6000);
  }

  // Prevent back navigation on swipe gestures for mobile
  window.addEventListener('touchmove', (e) => {
    if (e.target instanceof HTMLCanvasElement) {
      e.preventDefault();
    }
  }, { passive: false });

  // Expose for debugging if needed
  (window as unknown as { __GAME__: Phaser.Game }).__GAME__ = game;
});
