const Minesweeper = require('../core/Minesweeper.js');

const rooms = new Map();

function pvp(io, socket) {
    // Utility function
    const toArray = Array.from;

    // Helper functions
    const getPlayerStatus = (room, playerId) => room.playersStatus.find(entry => entry[playerId])?.[playerId];

    const createGameState = (rows = 9, cols = 9, mines = null) => new Minesweeper(rows, cols, mines);

    const initializePlayerState = () => ({
        revealedCells: new Set(),
        flags: new Set()
    });

    const emitInitialGameState = (roomId) => {
        const room = rooms.get(roomId);
        if (!room) return;

        const gameStates = {};

        for (const id in room.games) {
            gameStates[id] = room.games[id].getState();
        }

        io.to(roomId).emit('setGames', { gameStates, playersStatus: room.playersStatus });
    };

    const deletePlayer = (roomId, playerId) => {
        const room = rooms.get(roomId);
        if (!room || !room.players.includes(playerId)) return;

        room.players = room.players.filter(id => id !== playerId);
        delete room.games[playerId];
        delete room.playerStates[playerId];
        room.playersStatus = room.playersStatus.filter(entry => !entry[playerId]);

        // Handle single remaining player
        if (room.players.length === 1) {
            const [remainingPlayerId] = room.players;
            const status = getPlayerStatus(room, remainingPlayerId);
            if (status) {
                status.isHost = true;
                status.isReady = true;
            }

            const { rows, cols, mines } = room.saveConfig;
            room.games[remainingPlayerId] = createGameState(rows, cols, mines);
            room.games[remainingPlayerId].start();
            room.playerStates[remainingPlayerId] = initializePlayerState();
        }

        // Prepare emit data
        const emitData = { playerId, playersStatus: room.playersStatus };
        if (room.players.length === 1) {
            const [remainingId] = room.players;
            emitData.gameState = room.games[remainingId].getState();
            emitData.playerState = { revealedCells: [], flags: [] };
        }

        socket.to(roomId).emit('playerLeft', emitData);
        socket.emit('returnToLobby', { message: 'Bạn đã rời khỏi phòng', roomId });

        if (!room.players.length) {
            rooms.delete(roomId);
            console.log(`Phòng ${roomId} đã được xóa`);
        }

        emitRoomList();
    };

    const emitRoomList = () => {
        const roomList = toArray(rooms).map(([roomId, room]) => {
            const firstPlayerStatus = getPlayerStatus(room, room.players[0]);
            return {
                id: roomId,
                name: firstPlayerStatus?.playerName
                    ? `Phòng của ${firstPlayerStatus.playerName}`
                    : `Phòng ${roomId}`,
                currentPlayers: room.players.length,
                maxPlayers: room.maxPlayers
            };
        });
        io.emit('roomList', roomList);
    };

    const handleGameAction = (roomId, actionType, index, actionHandler) => {
        const room = rooms.get(roomId);
        if (!room || !room.players.includes(socket.id)) return;

        const game = room.games[socket.id];
        const playerState = room.playerStates[socket.id];
        const result = actionHandler(game, playerState, index);
        if (!result) return;

        const updateData = {
            playerId: socket.id,
            action: {
                type: actionType,
                index,
                result,
                changes: { revealedCells: result.openedIndices || [] }
            }
        };

        if (result.isMine || result.isWin) {
            const status = getPlayerStatus(room, socket.id);
            if (status) {
                status.isCompleted = true;
                status.status = result.isMine ? 'lost' : 'won';
            }
            updateData.playersStatus = room.playersStatus;
        }

        io.to(roomId).emit('updateState', updateData);
    };

    // Event handlers
    socket.on('emitRoomList', emitRoomList);

    socket.on('joinRoom', (roomId, playerName, configMode, maxPlayers) => {
        if (!roomId || typeof roomId !== 'string' || !roomId.trim()) {
            socket.emit('error', { message: 'Invalid room ID' });
            return;
        }

        let room = rooms.get(roomId);
        if (!room) {
            room = {
                players: [],
                games: {},
                playerStates: {},
                playersStatus: [],
                saveConfig: configMode || {},
                maxPlayers: maxPlayers || 2
            };
            rooms.set(roomId, room);
            socket.emit('roomCreated', { roomId });
        }

        if (room.players.length >= room.maxPlayers) {
            socket.emit('roomFull', { message: 'Room is full' });
            return;
        }

        const { rows, cols, mines } = room.saveConfig;
        room.players.push(socket.id);
        room.games[socket.id] = createGameState(rows, cols, mines);
        room.games[socket.id].start();
        room.playerStates[socket.id] = initializePlayerState();

        const isHost = room.players.length === 1;
        room.playersStatus.push({
            [socket.id]: {
                playerName: playerName || `Player ${room.players.length}`,
                isReady: isHost,
                isHost,
                isCompleted: false,
                status: 'playing'
            }
        });

        socket.join(roomId);
        socket.emit('joinedRoom', { roomId, playerId: socket.id });
        emitInitialGameState(roomId);
        emitRoomList();
    });

    socket.on('toggleReadyGame', (roomId) => {
        const room = rooms.get(roomId);
        if (!room || !room.players.includes(socket.id)) return;

        const status = getPlayerStatus(room, socket.id);
        if (status && !status.isHost) {
            status.isReady = !status.isReady;
            io.to(roomId).emit('playerStatusUpdate', { playerId: socket.id, isReady: status.isReady });
        }
    });

    socket.on('startGame', (roomId) => {
        const room = rooms.get(roomId);
        if (!room || !room.players.includes(socket.id)) return;

        const status = getPlayerStatus(room, socket.id);
        if (!status?.isHost) {
            socket.emit('error', { message: 'Chỉ host mới có thể bắt đầu game!' });
            return;
        }

        if (room.playersStatus.every(pl => Object.values(pl)[0].isReady)) {
            io.to(roomId).emit('gameStarted', { message: 'Game bắt đầu!' });
        } else {
            socket.emit('playerNotReady', { message: 'Người chơi chưa sẵn sàng!' });
        }
    });

    socket.on('replayGame', (roomId) => {
        if (rooms.has(roomId)) {
            socket.to(roomId).emit('replayRequested', { message: 'Chơi thêm ván nữa nhé!' });
        }
    });

    socket.on('confirmReplay', ({ roomId }) => {
        const room = rooms.get(roomId);
        if (!room || !room.players.includes(socket.id)) return;

        const { rows, cols, mines } = room.saveConfig;
        room.players.forEach(id => {
            room.games[id] = createGameState(rows, cols, mines);
            room.games[id].start();
            room.playerStates[id] = initializePlayerState();
            const status = getPlayerStatus(room, id);
            if (status) {
                status.isCompleted = false;
                status.status = 'playing';
            }
        });

        emitInitialGameState(roomId);
    });

    socket.on('declineReplay', ({ roomId }) => {
        socket.to(roomId).emit('replayDeclined', { message: 'Người chơi đã từ chối chơi lại.' });
    });

    socket.on('chording', ({ roomId, index }) => {
        handleGameAction(roomId, 'chord', index, (game, state, idx) => {
            const result = game.chording(idx, toArray(state.flags));
            if (result.success) {
                result.openedIndices.forEach(i => state.revealedCells.add(i));
            }
            return result;
        });
    });

    socket.on('openCell', ({ roomId, index }) => {
        handleGameAction(roomId, 'open', index, (game, state, idx) => {
            if (state.flags.has(idx)) return null;
            const result = game.openCell(idx);
            if (result) {
                state.revealedCells.add(idx);
                if (result.openedIndices) {
                    result.openedIndices.forEach(i => state.revealedCells.add(i));
                }
            }
            return result;
        });
    });

    socket.on('toggleFlag', ({ roomId, index }) => {
        const room = rooms.get(roomId);
        if (!room || !room.players.includes(socket.id) || room.playerStates[socket.id].revealedCells.has(index)) return;

        const playerState = room.playerStates[socket.id];
        const hadFlag = playerState.flags.has(index);
        hadFlag ? playerState.flags.delete(index) : playerState.flags.add(index);

        io.to(roomId).emit('flagToggled', { playerId: socket.id, index, hasFlag: !hadFlag });
    });

    socket.on('leaveRoom', (roomId) => deletePlayer(roomId, socket.id));

    socket.on('disconnect', () => {
        rooms.forEach((_, roomId) => {
            if (rooms.get(roomId).players.includes(socket.id)) {
                deletePlayer(roomId, socket.id);
            }
        });
    });
}

module.exports = pvp;