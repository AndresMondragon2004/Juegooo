import Phaser from 'phaser';
import { GameScene } from '../scenes/GameScene';

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  backgroundColor: '#1b3b6f',
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: '100%',
    height: '100%'
  },
  render: {
    pixelArt: false,
    antialias: true,
    powerPreference: 'high-performance'
  },
  input: {
    touch: {
      capture: true
    }
  },
  scene: [GameScene]
};
