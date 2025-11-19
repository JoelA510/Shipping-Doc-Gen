const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const uploadRouter = require('./routes/upload');
const documentsRouter = require('./routes/documents');
const statusRouter = require('./routes/status');
const metricsRouter = require('./routes/metrics');
const authRouter = require('./routes/auth');
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

app.use(helmet());
app.use(cors());
app.use(express.json());

// Public health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Public routes
app.use('/auth', authRouter);
app.use('/metrics', metricsRouter);

// Protected routes
app.use('/upload', requireAuth, uploadRouter);
app.use('/documents', requireAuth, documentsRouter);
app.use('/', requireAuth, statusRouter);

if (require.main === module) {
    app.listen(port, () => {
        console.log(`API listening at http://localhost:${port}`);
    });
}

module.exports = app;
