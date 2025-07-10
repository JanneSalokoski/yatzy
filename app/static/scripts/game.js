import { GameUI } from './game_ui.js';

async function init() {
    const game = new GameUI();
    game.init();
}

window.addEventListener("DOMContentLoaded", init);
