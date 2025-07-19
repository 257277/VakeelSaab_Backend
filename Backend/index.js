const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');
const lawyerRoutes = require('./routes/lawyerRoutes');
const { wsServer } = require('./ws/wsServer');

const app = express();
const PORT = 8000;
app.use(cors());

app.use(express.json());

app.use('/auth', authRoutes);
app.use('/lawyers', lawyerRoutes);

const server = http.createServer(app);

const wss = new WebSocket.Server({ server });
wsServer(wss);


server.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
});
