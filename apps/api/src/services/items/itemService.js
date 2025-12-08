const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const itemService = {
    /**
     * List items with optional search and pagination
     */
    listItems: async ({ search, limit = 20, offset = 0 }) => {
        const where = {};

        if (search) {
            where.OR = [
                { sku: { contains: search } },
                { description: { contains: search } },
                { htsCode: { contains: search } }
            ];
        }

        const [data, total] = await Promise.all([
            prisma.item.findMany({
                where,
                skip: offset,
                take: limit,
                orderBy: { sku: 'asc' }
            }),
            prisma.item.count({ where })
        ]);

        return { data, total, limit, offset };
    },

    /**
     * Get single item by ID
     */
    getItem: async (id) => {
        return prisma.item.findUnique({ where: { id } });
    },

    /**
     * Get item by SKU
     */
    getItemBySku: async (sku) => {
        return prisma.item.findUnique({ where: { sku } });
    },

    /**
     * Create new item
     */
    createItem: async (data, userId) => {
        // Check uniqueness of SKU if provided manually
        if (data.sku) {
            const existing = await prisma.item.findUnique({ where: { sku: data.sku } });
            if (existing) throw new Error(`Item with SKU ${data.sku} already exists.`);
        }

        return prisma.item.create({
            data: {
                ...data,
                createdByUserId: userId
            }
        });
    },

    /**
     * Update existing item
     */
    updateItem: async (id, data) => {
        return prisma.item.update({
            where: { id },
            data
        });
    },

    /**
     * Delete item
     */
    deleteItem: async (id) => {
        return prisma.item.delete({ where: { id } });
    }
};

module.exports = itemService;
