const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { prisma } = require('../queue'); // Use shared instance

// Helper to generate token
const generateToken = (user) => {
    const secret = process.env.AUTH_SECRET || 'default-secret-key';
    return jwt.sign({ id: user.id, username: user.username, role: user.role }, secret, { expiresIn: '24h' });
};

// Register new user
const register = async (username, password) => {
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
        where: { username }
    });

    if (existingUser) {
        throw new Error('Username already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
        data: {
            username,
            password: hashedPassword
        }
    });

    const token = generateToken(user);
    return { user: { id: user.id, username: user.username, role: user.role }, token };
};

// Login user
const login = async (username, password) => {
    const user = await prisma.user.findUnique({
        where: { username }
    });

    if (!user) {
        throw new Error('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        throw new Error('Invalid credentials');
    }

    const token = generateToken(user);
    return { user: { id: user.id, username: user.username, role: user.role }, token };
};

// Verify token middleware
const verifyToken = (token) => {
    try {
        const secret = process.env.AUTH_SECRET || 'default-secret-key';
        return jwt.verify(token, secret);
    } catch (err) {
        throw new Error('Invalid token');
    }
};

module.exports = {
    register,
    login,
    verifyToken,
    prisma // Export prisma client for use in other services if needed
};
