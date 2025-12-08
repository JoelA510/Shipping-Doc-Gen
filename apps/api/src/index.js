const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { requireAuth } = require('./middleware/auth');
const uploadRouter = require('./routes/upload');
const documentsRouter = require('./routes/documents');
const statusRouter = require('./routes/status');
const authRouter = require('./routes/auth');
const metricsRouter = require('./routes/metrics');
const complianceRouter = require('./routes/compliance');
const templatesRouter = require('./routes/templates');
const notificationsRouter = require('./routes/notifications');
const carriersRouter = require('./routes/carriers');
const partiesRouter = require('./routes/parties');
const shipmentsRouter = require('./routes/shipments');
const importRouter = require('./routes/import');
const filesRouter = require('./routes/files');
const forwardersRouter = require('./routes/forwarders');
const erpRouter = require('./routes/erp');


const port = process.env.PORT || 3001;
const app = express();

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

// Public routes
app.use('/auth', authRouter);
app.use('/metrics', metricsRouter);

// Protected routes
app.use('/files', requireAuth, filesRouter);
app.use('/upload', requireAuth, uploadRouter);
app.use('/documents', requireAuth, documentsRouter);
app.use('/compliance', requireAuth, complianceRouter);
app.use('/templates', requireAuth, templatesRouter);
app.use('/notifications', requireAuth, notificationsRouter);
app.use('/carriers', requireAuth, carriersRouter);
app.use('/forwarders', requireAuth, forwardersRouter);
app.use('/erp', requireAuth, erpRouter);
app.use('/compliance', requireAuth, complianceRouter);
app.use('/reports', requireAuth, require('./routes/reports')); // New Reports Router
app.use('/parties', requireAuth, partiesRouter);
app.use('/items', requireAuth, require('./routes/items'));
app.use('/shipment-templates', requireAuth, require('./routes/shipmentTemplates'));
app.use('/shipments', requireAuth, shipmentsRouter);
app.use('/import', requireAuth, importRouter);
app.use('/', requireAuth, statusRouter);

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

const errorHandler = require('./middleware/errorHandler');

// ...

// Centralized error handler
app.use(errorHandler);

if (require.main === module) {
    app.listen(port, () => {
        console.log(`API listening at http://localhost:${port}`);
    });
}

module.exports = app;
