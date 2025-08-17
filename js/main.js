
// Main game logic
console.log("Main.js loaded");

// Game configuration
const gameConfig = {
  canvas: {
    width: 922,
    height: 888
  },
  player: {
    speed: 5,
    size: 10
  }
};

// Export config for other files
window.gameConfig = gameConfig;
