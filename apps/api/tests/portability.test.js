const request = require('supertest');
const { shipments } = require('./fixtures/shipments');

// Mock Prisma - defined inline to avoid hoisting issues
jest.mock('../src/lib/prisma', () => {
    const mockClient = {
        shipment: {
            findUnique: jest.fn(),
            create: jest.fn()
        },
        shipmentCarrierMeta: {
            findMany: jest.fn()
        },
        $transaction: jest.fn((cb) => cb(mockClient)),
        $connect: jest.fn(),
        $disconnect: jest.fn()
    };
    // return the mock client directly or a factory that returns it?
    // prisma module usually exports the client instance.
    return mockClient;
});

const mockPrisma = require('../src/lib/prisma');

// Mock Services/Libs
jest.mock('bullmq', () => ({
    Queue: jest.fn().mockImplementation(() => ({ add: jest.fn() })),
    Worker: jest.fn().mockImplementation(() => ({ on: jest.fn(), close: jest.fn() }))
}));

// Mock Auth
jest.mock('../src/services/auth', () => ({
    verifyToken: jest.fn().mockReturnValue({ id: 'u1', username: 'testuser' }),
    requireAuth: (req, res, next) => { req.user = { id: 'u1' }; next(); }
}));

// Mock Historian
jest.mock('../src/services/historian', () => ({
    logShipmentEvent: jest.fn()
}));

const app = require('../src/index');

describe('Portability API', () => {
    const token = 'valid-token';
    const mockShipment = {
        id: 'ship-1',
        ...shipments.domestic,
        createdAt: new Date(),
        updatedAt: new Date(),
        lineItems: [{ id: 'l1', ...shipments.domestic.lineItems[0] }],
        documents: [],
        carrierMeta: []
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /shipments/:id/export', () => {
        it('should export a shipment as JSON', async () => {
            // Mock finding the shipment
            mockPrisma.shipment.findUnique.mockResolvedValue(mockShipment);
            mockPrisma.shipmentCarrierMeta.findMany.mockResolvedValue([]);

            const res = await request(app)
                .get('/shipments/ship-1/export')
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(res.headers['content-type']).toContain('application/json');
            expect(res.body.version).toBeDefined();
            expect(res.body.data.id).toBe('ship-1');
        });

        it('should return 404/Error if shipment not found', async () => {
            mockPrisma.shipment.findUnique.mockResolvedValue(null);

            const res = await request(app)
                .get('/shipments/unknown/export')
                .set('Authorization', `Bearer ${token}`);

            // Service throws "Shipment not found", error handler returns 500 or 404 depending on error type.
            // Current error handler returns 500 for generic errors usually.
            expect(res.statusCode).not.toBe(200);
        });
    });

    describe('POST /shipments/import', () => {
        it('should import a valid shipment payload', async () => {
            const importPayload = {
                version: '1.0',
                timestamp: new Date().toISOString(),
                exportSource: 'shipping-doc-gen',
                data: {
                    ...mockShipment,
                    id: 'old-id'
                }
            };

            // Mock creation
            mockPrisma.shipment.create.mockResolvedValue({
                id: 'new-id',
                status: 'draft',
                consigneeId: 'c1' // simplified
            });

            const res = await request(app)
                .post('/shipments/import')
                .set('Authorization', `Bearer ${token}`)
                .send(importPayload);

            expect(res.statusCode).toBe(201);
            expect(res.body.id).toBe('new-id');
            expect(res.body.status).toBe('draft');

            // Verify create was called
            expect(mockPrisma.shipment.create).toHaveBeenCalled();
        });
    });
});
