const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../data/users.json');

function ensureFileExists() {
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, '{}');
    }
}

function loadUsers() {
    ensureFileExists();
    try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(raw);
    } catch (err) {
        console.error('Failed to load users:', err.message);
        return {};
    }
}
function saveUsers(users) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(users, null, 2));
        console.log('users.json updated successfully');
    } catch (err) {
        console.error('Failed to save users:', err.message);
    }
}

module.exports = { loadUsers, saveUsers };
