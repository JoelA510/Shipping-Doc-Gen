const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const partyService = {
    /**
     * List parties in the address book
     * @param {Object} query - { search, limit, offset }
     */
    listParties: async ({ search, limit = 20, offset = 0 }) => {
        const where = {
            isAddressBookEntry: true
        };

        if (search) {
            where.OR = [
                { name: { contains: search } }, // Case insensitive in SQLite by default? Check provider.
                { city: { contains: search } },
                { countryCode: { contains: search } }
            ];
        }

        const [data, total] = await Promise.all([
            prisma.party.findMany({
                where,
                skip: offset,
                take: limit,
                orderBy: { name: 'asc' }
            }),
            prisma.party.count({ where })
        ]);

        return { data, total, limit, offset };
    },

    /**
     * Get a single party
     */
    getParty: async (id) => {
        return prisma.party.findUnique({ where: { id } });
    },

    /**
     * Create a new address book entry
     */
    createParty: async (data, userId) => {
        return prisma.party.create({
            data: {
                ...data,
                isAddressBookEntry: true,
                createdByUserId: userId
            }
        });
    },

    /**
     * Update an existing party
     */
    updateParty: async (id, data) => {
        return prisma.party.update({
            where: { id },
            data
        });
    },

    /**
     * Delete (or soft delete) a party
     * For now, strict delete, but could fail if linked to shipments.
     * Recommendation: Just mark inactive or implement safe delete check.
     */
    deleteParty: async (id) => {
        // Validation: Check if linked to any shipment
        const usedCount = await prisma.shipment.count({
            where: {
                OR: [
                    { shipperId: id },
                    { consigneeId: id },
                    { forwarderId: id },
                    { brokerId: id }
                ]
            }
        });

        if (usedCount > 0) {
            // Cannot delete used party, maybe unmark as address book?
            return prisma.party.update({
                where: { id },
                data: { isAddressBookEntry: false } // "Archive" from address book
            });
        }

        return prisma.party.delete({ where: { id } });
    }
};

module.exports = partyService;
