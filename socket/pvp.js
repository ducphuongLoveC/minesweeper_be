// const Minesweeper = require('../core/Minesweeper.js');

// const rooms = {};

// function pvp(io, socket) {
//     function DeletePlayer(roomId, playerId) {
//         if (!rooms[roomId] || !rooms[roomId].players.includes(playerId)) return;

//         // Remove player from players array
//         rooms[roomId].players = rooms[roomId].players.filter(id => id !== playerId);

//         // Remove player's game and state
//         delete rooms[roomId].games[playerId];
//         delete rooms[roomId].playerStates[playerId];

//         // Update playersStatus and assign new host if needed
//         rooms[roomId].playersStatus = rooms[roomId].playersStatus.filter(
//             entry => !entry[playerId]
//         );

//         // If a player remains, make them the host and reset their game
//         if (rooms[roomId].players.length === 1) {
//             const remainingPlayerId = rooms[roomId].players[0];
//             const remainingPlayerStatus = rooms[roomId].playersStatus.find(
//                 entry => entry[remainingPlayerId]
//             );
//             if (remainingPlayerStatus) {
//                 remainingPlayerStatus[remainingPlayerId].isHost = true;
//                 remainingPlayerStatus[remainingPlayerId].isReady = true;
//             }

//             // Reset the remaining player's game
//             const { rows, cols, mines } = rooms[roomId].saveConfig;
//             rooms[roomId].games[remainingPlayerId] = new Minesweeper(rows || 9, cols || 9, mines || null);
//             rooms[roomId].games[remainingPlayerId].start();
//             rooms[roomId].playerStates[remainingPlayerId] = {
//                 revealedCells: new Set(),
//                 flags: new Set()
//             };
//         }

//         // Notify room of player leaving and reset game for remaining player
//         socket.to(roomId).emit('playerLeft', {
//             playerId,
//             message: 'Người chơi đã rời khỏi phòng',
//             playersStatus: rooms[roomId].playersStatus,
//             gameStates: rooms[roomId].players.length === 1 ? {
//                 [rooms[roomId].players[0]]: rooms[roomId].games[rooms[roomId].players[0]].getState()
//             } : {},
//             playerStates: rooms[roomId].players.length === 1 ? {
//                 [rooms[roomId].players[0]]: {
//                     revealedCells: [],
//                     flags: []
//                 }
//             } : {}
//         });

//         // Notify the leaving player to return to lobby
//         socket.emit('returnToLobby', {
//             message: 'Bạn đã rời khỏi phòng',
//             roomId
//         });

//         // Delete room if empty
//         if (rooms[roomId].players.length === 0) {
//             delete rooms[roomId];
//             console.log(`Phòng ${roomId} đã được xóa`);
//             return;
//         }

//         console.log(`Player ${playerId} removed from room ${roomId}`);
//     }

//     function AllEmitSetGames(roomId) {
//         if (!rooms[roomId]) return;
//         io.to(roomId).emit('setGames', {
//             gameStates: Object.fromEntries(
//                 Object.entries(rooms[roomId].games).map(([id, game]) => [id, game.getState()])
//             ),
//             playerStates: Object.fromEntries(
//                 Object.entries(rooms[roomId].playerStates).map(([id, state]) => [
//                     id,
//                     {
//                         revealedCells: Array.from(state.revealedCells),
//                         flags: Array.from(state.flags)
//                     }
//                 ])
//             ),
//             playersStatus: rooms[roomId].playersStatus
//         });
//     }

//     function emitRoomList() {
//         const roomList = Object.entries(rooms).map(([roomId, room]) => ({
//             id: roomId,
//             name: room.playersStatus[0]?.[room.players[0]]?.playerName
//                 ? `Phòng của ${room.playersStatus[0][room.players[0]].playerName}`
//                 : `Phòng ${roomId}`,
//             currentPlayers: room.players.length,
//             maxPlayers: 2
//         }));

//         io.emit('roomList', roomList);
//     }

//     socket.on('emitRoomList', () => {
//         emitRoomList();
//     })


//     socket.on('joinRoom', (roomId, playerName, configMode) => {
//         console.log('configMode', configMode);
//         console.log(`User ${socket.id} attempting to join room ${roomId}`);

//         if (!roomId || typeof roomId !== 'string' || roomId.trim() === '') {
//             socket.emit('error', { message: 'Invalid room ID' });
//             return;
//         }

//         if (!rooms[roomId]) {
//             rooms[roomId] = {
//                 players: [],
//                 games: {},
//                 playerStates: {},
//                 playersStatus: [],
//                 saveConfig: {}
//             };
//             socket.emit('roomCreated', { roomId });
//         }

//         if (rooms[roomId].players.length >= 2) {
//             socket.emit('roomFull', { message: 'Room is full' });
//             return;
//         }

//         if (configMode) {
//             rooms[roomId].saveConfig = configMode;
//         }
//         const { rows, cols, mines } = rooms[roomId].saveConfig;

//         rooms[roomId].players.push(socket.id);
//         rooms[roomId].games[socket.id] = new Minesweeper(rows || 9, cols || 9, mines || null);
//         rooms[roomId].games[socket.id].start();
//         rooms[roomId].playerStates[socket.id] = {
//             revealedCells: new Set(),
//             flags: new Set()
//         };

//         const isHost = rooms[roomId].players.length === 1;
//         rooms[roomId].playersStatus.push({
//             [socket.id]: {
//                 playerName: playerName || `Player ${rooms[roomId].players.length}`,
//                 isReady: isHost,
//                 isHost
//             }
//         });

//         socket.join(roomId);
//         socket.emit('joinedRoom', { roomId, playerId: socket.id });
//         console.log(`User ${socket.id} joined room ${roomId}. Players: ${rooms[roomId].players.length}`);

//         AllEmitSetGames(roomId);
//         emitRoomList();
//     });

//     socket.on('toggleReadyGame', (roomId) => {
//         if (!rooms[roomId] || !rooms[roomId].players.includes(socket.id)) return;

//         const playerStatus = rooms[roomId].playersStatus.find(entry => entry[socket.id])?.[socket.id];
//         if (playerStatus && !playerStatus.isHost) {
//             playerStatus.isReady = !playerStatus.isReady;
//             AllEmitSetGames(roomId);
//         }
//     });

//     socket.on('startGame', (roomId) => {
//         if (!rooms[roomId] || !rooms[roomId].players.includes(socket.id)) return;

//         const playerStatus = rooms[roomId].playersStatus.find(entry => entry[socket.id])?.[socket.id];
//         if (!playerStatus?.isHost) {
//             socket.emit('error', { message: 'Chỉ host mới có thể bắt đầu game!' });
//             return;
//         }

//         const canStart = rooms[roomId].playersStatus.every(pl => {
//             const [, player] = Object.entries(pl)[0];
//             return player.isReady;
//         });

//         if (canStart) {
            
//             io.to(roomId).emit('canStartGame', { canStart: true, message: 'Game bắt đầu!' });
//         } else {
//             socket.emit('playerNotReady', { message: 'Người chơi chưa sẵn sàng!' });
//         }
//     });

//     socket.on('replayGame', (roomId) => {
//         if (!rooms[roomId] || !rooms[roomId].players.includes(socket.id)) return;
//         socket.to(roomId).emit('sendReplayGame', { message: 'Chơi thêm ván nữa nhé!' });
//     });

//     socket.on('confirmReplay', ({ roomId }) => {
//         if (!rooms[roomId] || !rooms[roomId].players.includes(socket.id)) return;

//         const { players, games, playerStates, saveConfig } = rooms[roomId];
//         const { rows, cols, mines } = saveConfig;

//         players.forEach((id) => {
//             games[id] = new Minesweeper(rows || 9, cols || 9, mines || null);
//             games[id].start();
//             playerStates[id] = {
//                 revealedCells: new Set(),
//                 flags: new Set()
//             };
//         });

//         io.to(roomId).emit('replayConfirmed', {
//             gameStates: Object.fromEntries(
//                 Object.entries(rooms[roomId].games).map(([id, game]) => [id, game.getState()])
//             ),
//             playerStates: Object.fromEntries(
//                 Object.entries(rooms[roomId].playerStates).map(([id, state]) => [
//                     id,
//                     {
//                         revealedCells: Array.from(state.revealedCells),
//                         flags: Array.from(state.flags)
//                     }
//                 ])
//             ),
//             playersStatus: rooms[roomId].playersStatus,
//             message: 'Chơi thêm ván nữa nhé!'
//         });
//     });

//     socket.on('declineReplay', ({ roomId }) => {
//         socket.to(roomId).emit('replayDeclined', { message: 'Người chơi đã từ chối chơi lại.' });
//     });

//     socket.on('chording', ({ roomId, index }) => {
//         if (!rooms[roomId] || !rooms[roomId].players.includes(socket.id)) return;

//         const currentGamePlayer = rooms[roomId].games[socket.id];
//         const playerState = rooms[roomId].playerStates[socket.id];
//         const flags = Array.from(playerState.flags);

//         const result = currentGamePlayer.chording(index, flags);

        
//         if (result.success) {
//             result.openedIndices.forEach(i => playerState.revealedCells.add(i));
//         }

//         if (result.isMine) {
//             const winner = rooms[roomId].players.find(id => id !== socket.id);
//             const winnerName = rooms[roomId].playersStatus.find(entry => entry[winner])?.[winner]?.playerName;
//             const loserName = rooms[roomId].playersStatus.find(entry => entry[socket.id])?.[socket.id]?.playerName;

//             const { mines } = currentGamePlayer.getState();
//             mines?.forEach(i => playerState.revealedCells.add(i));

//             io.to(roomId).emit('gameOver', {
//                 winner,
//                 loser: socket.id,
//                 message: winner ? `${winnerName} thắng! ${loserName} chạm vào bom!` : 'Kết thúc game!'
//             });
//         } else if (result.isWin) {
//             io.to(roomId).emit('gameOver', {
//                 winner: socket.id,
//                 loser: null,
//                 message: `${loserName} đã thắng game!`
//             });
//         }

//         io.to(roomId).emit('updateState', {
//             playerId: socket.id,
//             gameStates: Object.fromEntries(
//                 Object.entries(rooms[roomId].games).map(([id, game]) => [id, game.getState()])
//             ),
//             playerStates: {
//                 [socket.id]: {
//                     revealedCells: Array.from(playerState.revealedCells),
//                     flags: Array.from(playerState.flags)
//                 },
//                 ...(rooms[roomId].players.length > 1 && {
//                     [rooms[roomId].players.find(id => id !== socket.id)]: {
//                         revealedCells: Array.from(
//                             rooms[roomId].playerStates[rooms[roomId].players.find(id => id !== socket.id)].revealedCells
//                         ),
//                         flags: Array.from(
//                             rooms[roomId].playerStates[rooms[roomId].players.find(id => id !== socket.id)].flags
//                         )
//                     }
//                 })
//             },
//             action: { type: 'chord', index, result, playerId: socket.id }
//         });
//     });


//     socket.on('openCell', ({ roomId, index }) => {
//         if (!rooms[roomId] || !rooms[roomId].players.includes(socket.id)) return;

//         const currentGamePlayer = rooms[roomId].games[socket.id];
//         const playerState = rooms[roomId].playerStates[socket.id];

//         if (playerState.flags.has(index)) return;

//         const result = currentGamePlayer.openCell(index);
//         if (result) {
//             playerState.revealedCells.add(index);
//             if (result.openedIndices?.length > 0) {
//                 result.openedIndices.forEach(i => playerState.revealedCells.add(i));
//             }

//             const winner = rooms[roomId].players.find(id => id !== socket.id);
//             const winnerName = rooms[roomId].playersStatus.find(entry => entry[winner])?.[winner]?.playerName;
//             const loserName = rooms[roomId].playersStatus.find(entry => entry[socket.id])?.[socket.id]?.playerName;

//             if (result.isMine) {

//                 const { mines } = result;
//                 mines.forEach((i) => playerState.revealedCells.add(i))

//                 io.to(roomId).emit('gameOver', {
//                     winner,
//                     loser: socket.id,
//                     message: winner ? `${winnerName} thắng! ${loserName} chạm vào bom!` : 'Kết thúc game!'
//                 });
//             } else if (result.isWin) {
//                 io.to(roomId).emit('gameOver', {
//                     winner: socket.id,
//                     loser: null,
//                     message: `${loserName} đã thắng game!`
//                 });
//             }

//             io.to(roomId).emit('updateState', {
//                 playerId: socket.id,
//                 gameStates: Object.fromEntries(
//                     Object.entries(rooms[roomId].games).map(([id, game]) => [id, game.getState()])
//                 ),
//                 playerStates: {
//                     [socket.id]: {
//                         revealedCells: Array.from(playerState.revealedCells),
//                         flags: Array.from(playerState.flags)
//                     },
//                     ...(rooms[roomId].players.length > 1 && {
//                         [rooms[roomId].players.find(id => id !== socket.id)]: {
//                             revealedCells: Array.from(
//                                 rooms[roomId].playerStates[rooms[roomId].players.find(id => id !== socket.id)].revealedCells
//                             ),
//                             flags: Array.from(
//                                 rooms[roomId].playerStates[rooms[roomId].players.find(id => id !== socket.id)].flags
//                             )
//                         }
//                     })
//                 },
//                 action: { type: 'open', index, result, playerId: socket.id }
//             });


//         }
//     });

//     socket.on('toggleFlag', ({ roomId, index }) => {
//         if (!rooms[roomId] || !rooms[roomId].players.includes(socket.id)) return;

//         const playerState = rooms[roomId].playerStates[socket.id];
//         if (playerState.revealedCells.has(index)) return;

//         if (playerState.flags.has(index)) {
//             playerState.flags.delete(index);
//         } else {
//             playerState.flags.add(index);
//         }

//         io.to(roomId).emit('updateState', {
//             playerId: socket.id,
//             gameStates: Object.fromEntries(
//                 Object.entries(rooms[roomId].games).map(([id, game]) => [id, game.getState()])
//             ),
//             playerStates: Object.fromEntries(
//                 Object.entries(rooms[roomId].playerStates).map(([id, state]) => [
//                     id,
//                     {
//                         revealedCells: Array.from(state.revealedCells),
//                         flags: Array.from(state.flags)
//                     }
//                 ])
//             ),
//             action: { type: 'flag', index, playerId: socket.id }
//         });
//     });

//     socket.on('leaveRoom', (roomId) => {
//         console.log(`Player ${socket.id} leaving room ${roomId}`);
//         DeletePlayer(roomId, socket.id);
//     });

//     socket.on('disconnect', () => {
//         console.log(`Player ${socket.id} disconnected`);
//         for (const roomId in rooms) {
//             if (rooms[roomId].players.includes(socket.id)) {
//                 DeletePlayer(roomId, socket.id);
//             }
//         }
//     });
// }

// module.exports = pvp;






















const Minesweeper = require('../core/Minesweeper.js');

const rooms = new Map(); // Using Map for better performance with frequent additions/deletions

function pvp(io, socket) {
    // Cache frequently used functions
    const toArray = Array.from;
    const getOwnPropertyNames = Object.getOwnPropertyNames;

    function DeletePlayer(roomId, playerId) {
        const room = rooms.get(roomId);
        if (!room || !room.players.includes(playerId)) return;

        // Optimized player removal
        const playerIndex = room.players.indexOf(playerId);
        if (playerIndex === -1) return;
        
        room.players.splice(playerIndex, 1);
        delete room.games[playerId];
        delete room.playerStates[playerId];

        // Optimized playersStatus update
        room.playersStatus = room.playersStatus.filter(entry => !entry[playerId]);

        // Handle single remaining player
        if (room.players.length === 1) {
            const remainingPlayerId = room.players[0];
            const remainingPlayerStatus = room.playersStatus.find(entry => entry[remainingPlayerId]);
            
            if (remainingPlayerStatus) {
                remainingPlayerStatus[remainingPlayerId].isHost = true;
                remainingPlayerStatus[remainingPlayerId].isReady = true;
            }

            // Reset game for remaining player
            const { rows, cols, mines } = room.saveConfig;
            room.games[remainingPlayerId] = new Minesweeper(rows || 9, cols || 9, mines || null);
            room.games[remainingPlayerId].start();
            room.playerStates[remainingPlayerId] = {
                revealedCells: new Set(),
                flags: new Set()
            };
        }

        // Prepare data for emit
        const emitData = {
            playerId,
            message: 'Người chơi đã rời khỏi phòng',
            playersStatus: room.playersStatus
        };

        if (room.players.length === 1) {
            const remainingId = room.players[0];
            emitData.gameStates = { [remainingId]: room.games[remainingId].getState() };
            emitData.playerStates = { 
                [remainingId]: {
                    revealedCells: [],
                    flags: []
                }
            };
        }

        socket.to(roomId).emit('playerLeft', emitData);
        socket.emit('returnToLobby', { message: 'Bạn đã rời khỏi phòng', roomId });

        // Delete room if empty
        if (room.players.length === 0) {
            rooms.delete(roomId);
            console.log(`Phòng ${roomId} đã được xóa`);
            return;
        }

        console.log(`Player ${playerId} removed from room ${roomId}`);
    }

    function AllEmitSetGames(roomId) {
        const room = rooms.get(roomId);
        if (!room) return;

        // Optimized object creation
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

    function emitRoomList() {
        const roomList = [];
        
        rooms.forEach((room, roomId) => {
            const firstPlayer = room.players[0];
            const firstPlayerStatus = room.playersStatus.find(entry => entry[firstPlayer])?.[firstPlayer];
            
            roomList.push({
                id: roomId,
                name: firstPlayerStatus?.playerName 
                    ? `Phòng của ${firstPlayerStatus.playerName}`
                    : `Phòng ${roomId}`,
                currentPlayers: room.players.length,
                maxPlayers: 2
            });
        });

        io.emit('roomList', roomList);
    }

    // Event handlers
    socket.on('emitRoomList', emitRoomList);

    socket.on('joinRoom', (roomId, playerName, configMode) => {
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
                saveConfig: {}
            };
            rooms.set(roomId, room);
            socket.emit('roomCreated', { roomId });
        }

        if (room.players.length >= 2) {
            socket.emit('roomFull', { message: 'Room is full' });
            return;
        }

        if (configMode) {
            room.saveConfig = configMode;
        }
        const { rows, cols, mines } = room.saveConfig;

        room.players.push(socket.id);
        room.games[socket.id] = new Minesweeper(rows || 9, cols || 9, mines || null);
        room.games[socket.id].start();
        room.playerStates[socket.id] = {
            revealedCells: new Set(),
            flags: new Set()
        };

        const isHost = room.players.length === 1;
        room.playersStatus.push({
            [socket.id]: {
                playerName: playerName || `Player ${room.players.length}`,
                isReady: isHost,
                isHost
            }
        });

        socket.join(roomId);
        socket.emit('joinedRoom', { roomId, playerId: socket.id });
        
        AllEmitSetGames(roomId);
        emitRoomList();
    });

    socket.on('toggleReadyGame', (roomId) => {
        const room = rooms.get(roomId);
        if (!room || !room.players.includes(socket.id)) return;

        const playerStatus = room.playersStatus.find(entry => entry[socket.id])?.[socket.id];
        if (playerStatus && !playerStatus.isHost) {
            playerStatus.isReady = !playerStatus.isReady;
            AllEmitSetGames(roomId);
        }
    });

    socket.on('startGame', (roomId) => {
        const room = rooms.get(roomId);
        if (!room || !room.players.includes(socket.id)) return;

        const playerStatus = room.playersStatus.find(entry => entry[socket.id])?.[socket.id];
        if (!playerStatus?.isHost) {
            socket.emit('error', { message: 'Chỉ host mới có thể bắt đầu game!' });
            return;
        }

        const canStart = room.playersStatus.every(pl => {
            const player = Object.values(pl)[0];
            return player.isReady;
        });

        if (canStart) {
            io.to(roomId).emit('canStartGame', { canStart: true, message: 'Game bắt đầu!' });
        } else {
            socket.emit('playerNotReady', { message: 'Người chơi chưa sẵn sàng!' });
        }
    });

    socket.on('replayGame', (roomId) => {
        if (rooms.has(roomId) && rooms.get(roomId).players.includes(socket.id)) {
            socket.to(roomId).emit('sendReplayGame', { message: 'Chơi thêm ván nữa nhé!' });
        }
    });

    socket.on('confirmReplay', ({ roomId }) => {
        const room = rooms.get(roomId);
        if (!room || !room.players.includes(socket.id)) return;

        const { players, games, playerStates, saveConfig } = room;
        const { rows, cols, mines } = saveConfig;

        players.forEach((id) => {
            games[id] = new Minesweeper(rows || 9, cols || 9, mines || null);
            games[id].start();
            playerStates[id] = {
                revealedCells: new Set(),
                flags: new Set()
            };
        });

        // Prepare data for emit
        const gameStates = {};
        const emitPlayerStates = {};
        
        for (const id in games) {
            gameStates[id] = games[id].getState();
            emitPlayerStates[id] = {
                revealedCells: toArray(playerStates[id].revealedCells),
                flags: toArray(playerStates[id].flags)
            };
        }

        io.to(roomId).emit('replayConfirmed', {
            gameStates,
            playerStates: emitPlayerStates,
            playersStatus: room.playersStatus,
            message: 'Chơi thêm ván nữa nhé!'
        });
    });

    socket.on('declineReplay', ({ roomId }) => {
        socket.to(roomId).emit('replayDeclined', { message: 'Người chơi đã từ chối chơi lại.' });
    });

    function handleGameAction(roomId, actionType, index, actionHandler) {
        const room = rooms.get(roomId);
        if (!room || !room.players.includes(socket.id)) return;

        const currentGamePlayer = room.games[socket.id];
        const playerState = room.playerStates[socket.id];
        const opponentId = room.players.find(id => id !== socket.id);

        const result = actionHandler(currentGamePlayer, playerState, index);
        if (!result) return;

        // Handle game over conditions
        if (result.isMine || result.isWin) {
            const winner = result.isMine ? opponentId : socket.id;
            const loser = result.isMine ? socket.id : null;
            
            const winnerName = room.playersStatus.find(entry => entry[winner])?.[winner]?.playerName;
            const loserName = room.playersStatus.find(entry => entry[socket.id])?.[socket.id]?.playerName;

            if (result.isMine) {
                const { mines } = currentGamePlayer.getState();
                mines?.forEach(i => playerState.revealedCells.add(i));
            }

            io.to(roomId).emit('gameOver', {
                winner,
                loser,
                message: winner 
                    ? `${winnerName} thắng! ${loserName} chạm vào bom!` 
                    : `${loserName} đã thắng game!`
            });
        }

        // Prepare update data
        const updateData = {
            playerId: socket.id,
            gameStates: {},
            playerStates: {
                [socket.id]: {
                    revealedCells: toArray(playerState.revealedCells),
                    flags: toArray(playerState.flags)
                }
            },
            action: { type: actionType, index, result, playerId: socket.id }
        };

        // Add opponent data if exists
        if (opponentId) {
            updateData.playerStates[opponentId] = {
                revealedCells: toArray(room.playerStates[opponentId].revealedCells),
                flags: toArray(room.playerStates[opponentId].flags)
            };
        }

        // Add game states
        for (const id in room.games) {
            updateData.gameStates[id] = room.games[id].getState();
        }

        io.to(roomId).emit('updateState', updateData);
    }

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

        if (playerState.flags.has(index)) {
            playerState.flags.delete(index);
        } else {
            playerState.flags.add(index);
        }

        // Prepare update data
        const updateData = {
            playerId: socket.id,
            gameStates: {},
            playerStates: {},
            action: { type: 'flag', index, playerId: socket.id }
        };

        // Add game states and player states
        for (const id in room.games) {
            updateData.gameStates[id] = room.games[id].getState();
            updateData.playerStates[id] = {
                revealedCells: toArray(room.playerStates[id].revealedCells),
                flags: toArray(room.playerStates[id].flags)
            };
        }

        io.to(roomId).emit('updateState', updateData);
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