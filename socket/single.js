const uWS = require('uWebSockets.js');
const Minesweeper = require('../core/Minesweeper.js');



function single(app) {
    const players = new Map();
 
    app.ws('/single', {
        open: (ws) => {
            console.log('User connected to /single:', ws.id);
            ws.id = generateId(); // Tạo ID duy nhất cho client
            players.set(ws.id, {
                gameState: null,
                playerState: {
                    revealedCells: new Set(),
                    flags: new Set()
                },
                saveConfig: {}
            });
            ws.subscribe('single'); // Đăng ký client vào channel "single"
        },
        message: (ws, message, isBinary) => {
            const data = JSON.parse(Buffer.from(message).toString());
            const playerData = players.get(ws.id);
            if (!playerData) return;

            switch (data.event) {
                case 'initializeGame':
                    handleInitializeGame(ws, playerData, data.configMode);
                    break;
                case 'chording':
                    handleChording(ws, playerData, data.index);
                    break;
                case 'openCell':
                    handleOpenCell(ws, playerData, data.index);
                    break;
                case 'toggleFlag':
                    handleToggleFlag(ws, playerData, data.index);
                    break;
            }
        },
        close: (ws) => {
            console.log('User disconnected from /single:', ws.id);
            players.delete(ws.id); // Xóa trạng thái khi client ngắt kết nối
        }
    });
}

// Hàm tạo ID duy nhất cho client
function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

// Hàm trả về dữ liệu trạng thái để gửi
function getDataToSend(playerData) {
    return {
        gameState: playerData.gameState.getState(),
        playerState: {
            revealedCells: Array.from(playerData.playerState.revealedCells),
            flags: Array.from(playerData.playerState.flags)
        }
    };
}

// Xử lý sự kiện initializeGame
function handleInitializeGame(ws, playerData, configMode) {
    playerData.saveConfig = configMode;
    const { rows, cols, mines } = playerData.saveConfig;
    playerData.gameState = new Minesweeper(rows || 9, cols || 9, mines || null);
    playerData.gameState.start();
    playerData.playerState = {
        revealedCells: new Set(),
        flags: new Set()
    };

    ws.send(JSON.stringify({
        event: 'setGames',
        data: getDataToSend(playerData)
    }));
}

// Xử lý sự kiện chording
function handleChording(ws, playerData, index) {
    const { gameState, playerState } = playerData;
    const flags = Array.from(playerState.flags);
    const result = gameState.chording(index, flags);

    if (result.success) {
        result.openedIndices.forEach(i => playerState.revealedCells.add(i));
    }

    const updateData = {
        ...getDataToSend(playerData),
        action: { type: 'chord', index, result }
    };

    if (result.isMine) {
        const { mines } = gameState.getState();
        mines?.forEach(i => playerState.revealedCells.add(i));
        ws.send(JSON.stringify({
            event: 'gameOver',
            data: { message: 'Bạn đã chạm vào bom' }
        }));
    } else if (result.isWin) {
        ws.send(JSON.stringify({
            event: 'gameOver',
            data: { message: 'Bạn đã thắng' }
        }));
    }

    ws.send(JSON.stringify({
        event: 'updateState',
        data: updateData
    }));
}

// Xử lý sự kiện openCell
function handleOpenCell(ws, playerData, index) {
    if (index == null || !playerData.gameState) return;
    if (playerData.playerState.flags.has(index)) return;

    const { gameState, playerState } = playerData;
    const result = gameState.openCell(index);

    if (result) {
        playerState.revealedCells.add(index);
        if (result.openedIndices?.length > 0) {
            result.openedIndices.forEach(i => playerState.revealedCells.add(i));
        }

        const updateData = {
            ...getDataToSend(playerData),
            action: { type: 'open', index, result }
        };

        if (result.isMine) {
            result.mines.forEach(i => playerState.revealedCells.add(i));
            ws.send(JSON.stringify({
                event: 'gameOver',
                data: { message: 'Bạn đã thua!' }
            }));
        } else if (result.isWin) {
            ws.send(JSON.stringify({
                event: 'gameOver',
                data: { message: 'Bạn đã thắng game!' }
            }));
        }

        ws.send(JSON.stringify({
            event: 'updateState',
            data: updateData
        }));
    }
}

function handleToggleFlag(ws, playerData, index) {
    if (index == null || !playerData.gameState) return;
    if (playerData.playerState.revealedCells.has(index)) return;

    const { playerState } = playerData;
    if (playerState.flags.has(index)) {
        playerState.flags.delete(index);
    } else {
        playerState.flags.add(index);
    }

    ws.send(JSON.stringify({
        event: 'updateState',
        data: {
            ...getDataToSend(playerData),
            action: { type: 'flag', index }
        }
    }));
}

module.exports = single;