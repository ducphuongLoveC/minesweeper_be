// const axios = require('axios');
// const env = require('dotenv');
// const express = require('express');
// const http = require('http');
// const socketIo = require('socket.io');
// const pvp = require('./socket/pvp.js');
// const single = require('./socket/single.js');


// env.config()
// const app = express();
// const server = http.createServer(app);
// const io = socketIo(server, {
//     cors: {
//         origin: "*",
//         methods: ["GET", "POST"]
//     }
// });

// app.use(express.static('public'));

// const singleNamespace = io.of('/single');
// singleNamespace.on('connection', (socket) => {
//     console.log('User connected to /single namespace:', socket.id);
//     single(singleNamespace, socket);
// });

// const pvpNamespace = io.of('/pvp');
// pvpNamespace.on('connection', (socket) => {
//     console.log('User connected to /pvp namespace:', socket.id);
//     pvp(pvpNamespace, socket);
// });

// app.get('/no-sleep', async (req, res) => {
//     return res.status(200).json({
//         success: true,
//         message: 'OK',
//         status: 200
//     });
// });

// (async () => {
//     let count_check = 0;
//     const API_URL = process.env.MAIN_BASE;

//     const check = async () => {
//         console.log(`${API_URL}/no-sleep`);

//         try {
//             const response = await axios.get(`${API_URL}/no-sleep`);
//             count_check++;
//             console.log(`check không cho ngủ lần thứ ${count_check}`, response.data);
//         } catch (error) {
//             console.error(`check không cho ngủ`, error.message);
//         }

//         // const delay = (4 + Math.random() * 2) * 1000; // 4 đến 6 giây
//         const delay = (4 + Math.random() * 2) * 60 * 1000; // 4 đến 6 phút
//         setTimeout(check, delay);
//     };
//     check();
// })();

// server.listen(3000, () => {
//     console.log('Server running on port 3000');
// });



const axios = require('axios');
const env = require('dotenv');
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const pvp = require('./socket/pvp.js');
const single = require('./socket/single.js');

env.config();
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    compression: true // Bật nén để giảm kích thước dữ liệu
});

app.use(express.static('public', {
    maxAge: '1d' // Cache tài nguyên tĩnh trong 1 ngày
}));


io.on('connection', (socket) => {
    console.log('User connected to default namespace:', socket.id);
    socket.on('ping', (data) => {
        socket.emit('pong', { pingTime: data.pingTime });
    });

    socket.on('disconnect', () => {
        console.log('User disconnected from default namespace:', socket.id);
    });
});

const singleNamespace = io.of('/single');
singleNamespace.on('connection', (socket) => {
    console.log('User connected to /single namespace:', socket.id);
    single(singleNamespace, socket);
});

const pvpNamespace = io.of('/pvp');
pvpNamespace.on('connection', (socket) => {
    console.log('User connected to /pvp namespace:', socket.id);
    pvp(pvpNamespace, socket);
});

app.get('/no-sleep', async (req, res) => {
    return res.status(200).json({
        success: true,
        message: 'OK',
        status: 200
    });
});

(async () => {
    let count_check = 0;
    const API_URL = process.env.MAIN_BASE;

    const check = async () => {
        console.log(`${API_URL}/no-sleep`);
        try {
            const response = await axios.get(`${API_URL}/no-sleep`);
            count_check++;
            console.log(`check không cho ngủ lần thứ ${count_check}`, response.data);
        } catch (error) {
            console.error(`check không cho ngủ`, error.message);
        }
    };

    // Gọi lần đầu
    check();
    // Lặp lại mỗi 5 phút
    setInterval(check, 5 * 60 * 1000);
})();

server.listen(3000, () => {
    console.log('Server running on port 3000');
});