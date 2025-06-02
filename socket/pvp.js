// const Minesweeper = require('../core/Minesweeper.js');

// const rooms = new Map();

// function pvp(io, socket) {

//     // Utility functions
//     const toArray = Array.from;

//     // Helper functions
//     function getPlayerStatus(room, playerId) {
//         return room.playersStatus.find(entry => entry[playerId])?.[playerId];
//     }

//     function createGameState(rows = 9, cols = 9, mines = null) {
//         return new Minesweeper(rows, cols, mines);
//     }

//     function initializePlayerState() {
//         return {
//             revealedCells: new Set(),
//             flags: new Set()
//         };
//     }

//     function prepareEmitData(room) {
//         const gameStates = {};
//         const playerStates = {};

//         for (const id in room.games) {
//             gameStates[id] = room.games[id].getState();
//             playerStates[id] = {
//                 revealedCells: toArray(room.playerStates[id].revealedCells),
//                 flags: toArray(room.playerStates[id].flags)
//             };
//         }

//         return { gameStates, playerStates };
//     }

//     function emitGameState(roomId, additionalData = {}) {
//         const room = rooms.get(roomId);
//         if (!room) return;

//         const { gameStates, playerStates } = prepareEmitData(room);

//         io.to(roomId).emit('setGames', {
//             gameStates,
//             playerStates,
//             playersStatus: room.playersStatus,
//             ...additionalData
//         });
//     }

//     function DeletePlayer(roomId, playerId) {
//         const room = rooms.get(roomId);
//         if (!room || !room.players.includes(playerId)) return;

//         const playerIndex = room.players.indexOf(playerId);
//         if (playerIndex === -1) return;

//         room.players.splice(playerIndex, 1);
//         delete room.games[playerId];
//         delete room.playerStates[playerId];
//         room.playersStatus = room.playersStatus.filter(entry => !entry[playerId]);

//         // Handle single remaining player
//         if (room.players.length === 1) {
//             const remainingPlayerId = room.players[0];
//             const remainingPlayerStatus = getPlayerStatus(room, remainingPlayerId);

//             if (remainingPlayerStatus) {
//                 remainingPlayerStatus.isHost = true;
//                 remainingPlayerStatus.isReady = true;
//             }

//             const { rows, cols, mines } = room.saveConfig;
//             room.games[remainingPlayerId] = createGameState(rows, cols, mines);
//             room.games[remainingPlayerId].start();
//             room.playerStates[remainingPlayerId] = initializePlayerState();
//         }

//         // Prepare emit data
//         const emitData = {
//             playerId,
//             message: 'Người chơi đã rời khỏi phòng',
//             playersStatus: room.playersStatus
//         };

//         if (room.players.length === 1) {
//             const remainingId = room.players[0];
//             emitData.gameStates = { [remainingId]: room.games[remainingId].getState() };
//             emitData.playerStates = { [remainingId]: { revealedCells: [], flags: [] } };
//         }

//         socket.to(roomId).emit('playerLeft', emitData);
//         socket.emit('returnToLobby', { message: 'Bạn đã rời khỏi phòng', roomId });

//         if (room.players.length === 0) {
//             rooms.delete(roomId);
//             console.log(`Phòng ${roomId} đã được xóa`);
//         }

//         emitRoomList();
//     }

//     function emitRoomList() {
//         const roomList = toArray(rooms).map(([roomId, room]) => {

//             const firstPlayer = room.players[0];
//             const firstPlayerStatus = getPlayerStatus(room, firstPlayer);

//             return {
//                 id: roomId,
//                 name: firstPlayerStatus?.playerName
//                     ? `Phòng của ${firstPlayerStatus.playerName}`
//                     : `Phòng ${roomId}`,
//                 currentPlayers: room.players.length,
//                 maxPlayers: room.maxPlayers
//             };
//         });

//         io.emit('roomList', roomList);
//     }
//     function handleGameAction(roomId, actionType, index, actionHandler) {

//         const room = rooms.get(roomId);
//         if (!room || !room.players.includes(socket.id)) return;


//         const currentGamePlayer = room.games[socket.id];
//         const playerState = room.playerStates[socket.id];

//         const result = actionHandler(currentGamePlayer, playerState, index);
//         if (!result) return;

//         if (result.isMine || result.isWin) {
//             room.playersStatus[socket.id] = {
//                 ...room.playersStatus[socket.id],
//                 isCompleted: true
//             }
//             // handleGameOver(roomId, result, currentGamePlayer, playerState);
//         }

//         const { playerStates } = prepareEmitData(room);
//         const updateData = {
//             playerId: socket.id,
//             playerStates,
//             action: { type: actionType, index, result, playerId: socket.id }
//         };

//         io.to(roomId).emit('updateState', updateData);
//     }

//     // Event handlers
//     socket.on('emitRoomList', emitRoomList);

//     socket.on('joinRoom', (roomId, playerName, configMode, maxPlayers) => {
//         console.log(configMode);

//         if (!roomId || typeof roomId !== 'string' || roomId.trim() === '') {
//             socket.emit('error', { message: 'Invalid room ID' });
//             return;
//         }

//         let room = rooms.get(roomId);
//         if (!room) {
//             room = {
//                 players: [],
//                 games: {},
//                 playerStates: {},
//                 playersStatus: [],
//                 saveConfig: {},
//                 maxPlayers: maxPlayers
//             };
//             rooms.set(roomId, room);
//             socket.emit('roomCreated', { roomId });
//         }

//         console.log(room);


//         if (room.players.length >= room.maxPlayers) {
//             socket.emit('roomFull', { message: 'Room is full' });
//             return;
//         }

//         if (configMode) {
//             room.saveConfig = configMode;
//         }
//         const { rows, cols, mines } = room.saveConfig;

//         room.players.push(socket.id);
//         room.games[socket.id] = createGameState(rows, cols, mines);
//         room.games[socket.id].start();
//         room.playerStates[socket.id] = initializePlayerState();

//         const isHost = room.players.length === 1;
//         room.playersStatus.push({
//             [socket.id]: {
//                 playerName: playerName || `Player ${room.players.length}`,
//                 isReady: isHost,
//                 isHost,
//                 isCompleted: false
//             }
//         });

//         socket.join(roomId);
//         socket.emit('joinedRoom', { roomId, playerId: socket.id });

//         emitGameState(roomId);
//         emitRoomList();
//     });

//     socket.on('toggleReadyGame', (roomId) => {
//         const room = rooms.get(roomId);
//         if (!room || !room.players.includes(socket.id)) return;

//         const playerStatus = getPlayerStatus(room, socket.id);
//         if (playerStatus && !playerStatus.isHost) {
//             playerStatus.isReady = !playerStatus.isReady;
//             emitGameState(roomId);
//         }
//     });

//     socket.on('startGame', (roomId) => {
//         const room = rooms.get(roomId);
//         if (!room || !room.players.includes(socket.id)) return;

//         const playerStatus = getPlayerStatus(room, socket.id);
//         if (!playerStatus?.isHost) {
//             socket.emit('error', { message: 'Chỉ host mới có thể bắt đầu game!' });
//             return;
//         }

//         const canStart = room.playersStatus.every(pl => {
//             const player = Object.values(pl)[0];
//             return player.isReady;
//         });

//         if (canStart) {
//             io.to(roomId).emit('canStartGame', { canStart: true, message: 'Game bắt đầu!' });
//         } else {
//             socket.emit('playerNotReady', { message: 'Người chơi chưa sẵn sàng!' });
//         }
//     });

//     socket.on('replayGame', (roomId) => {
//         if (rooms.has(roomId)) {
//             socket.to(roomId).emit('sendReplayGame', { message: 'Chơi thêm ván nữa nhé!' });
//         }
//     });

//     socket.on('confirmReplay', ({ roomId }) => {
//         const room = rooms.get(roomId);
//         if (!room || !room.players.includes(socket.id)) return;

//         const { players, games, playerStates, saveConfig } = room;
//         const { rows, cols, mines } = saveConfig;

//         players.forEach((id) => {
//             games[id] = createGameState(rows, cols, mines);
//             games[id].start();
//             playerStates[id] = initializePlayerState();
//         });

//         emitGameState(roomId, {
//             message: 'Chơi thêm ván nữa nhé!'
//         });
//     });

//     socket.on('declineReplay', ({ roomId }) => {
//         socket.to(roomId).emit('replayDeclined', { message: 'Người chơi đã từ chối chơi lại.' });
//     });

//     socket.on('chording', ({ roomId, index }) => {
//         handleGameAction(roomId, 'chord', index, (game, state, idx) => {
//             const flags = toArray(state.flags);
//             const result = game.chording(idx, flags);

//             if (result.success) {
//                 result.openedIndices.forEach(i => state.revealedCells.add(i));
//             }

//             return result;
//         });
//     });

//     socket.on('openCell', ({ roomId, index }) => {

//         handleGameAction(roomId, 'open', index, (game, state, idx) => {

//             if (state.flags.has(idx)) return null;

//             const result = game.openCell(idx);

//             if (!result) return null;

//             state.revealedCells.add(idx);
//             if (result.openedIndices?.length > 0) {
//                 result.openedIndices.forEach(i => state.revealedCells.add(i));
//             }
//             console.log("result", result);


//             return result;
//         });
//     });

//     socket.on('toggleFlag', ({ roomId, index }) => {
//         const room = rooms.get(roomId);
//         if (!room || !room.players.includes(socket.id)) return;

//         const playerState = room.playerStates[socket.id];
//         if (playerState.revealedCells.has(index)) return;

//         if (playerState.flags.has(index)) {
//             playerState.flags.delete(index);
//         } else {
//             playerState.flags.add(index);
//         }

//         const updateData = {
//             playerId: socket.id,
//             ...prepareEmitData(room),
//             action: { type: 'flag', index, playerId: socket.id }
//         };

//         io.to(roomId).emit('updateState', updateData);
//     });

//     socket.on('leaveRoom', (roomId) => {
//         DeletePlayer(roomId, socket.id);
//     });

//     socket.on('disconnect', () => {
//         rooms.forEach((room, roomId) => {
//             if (room.players.includes(socket.id)) {
//                 DeletePlayer(roomId, socket.id);
//             }
//         });
//     });
// }

// module.exports = pvp;


const Minesweeper = require('../core/Minesweeper.js');

const rooms = new Map();

function pvp(io, socket) {
    // Utility functions
    const toArray = Array.from;

    // Helper functions
    function getPlayerStatus(room, playerId) {
        return room.playersStatus.find(entry => entry[playerId])?.[playerId];
    }

    function createGameState(rows = 9, cols = 9, mines = null) {
        return new Minesweeper(rows, cols, mines);
    }

    function initializePlayerState() {
        return {
            revealedCells: new Set(),
            flags: new Set()
        };
    }

    function emitInitialGameState(roomId) {
        const room = rooms.get(roomId);
        if (!room) return;

        const gameStates = {};
        const playerStates = {};

        for (const id in room.games) {
            gameStates[id] = room.games[id].getState();
            playerStates[id] = {
                revealedCells: toArray(room.playerStates[id].revealedCells),
                flags: toArray(room.playerStates[id].flags)
            };
        }

        io.to(roomId).emit('setGames', {
            gameStates,
            playerStates,
            playersStatus: room.playersStatus
        });
    }

    function DeletePlayer(roomId, playerId) {
        const room = rooms.get(roomId);
        if (!room || !room.players.includes(playerId)) return;

        const playerIndex = room.players.indexOf(playerId);
        if (playerIndex === -1) return;

        room.players.splice(playerIndex, 1);
        delete room.games[playerId];
        delete room.playerStates[playerId];
        room.playersStatus = room.playersStatus.filter(entry => !entry[playerId]);

        // Handle single remaining player
        if (room.players.length === 1) {
            const remainingPlayerId = room.players[0];
            const remainingPlayerStatus = getPlayerStatus(room, remainingPlayerId);

            if (remainingPlayerStatus) {
                remainingPlayerStatus.isHost = true;
                remainingPlayerStatus.isReady = true;
            }

            const { rows, cols, mines } = room.saveConfig;
            room.games[remainingPlayerId] = createGameState(rows, cols, mines);
            room.games[remainingPlayerId].start();
            room.playerStates[remainingPlayerId] = initializePlayerState();
        }

        // Prepare emit data
        const emitData = {
            playerId,
            playersStatus: room.playersStatus
        };

        if (room.players.length === 1) {
            const remainingId = room.players[0];
            emitData.gameState = room.games[remainingId].getState();
            emitData.playerState = { revealedCells: [], flags: [] };
        }

        socket.to(roomId).emit('playerLeft', emitData);
        socket.emit('returnToLobby', { message: 'Bạn đã rời khỏi phòng', roomId });

        if (room.players.length === 0) {
            rooms.delete(roomId);
            console.log(`Phòng ${roomId} đã được xóa`);
        }

        emitRoomList();
    }

    function emitRoomList() {
        const roomList = toArray(rooms).map(([roomId, room]) => {
            const firstPlayer = room.players[0];
            const firstPlayerStatus = getPlayerStatus(room, firstPlayer);

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
    }

    function handleGameAction(roomId, actionType, index, actionHandler) {
        const room = rooms.get(roomId);
        if (!room || !room.players.includes(socket.id)) return;

        const currentGamePlayer = room.games[socket.id];
        const playerState = room.playerStates[socket.id];

        const result = actionHandler(currentGamePlayer, playerState, index);
        if (!result) return;


        const changes = {
            revealedCells: result.openedIndices || [],
        };

        console.log("changes", changes);
        

        const updateData = {
            playerId: socket.id,
            action: {
                type: actionType,
                index,
                result,
                changes
            }
        };

        if (result.isMine || result.isWin) {
            room.playersStatus = room.playersStatus.map(status => {
                if (status[socket.id]) {
                    status[socket.id].isCompleted = true;
                    status[socket.id].status = result.isMine ? 'lost' : 'won';
                }
                return status;
            });

            updateData.playersStatus = room.playersStatus;
        }

        io.to(roomId).emit('updateState', updateData);
    }

    // Event handlers
    socket.on('emitRoomList', emitRoomList);

    socket.on('joinRoom', (roomId, playerName, configMode, maxPlayers) => {
        if (!roomId || typeof roomId !== 'string' || roomId.trim() === '') {
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
                saveConfig: {},
                maxPlayers: maxPlayers
            };
            rooms.set(roomId, room);
            socket.emit('roomCreated', { roomId });
        }

        if (room.players.length >= room.maxPlayers) {
            socket.emit('roomFull', { message: 'Room is full' });
            return;
        }

        if (configMode) {
            room.saveConfig = configMode;
        }
        const { rows, cols, mines } = room.saveConfig;

        room.players.push(socket.id);
        room.games[socket.id] = createGameState(rows, cols, mines);
        room.games[socket.id].start();
        console.log(room.games[socket.id].getState());

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

        const playerStatus = getPlayerStatus(room, socket.id);
        if (playerStatus && !playerStatus.isHost) {
            playerStatus.isReady = !playerStatus.isReady;
            io.to(roomId).emit('playerStatusUpdate', {
                playerId: socket.id,
                isReady: playerStatus.isReady
            });
        }
    });

    socket.on('startGame', (roomId) => {
        const room = rooms.get(roomId);
        if (!room || !room.players.includes(socket.id)) return;

        const playerStatus = getPlayerStatus(room, socket.id);
        if (!playerStatus?.isHost) {
            socket.emit('error', { message: 'Chỉ host mới có thể bắt đầu game!' });
            return;
        }

        const canStart = room.playersStatus.every(pl => {
            const player = Object.values(pl)[0];
            return player.isReady;
        });

        if (canStart) {
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

        const { players, games, playerStates, saveConfig } = room;
        const { rows, cols, mines } = saveConfig;

        players.forEach((id) => {
            games[id] = createGameState(rows, cols, mines);
            games[id].start();
            playerStates[id] = initializePlayerState();

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
            const flags = toArray(state.flags);
            const result = game.chording(idx, flags);

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
            if (!result) return null;

            state.revealedCells.add(idx);
            if (result.openedIndices?.length > 0) {
                result.openedIndices.forEach(i => state.revealedCells.add(i));
            }

            return result;
        });
    });

    socket.on('toggleFlag', ({ roomId, index }) => {
        const room = rooms.get(roomId);
        if (!room || !room.players.includes(socket.id)) return;

        const playerState = room.playerStates[socket.id];
        if (playerState.revealedCells.has(index)) return;

        const hadFlag = playerState.flags.has(index);
        if (hadFlag) {
            playerState.flags.delete(index);
        } else {
            playerState.flags.add(index);
        }

        io.to(roomId).emit('flagToggled', {
            playerId: socket.id,
            index,
            hasFlag: !hadFlag
        });
    });

    socket.on('leaveRoom', (roomId) => {
        DeletePlayer(roomId, socket.id);
    });

    socket.on('disconnect', () => {
        rooms.forEach((room, roomId) => {
            if (room.players.includes(socket.id)) {
                DeletePlayer(roomId, socket.id);
            }
        });
    });
}

module.exports = pvp;