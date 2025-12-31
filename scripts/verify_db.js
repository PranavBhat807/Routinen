require('dotenv').config();
const db = require('../src/db');

async function verify() {
    console.log('Running DB Verification...');
    
    try {
        console.log('1. Creating User...');
        const user = await db.createUser({
             name: 'Test User',
             email: `test${Date.now()}@example.com`,
             passwordHash: 'dummy'
        });
        console.log('User created:', user.id);

        console.log('2. Creating Task...');
        const task = await db.createTask({
            userId: user.id,
            title: 'Test Task',
            priority: 'high'
        });
        console.log('Task created:', task.id);

        console.log('3. Fetching Tasks...');
        const tasks = await db.getTasksForUser(user.id);
        if (tasks.length !== 1) throw new Error(`Expected 1 task, got ${tasks.length}`);
        console.log('Tasks fetched successfully.');

        console.log('4. Completing Task...');
        const res = await db.markTaskComplete({
            taskId: task.id,
            userId: user.id,
            dateISO: new Date().toISOString(),
            durationMinutes: 10
        });
        if (!res.task.completed) throw new Error('Task not marked completed');
        console.log('Task completed successfully, Streak:', res.task.streak);

        console.log('✅ Verification Passed!');
    } catch (err) {
        console.error('❌ Verification Failed:', err);
        process.exit(1);
    }
}

verify();
