import Phaser from 'phaser';
import { gameConfig } from './config/gameConfig';

window.addEventListener('DOMContentLoaded', () => {
  const game = new Phaser.Game(gameConfig);

  // Prevent back navigation on swipe gestures for mobile
  window.addEventListener('touchmove', (e) => {
    if (e.target instanceof HTMLCanvasElement) {
      e.preventDefault();
    }
  }, { passive: false });

  // Expose for debugging if needed
  (window as unknown as { __GAME__: Phaser.Game }).__GAME__ = game;
});
