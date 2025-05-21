// const Minesweeper = require('../core/Minesweeper.js');

// function single(io, socket) {
//     const dataPlayer = {
//         gameState: null,
//         playerState: {
//             revealedCells: new Set(),
//             flags: new Set()
//         },
//         saveConfig: {}
//     };

//     function getDataToSend() {
//         return {
//             gameState: dataPlayer.gameState.getState(),
//             playerState: {
//                 revealedCells: Array.from(dataPlayer.playerState.revealedCells),
//                 flags: Array.from(dataPlayer.playerState.flags)
//             }
//         };
//     }

//     socket.on('initializeGame', (configMode) => {

//         dataPlayer.saveConfig = configMode;
//         const { rows, cols, mines } = dataPlayer.saveConfig;
//         dataPlayer.gameState = new Minesweeper(rows || 9, cols || 9, mines || null);
//         dataPlayer.gameState.start();
//         dataPlayer.playerState = {
//             revealedCells: new Set(),
//             flags: new Set()
//         };

//         socket.emit('setGames', getDataToSend());
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
    // Cache frequently used functions
    const toArray = Array.from;

    // Player data structure optimized for performance
    const dataPlayer = {
        game: null,
        revealedCells: new Set(),
        flags: new Set(),
        config: { rows: 9, cols: 9, mines: null } // Default config
    };

    // Optimized data preparation function
    function getGameData() {
        return {
            gameState: dataPlayer.game.getState(),
            playerState: {
                revealedCells: toArray(dataPlayer.revealedCells),
                flags: toArray(dataPlayer.flags)
            }
        };
    }

    // Consolidated game action handler
    function handleGameAction(actionType, index, actionHandler) {
        if (index == null || !dataPlayer.game) return;

        const result = actionHandler();
        if (!result) return;

        // Prepare response data
        const response = {
            ...getGameData(),
            action: { type: actionType, index, result }
        };

        // Handle game over conditions
        if (result.isMine || result.isWin) {
            const mines = result.isMine ? dataPlayer.game.getState().mines : null;
            if (mines) mines.forEach(i => dataPlayer.revealedCells.add(i));

            socket.emit('gameOver', {
                message: result.isMine ? 'Bạn đã chạm vào bom' : 'Bạn đã thắng'
            });
        }

        socket.emit('updateState', response);
    }

    // Event handlers
    socket.on('initializeGame', (config) => {
        // Update config with defaults if not provided
        dataPlayer.config = {
            rows: config?.rows || 9,
            cols: config?.cols || 9,
            mines: config?.mines || null
        };

        // Initialize new game
        dataPlayer.game = new Minesweeper(
            dataPlayer.config.rows,
            dataPlayer.config.cols,
            dataPlayer.config.mines
        );
        dataPlayer.game.start();

        // Reset player state
        dataPlayer.revealedCells = new Set();
        dataPlayer.flags = new Set();

        socket.emit('setGames', getGameData());
    });

    socket.on('chording', ({ index }) => {
        handleGameAction('chord', index, () => {
            const result = dataPlayer.game.chording(index, toArray(dataPlayer.flags));
            if (result.success) {
                result.openedIndices.forEach(i => dataPlayer.revealedCells.add(i));
            }
            return result;
        });
    });

    socket.on('openCell', ({ index }) => {
        handleGameAction('open', index, () => {
            if (dataPlayer.flags.has(index)) return null;

            const result = dataPlayer.game.openCell(index);
            if (!result) return null;

            dataPlayer.revealedCells.add(index);
            if (result.openedIndices?.length > 0) {
                result.openedIndices.forEach(i => dataPlayer.revealedCells.add(i));
            }
            return result;
        });
    });

    socket.on('toggleFlag', ({ index }) => {
        if (index == null || !dataPlayer.game || dataPlayer.revealedCells.has(index)) return;

        // Toggle flag state
        if (dataPlayer.flags.has(index)) {
            dataPlayer.flags.delete(index);
        } else {
            dataPlayer.flags.add(index);
        }

        socket.emit('updateState', {
            ...getGameData(),
            action: { type: 'flag', index }
        });
    });
}

module.exports = single;