

// Paper.io Game implementation
console.log("Paper.io Game starting...");

// Game state
let gameState = {
  canvas: null,
  ctx: null,
  player: null,
  players: new Map(),
  bots: new Map(),
  gameRunning: false,
  keys: {},
  camera: { x: 0, y: 0 },
  arenaSize: 2000,
  arenaRadius: 1000
};

// Fixed colors for consistent multiplayer
const PLAYER_COLORS = [
  '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7',
  '#dda0dd', '#98d8c8', '#f7dc6f', '#bb8fce', '#85c1e9'
];

// Bot names
const BOT_NAMES = [
  'RobotX', 'AI_Player', 'CyberBot', 'NanoBot', 'TechBot',
  'DigitalKid', 'ByteHunter', 'CodeRunner', 'PixelBot', 'DataBot'
];

// Store assigned colors to prevent duplicates
const assignedColors = new Map();
let colorIndex = 0;

function getPlayerColor(playerId) {
  // Return existing color if already assigned
  if (assignedColors.has(playerId)) {
    return assignedColors.get(playerId);
  }
  
  // Find next available color
  let attempts = 0;
  let color;
  do {
    color = PLAYER_COLORS[colorIndex % PLAYER_COLORS.length];
    colorIndex++;
    attempts++;
  } while (Array.from(assignedColors.values()).includes(color) && attempts < PLAYER_COLORS.length);
  
  // If all colors are taken, use hash method as fallback
  if (attempts >= PLAYER_COLORS.length) {
    let hash = 0;
    for (let i = 0; i < playerId.length; i++) {
      hash = playerId.charCodeAt(i) + ((hash << 5) - hash);
    }
    color = PLAYER_COLORS[Math.abs(hash) % PLAYER_COLORS.length];
  }
  
  assignedColors.set(playerId, color);
  return color;
}

function createBot() {
  const botId = 'bot_' + Date.now() + '_' + Math.random();
  const botName = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
  
  // Find safe spawn location away from player and other territories
  let startX, startY;
  let attempts = 0;
  const territorySize = 25;
  const minDistanceFromPlayer = 200;
  
  do {
    const angle = Math.random() * Math.PI * 2;
    const distance = 400 + Math.random() * 400;
    startX = gameState.arenaSize / 2 + Math.cos(angle) * distance;
    startY = gameState.arenaSize / 2 + Math.sin(angle) * distance;
    
    const centerX = gameState.arenaSize / 2;
    const centerY = gameState.arenaSize / 2;
    const distanceFromCenter = Math.sqrt(Math.pow(startX - centerX, 2) + Math.pow(startY - centerY, 2));
    if (distanceFromCenter > gameState.arenaRadius - 100) {
      const angleToCenter = Math.atan2(startY - centerY, startX - centerX);
      startX = centerX + Math.cos(angleToCenter) * (gameState.arenaRadius - 100);
      startY = centerY + Math.sin(angleToCenter) * (gameState.arenaRadius - 100);
    }
    
    // Check distance from player
    let tooCloseToPlayer = false;
    if (gameState.player) {
      const distanceToPlayer = Math.sqrt(Math.pow(startX - gameState.player.x, 2) + Math.pow(startY - gameState.player.y, 2));
      if (distanceToPlayer < minDistanceFromPlayer) {
        tooCloseToPlayer = true;
      }
      // Check if spawning in player territory
      if (isInOwnTerritory(startX, startY, gameState.player.territory)) {
        tooCloseToPlayer = true;
      }
    }
    
    // Check distance from other bots
    let tooCloseToOtherBot = false;
    gameState.bots.forEach(bot => {
      if (bot.alive) {
        const distanceToBot = Math.sqrt(Math.pow(startX - bot.x, 2) + Math.pow(startY - bot.y, 2));
        if (distanceToBot < 150) {
          tooCloseToOtherBot = true;
        }
      }
    });
    
    if (!tooCloseToPlayer && !tooCloseToOtherBot) break;
    
    attempts++;
  } while (attempts < 50);
  
  return {
    id: botId,
    name: botName,
    x: startX,
    y: startY,
    size: 8,
    color: getPlayerColor(botId),
    direction: { x: Math.random() - 0.5, y: Math.random() - 0.5 },
    speed: 2 + Math.random(),
    trail: [],
    territory: [
      { x: startX - territorySize, y: startY - territorySize },
      { x: startX + territorySize, y: startY - territorySize },
      { x: startX + territorySize, y: startY + territorySize },
      { x: startX - territorySize, y: startY + territorySize }
    ],
    inOwnTerritory: true,
    score: territorySize * territorySize * 4,
    alive: true,
    isBot: true,
    lastDirectionChange: Date.now()
  };
}

// Initialize game when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  console.log("DOM loaded, initializing Paper.io game...");
  
  const playButton = document.getElementById('play');
  const nickInput = document.getElementById('nick');
  const statusIndicator = document.getElementById('status-indicator');
  const statusText = document.getElementById('status-text');
  
  // Initialize multiplayer client to check server status
  if (!window.multiplayerClient) {
    window.multiplayerClient = new MultiplayerClient();
  }
  
  // Update server status
  function updateServerStatus(connected, error = false) {
    if (connected) {
      statusIndicator.className = 'status-connected';
      statusText.textContent = 'Connected to server';
      playButton.disabled = false;
    } else if (error) {
      statusIndicator.className = 'status-error';
      statusText.textContent = 'Server connection failed';
      playButton.disabled = true;
    } else {
      statusIndicator.className = 'status-disconnected';
      statusText.textContent = 'Connecting to server...';
      playButton.disabled = true;
    }
  }
  
  // Try to connect to server
  try {
    window.multiplayerClient.connect();
    
    // Listen for connection events
    window.multiplayerClient.socket.on('connect', () => {
      updateServerStatus(true);
    });
    
    window.multiplayerClient.socket.on('disconnect', () => {
      updateServerStatus(false);
    });
    
    window.multiplayerClient.socket.on('connect_error', () => {
      updateServerStatus(false, true);
    });
    
  } catch (error) {
    updateServerStatus(false, true);
  }
  
  if (playButton && nickInput) {
    playButton.addEventListener('click', function(e) {
      e.preventDefault();
      
      if (playButton.disabled) return;
      
      const playerName = nickInput.value.trim() || 'Anonymous';
      console.log('Starting Paper.io game with name:', playerName);
      
      // Hide UI and show game
      const ui = document.getElementById('ui');
      if (ui) {
        ui.style.display = 'none';
      }
      
      // Start Paper.io game
      startPaperIoGame(playerName);
    });
  }
});

function startPaperIoGame(playerName) {
  const canvas = document.getElementById('view');
  if (!canvas) {
    console.error('Canvas not found');
    return;
  }
  
  gameState.canvas = canvas;
  gameState.ctx = canvas.getContext('2d');
  gameState.gameRunning = true;
  
  // Find a safe spawn location away from other players
  let startX, startY;
  let attempts = 0;
  const territorySize = 30;
  const minDistance = 150; // Minimum distance from other players
  
  do {
    const angle = Math.random() * Math.PI * 2;
    const distance = 200 + Math.random() * 500; // Spawn 200-700 pixels from center
    startX = gameState.arenaSize / 2 + Math.cos(angle) * distance;
    startY = gameState.arenaSize / 2 + Math.sin(angle) * distance;
    
    // Keep within arena bounds
    const centerX = gameState.arenaSize / 2;
    const centerY = gameState.arenaSize / 2;
    const distanceFromCenter = Math.sqrt(Math.pow(startX - centerX, 2) + Math.pow(startY - centerY, 2));
    if (distanceFromCenter > gameState.arenaRadius - 100) {
      const angleToCenter = Math.atan2(startY - centerY, startX - centerX);
      startX = centerX + Math.cos(angleToCenter) * (gameState.arenaRadius - 100);
      startY = centerY + Math.sin(angleToCenter) * (gameState.arenaRadius - 100);
    }
    
    attempts++;
  } while (attempts < 20); // Limit attempts to prevent infinite loop
  
  gameState.player = {
    id: 'local',
    name: playerName,
    x: startX,
    y: startY,
    size: 8,
    color: getPlayerColor('local'),
    direction: { x: 0, y: 1 },
    speed: 3,
    trail: [],
    territory: [
      { x: startX - territorySize, y: startY - territorySize },
      { x: startX + territorySize, y: startY - territorySize },
      { x: startX + territorySize, y: startY + territorySize },
      { x: startX - territorySize, y: startY + territorySize }
    ],
    inOwnTerritory: true,
    score: territorySize * territorySize * 4, // Initial score based on territory
    alive: true
  };
  
  // Connect to multiplayer
  if (!window.multiplayerClient) {
    window.multiplayerClient = new MultiplayerClient();
  }
  
  if (!window.multiplayerClient.connected) {
    window.multiplayerClient.connect();
  }
  
  // Wait for connection before joining
  setTimeout(() => {
    window.multiplayerClient.joinGame(playerName);
  }, 100);
  
  // Create bots immediately, always ensure minimum number
  for (let i = 0; i < 5; i++) {
    const bot = createBot();
    gameState.bots.set(bot.id, bot);
  }
  
  // Respawn dead bots periodically - always maintain at least 5 bots
  setInterval(() => {
    const aliveBots = Array.from(gameState.bots.values()).filter(bot => bot.alive);
    const targetBotCount = 5; // Always have 5 bots minimum
    
    for (let i = aliveBots.length; i < targetBotCount; i++) {
      const newBot = createBot();
      gameState.bots.set(newBot.id, newBot);
      console.log('Spawned new bot:', newBot.name);
    }
  }, 3000);
  
  setupControls();
  gameLoop();
}

function setupControls() {
  const canvas = gameState.canvas;
  
  // Touch controls for mobile
  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartTime = 0;
  let isTouching = false;
  let hasMoved = false;
  
  canvas.addEventListener('touchstart', function(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    touchStartX = touch.clientX - rect.left;
    touchStartY = touch.clientY - rect.top;
    touchStartTime = Date.now();
    isTouching = true;
    hasMoved = false;
  });
  
  canvas.addEventListener('touchmove', function(e) {
    e.preventDefault();
    if (!isTouching || !gameState.player) return;
    
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const touchCurrentX = touch.clientX - rect.left;
    const touchCurrentY = touch.clientY - rect.top;
    
    const deltaX = touchCurrentX - touchStartX;
    const deltaY = touchCurrentY - touchStartY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    // Only change direction if moved significantly
    if (distance > 30) {
      hasMoved = true;
      const newDirection = {
        x: deltaX / distance,
        y: deltaY / distance
      };
      
      gameState.player.direction = newDirection;
      
      if (window.multiplayerClient) {
        window.multiplayerClient.sendMovement(gameState.player.x, gameState.player.y, 'touch', gameState.player.trail, gameState.player.territory);
      }
    }
  });
  
  canvas.addEventListener('touchend', function(e) {
    e.preventDefault();
    const touchDuration = Date.now() - touchStartTime;
    
    // If it was a quick tap without movement, make a small territory claim
    if (!hasMoved && touchDuration < 300 && gameState.player && gameState.player.alive) {
      createSmallTerritoryClaim(gameState.player);
    }
    
    isTouching = false;
    hasMoved = false;
  });
  
  // Mouse controls for desktop
  let isMouseDown = false;
  
  canvas.addEventListener('mousedown', function(e) {
    isMouseDown = true;
    updateDirectionFromMouse(e);
  });
  
  canvas.addEventListener('mousemove', function(e) {
    if (isMouseDown) {
      updateDirectionFromMouse(e);
    }
  });
  
  canvas.addEventListener('mouseup', function(e) {
    isMouseDown = false;
  });
  
  function updateDirectionFromMouse(e) {
    if (!gameState.player) return;
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Convert to world coordinates
    const worldMouseX = mouseX + gameState.camera.x;
    const worldMouseY = mouseY + gameState.camera.y;
    
    const deltaX = worldMouseX - gameState.player.x;
    const deltaY = worldMouseY - gameState.player.y;
    
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    if (distance > 10) {
      const newDirection = {
        x: deltaX / distance,
        y: deltaY / distance
      };
      
      gameState.player.direction = newDirection;
      
      if (window.multiplayerClient) {
        window.multiplayerClient.sendMovement(gameState.player.x, gameState.player.y, 'mouse', gameState.player.trail, gameState.player.territory);
      }
    }
  }
  
  // Keyboard controls (keep for desktop)
  document.addEventListener('keydown', function(e) {
    gameState.keys[e.key] = true;
    
    let newDirection = null;
    
    switch(e.key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        newDirection = { x: 0, y: -1 };
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        newDirection = { x: 0, y: 1 };
        break;
      case 'ArrowLeft':
      case 'a':
      case 'A':
        newDirection = { x: -1, y: 0 };
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        newDirection = { x: 1, y: 0 };
        break;
    }
    
    if (newDirection && gameState.player) {
      gameState.player.direction = newDirection;
      
      if (window.multiplayerClient) {
        window.multiplayerClient.sendMovement(gameState.player.x, gameState.player.y, e.key, gameState.player.trail, gameState.player.territory);
      }
    }
  });
  
  document.addEventListener('keyup', function(e) {
    gameState.keys[e.key] = false;
  });
}

function gameLoop() {
  if (!gameState.gameRunning) return;
  
  update();
  render();
  
  requestAnimationFrame(gameLoop);
}

function update() {
  const player = gameState.player;
  if (!player || !player.alive) return;
  
  // Update bots
  updateBots();
  
  // Move player
  const oldX = player.x;
  const oldY = player.y;
  
  player.x += player.direction.x * player.speed;
  player.y += player.direction.y * player.speed;
  
  // Keep player in circular bounds
  const centerX = gameState.arenaSize / 2;
  const centerY = gameState.arenaSize / 2;
  const distanceFromCenter = Math.sqrt(
    Math.pow(player.x - centerX, 2) + Math.pow(player.y - centerY, 2)
  );
  
  if (distanceFromCenter > gameState.arenaRadius - 10) {
    const angle = Math.atan2(player.y - centerY, player.x - centerX);
    player.x = centerX + Math.cos(angle) * (gameState.arenaRadius - 10);
    player.y = centerY + Math.sin(angle) * (gameState.arenaRadius - 10);
  }
  
  // Add to trail if moving
  if (player.x !== oldX || player.y !== oldY) {
    const wasInTerritory = player.inOwnTerritory;
    player.inOwnTerritory = isInOwnTerritory(player.x, player.y, player.territory);
    
    // If leaving territory, start trail
    if (wasInTerritory && !player.inOwnTerritory) {
      player.trail = [{ x: oldX, y: oldY }];
    }
    
    // If in trail mode, add to trail (but not too frequently to avoid collision issues)
    if (!player.inOwnTerritory) {
      const lastTrailPoint = player.trail[player.trail.length - 1];
      if (!lastTrailPoint || 
          Math.sqrt(Math.pow(player.x - lastTrailPoint.x, 2) + Math.pow(player.y - lastTrailPoint.y, 2)) > 5) {
        player.trail.push({ x: player.x, y: player.y });
      }
    }
    
    // If returning to territory, complete the loop
    if (!wasInTerritory && player.inOwnTerritory && player.trail.length > 3) {
      completeTerritory(player);
    }
  }
  
  // Check collisions with other players
  checkCollisions();
  
  // Update camera to follow player
  updateCamera();
  
  // Update other players from multiplayer
  if (window.multiplayerClient) {
    const otherPlayers = window.multiplayerClient.getPlayers();
    gameState.players.clear();
    otherPlayers.forEach(p => {
      if (p.id !== window.multiplayerClient.socket?.id) {
        gameState.players.set(p.id, p);
      }
    });
  }
}

function isInOwnTerritory(x, y, territory) {
  if (territory.length < 3) return false;
  
  // Point-in-polygon test using ray casting
  let inside = false;
  for (let i = 0, j = territory.length - 1; i < territory.length; j = i++) {
    if (((territory[i].y > y) !== (territory[j].y > y)) &&
        (x < (territory[j].x - territory[i].x) * (y - territory[i].y) / (territory[j].y - territory[i].y) + territory[i].x)) {
      inside = !inside;
    }
  }
  return inside;
}

function completeTerritory(player) {
  if (player.trail.length < 3) return;
  
  try {
    // Store original territory and area for rollback if needed
    const originalTerritory = [...player.territory];
    const originalArea = calculateTerritoryArea(originalTerritory);
    
    // Create the trail loop
    const trailLoop = [...player.trail];
    
    // Simple polygon expansion: combine territory and trail
    let newTerritory;
    
    if (player.territory.length > 0) {
      // Method 1: Create a polygon that includes both the original territory and the trail
      const allPoints = [...originalTerritory, ...trailLoop];
      
      // Remove duplicate points that are too close
      const cleanPoints = [];
      allPoints.forEach(point => {
        let isDuplicate = false;
        cleanPoints.forEach(existingPoint => {
          const dist = Math.sqrt(
            Math.pow(point.x - existingPoint.x, 2) + Math.pow(point.y - existingPoint.y, 2)
          );
          if (dist < 5) {
            isDuplicate = true;
          }
        });
        if (!isDuplicate) {
          cleanPoints.push(point);
        }
      });
      
      // Use convex hull for clean territory
      newTerritory = createConvexHull(cleanPoints);
      
      // Validate the new territory
      const newArea = calculateTerritoryArea(newTerritory);
      const areaIncrease = newArea - originalArea;
      const maxAllowedIncrease = 100000; // Increased limit
      
      if (newTerritory.length >= 3 && areaIncrease > 0 && areaIncrease < maxAllowedIncrease) {
        player.territory = newTerritory;
        player.score += Math.floor(areaIncrease * 0.2); // Better scoring
        console.log('Territory expanded successfully! Area gained:', areaIncrease);
      } else if (areaIncrease >= maxAllowedIncrease) {
        // If area is very large, take a portion of it
        const scaleFactor = Math.sqrt(maxAllowedIncrease / areaIncrease);
        const centerX = player.x;
        const centerY = player.y;
        
        // Scale down the expansion
        const scaledPoints = newTerritory.map(point => ({
          x: centerX + (point.x - centerX) * scaleFactor,
          y: centerY + (point.y - centerY) * scaleFactor
        }));
        
        player.territory = scaledPoints;
        player.score += Math.floor(maxAllowedIncrease * 0.2);
        console.log('Large territory scaled down and claimed');
      } else {
        // Keep original territory
        player.territory = originalTerritory;
        console.log('Territory expansion invalid, keeping original');
      }
    } else {
      // No existing territory, use trail as new territory
      newTerritory = createConvexHull(trailLoop);
      if (newTerritory.length >= 3) {
        player.territory = newTerritory;
        const newArea = calculateTerritoryArea(newTerritory);
        player.score += Math.floor(newArea * 0.2);
        console.log('New territory created from trail');
      }
    }
    
    // Clear trail
    player.trail = [];
    
    // Check if we captured any enemy territory
    checkTerritoryCapture(player);
    
  } catch (error) {
    // If anything goes wrong, just clear the trail and keep original territory
    player.trail = [];
    console.log('Territory completion failed, keeping original territory:', error);
  }
}

function createConvexHull(points) {
  if (points.length < 3) return points;
  
  // Sort points lexicographically
  points.sort((a, b) => a.x - b.x || a.y - b.y);
  
  // Build lower hull
  const lower = [];
  for (let i = 0; i < points.length; i++) {
    while (lower.length >= 2 && cross(lower[lower.length-2], lower[lower.length-1], points[i]) <= 0) {
      lower.pop();
    }
    lower.push(points[i]);
  }
  
  // Build upper hull
  const upper = [];
  for (let i = points.length - 1; i >= 0; i--) {
    while (upper.length >= 2 && cross(upper[upper.length-2], upper[upper.length-1], points[i]) <= 0) {
      upper.pop();
    }
    upper.push(points[i]);
  }
  
  // Remove last point of each half because it's repeated
  upper.pop();
  lower.pop();
  
  return lower.concat(upper);
}

function cross(O, A, B) {
  return (A.x - O.x) * (B.y - O.y) - (A.y - O.y) * (B.x - O.x);
}

function checkTerritoryCapture(player) {
  // Check if player's new territory overlaps with other players' territories
  gameState.players.forEach(otherPlayer => {
    if (otherPlayer.id === player.id || !otherPlayer.territory) return;
    
    // Simple overlap check - remove overlapped parts from other player
    const newOtherTerritory = [];
    otherPlayer.territory.forEach(point => {
      if (!isInOwnTerritory(point.x, point.y, player.territory)) {
        newOtherTerritory.push(point);
      }
    });
    
    if (newOtherTerritory.length < otherPlayer.territory.length) {
      otherPlayer.territory = newOtherTerritory;
      otherPlayer.score = Math.max(100, calculateTerritoryArea(otherPlayer.territory));
    }
  });
  
  // Check if player captured bot territories
  gameState.bots.forEach(bot => {
    if (!bot.territory || bot.territory.length === 0) return;
    
    let capturedPoints = 0;
    const newBotTerritory = [];
    
    bot.territory.forEach(point => {
      if (isInOwnTerritory(point.x, point.y, player.territory)) {
        capturedPoints++;
      } else {
        newBotTerritory.push(point);
      }
    });
    
    if (capturedPoints > 0) {
      // Bot lost some territory
      bot.territory = newBotTerritory;
      bot.score = Math.max(100, calculateTerritoryArea(bot.territory));
      player.score += capturedPoints * 10; // Bonus for capturing bot territory
      
      // If bot lost most of its territory, eliminate it
      if (newBotTerritory.length < 3) {
        bot.alive = false;
        bot.trail = [];
        bot.territory = [];
        player.score += 200; // Bonus for eliminating bot
      }
    }
  });
}

function calculateTerritoryArea(territory) {
  if (territory.length < 3) return 0;
  
  let area = 0;
  for (let i = 0; i < territory.length; i++) {
    const j = (i + 1) % territory.length;
    area += territory[i].x * territory[j].y;
    area -= territory[j].x * territory[i].y;
  }
  return Math.abs(area) / 2;
}

function checkCollisions() {
  const player = gameState.player;
  if (!player || !player.alive) return;
  
  // Only check self-collision if player is NOT in their own territory
  if (!player.inOwnTerritory) {
    // Check collision with own trail (only check older trail points, not recent ones)
    if (player.trail.length > 10) {
      for (let i = 0; i < player.trail.length - 5; i++) {
        const trailPoint = player.trail[i];
        const distance = Math.sqrt(
          Math.pow(player.x - trailPoint.x, 2) + Math.pow(player.y - trailPoint.y, 2)
        );
        if (distance < player.size + 2) {
          player.alive = false;
          player.trail = [];
          player.territory = [];
          console.log('Player died: hit own trail');
          if (window.multiplayerClient) {
            window.multiplayerClient.sendPlayerDeath('own_trail');
          }
          return;
        }
      }
    }
  }
  
  // Check collision with other players
  gameState.players.forEach(otherPlayer => {
    if (!otherPlayer.alive) return;
    
    // Check if we hit other player's trail - WE should kill THEM if they're outside their territory
    if (otherPlayer.trail && otherPlayer.trail.length > 0) {
      otherPlayer.trail.forEach(trailPoint => {
        const distance = Math.sqrt(
          Math.pow(player.x - trailPoint.x, 2) + Math.pow(player.y - trailPoint.y, 2)
        );
        if (distance < player.size + 3) {
          // Other player dies because we hit their trail
          console.log('Other player eliminated by hitting their trail');
          // In multiplayer, this would be handled by the server
          // For now, just award points to local player
          player.score += 200;
        }
      });
    }
    
    // Check direct collision with other player
    const distanceToPlayer = Math.sqrt(
      Math.pow(player.x - otherPlayer.x, 2) + Math.pow(player.y - otherPlayer.y, 2)
    );
    if (distanceToPlayer < player.size + 8) {
      // If other player is outside their territory and we hit them, they die
      if (otherPlayer.trail && otherPlayer.trail.length > 0) {
        console.log('Other player eliminated by direct collision');
        player.score += 300;
      }
      // Only kill ourselves if WE are outside our territory
      else if (player.trail && player.trail.length > 0) {
        player.alive = false;
        player.trail = [];
        player.territory = [];
        console.log('Player died: collision while outside territory');
        if (window.multiplayerClient) {
          window.multiplayerClient.sendPlayerDeath('other_player');
        }
      }
    }
  });
  
  // Check collision with bots
  gameState.bots.forEach(bot => {
    if (!bot.alive) return;
    
    // Check if we hit bot's trail - bot dies
    if (bot.trail && bot.trail.length > 0) {
      bot.trail.forEach(trailPoint => {
        const distance = Math.sqrt(
          Math.pow(player.x - trailPoint.x, 2) + Math.pow(player.y - trailPoint.y, 2)
        );
        if (distance < player.size + 3) {
          // Bot dies, player gets points
          killBot(bot);
          player.score += 150;
          console.log('Bot eliminated by hitting its trail!');
        }
      });
    }
    
    // Check direct collision with bot
    const distanceToBot = Math.sqrt(
      Math.pow(player.x - bot.x, 2) + Math.pow(player.y - bot.y, 2)
    );
    if (distanceToBot < player.size + bot.size) {
      if (!bot.inOwnTerritory) {
        // Bot is outside territory, player wins
        player.score += bot.score * 0.5;
        killBot(bot);
        console.log('Bot eliminated by direct collision!');
      } else if (!player.inOwnTerritory) {
        // Player is outside territory, player dies
        player.alive = false;
        player.trail = [];
        player.territory = [];
        console.log('Player died: collision with bot while outside territory');
        if (window.multiplayerClient) {
          window.multiplayerClient.sendPlayerDeath('bot');
        }
      }
    }
  });
}

function updateCamera() {
  const player = gameState.player;
  if (!player) return;
  
  const canvas = gameState.canvas;
  gameState.camera.x = player.x - canvas.width / 2;
  gameState.camera.y = player.y - canvas.height / 2;
  
  // Keep camera in bounds
  gameState.camera.x = Math.max(0, Math.min(gameState.arenaSize - canvas.width, gameState.camera.x));
  gameState.camera.y = Math.max(0, Math.min(gameState.arenaSize - canvas.height, gameState.camera.y));
}

function render() {
  const ctx = gameState.ctx;
  const canvas = gameState.canvas;
  const camera = gameState.camera;
  
  // Clear canvas with white background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Save context for camera transform
  ctx.save();
  ctx.translate(-camera.x, -camera.y);
  
  // Draw arena border
  drawArenaBorder(ctx);
  
  // Draw all players' territories (opaque)
  gameState.players.forEach(player => {
    if (player.territory && player.territory.length > 2 && player.alive !== false) {
      drawTerritory(ctx, player.territory, player.color || '#ff6b6b');
      // Draw territory border
      drawTerritoryBorder(ctx, player.territory, player.color || '#ff6b6b');
    }
  });
  
  // Draw bot territories
  gameState.bots.forEach(bot => {
    if (bot.territory && bot.territory.length > 2 && bot.alive) {
      drawTerritory(ctx, bot.territory, bot.color);
      drawTerritoryBorder(ctx, bot.territory, bot.color);
    }
  });
  
  // Draw local player territory (opaque)
  const player = gameState.player;
  if (player && player.territory.length > 2 && player.alive) {
    drawTerritory(ctx, player.territory, player.color);
  }
  
  // Draw all players' trails
  gameState.players.forEach(p => {
    if (p.trail && p.trail.length > 1 && p.alive !== false) {
      drawTrail(ctx, p.trail, p.color || '#ff6b6b');
    }
  });
  
  // Draw bot trails
  gameState.bots.forEach(bot => {
    if (bot.trail && bot.trail.length > 1 && bot.alive) {
      drawTrail(ctx, bot.trail, bot.color);
    }
  });
  
  // Draw local player trail
  if (player && player.trail.length > 1 && player.alive) {
    drawTrail(ctx, player.trail, player.color);
  }
  
  // Draw all players
  gameState.players.forEach(p => {
    if (p.alive !== false) {
      drawPlayer(ctx, p, p.color || '#ff6b6b');
    }
  });
  
  // Draw bots
  gameState.bots.forEach(bot => {
    if (bot.alive) {
      drawPlayer(ctx, bot, bot.color);
    }
  });
  
  // Draw local player
  if (player && player.alive) {
    drawPlayer(ctx, player, player.color);
  }
  
  // Restore context
  ctx.restore();
  
  // Draw UI elements (not affected by camera)
  drawUI();
  drawMinimap();
}

function drawArenaBorder(ctx) {
  const centerX = gameState.arenaSize / 2;
  const centerY = gameState.arenaSize / 2;
  
  // Draw outer circle (arena boundary)
  ctx.strokeStyle = '#ff6b6b';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(centerX, centerY, gameState.arenaRadius, 0, Math.PI * 2);
  ctx.stroke();
  
  // Draw subtle grid inside circle
  ctx.strokeStyle = '#404040';
  ctx.lineWidth = 0.5;
  
  const gridSize = 100;
  for (let x = centerX - gameState.arenaRadius; x <= centerX + gameState.arenaRadius; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, centerY - gameState.arenaRadius);
    ctx.lineTo(x, centerY + gameState.arenaRadius);
    ctx.stroke();
  }
  
  for (let y = centerY - gameState.arenaRadius; y <= centerY + gameState.arenaRadius; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(centerX - gameState.arenaRadius, y);
    ctx.lineTo(centerX + gameState.arenaRadius, y);
    ctx.stroke();
  }
}

function drawTerritory(ctx, territory, color) {
  if (territory.length < 3) return;
  
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(territory[0].x, territory[0].y);
  
  for (let i = 1; i < territory.length; i++) {
    ctx.lineTo(territory[i].x, territory[i].y);
  }
  
  ctx.closePath();
  ctx.fill();
}

function drawTerritoryBorder(ctx, territory, color) {
  if (territory.length < 3) return;
  
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(territory[0].x, territory[0].y);
  
  for (let i = 1; i < territory.length; i++) {
    ctx.lineTo(territory[i].x, territory[i].y);
  }
  
  ctx.closePath();
  ctx.stroke();
}

function drawTrail(ctx, trail, color) {
  if (trail.length < 2) return;
  
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  ctx.beginPath();
  ctx.moveTo(trail[0].x, trail[0].y);
  
  for (let i = 1; i < trail.length; i++) {
    ctx.lineTo(trail[i].x, trail[i].y);
  }
  
  ctx.stroke();
}

function drawPlayer(ctx, player, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.size, 0, Math.PI * 2);
  ctx.fill();
  
  // Draw player name
  ctx.fillStyle = 'white';
  ctx.font = '12px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(player.name || 'Player', player.x, player.y - player.size - 5);
}

function drawUI() {
  const ctx = gameState.ctx;
  const player = gameState.player;
  
  if (!player) return;
  
  // Draw score
  ctx.fillStyle = 'white';
  ctx.font = 'bold 20px Arial';
  ctx.textAlign = 'left';
  ctx.fillText(`Score: ${Math.round(player.score)}`, 10, 30);
  
  // Draw status
  if (!player.inOwnTerritory && player.trail.length > 0) {
    ctx.fillStyle = '#ff6b6b';
    ctx.font = '16px Arial';
    ctx.fillText('Outside Territory - Return to claim!', 10, 60);
  }
  
  if (!player.alive) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, gameState.canvas.width, gameState.canvas.height);
    
    ctx.fillStyle = 'white';
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', gameState.canvas.width / 2, gameState.canvas.height / 2);
    
    ctx.font = '20px Arial';
    ctx.fillText(`Final Score: ${Math.round(player.score)}`, gameState.canvas.width / 2, gameState.canvas.height / 2 + 50);
    
    ctx.font = '16px Arial';
    ctx.fillText('Click to restart', gameState.canvas.width / 2, gameState.canvas.height / 2 + 80);
    
    // Add restart functionality
    if (!gameState.restartListenerAdded) {
      gameState.canvas.addEventListener('click', restartGame);
      gameState.restartListenerAdded = true;
    }
  }
}

function restartGame() {
  if (gameState.player && !gameState.player.alive) {
    // Reset game state
    gameState.gameRunning = false;
    gameState.restartListenerAdded = false;
    
    // Show UI again
    const ui = document.getElementById('ui');
    if (ui) {
      ui.style.display = 'flex';
    }
    
    // Clear canvas
    const ctx = gameState.ctx;
    ctx.clearRect(0, 0, gameState.canvas.width, gameState.canvas.height);
    
    // Disconnect from multiplayer
    if (window.multiplayerClient && window.multiplayerClient.socket) {
      window.multiplayerClient.socket.disconnect();
    }
  }
}

function updateBots() {
  gameState.bots.forEach(bot => {
    if (!bot.alive) return;
    
    // Check if bot should die from collisions
    checkBotCollisions(bot);
    if (!bot.alive) return;
    
    // AI decision making
    let targetDirection = null;
    
    // 5% chance per action to attack nearest player trail (reduced aggression)
    if (Math.random() < 0.05) {
      const nearestTrail = findNearestPlayerTrail(bot);
      if (nearestTrail) {
        targetDirection = {
          x: nearestTrail.x - bot.x,
          y: nearestTrail.y - bot.y
        };
        
        // Normalize
        const length = Math.sqrt(targetDirection.x * targetDirection.x + targetDirection.y * targetDirection.y);
        if (length > 0) {
          targetDirection.x /= length;
          targetDirection.y /= length;
        }
      }
    }
    
    // If not attacking, use safer AI behavior
    if (!targetDirection) {
      // Less frequent direction changes for smoother movement
      if (Date.now() - bot.lastDirectionChange > 2000 + Math.random() * 2000 || isStuck(bot)) {
        const centerX = gameState.arenaSize / 2;
        const centerY = gameState.arenaSize / 2;
        const distanceFromCenter = Math.sqrt(
          Math.pow(bot.x - centerX, 2) + Math.pow(bot.y - centerY, 2)
        );
        
        if (distanceFromCenter > gameState.arenaRadius - 200) {
          // Head towards center with some randomness
          const angle = Math.atan2(centerY - bot.y, centerX - bot.x) + (Math.random() - 0.5) * 0.5;
          targetDirection = {
            x: Math.cos(angle),
            y: Math.sin(angle)
          };
        } else {
          // Create much smoother movement with gentle curves
          const currentAngle = Math.atan2(bot.direction.y, bot.direction.x);
          const angleChange = (Math.random() - 0.5) * 0.3; // Even smaller turns
          const newAngle = currentAngle + angleChange;
          
          targetDirection = {
            x: Math.cos(newAngle),
            y: Math.sin(newAngle)
          };
          
          // Avoid edges and dangerous areas
          if (wouldGoOutOfBounds(bot, targetDirection) || wouldHitOwnTrail(bot, targetDirection)) {
            const toCenter = Math.atan2(centerY - bot.y, centerX - bot.x);
            targetDirection = {
              x: Math.cos(toCenter + (Math.random() - 0.5) * 0.2),
              y: Math.sin(toCenter + (Math.random() - 0.5) * 0.2)
            };
          }
        }
        
        bot.lastDirectionChange = Date.now();
      } else {
        // Keep current direction with very small adjustments
        targetDirection = bot.direction;
      }
    }
    
    bot.direction = targetDirection;
    
    // Move bot
    const oldX = bot.x;
    const oldY = bot.y;
    
    bot.x += bot.direction.x * bot.speed;
    bot.y += bot.direction.y * bot.speed;
    
    // Keep bot in circular bounds
    const centerX = gameState.arenaSize / 2;
    const centerY = gameState.arenaSize / 2;
    const distanceFromCenter = Math.sqrt(
      Math.pow(bot.x - centerX, 2) + Math.pow(bot.y - centerY, 2)
    );
    
    if (distanceFromCenter > gameState.arenaRadius - 15) {
      const angle = Math.atan2(bot.y - centerY, bot.x - centerX);
      bot.x = centerX + Math.cos(angle) * (gameState.arenaRadius - 15);
      bot.y = centerY + Math.sin(angle) * (gameState.arenaRadius - 15);
      
      // Redirect towards center
      bot.direction = {
        x: (centerX - bot.x) / distanceFromCenter,
        y: (centerY - bot.y) / distanceFromCenter
      };
      bot.lastDirectionChange = Date.now();
    }
    
    // Territory logic for bots
    if (bot.x !== oldX || bot.y !== oldY) {
      const wasInTerritory = bot.inOwnTerritory;
      bot.inOwnTerritory = isInOwnTerritory(bot.x, bot.y, bot.territory);
      
      // If leaving territory, start trail
      if (wasInTerritory && !bot.inOwnTerritory) {
        bot.trail = [{ x: oldX, y: oldY }];
      }
      
      // If in trail mode, add to trail
      if (!bot.inOwnTerritory) {
        const lastTrailPoint = bot.trail[bot.trail.length - 1];
        if (!lastTrailPoint || 
            Math.sqrt(Math.pow(bot.x - lastTrailPoint.x, 2) + Math.pow(bot.y - lastTrailPoint.y, 2)) > 5) {
          bot.trail.push({ x: bot.x, y: bot.y });
        }
        
        // Return to territory after a while or if trail gets too long
        if (bot.trail.length > 25 + Math.random() * 20) {
          // Find closest territory point
          let closestPoint = bot.territory[0];
          let minDist = Infinity;
          
          bot.territory.forEach(point => {
            const dist = Math.sqrt(Math.pow(bot.x - point.x, 2) + Math.pow(bot.y - point.y, 2));
            if (dist < minDist) {
              minDist = dist;
              closestPoint = point;
            }
          });
          
          // Head towards territory
          if (minDist > 0) {
            bot.direction.x = (closestPoint.x - bot.x) / minDist;
            bot.direction.y = (closestPoint.y - bot.y) / minDist;
            bot.lastDirectionChange = Date.now();
          }
        }
      }
      
      // If returning to territory, complete the loop
      if (!wasInTerritory && bot.inOwnTerritory && bot.trail.length > 3) {
        completeBotTerritory(bot);
      }
    }
  });
}

function findNearestPlayerTrail(bot) {
  let nearestPoint = null;
  let minDistance = Infinity;
  
  // Check human player trail
  if (gameState.player && gameState.player.trail && gameState.player.trail.length > 0) {
    gameState.player.trail.forEach(point => {
      const distance = Math.sqrt(Math.pow(bot.x - point.x, 2) + Math.pow(bot.y - point.y, 2));
      if (distance < minDistance && distance < 200) {
        minDistance = distance;
        nearestPoint = point;
      }
    });
  }
  
  // Check other players' trails
  gameState.players.forEach(player => {
    if (player.trail && player.trail.length > 0) {
      player.trail.forEach(point => {
        const distance = Math.sqrt(Math.pow(bot.x - point.x, 2) + Math.pow(bot.y - point.y, 2));
        if (distance < minDistance && distance < 200) {
          minDistance = distance;
          nearestPoint = point;
        }
      });
    }
  });
  
  return nearestPoint;
}

function isStuck(bot) {
  // Check if bot hasn't moved much in the last few updates
  if (!bot.lastPositions) {
    bot.lastPositions = [];
  }
  
  bot.lastPositions.push({ x: bot.x, y: bot.y, time: Date.now() });
  
  // Keep only last 10 positions
  if (bot.lastPositions.length > 10) {
    bot.lastPositions.shift();
  }
  
  if (bot.lastPositions.length < 10) return false;
  
  // Check if bot has moved less than 50 pixels in the last 10 updates
  const firstPos = bot.lastPositions[0];
  const lastPos = bot.lastPositions[bot.lastPositions.length - 1];
  const distance = Math.sqrt(Math.pow(lastPos.x - firstPos.x, 2) + Math.pow(lastPos.y - firstPos.y, 2));
  
  return distance < 50;
}

function wouldGoOutOfBounds(bot, direction) {
  const futureX = bot.x + direction.x * bot.speed * 10;
  const futureY = bot.y + direction.y * bot.speed * 10;
  
  const centerX = gameState.arenaSize / 2;
  const centerY = gameState.arenaSize / 2;
  const distanceFromCenter = Math.sqrt(
    Math.pow(futureX - centerX, 2) + Math.pow(futureY - centerY, 2)
  );
  
  return distanceFromCenter > gameState.arenaRadius - 100;
}

function wouldHitOwnTrail(bot, direction) {
  if (!bot.trail || bot.trail.length < 5) return false;
  
  // Check if the projected movement would hit the bot's own trail
  const steps = 5;
  for (let step = 1; step <= steps; step++) {
    const futureX = bot.x + direction.x * bot.speed * step;
    const futureY = bot.y + direction.y * bot.speed * step;
    
    // Check against trail points (except recent ones)
    for (let i = 0; i < bot.trail.length - 3; i++) {
      const trailPoint = bot.trail[i];
      const distance = Math.sqrt(
        Math.pow(futureX - trailPoint.x, 2) + Math.pow(futureY - trailPoint.y, 2)
      );
      if (distance < bot.size + 5) {
        return true;
      }
    }
  }
  
  return false;
}

function checkBotCollisions(bot) {
  // Only check collisions when bot is outside its own territory
  if (!bot.inOwnTerritory) {
    // Check collision with own trail
    if (bot.trail.length > 10) {
      for (let i = 0; i < bot.trail.length - 5; i++) {
        const trailPoint = bot.trail[i];
        const distance = Math.sqrt(
          Math.pow(bot.x - trailPoint.x, 2) + Math.pow(bot.y - trailPoint.y, 2)
        );
        if (distance < bot.size + 2) {
          killBot(bot);
          return;
        }
      }
    }
    
    // Check collision with human player trail
    if (gameState.player && gameState.player.trail && gameState.player.trail.length > 0) {
      gameState.player.trail.forEach(trailPoint => {
        const distance = Math.sqrt(
          Math.pow(bot.x - trailPoint.x, 2) + Math.pow(bot.y - trailPoint.y, 2)
        );
        if (distance < bot.size + 2) {
          killBot(bot);
        }
      });
    }
    
    // Check collision with other players' trails
    gameState.players.forEach(player => {
      if (player.trail && player.trail.length > 0) {
        player.trail.forEach(trailPoint => {
          const distance = Math.sqrt(
            Math.pow(bot.x - trailPoint.x, 2) + Math.pow(bot.y - trailPoint.y, 2)
          );
          if (distance < bot.size + 2) {
            killBot(bot);
          }
        });
      }
    });
    
    // Check collision with other bots' trails - bots can kill each other
    gameState.bots.forEach(otherBot => {
      if (otherBot.id !== bot.id && otherBot.alive && otherBot.trail && otherBot.trail.length > 0) {
        otherBot.trail.forEach(trailPoint => {
          const distance = Math.sqrt(
            Math.pow(bot.x - trailPoint.x, 2) + Math.pow(bot.y - trailPoint.y, 2)
          );
          if (distance < bot.size + 2) {
            killBot(bot);
          }
        });
      }
    });
    
    // Check direct collision with other bots (when both outside territory)
    gameState.bots.forEach(otherBot => {
      if (otherBot.id !== bot.id && otherBot.alive && !otherBot.inOwnTerritory) {
        const distance = Math.sqrt(
          Math.pow(bot.x - otherBot.x, 2) + Math.pow(bot.y - otherBot.y, 2)
        );
        if (distance < bot.size + otherBot.size) {
          // Both bots die on direct collision
          killBot(bot);
          killBot(otherBot);
        }
      }
    });
  }
}

function killBot(bot) {
  bot.alive = false;
  bot.trail = [];
  bot.territory = [];
  bot.score = 0;
  // Remove color assignment so it can be reused
  assignedColors.delete(bot.id);
}

function completeBotTerritory(bot) {
  if (bot.trail.length < 3 || bot.territory.length === 0) return;
  
  try {
    // Store original territory
    const originalTerritory = [...bot.territory];
    const originalArea = calculateTerritoryArea(originalTerritory);
    
    // Create proper territory expansion
    const allPoints = [...originalTerritory, ...bot.trail];
    
    // Remove duplicates
    const cleanPoints = [];
    allPoints.forEach(point => {
      let isDuplicate = false;
      cleanPoints.forEach(existingPoint => {
        const dist = Math.sqrt(
          Math.pow(point.x - existingPoint.x, 2) + Math.pow(point.y - existingPoint.y, 2)
        );
        if (dist < 3) {
          isDuplicate = true;
        }
      });
      if (!isDuplicate) {
        cleanPoints.push(point);
      }
    });
    
    // Create new territory using convex hull
    let newTerritory = createConvexHull(cleanPoints);
    
    // Validate new territory
    const newArea = calculateTerritoryArea(newTerritory);
    const areaIncrease = newArea - originalArea;
    
    // Only accept reasonable expansions
    if (newTerritory.length >= 3 && areaIncrease > 0 && areaIncrease < 30000) {
      bot.territory = newTerritory;
      bot.score += Math.floor(areaIncrease * 0.3);
      console.log('Bot territory expanded successfully, area gained:', areaIncrease);
    } else {
      // Keep original territory if expansion is problematic
      bot.territory = originalTerritory;
      console.log('Bot territory expansion rejected, keeping original');
    }
    
    // Clear trail
    bot.trail = [];
    
  } catch (error) {
    // If territory completion fails, just clear trail and keep original territory
    bot.trail = [];
    bot.territory = [...bot.territory]; // Ensure we have a copy
    console.log('Bot territory completion failed, keeping original territory:', error);
  }
}

function createSmallTerritoryClaim(player) {
  if (!player.inOwnTerritory) return; // Can only make claims from within own territory
  
  // Create a small circular territory extension
  const claimRadius = 15;
  const numPoints = 8;
  const smallClaim = [];
  
  for (let i = 0; i < numPoints; i++) {
    const angle = (i / numPoints) * Math.PI * 2;
    smallClaim.push({
      x: player.x + Math.cos(angle) * claimRadius,
      y: player.y + Math.sin(angle) * claimRadius
    });
  }
  
  // Add small claim to existing territory
  const combinedTerritory = [...player.territory, ...smallClaim];
  player.territory = createConvexHull(combinedTerritory);
  
  // Add small score increase
  player.score += 50;
  
  console.log('Small territory claim made!');
}

function drawMinimap() {
  const ctx = gameState.ctx;
  const canvas = gameState.canvas;
  const player = gameState.player;
  
  if (!player) return;
  
  // Minimap settings
  const minimapSize = 150;
  const minimapX = canvas.width - minimapSize - 20;
  const minimapY = canvas.height - minimapSize - 20;
  const scale = minimapSize / (gameState.arenaRadius * 2);
  
  // Draw minimap background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(minimapX - 5, minimapY - 5, minimapSize + 10, minimapSize + 10);
  
  // Draw arena circle on minimap
  ctx.strokeStyle = '#ff6b6b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(minimapX + minimapSize/2, minimapY + minimapSize/2, minimapSize/2, 0, Math.PI * 2);
  ctx.stroke();
  
  // Draw all players on minimap
  gameState.players.forEach(p => {
    if (p.alive !== false) {
      const mapX = minimapX + (p.x - (gameState.arenaSize/2 - gameState.arenaRadius)) * scale;
      const mapY = minimapY + (p.y - (gameState.arenaSize/2 - gameState.arenaRadius)) * scale;
      
      ctx.fillStyle = p.color || '#ff6b6b';
      ctx.beginPath();
      ctx.arc(mapX, mapY, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  
  // Draw bots on minimap
  gameState.bots.forEach(bot => {
    if (bot.alive) {
      const mapX = minimapX + (bot.x - (gameState.arenaSize/2 - gameState.arenaRadius)) * scale;
      const mapY = minimapY + (bot.y - (gameState.arenaSize/2 - gameState.arenaRadius)) * scale;
      
      ctx.fillStyle = bot.color;
      ctx.beginPath();
      ctx.arc(mapX, mapY, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  
  // Draw local player on minimap
  if (player.alive) {
    const mapX = minimapX + (player.x - (gameState.arenaSize/2 - gameState.arenaRadius)) * scale;
    const mapY = minimapY + (player.y - (gameState.arenaSize/2 - gameState.arenaRadius)) * scale;
    
    ctx.fillStyle = player.color;
    ctx.beginPath();
    ctx.arc(mapX, mapY, 4, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw white border around local player
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  
  // Minimap label
  ctx.fillStyle = 'white';
  ctx.font = '12px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('MAP', minimapX + minimapSize/2, minimapY - 10);
}

