
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Serve static files
app.use(express.static('.'));

// Game state
const players = new Map();
const arenaSize = 2000;

// Generate random spawn position
function getRandomSpawnPosition() {
  return {
    x: Math.random() * (arenaSize - 200) + 100,
    y: Math.random() * (arenaSize - 200) + 100
  };
}

// Fixed colors for consistent multiplayer
const PLAYER_COLORS = [
  '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7',
  '#dda0dd', '#98d8c8', '#f7dc6f', '#bb8fce', '#85c1e9'
];

function getPlayerColor(playerId) {
  // Use hash of player ID to get consistent color
  let hash = 0;
  for (let i = 0; i < playerId.length; i++) {
    hash = playerId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PLAYER_COLORS[Math.abs(hash) % PLAYER_COLORS.length];
}

const gameState = {
  arenaSize: 2000,
  players: {}
};

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  // Handle player join
  socket.on('join', (data) => {
    // Find safe spawn location
    let startX, startY;
    let attempts = 0;
    const territorySize = 30;
    const minDistance = 150;
    
    do {
      const angle = Math.random() * Math.PI * 2;
      const distance = 200 + Math.random() * 500;
      startX = gameState.arenaSize / 2 + Math.cos(angle) * distance;
      startY = gameState.arenaSize / 2 + Math.sin(angle) * distance;
      
      // Keep within circular bounds
      const centerX = gameState.arenaSize / 2;
      const centerY = gameState.arenaSize / 2;
      const distanceFromCenter = Math.sqrt(Math.pow(startX - centerX, 2) + Math.pow(startY - centerY, 2));
      if (distanceFromCenter > 900) { // Arena radius minus buffer
        const angleToCenter = Math.atan2(startY - centerY, startX - centerX);
        startX = centerX + Math.cos(angleToCenter) * 900;
        startY = centerY + Math.sin(angleToCenter) * 900;
      }
      
      attempts++;
    } while (attempts < 20);
    
    const player = {
      id: socket.id,
      name: data.name || 'Anonymous',
      x: startX,
      y: startY,
      color: getPlayerColor(socket.id),
      score: territorySize * territorySize * 4,
      trail: [],
      territory: [
        { x: startX - territorySize, y: startY - territorySize },
        { x: startX + territorySize, y: startY - territorySize },
        { x: startX + territorySize, y: startY + territorySize },
        { x: startX - territorySize, y: startY + territorySize }
      ],
      alive: true
    };

    players.set(socket.id, player);
    gameState.players[socket.id] = player;

    // Send initial game state to new player
    socket.emit('gameState', gameState);
    
    // Broadcast new player to all other players
    socket.broadcast.emit('playerJoined', player);
  });

  // Handle player movement
  socket.on('move', (data) => {
    const player = players.get(socket.id);
    if (player && player.alive) {
      player.x = data.x;
      player.y = data.y;
      player.direction = data.direction;
      
      // Update trail
      if (data.trail) {
        player.trail = data.trail;
      }
      
      // Update territory if provided
      if (data.territory) {
        player.territory = data.territory;
      }

      // Broadcast movement to all players
      io.emit('playerMove', {
        id: socket.id,
        x: data.x,
        y: data.y,
        direction: data.direction,
        trail: player.trail,
        territory: player.territory,
        score: player.score
      });
    }
  });

  // Handle player completing territory
  socket.on('completeTerritory', (data) => {
    const player = players.get(socket.id);
    if (player && player.alive) {
      player.score += data.area;
      player.trail = [];
      
      io.emit('territoryCompleted', {
        playerId: socket.id,
        area: data.area,
        territory: data.territory,
        newScore: player.score
      });
    }
  });

  // Handle player collision/death
  socket.on('playerDied', (data) => {
    const player = players.get(socket.id);
    if (player) {
      player.alive = false;
      player.trail = [];
      player.territory = [];
      player.score = 0;
      
      io.emit('playerDied', {
        playerId: socket.id,
        killedBy: data.killedBy
      });
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    players.delete(socket.id);
    delete gameState.players[socket.id];
    
    io.emit('playerLeft', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Multiplayer server running on port ${PORT}`);
});
