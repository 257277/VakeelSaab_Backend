const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { loadUsers, saveUsers } = require('../utils/fileStore');

const router = express.Router();
const JWT_SECRET = 'VakeelSaab';

router.post('/register', async (req, res) => {
    const { username, password, role } = req.body;

    if (!username || !password || !['CLIENT', 'LAWYER'].includes(role)) {
        return res.status(400).json({ message: 'Username, password and valid role are required' });
    }

    const users = loadUsers();

    if (users[username]) {
        return res.status(409).json({ message: 'User already exists' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const userData = { passwordHash, role };
    if (role === 'LAWYER') {
        userData.status = 'BUSY';
    }
    users[username] = userData;

    saveUsers(users);

    return res.status(201).json({ message: 'User registered successfully' });
});

router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    const users = loadUsers();
    const user = users[username];

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
        return res.status(401).json({ message: 'Invalid credentials' });
    }
    const token = jwt.sign({ username, role: user.role }, JWT_SECRET);
    return res.status(200).json({ token, role: user.role });
});

module.exports = router;
