const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const uploadRouter = require('./routes/upload');
const documentsRouter = require('./routes/documents');
const statusRouter = require('./routes/status');
const metricsRouter = require('./routes/metrics');
const authRouter = require('./routes/auth');
const complianceRouter = require('./routes/compliance');
const templatesRouter = require('./routes/templates');
const notificationsRouter = require('./routes/notifications');
const { validateEnv } = require('./config/env');
const { requireAuth } = require('./middleware/auth');

// Validate env at startup
try {
    validateEnv();
} catch (error) {
    console.error(error.message);
    process.exit(1);
}

const app = express();
const port = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors({
    origin: true, // Reflect request origin to support credentials
    credentials: true
}));
app.use(express.json({ limit: '10mb' })); // Limit payload size

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5, // Stricter limit for auth endpoints
    message: 'Too many login attempts, please try again later.',
    skipSuccessfulRequests: true
});

app.use('/api/', limiter); // Apply to all API routes
app.use('/auth', authLimiter); // Stricter limit for auth

// Public health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static files (generated PDFs) - PUBLIC ACCESS
// We need to get the config again or pass it down
const config = validateEnv();
app.use('/files', express.static(config.storagePath));

// Public routes
app.use('/auth', authRouter);
app.use('/metrics', metricsRouter);

// Protected routes
app.use('/upload', requireAuth, uploadRouter);
app.use('/documents', requireAuth, documentsRouter);
app.use('/compliance', requireAuth, complianceRouter);
app.use('/templates', requireAuth, templatesRouter);
app.use('/notifications', requireAuth, notificationsRouter);
app.use('/', requireAuth, statusRouter);

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

//Centralized error handler
app.use((err, req, res, next) => {
    console.error('Error:', err);

    // Don't leak error details in production
    const isDev = process.env.NODE_ENV !== 'production';

    res.status(err.status || 500).json({
        error: err.message || 'Internal server error',
        ...(isDev && { stack: err.stack })
    });
});

if (require.main === module) {
    app.listen(port, () => {
        console.log(`API listening at http://localhost:${port}`);
    });
}

module.exports = app;
