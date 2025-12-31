const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3000/api';

async function verifySignup() {
    const uniqueId = Date.now();
    const user = {
        name: `Test User ${uniqueId}`,
        email: `test${uniqueId}@example.com`,
        password: 'password123'
    };

    console.log('Attempting signup with:', user.email);

    try {
        const response = await fetch(`${BASE_URL}/auth/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(user)
        });

        if (response.ok) {
            const data = await response.json();
            console.log('Signup Successful!');
            console.log('Token received:', !!data.token);
            console.log('User ID:', data.user.id);
        } else {
            console.error('Signup Failed:', response.status, response.statusText);
            const err = await response.text();
            console.error('Error body:', err);
            process.exit(1);
        }
    } catch (err) {
        console.error('Network or Script Error:', err);
        process.exit(1);
    }
}

verifySignup();
