// const Minesweeper = require('../core/Minesweeper.js');

// function single(io, socket) {
//     const dataPlayer = {
//         gameState: null,
//         playerState: {
//             revealedCells: new Set(),
//             flags: new Set()
//         },
//         saveConfig: {},
//         stat: {

//         }
//     };

//     function getDataToSend(sendGS) {

//         const data = {
//             playerState: {
//                 revealedCells: Array.from(dataPlayer.playerState.revealedCells),
//                 flags: Array.from(dataPlayer.playerState.flags)
//             }
//         };
//         if (sendGS) {
//             data.gameState = dataPlayer.gameState.getState()
//         }
//         return data
//     }

//     socket.on('initializeGame', (configMode) => {

//         dataPlayer.saveConfig = configMode;

//         console.log(dataPlayer.saveConfig);

//         const { rows, cols, mines } = dataPlayer.saveConfig;
//         dataPlayer.gameState = new Minesweeper(rows || 9, cols || 9, mines || null);
//         dataPlayer.gameState.start();

//         console.log(dataPlayer.gameState.getState());

//         dataPlayer.playerState = {
//             revealedCells: new Set(),
//             flags: new Set()
//         };

//         socket.emit('setGames', getDataToSend(true));
//     });

//     socket.on('chording', ({ index }) => {
//         const { gameState, playerState } = dataPlayer;

//         const flags = Array.from(playerState.flags);

//         const result = gameState.chording(index, flags);
//         if (result.success) {
//             result.openedIndices.forEach(i => playerState.revealedCells.add(i));
//         }

//         if (result.isMine) {

//             const { mines } = gameState.getState();
//             mines?.forEach(i => playerState.revealedCells.add(i));

//             socket.emit('gameOver', {
//                 message: 'Bạn đã chạm vào bom'
//             });
//         } else if (result.isWin) {
//             socket.emit('gameOver', {
//                 message: 'Bạn đã thắng'
//             });
//         }

//         socket.emit('updateState', {
//             ...getDataToSend(),
//             action: { type: 'chord', index, result }
//         });
//     })


//     socket.on('openCell', ({ index }) => {
//         if (index === undefined || index === null) return;
//         if (!dataPlayer.gameState) return;

//         const currentGamePlayer = dataPlayer.gameState;
//         const playerState = dataPlayer.playerState;

//         if (playerState.flags.has(index)) return;

//         const result = currentGamePlayer.openCell(index);

//         if (result) {
//             playerState.revealedCells.add(index);

//             if (result.openedIndices?.length > 0) {
//                 result.openedIndices.forEach(i => playerState.revealedCells.add(i));
//             }

//             if (result.isMine) {
//                 const { mines } = result;

//                 mines.forEach((i) => playerState.revealedCells.add(i))

//                 socket.emit('gameOver', {
//                     message: 'Bạn đã thua!'
//                 });
//             } else if (result.isWin) {
//                 socket.emit('gameOver', {
//                     message: 'Bạn đã thắng game!'
//                 });
//             }

//             socket.emit('updateState', {
//                 ...getDataToSend(),
//                 action: { type: 'open', index, result }
//             });
//         }
//     });

//     socket.on('toggleFlag', ({ index }) => {
//         if (index === undefined || index === null) return;
//         if (!dataPlayer.gameState) return;

//         const playerState = dataPlayer.playerState;

//         if (playerState.revealedCells.has(index)) return;

//         if (playerState.flags.has(index)) {
//             playerState.flags.delete(index);
//         } else {
//             playerState.flags.add(index);
//         }

//         socket.emit('updateState', {
//             ...getDataToSend(),
//             action: { type: 'flag', index }
//         });
//     });
// }

// module.exports = single;

const Minesweeper = require('../core/Minesweeper.js');

function single(io, socket) {
    const dataPlayer = {
        gameState: null,
        playerState: {
            revealedCells: new Set(),
            flags: new Set()
        },
        saveConfig: {},
        stat: {},
        status: null
    };

    socket.on('initializeGame', (configMode) => {
        dataPlayer.saveConfig = configMode;
        const { rows, cols, mines } = dataPlayer.saveConfig;
        dataPlayer.gameState = new Minesweeper(rows || 9, cols || 9, mines || null);
        dataPlayer.gameState.start();

        dataPlayer.status = 'playing'
        dataPlayer.playerState = {
            revealedCells: new Set(),
            flags: new Set()
        };

        socket.emit('gameInitialized', {
            gameState: dataPlayer.gameState.getState(),
            revealedCells: Array.from(dataPlayer.playerState.revealedCells),
            flags: Array.from(dataPlayer.playerState.flags),
            status: dataPlayer.status
        });
    });

    socket.on('chording', ({ index }) => {
        const { gameState, playerState } = dataPlayer;
        const flags = Array.from(playerState.flags);
        const result = gameState.chording(index, flags);

        if (result.success) {
            result.openedIndices.forEach(i => playerState.revealedCells.add(i));
        }

        const changes = {
            revealedCells: result.openedIndices || [],
            flags: [] // No flag changes in chording
        };

        if (result.isMine) {
            const { mines } = gameState.getState();
            mines?.forEach(i => playerState.revealedCells.add(i));
            console.log('check');

            socket.emit('gameOver', {
                message: 'Bạn đã chạm vào bom',
                revealedCells: Array.from(playerState.revealedCells),
                flags: Array.from(playerState.flags),
                status: 'lost'
            });
        } else if (result.isWin) {
            socket.emit('gameOver', {
                message: 'Bạn đã thắng',
                revealedCells: Array.from(playerState.revealedCells),
                flags: Array.from(playerState.flags),
                status: 'winner'

            });
        } else {
            socket.emit('stateUpdate', {
                action: 'chord',
                index,
                result,
                changes
            });
        }
    });

    socket.on('openCell', ({ index }) => {
        if (index === undefined || index === null || !dataPlayer.gameState) return;

        const currentGamePlayer = dataPlayer.gameState;
        const playerState = dataPlayer.playerState;

        if (playerState.flags.has(index)) return;

        const result = currentGamePlayer.openCell(index);

        if (result) {
            const openedIndices = [index, ...(result.openedIndices || [])];
            openedIndices.forEach(i => playerState.revealedCells.add(i));

            const changes = {
                revealedCells: openedIndices,
                flags: [] // No flag changes in openCell
            };

            if (result.isMine) {
                const { mines } = result;
                mines.forEach(i => playerState.revealedCells.add(i));
                socket.emit('gameOver', {
                    message: 'Bạn đã thua!',
                    revealedCells: Array.from(playerState.revealedCells),
                    flags: Array.from(playerState.flags),
                    status: 'lost'
                });
            } else if (result.isWin) {
                socket.emit('gameOver', {
                    message: 'Bạn đã thắng game!',
                    revealedCells: Array.from(playerState.revealedCells),
                    flags: Array.from(playerState.flags),
                    status: 'lost'
                });
            } else {
                socket.emit('stateUpdate', {
                    action: 'open',
                    index,
                    result,
                    changes,

                });
            }
        }
    });

    socket.on('toggleFlag', ({ index }) => {
        if (index === undefined || index === null || !dataPlayer.gameState) return;

        const playerState = dataPlayer.playerState;
        if (playerState.revealedCells.has(index)) return;

        const flagChanged = [index];
        const changes = {
            revealedCells: [],
            flags: flagChanged
        };

        if (playerState.flags.has(index)) {
            playerState.flags.delete(index);
        } else {
            playerState.flags.add(index);
        }

        socket.emit('stateUpdate', {
            action: 'flag',
            index,
            changes
        });
    });
}

module.exports = single;