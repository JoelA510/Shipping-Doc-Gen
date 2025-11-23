const { validateEnv } = require('../config/env');

// Simple mock auth middleware
function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;

    // Debug log
    if (!authHeader) {
        console.log('[Auth Middleware] Missing Authorization Header. Headers:', JSON.stringify(req.headers));
        return res.status(401).json({ error: 'No authorization header provided' });
    }

    const token = authHeader.split(' ')[1];

    // In a real app, verify JWT here.
    // For prototype, check against a secret or just existence.
    // Let's check against the env secret for basic security.

    try {
        const authService = require('../services/auth');
        const decoded = authService.verifyToken(token);
        req.user = { id: decoded.id, username: decoded.username };
        next();
    } catch (error) {
        return res.status(403).json({ error: 'Invalid token' });
    }
}

module.exports = {
    requireAuth
};
