const jwt = require('jsonwebtoken');
const WebSocket = require('ws');
const { loadUsers, saveUsers } = require('../utils/fileStore');

const JWT_SECRET = 'VakeelSaab';
const sockets = new Map();
const rooms = new Map();

function broadcastLawyers() {
    const users = loadUsers();
    const lawyerList = Object.entries(users)
        .filter(([_, u]) => u.role === 'LAWYER')
        .map(([username, user]) => ({ username, status: user.status }));

    const message = JSON.stringify({ type: 'lawyer_list', data: lawyerList });

    sockets.forEach((ws) => {
        try {
            ws.send(message);
        } catch (err) {
            console.error(`Error sending to ${ws.username}:`, err.message);
        }
    });
}

function wsServer(wss) {
    wss.on('connection', (ws, req) => {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const token = url.searchParams.get('token');

        if (!token) return ws.close(1008, 'Missing auth token');

        let user;
        try {
            user = jwt.verify(token, JWT_SECRET);
        } catch (err) {
            return ws.close(1008, 'Invalid token');
        }

        const { username, role } = user;
        ws.username = username;
        ws.role = role;
        sockets.set(username, ws);

        console.log(`${username} connected`);
        broadcastLawyers();

        ws.on('message', (message) => {
            let parsed;
            try {
                parsed = JSON.parse(message);
            } catch (err) {
                console.error('Invalid message:', message);
                return;
            }

            const { type, to, data } = parsed;

            switch (type) {
                case 'call-request': {
                    const users = loadUsers();
                    const targetSocket = sockets.get(to);
                    const lawyer = users[to];

                    if (targetSocket && lawyer?.role === 'LAWYER' && lawyer?.status === 'ONLINE') {
                        targetSocket.send(JSON.stringify({
                            type: 'call-request',
                            from: username,
                            data: { message: 'Client is requesting a call', from: username }
                        }));
                    } else {
                        ws.send(JSON.stringify({
                            type: 'error',
                            data: 'Lawyer is not available'
                        }));
                    }
                    break;
                }
                case 'audio-call-request': {
                    const users = loadUsers();
                    const targetSocket = sockets.get(to);
                    const lawyer = users[to];

                    if (targetSocket && lawyer?.role === 'LAWYER' && lawyer?.status === 'ONLINE') {
                        targetSocket.send(JSON.stringify({
                            type: 'audio-call-request',
                            from: username,
                            data: { message: 'Client is requesting a audio call', from: username }
                        }));
                    } else {
                        ws.send(JSON.stringify({
                            type: 'error',
                            data: 'Lawyer is not available'
                        }));
                    }
                    break;
                }

                case 'call-accept': {
                    const { clientUsername } = data;
                    const users = loadUsers();
                    if (users[username]?.role !== 'LAWYER') return;

                    const clientSocket = sockets.get(clientUsername);
                    const lawyerSocket = sockets.get(username);

                    if (!clientSocket || clientSocket.readyState !== WebSocket.OPEN) return;

                    const roomId = `room-${username}-${clientUsername}-${Date.now()}`;
                    rooms.set(roomId, { lawyer: username, client: clientUsername });

                    users[username].status = 'BUSY';
                    saveUsers(users);
                    broadcastLawyers();

                    const payload = JSON.stringify({
                        type: 'room-joined',
                        roomId,
                        lawyer: username,
                        client: clientUsername
                    });

                    lawyerSocket.send(payload);
                    clientSocket.send(payload);
                    break;
                }
                case 'audio-call-accept': {
                    const { clientUsername } = data;
                    const users = loadUsers();
                    if (users[username]?.role !== 'LAWYER') return;

                    const clientSocket = sockets.get(clientUsername);
                    const lawyerSocket = sockets.get(username);

                    if (!clientSocket || clientSocket.readyState !== WebSocket.OPEN) return;

                    const roomId = `room-audio-${username}-${clientUsername}-${Date.now()}`;
                    rooms.set(roomId, { lawyer: username, client: clientUsername });

                    users[username].status = 'BUSY';
                    saveUsers(users);
                    broadcastLawyers();

                    const payload = JSON.stringify({
                        type: 'audio-room-joined',
                        roomId,
                        lawyer: username,
                        client: clientUsername
                    });

                    lawyerSocket.send(payload);
                    clientSocket.send(payload);
                    break;
                }

                case 'chat-message': {
                    const { roomId, message } = data;
                    const room = rooms.get(roomId);
                    if (!room) return ws.send(JSON.stringify({ type: 'error', data: 'Room not found' }));

                    const targetUsername = username === room.lawyer ? room.client : room.lawyer;
                    const targetSocket = sockets.get(targetUsername);

                    if (targetSocket && targetSocket.readyState === WebSocket.OPEN) {
                        targetSocket.send(JSON.stringify({
                            type: 'chat-message',
                            from: username,
                            message
                        }));
                    }
                    break;
                }

                case 'audio-message': {
                    const { roomId, audioData } = data;
                    const room = rooms.get(roomId);
                    if (!room) return ws.send(JSON.stringify({ type: 'error', data: 'Room not found' }));

                    const targetUsername = username === room.lawyer ? room.client : room.lawyer;
                    const targetSocket = sockets.get(targetUsername);

                    if (targetSocket && targetSocket.readyState === WebSocket.OPEN) {
                        targetSocket.send(JSON.stringify({
                            type: 'audio-message',
                            from: username,
                            audioData
                        }));
                    }
                    break;
                }

                case 'offer':
                case 'answer':
                case 'ice-candidate': {
                    const targetSocket = sockets.get(to);
                    if (targetSocket && targetSocket.readyState === WebSocket.OPEN) {
                        targetSocket.send(JSON.stringify({
                            type,
                            from: username,
                            data
                        }));
                    }
                    break;
                }
                case 'call-ended': {
                    const users = loadUsers();

                    if (users[username]?.role === 'LAWYER') {
                        users[username].status = 'ONLINE';
                    } else if (users[username]?.role === 'CLIENT') {
                        const room = [...rooms.entries()].find(([_, p]) =>
                            p.client === username || p.lawyer === username
                        );
                        if (room && users[room[1].lawyer]) {
                            users[room[1].lawyer].status = 'ONLINE';
                        }
                    }
                    saveUsers(users);
                    broadcastLawyers();

                    for (const [roomId, participants] of rooms.entries()) {
                        if (participants.client === username || participants.lawyer === username) {
                            rooms.delete(roomId);
                            break;
                        }
                    }
                    const targetSocket = sockets.get(to);
                    if (targetSocket && targetSocket.readyState === WebSocket.OPEN) {
                        targetSocket.send(JSON.stringify({
                            type: 'call-ended',
                            from: username
                        }));
                    }
                    break;
                }

                default:
                    break;
            }
        });

        ws.on('close', (e) => {
            console.warn('WebSocket closed unexpectedly:', e);
            console.log(`${username} disconnected`);
            sockets.delete(username);

            const users = loadUsers();
            if (users[username]?.role === 'LAWYER') {
                users[username].status = 'OFFLINE';
                saveUsers(users);
            }

            broadcastLawyers();
        });
    });
}

module.exports = {
    wsServer,
    broadcastLawyers,
    sockets
};
