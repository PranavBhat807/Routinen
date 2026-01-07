const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3000/api';

class ApiClient {
    constructor(context) {
        this.context = context;
    }

    async getToken() {
        return await this.context.secrets.get('sro_token');
    }

    async setToken(token) {
        await this.context.secrets.store('sro_token', token);
    }

    async login(email, password) {
        try {
            const response = await fetch(`${BASE_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            
            if (!response.ok) {
                throw new Error('Login failed');
            }

            const data = await response.json();
            if (data.token) {
                await this.setToken(data.token);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    }

    async signup(name, email, password) {
        try {
            const response = await fetch(`${BASE_URL}/auth/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password })
            });

            if (!response.ok) {
                 const errData = await response.json();
                 throw new Error(errData.error || 'Signup failed');
            }

            const data = await response.json();
            if (data.token) {
                await this.setToken(data.token);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Signup error:', error);
            throw error;
        }
    }

    async getTasks() {
        const token = await this.getToken();
        if (!token) return [];

        try {
            const response = await fetch(`${BASE_URL}/tasks`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.status === 401 || response.status === 403) {
                 // Token might be expired
                 return null; 
            }

            if (!response.ok) return [];

            return await response.json();
        } catch (error) {
            console.error('Get tasks error:', error);
            return [];
        }
    }

    async getTask(taskId) {
        const token = await this.getToken();
        if (!token) return null;

        try {
            const response = await fetch(`${BASE_URL}/tasks/${taskId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) return null;
            return await response.json();
        } catch (error) {
            console.error('Get task error:', error);
            return null;
        }
    }

    async completeTask(taskId) {
        const token = await this.getToken();
        if (!token) return false;

        try {
            const response = await fetch(`${BASE_URL}/tasks/${taskId}/complete`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    date: new Date().toISOString().slice(0, 10),
                    durationMinutes: 30 // Default or prompt user? keeping simple for now
                })
            });

            return response.ok;
        } catch (error) {
            console.error('Complete task error:', error);
            return false;
        }
    }

    async createTask(taskData) {
        const token = await this.getToken();
        if (!token) return false;

        try {
            const response = await fetch(`${BASE_URL}/tasks`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(taskData)
            });

            return response.ok;
        } catch (error) {
            console.error('Create task error:', error);
            return false;
        }
    }

    async updateTask(taskId, taskData) {
        const token = await this.getToken();
        if (!token) return false;

        try {
            const response = await fetch(`${BASE_URL}/tasks/${taskId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(taskData)
            });

            return response.ok;
        } catch (error) {
            console.error('Update task error:', error);
            return false;
        }
    }

    async deleteTask(taskId) {
        const token = await this.getToken();
        if (!token) return false;

        try {
            const response = await fetch(`${BASE_URL}/tasks/${taskId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            return response.ok;
        } catch (error) {
            console.error('Delete task error:', error);
            return false;
        }
    }

    async getAIPlan() {
        const token = await this.getToken();
        if (!token) return null;

        try {
            const response = await fetch(`${BASE_URL}/planner/today?mode=ai`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) return null;
            return await response.json();
        } catch (error) {
            console.error('Get AI plan error:', error);
            return null;
        }
    }
}

module.exports = ApiClient;
