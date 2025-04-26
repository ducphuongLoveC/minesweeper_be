const axios = require('axios');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

require('dotenv').config()

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.get('/no-sleep', async (req, res) => {
    
    return res.status(200).json({
        success: true,
        message: 'OK',
        status: 200
    });
});

const rooms = new Map();
const difficultyLevels = {
    beginner: { x: 9, y: 9, mines: 10 },
    intermediate: { x: 16, y: 16, mines: 40 },
    expert: { x: 30, y: 16, mines: 99 },
};

// Hàm tạo mìn ngẫu nhiên
function generateMines(x, y, mineCount) {
    const totalCells = x * y;
    const mines = new Set();
    while (mines.size < mineCount) {
        const index = Math.floor(Math.random() * totalCells);
        mines.add(index);
    }
    return Array.from(mines);
}

io.on('connection', (socket) => {
    console.log('New connection:', socket.id);

    // Tạo phòng
    socket.on('createRoom', ({ difficulty, playerName }) => {
        const roomId = generateRoomId();
        const { x, y, mines } = difficultyLevels[difficulty];
        const totalCells = x * y;

        // Generate board for player 1
        const minesP1 = generateMines(x, y, mines);
        const boardP1 = Array.from({ length: totalCells }, (_, i) => ({
            count: calculateCellCount(i, minesP1, x, y), // Implement this function
            isMine: minesP1.includes(i),
            isOpen: false,
            isFlagged: false,
        }));

        const newRoom = {
            id: roomId,
            difficulty,
            players: [{
                id: socket.id,
                name: playerName,
                status: 'playing',
                board: {
                    mines: minesP1,
                    cells: boardP1,
                    opened: new Set(),
                    flagged: new Set(),
                }
            }],
            gameStarted: false
        };

        rooms.set(roomId, newRoom);
        socket.join(roomId);
        socket.emit('roomCreated', newRoom);
    });


    socket.on('requestBoardState', ({ roomId }) => {
        const room = rooms.get(roomId);
        if (!room) return socket.emit('error', 'Room not found');

        const player = room.players.find(p => p.id === socket.id);
        const opponent = room.players.find(p => p.id !== socket.id);
        if (!player) return;

        socket.emit('initBoard', {
            ownBoard: player.board.cells,
            opponentBoard: opponent ? opponent.board.cells.map(cell => ({
                ...cell,
                count: cell.isOpen ? cell.count : 0,
                isMine: false,
            })) : null,
        });
    });

    // In joinRoom
    socket.on('joinRoom', ({ roomId, playerName }) => {
        const room = rooms.get(roomId);
        if (!room) return socket.emit('error', 'Room not found');
        // if (room.players.length >= 2) return socket.emit('error', 'Room is full');

        const { x, y, mines } = difficultyLevels[room.difficulty];
        const totalCells = x * y;

        // Generate board for player 2
        const minesP2 = generateMines(x, y, mines);
        const boardP2 = Array.from({ length: totalCells }, (_, i) => ({
            count: calculateCellCount(i, minesP2, x, y),
            isMine: minesP2.includes(i),
            isOpen: false,
            isFlagged: false,
        }));

        room.players.push({
            id: socket.id,
            name: playerName,
            status: 'playing',
            board: {
                mines: minesP2,
                cells: boardP2,
                opened: new Set(),
                flagged: new Set(),
            }
        });
        room.gameStarted = true;

        socket.join(roomId);
        io.to(roomId).emit('roomJoined', room);

        // Send each player their own board and the opponent's visible state
        room.players.forEach(player => {
            io.to(player.id).emit('initBoard', {
                ownBoard: player.board.cells,
                opponentBoard: room.players.find(p => p.id !== player.id).board.cells.map(cell => ({
                    ...cell,
                    count: cell.isOpen ? cell.count : 0, // Hide counts for unopened cells
                    isMine: false, // Hide mines
                })),
            });
        });
    });

    // Helper function to calculate cell count
    function calculateCellCount(index, mines, x, y) {
        let count = 0;
        const col = index % x;
        const row = Math.floor(index / x);
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                const newRow = row + dy;
                const newCol = col + dx;
                if (newRow >= 0 && newRow < y && newCol >= 0 && newCol < x) {
                    const neighborIndex = newRow * x + newCol;
                    if (mines.includes(neighborIndex)) count++;
                }
            }
        }
        return count;
    }
    // Tham gia phòng
    socket.on('joinRoom', ({ roomId, playerName }) => {
        const room = rooms.get(roomId);
        if (!room) return socket.emit('error', 'Room not found');
        if (room.players.length == 2) return socket.emit('full', 'Đã vào phòng');

        const { x, y, mines } = difficultyLevels[room.difficulty];
        room.players.push({
            id: socket.id,
            name: playerName,
            status: 'playing',
            board: {
                mines: generateMines(x, y, mines), // Tạo mìn cho người chơi 2
                opened: new Set(),
                flagged: new Set(),
            }
        });
        room.gameStarted = true;

        socket.join(roomId);
        io.to(roomId).emit('roomJoined', room);
    });

    // Xử lý khi mở ô
    socket.on('openCell', ({ roomId, index }) => {
        const room = rooms.get(roomId);
        if (!room) return;

        const player = room.players.find(p => p.id === socket.id);
        if (!player || player.board.cells[index].isOpen || player.board.cells[index].isFlagged) return;

        const openedCells = new Set([index]);
        player.board.opened.add(index);
        player.board.cells[index].isOpen = true;

        // Perform flood-fill if count is 0
        if (player.board.cells[index].count === 0 && !player.board.cells[index].isMine) {
            const queue = [index];
            const { x, y } = difficultyLevels[room.difficulty];
            while (queue.length) {
                const currIdx = queue.shift();
                const col = currIdx % x;
                const row = Math.floor(currIdx / x);
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        if (dx === 0 && dy === 0) continue;
                        const newRow = row + dy;
                        const newCol = col + dx;
                        if (newRow >= 0 && newRow < y && newCol >= 0 && newCol < x) {
                            const nIdx = newRow * x + newCol;
                            if (!player.board.cells[nIdx].isOpen && !player.board.cells[nIdx].isFlagged) {
                                player.board.cells[nIdx].isOpen = true;
                                player.board.opened.add(nIdx);
                                openedCells.add(nIdx);
                                if (player.board.cells[nIdx].count === 0 && !player.board.cells[nIdx].isMine) {
                                    queue.push(nIdx);
                                }
                            }
                        }
                    }
                }
            }
        }

        // Emit opened cells to all clients
        const cellData = Array.from(openedCells).map(idx => ({
            index: idx,
            count: player.board.cells[idx].count,
            isMine: player.board.cells[idx].isMine,
        }));
        io.to(roomId).emit('cellOpened', { playerId: socket.id, cells: cellData });

        // Check for game over
        if (player.board.cells[index].isMine) {
            player.status = 'lost';
            const opponent = room.players.find(p => p.id !== socket.id);
            if (opponent) opponent.status = 'won';
            io.to(roomId).emit('endGame', {
                playerId: socket.id,
                type: 'lost',
                playerName: player.name
            });
            rooms.delete(roomId);
        }
    });
    // Xử lý khi cắm cờ
    socket.on('toggleFlag', ({ roomId, index }) => {
        const room = rooms.get(roomId);
        if (!room) return;

        const player = room.players.find(p => p.id === socket.id);
        if (!player) return;

        if (player.board.flagged.has(index)) {
            player.board.flagged.delete(index);
        } else {
            player.board.flagged.add(index);
        }
        socket.to(roomId).emit('flagToggled', { playerId: socket.id, index });
    });


    socket.on('gameOver', ({ roomId, type, playerId, playerName }) => {
        console.log(`Emitting endGame to room ${roomId}:`, { playerId, type, playerName });
        io.to(roomId).emit('endGame', { playerId, type, playerName });
    });

    socket.on('disconnect', () => {
        console.log('Disconnected:', socket.id);
        for (const [roomId, room] of rooms) {
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            if (playerIndex !== -1) {
                room.players.splice(playerIndex, 1);
                io.to(roomId).emit('playerLeft', socket.id);
                if (room.players.length === 0) {
                    rooms.delete(roomId);
                } else {
                    io.to(roomId).emit('roomJoined', room);
                }
                break;
            }
        }
    });
});

function generateRoomId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}



(async () => {
    let count_check = 0;
    const API_URL = process.env.URL;

    const check = async () => {
        try {
            const response = await axios.get(`${API_URL}/no-sleep`);
            count_check++;
            console.log(`check không cho ngủ lần thứ ${count_check}`, response.data);
        } catch (error) {
            console.error(`check không cho ngủ`, error.message);
        }

        // const delay = (4 + Math.random() * 2) * 1000; // 4 đến 6 giây
        const delay = (4 + Math.random() * 2) * 60 * 1000; 
        setTimeout(check, delay);
    };
    check();
})();

function keepServerAwake(minSeconds = 3, maxSeconds = 7) {
    const url = process.env.URL;
    console.log(url);
    
    const ping = async () => {
        try {

            await axios.get(`${url}/no-sleep`);
            console.log(`[KEEP-AWAKE] Pinged ${url}`);
        } catch (err) {
            console.error('[KEEP-AWAKE] Ping failed:', err.message);
        }

        const nextPingInMs = (Math.random() * (maxSeconds - minSeconds) + minSeconds) * 1000;
        setTimeout(ping, nextPingInMs);
    };

    ping();
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    // keepServerAwake();
});