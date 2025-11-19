const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const SECRET_KEY = process.env.AUTH_SECRET || 'default-secret-key';
const users = new Map(); // In-memory user store

// Helper to generate token
const generateToken = (user) => {
    return jwt.sign({ id: user.id, username: user.username }, SECRET_KEY, { expiresIn: '24h' });
};

// Register new user
const register = async (username, password) => {
    // Check if user exists
    for (const user of users.values()) {
        if (user.username === username) {
            throw new Error('Username already exists');
        }
    }

    const id = uuidv4();
    // In a real app, password should be hashed (e.g., bcrypt)
    const user = { id, username, password };
    users.set(id, user);

    const token = generateToken(user);
    return { user: { id, username }, token };
};

// Login user
const login = async (username, password) => {
    let foundUser = null;
    for (const user of users.values()) {
        if (user.username === username && user.password === password) {
            foundUser = user;
            break;
        }
    }

    if (!foundUser) {
        throw new Error('Invalid credentials');
    }

    const token = generateToken(foundUser);
    return { user: { id: foundUser.id, username: foundUser.username }, token };
};

// Verify token middleware
const verifyToken = (token) => {
    try {
        return jwt.verify(token, SECRET_KEY);
    } catch (err) {
        throw new Error('Invalid token');
    }
};

module.exports = {
    register,
    login,
    verifyToken
};
