require('dotenv').config();
const db = require('../src/db');

async function verify() {
    try {
        console.log('Testing getAllUsers...');
        const users = await db.getAllUsers();
        if (!Array.isArray(users)) throw new Error('getAllUsers should return an array');
        console.log(`✅ Success: Fetched ${users.length} users.`);
    } catch (err) {
        console.error('❌ Failed:', err);
        process.exit(1);
    }
}

verify();
