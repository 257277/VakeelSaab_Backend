const express = require('express');
const { verifyToken } = require('../middleware/authMiddleware');
const { loadUsers, saveUsers } = require('../utils/fileStore');
const { broadcastLawyers } = require('../ws/wsServer');

const router = express.Router();

router.post('/status', verifyToken, async (req, res) => {
    const { status } = req.body;
    const username = req.user.username;

    if (!['ONLINE', 'BUSY'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status value. Use ONLINE or BUSY.' });
    }

    const users = loadUsers();

    const user = users[username];
    if (!user) {
        return res.status(404).json({ message: 'User not found.' });
    }

    if (user.role !== 'LAWYER') {
        return res.status(403).json({ message: 'Only lawyers can set status.' });
    }

    user.status = status;
    await saveUsers(users);

    broadcastLawyers();

    return res.status(200).json({ message: `Status updated to ${status}` });
});

module.exports = router;
