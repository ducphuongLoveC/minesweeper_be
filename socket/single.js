const Minesweeper = require('../core/Minesweeper.js');

function single(io, socket) {
    const dataPlayer = {
        gameState: null,
        playerState: {
            revealedCells: new Set(),
            flags: new Set()
        },
        saveConfig: {},
        stat: {

        }
    };

    function getDataToSend(sendGS) {

        const data = {
            playerState: {
                revealedCells: Array.from(dataPlayer.playerState.revealedCells),
                flags: Array.from(dataPlayer.playerState.flags)
            }
        };
        if (sendGS) {
            data.gameState = dataPlayer.gameState.getState()
        }
        return data
    }

    socket.on('initializeGame', (configMode) => {

        dataPlayer.saveConfig = configMode;

        console.log(dataPlayer.saveConfig);

        const { rows, cols, mines } = dataPlayer.saveConfig;
        dataPlayer.gameState = new Minesweeper(rows || 9, cols || 9, mines || null);
        dataPlayer.gameState.start();

        console.log(dataPlayer.gameState.getState());

        dataPlayer.playerState = {
            revealedCells: new Set(),
            flags: new Set()
        };

        socket.emit('setGames', getDataToSend(true));
    });

    socket.on('chording', ({ index }) => {
        const { gameState, playerState } = dataPlayer;

        const flags = Array.from(playerState.flags);

        const result = gameState.chording(index, flags);
        if (result.success) {
            result.openedIndices.forEach(i => playerState.revealedCells.add(i));
        }

        if (result.isMine) {

            const { mines } = gameState.getState();
            mines?.forEach(i => playerState.revealedCells.add(i));

            socket.emit('gameOver', {
                message: 'Bạn đã chạm vào bom'
            });
        } else if (result.isWin) {
            socket.emit('gameOver', {
                message: 'Bạn đã thắng'
            });
        }

        socket.emit('updateState', {
            ...getDataToSend(),
            action: { type: 'chord', index, result }
        });
    })


    socket.on('openCell', ({ index }) => {
        if (index === undefined || index === null) return;
        if (!dataPlayer.gameState) return;

        const currentGamePlayer = dataPlayer.gameState;
        const playerState = dataPlayer.playerState;

        if (playerState.flags.has(index)) return;

        const result = currentGamePlayer.openCell(index);

        if (result) {
            playerState.revealedCells.add(index);

            if (result.openedIndices?.length > 0) {
                result.openedIndices.forEach(i => playerState.revealedCells.add(i));
            }

            if (result.isMine) {
                const { mines } = result;

                mines.forEach((i) => playerState.revealedCells.add(i))

                socket.emit('gameOver', {
                    message: 'Bạn đã thua!'
                });
            } else if (result.isWin) {
                socket.emit('gameOver', {
                    message: 'Bạn đã thắng game!'
                });
            }

            socket.emit('updateState', {
                ...getDataToSend(),
                action: { type: 'open', index, result }
            });
        }
    });

    socket.on('toggleFlag', ({ index }) => {
        if (index === undefined || index === null) return;
        if (!dataPlayer.gameState) return;

        const playerState = dataPlayer.playerState;

        if (playerState.revealedCells.has(index)) return;

        if (playerState.flags.has(index)) {
            playerState.flags.delete(index);
        } else {
            playerState.flags.add(index);
        }

        socket.emit('updateState', {
            ...getDataToSend(),
            action: { type: 'flag', index }
        });
    });
}

module.exports = single;