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
  });
  
  // Leave room
  socket.on('leave_room', (data) => {
    const room = rooms.get(data.roomCode);
    if (room) {
      room.players = room.players.filter(id => id !== socket.id);
      
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
    
    players.delete(socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🎮 Cards Game Server running at:`);
  console.log(`   Local:  http://localhost:${PORT}`);
  console.log(`   Network: http://YOUR-IP:${PORT} (for testing on phone)`);
});
