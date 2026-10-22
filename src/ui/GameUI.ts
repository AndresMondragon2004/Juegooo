import type { RoundController } from '../core/game/RoundController';
import { formatSurvivalTime } from '../core/game/ScoreSystem';
import './gameUI.css';

export class GameUI {
  private readonly root = document.createElement('div');
  private lastScreen = '';
  constructor(private readonly actions: { start: () => void; pause: () => void; resume: () => void; restart: () => void }) {
    this.root.className = 'game-ui';
    this.root.innerHTML = `
      <div class="flight-hud" hidden>
        <div class="hud-readout"><span>TIEMPO <b data-value="hud-time">00:00</b></span><span>PUNTOS <b data-value="hud-score">0</b></span></div>
        <button class="pause-button" aria-label="Pausar partida" data-action="pause">Ⅱ</button>
      </div>
      <div class="round-overlay">
        <section class="round-card" aria-labelledby="round-title">
          <div class="flight-mark" aria-hidden="true">✦</div>
          <p class="eyebrow">ARCADE DE EVASIÓN AÉREA</p>
          <h1 id="round-title">SKY EVASION</h1>
          <p class="round-description"></p>
          <div class="round-stats" hidden>
            <div class="total-score"><span>PUNTUACIÓN TOTAL</span><strong data-value="score">0</strong></div>
            <dl>
              <div><dt>Tiempo</dt><dd data-value="time">00:00</dd></div>
              <div><dt>Colisiones</dt><dd data-value="collisions">0</dd></div>
              <div><dt>Misiles destruidos</dt><dd data-value="destroyed">0</dd></div>
              <div><dt>Récord local</dt><dd data-value="best">0</dd></div>
            </dl>
            <p class="record-badge" hidden>¡NUEVO RÉCORD!</p>
          </div>
          <button class="primary-button" data-action="primary">Comenzar</button>
          <p class="control-guide">A / D o ← / → para girar<br>Toca y arrastra para dirigir · P / Esc para pausar</p>
          <p class="menu-record">Récord local: <b data-value="menu-best">0</b></p>
        </section>
      </div>`;
    this.root.addEventListener('pointerdown', event => event.stopPropagation());
    this.root.addEventListener('pointerup', event => event.stopPropagation());
    this.root.addEventListener('click', this.onClick);
    document.getElementById('game-container')!.append(this.root);
  }
  private get<T extends HTMLElement>(selector: string): T { return this.root.querySelector<T>(selector)!; }
  private setValue(name: string, value: string | number): void {
    const element = this.get(`[data-value="${name}"]`);
    const text = String(value);
    if (element.textContent !== text) element.textContent = text;
  }
  private onClick = (event: MouseEvent): void => {
    const action = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-action]')?.dataset.action;
    if (action === 'pause') this.actions.pause();
    if (action === 'primary') {
      if (this.lastScreen === 'MENU') this.actions.start();
      else if (this.lastScreen === 'PAUSED') this.actions.resume();
      else if (this.lastScreen === 'GAME_OVER') this.actions.restart();
    }
  };
  render(round: RoundController, resultsReady: boolean): void {
    const state = round.state;
    const stats = round.stats;
    this.setValue('hud-time', formatSurvivalTime(stats.time));
    this.setValue('hud-score', stats.score);
    this.get('.flight-hud').hidden = state !== 'PLAYING';
    const overlayVisible = state === 'MENU' || state === 'PAUSED' || (state === 'GAME_OVER' && resultsReady);
    this.get('.round-overlay').hidden = !overlayVisible;
    if (!overlayVisible) { this.lastScreen = ''; return; }
    this.setValue('menu-best', stats.best);
    const screenChanged = this.lastScreen !== state;
    this.lastScreen = state;
    this.root.dataset.screen = state;
    this.get('.round-stats').hidden = state !== 'GAME_OVER';
    this.get('.control-guide').hidden = state === 'GAME_OVER';
    this.get('.menu-record').hidden = state !== 'MENU';
    this.get('.eyebrow').textContent = state === 'GAME_OVER' ? 'RESULTADOS DE LA MISIÓN' : 'ARCADE DE EVASIÓN AÉREA';
    this.get('#round-title').textContent = state === 'MENU' ? 'SKY EVASION' : state === 'PAUSED' ? 'EN PAUSA' : 'FIN DEL VUELO';
    this.get('.round-description').textContent = state === 'MENU'
      ? 'Sobrevive. Cruza trayectorias. Haz que tus perseguidores choquen.'
      : state === 'PAUSED' ? 'Tómate un respiro. Tu vuelo te espera.' : 'Cada giro es otra oportunidad.';
    const button = this.get<HTMLButtonElement>('.primary-button');
    button.textContent = state === 'MENU' ? 'Comenzar' : state === 'PAUSED' ? 'Reanudar' : 'Volver a jugar';
    this.setValue('score', stats.score); this.setValue('time', formatSurvivalTime(stats.time));
    this.setValue('collisions', stats.collisions); this.setValue('destroyed', stats.destroyedMissiles);
    this.setValue('best', stats.best);
    this.get('.record-badge').hidden = !stats.newRecord;
    if (screenChanged) button.focus({ preventScroll: true });
  }
  destroy(): void { this.root.removeEventListener('click', this.onClick); this.root.remove(); }
}
