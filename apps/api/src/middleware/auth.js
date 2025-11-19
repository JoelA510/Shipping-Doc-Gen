const { validateEnv } = require('../config/env');

// Simple mock auth middleware
function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({ error: 'No authorization header provided' });
    }

    const token = authHeader.split(' ')[1];

    // In a real app, verify JWT here.
    // For prototype, check against a secret or just existence.
    // Let's check against the env secret for basic security.

    try {
        const config = validateEnv();
        if (token !== config.authSecret) {
            return res.status(403).json({ error: 'Invalid token' });
        }

        // Mock user
        req.user = { id: 'user-1', role: 'operator' };
        next();
    } catch (error) {
        return res.status(500).json({ error: 'Auth configuration error' });
    }
}

module.exports = {
    requireAuth
};
