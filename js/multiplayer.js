
// Multiplayer client functionality
class MultiplayerClient {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.players = new Map();
    this.localPlayer = null;
  }

  connect() {
    // Connect to Socket.io server
    this.socket = io();

    this.socket.on('connect', () => {
      console.log('Connected to server');
      this.connected = true;
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from server');
      this.connected = false;
    });

    this.socket.on('gameState', (gameState) => {
      console.log('Received game state:', gameState);
      this.updateGameState(gameState);
    });

    this.socket.on('playerJoined', (player) => {
      console.log('Player joined:', player);
      this.players.set(player.id, player);
    });

    this.socket.on('playerLeft', (playerId) => {
      console.log('Player left:', playerId);
      this.players.delete(playerId);
    });

    this.socket.on('playerMove', (data) => {
      const player = this.players.get(data.id);
      if (player && data.id !== this.socket.id) {
        player.x = data.x;
        player.y = data.y;
        player.direction = data.direction;
        player.trail = data.trail || [];
        if (data.territory) {
          player.territory = data.territory;
        }
      }
    });

    this.socket.on('territoryCompleted', (data) => {
      const player = this.players.get(data.playerId);
      if (player) {
        player.score = data.newScore;
        player.trail = [];
      }
    });

    this.socket.on('playerDied', (data) => {
      const player = this.players.get(data.playerId);
      if (player) {
        player.alive = false;
        player.trail = [];
      }
    });
  }

  joinGame(playerName) {
    if (this.socket && this.connected) {
      this.socket.emit('join', { name: playerName });
    }
  }

  sendMovement(x, y, direction, trail, territory) {
    if (this.socket && this.connected) {
      this.socket.emit('move', { x, y, direction, trail, territory });
    }
  }

  sendTerritoryComplete(area, territory) {
    if (this.socket && this.connected) {
      this.socket.emit('completeTerritory', { area, territory });
    }
  }

  sendPlayerDeath(killedBy) {
    if (this.socket && this.connected) {
      this.socket.emit('playerDied', { killedBy });
    }
  }

  updateGameState(gameState) {
    this.players.clear();
    for (const [playerId, player] of Object.entries(gameState.players)) {
      this.players.set(playerId, player);
      if (playerId === this.socket.id) {
        this.localPlayer = player;
      }
    }
  }

  getPlayers() {
    return Array.from(this.players.values());
  }

  getLocalPlayer() {
    return this.localPlayer;
  }
}

// Global multiplayer client instance
window.multiplayerClient = new MultiplayerClient();
