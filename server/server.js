// ✅ PORT CONFIGURATION FIXED BY AI: Running on port 5000

// TODO: FIX JUDGE DECISION BUG
// PROBLEM: When judge selects card, sometimes wrong card wins
// FIX: Validate winningCardId exists in game state before proceeding

// TODO: IMPLEMENT BOT SYSTEM
// Add socket events: 'add_bot' and 'add_bots'
// Bots should: auto-play cards, auto-judge, appear as 🤖 players
// Only room host can add/remove bots

// TODO: ADD REJOIN FUNCTIONALITY
// Players should reconnect without reset after app switch
// Need 'rejoin_room' event and game state restoration

socket.on('judge_decision', ({ roomId, winningCardId, playerId }) => {
    console.log('🎯 JUDGE DECISION RECEIVED - DEBUG INFO:');
    console.log('Room:', roomId);
    console.log('Selected Card ID:', winningCardId);
    console.log('Winning Player ID:', playerId);
    
    const room = rooms.get(roomId);
    if (!room) {
        console.error('❌ Room not found for judge decision');
        return;
    }
    
    // TODO: AI - ADD VALIDATION HERE
    // Check if winningCardId actually exists in current round submissions
    // This prevents the "random card wins" bug
    
    // TEMPORARY LOGGING FOR DEBUG
    if (room.currentGame) {
        console.log('Current game submissions:', room.currentGame.submittedCards);
    }
    
    // TODO: AI - Fix this to ensure correct card is announced as winner
    io.to(roomId).emit('winner_selected', {
        winningCardId: winningCardId,
        winningPlayerId: playerId,
        roomId: roomId
    });
});

// TODO: AI - IMPLEMENT BOT ADDITION LOGIC HERE
socket.on('add_bot', ({ roomId }) => {
    console.log('🤖 ADD BOT REQUEST for room:', roomId);
    // TODO: AI - Implement bot creation logic
    // Bot should have: isBot: true, auto-ready, 🤖 name
});

socket.on('add_bots', ({ roomId, count }) => {
    console.log(`🤖 ADD ${count} BOTS REQUEST for room:`, roomId);
    // TODO: AI - Implement multiple bot creation
});

// TODO: AI - IMPLEMENT REJOIN LOGIC
socket.on('rejoin_room', ({ roomId }) => {
    console.log('🔄 REJOIN REQUEST for room:', roomId);
    // TODO: AI - Restore player's game state without resetting
});
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files (your index.html)
app.use(express.static('../public'));

// Basic Socket.io setup
const rooms = new Map();
const players = new Map();

io.on('connection', (socket) => {
  console.log('🟢 New player connected:', socket.id);
  
  // Store player info
  socket.on('player_info', (data) => {
    players.set(socket.id, data);
    console.log(`👤 Player ${data.username} (${socket.id}) connected`);
  });
  
  // Create room
  socket.on('create_room', (data) => {
    const roomCode = Math.random().toString(36).substr(2, 6).toUpperCase();
    const room = {
      id: roomCode,
      name: data.name || 'Game Room',
      host: socket.id,
      players: [socket.id],
      gameState: 'lobby'
    };
    
    rooms.set(roomCode, room);
    socket.join(roomCode);
    
    socket.emit('room_created', {
      code: roomCode,
      success: true,
      room: room
    });
    
    console.log(`🏠 Room created: ${roomCode} by ${players.get(socket.id)?.username}`);
  });
  
  // Join room
  socket.on('join_room', (data) => {
    const roomCode = data.code.toUpperCase();
    const room = rooms.get(roomCode);
    
    if (!room) {
      socket.emit('room_error', { message: 'Room not found' });
      return;
    }
    
    if (room.players.length >= 8) {
      socket.emit('room_error', { message: 'Room is full' });
      return;
    }
    
    // ✅ FIX: Check if THIS socket.id is already in room
    if (!room.players.includes(socket.id)) {
      room.players.push(socket.id);
      socket.join(roomCode);
      
      // Tell everyone in the room
      io.to(roomCode).emit('room_update', {
        type: 'player_joined',
        room: room,
        player: players.get(socket.id),
        allPlayers: room.players.map(id => players.get(id))
      });
      
      console.log(`👥 ${players.get(socket.id)?.username} joined ${roomCode}`);
    }
  });
  
  // Leave room
  socket.on('leave_room', (data) => {
    const room = rooms.get(data.roomCode);
    if (room) {
      // ✅ FIX: Only remove THIS socket's ID
      const index = room.players.indexOf(socket.id);
      if (index > -1) {
        room.players.splice(index, 1);
      }
      
      // Remove room if empty
      if (room.players.length === 0) {
        rooms.delete(data.roomCode);
      }
      
      socket.leave(data.roomCode);
      io.to(data.roomCode).emit('room_update', {
        type: 'player_left',
        playerId: socket.id
      });
    }
  });
  // Start game - ADD THIS NEW HANDLER
socket.on('start_game', (data) => {
  const roomCode = data.roomCode;
  const room = rooms.get(roomCode);
  
  if (!room) {
    socket.emit('game_error', { message: 'Room not found' });
    return;
  }
  
  // Only host can start game
  if (room.host !== socket.id) {
    socket.emit('game_error', { message: 'Only host can start game' });
    return;
  }
  
  // Need at least 2 players (or 1 human + bots)
  if (room.players.length < 2) {
    socket.emit('game_error', { message: 'Need at least 2 players to start' });
    return;
  }
  
  // Change game state
  room.gameState = 'playing';
  room.currentRound = 1;
  room.judgeIndex = 0;
  
  // Notify all players
  io.to(roomCode).emit('game_started', {
    room: room,
    message: 'Game is starting!',
    round: 1
  });
  
  console.log(`🎮 Game started in room ${roomCode} by ${players.get(socket.id)?.username}`);
});
  // Chat message
  socket.on('room_chat', (data) => {
    const player = players.get(socket.id);
    io.to(data.roomCode).emit('chat_message', {
      player: player?.username || 'Anonymous',
      message: data.message,
      timestamp: new Date().toISOString()
    });
  });
  
  // Disconnect
  socket.on('disconnect', () => {
    const player = players.get(socket.id);
    console.log(`🔴 Player disconnected: ${player?.username || socket.id}`);
    
    // Remove from all rooms
    rooms.forEach((room, roomCode) => {
      if (room.players.includes(socket.id)) {
        room.players = room.players.filter(id => id !== socket.id);
        
        if (room.players.length === 0) {
          rooms.delete(roomCode);
        } else {
          io.to(roomCode).emit('room_update', {
            type: 'player_left',
            playerId: socket.id
          });
        }
      }
    });
    
    players.delete(socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🎮 Cards Game Server running at:`);
  console.log(`   Local:  http://localhost:${PORT}`);
  console.log(`   Network: http://YOUR-IP:${PORT} (for testing on phone)`);
});    socket.emit('room_error', { message: 'Room is full' });
    return;
  }
  
  // ✅ FIX: Check if THIS socket.id is already in room
  if (!room.players.includes(socket.id)) {
    room.players.push(socket.id);
    socket.join(roomCode);
    
    // Tell everyone in the room
    io.to(roomCode).emit('room_update', {
      type: 'player_joined',
      room: room,
      player: players.get(socket.id),
      allPlayers: room.players.map(id => players.get(id))
    });
    
    console.log(`👥 ${players.get(socket.id)?.username} joined ${roomCode}`);
  }
});
      // Remove room if empty
      if (room.players.length === 0) {
        rooms.delete(data.roomCode);
      }
      
      socket.leave(data.roomCode);
      io.to(data.roomCode).emit('room_update', {
        type: 'player_left',
        playerId: socket.id
      });
    }
  });
  
  // Chat message
  socket.on('room_chat', (data) => {
    const player = players.get(socket.id);
    io.to(data.roomCode).emit('chat_message', {
      player: player?.username || 'Anonymous',
      message: data.message,
      timestamp: new Date().toISOString()
    });
  });
  
  // Disconnect
  socket.on('disconnect', () => {
    const player = players.get(socket.id);
    console.log(`🔴 Player disconnected: ${player?.username || socket.id}`);
    
    // Remove from all rooms
    rooms.forEach((room, roomCode) => {
      if (room.players.includes(socket.id)) {
        room.players = room.players.filter(id => id !== socket.id);
        
        if (room.players.length === 0) {
          rooms.delete(roomCode);
        } else {
          io.to(roomCode).emit('room_update', {
            type: 'player_left',
            playerId: socket.id
          });
        }
      }
    });
    // Add these headers to prevent caching
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
});
    players.delete(socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🎮 Cards Game Server running at:`);
  console.log(`   Local:  http://localhost:${PORT}`);
  console.log(`   Network: http://YOUR-IP:${PORT} (for testing on phone)`);
});
