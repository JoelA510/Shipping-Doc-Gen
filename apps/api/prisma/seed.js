const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const HTS_CODES = [
    { code: '8517.62.0050', description: 'Machines for the reception, conversion and transmission or regeneration of voice, images or other data' },
    { code: '8471.30.0100', description: 'Portable automatic data processing machines, weighing not more than 10 kg, consisting of at least a central processing unit, a keyboard and a display' },
    { code: '8471.41.0150', description: 'Other automatic data processing machines: Comprising in the same housing at least a central processing unit and an input and output unit' },
    { code: '8544.42.0000', description: 'Insulated (including enameled or anodized) wire, cable (including coaxial cable) and other insulated electric conductors, fitted with connectors' },
];

async function main() {
    console.log('Start seeding ...');

    for (const hts of HTS_CODES) {
        const item = await prisma.htsCode.upsert({
            where: { code: hts.code },
            update: {},
            create: hts,
        });
        console.log(`Created/Updated HTS Code: ${item.code}`);
    }

    console.log('Seeding finished.');
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });
