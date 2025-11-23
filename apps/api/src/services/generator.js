const puppeteer = require('puppeteer');
const handlebars = require('handlebars');
const fs = require('fs');
const path = require('path');

/**
 * Generate PDF from data and template
 * @param {Object} data - Document data
 * @param {string} templateName - Name of the template (e.g., 'sli')
 * @returns {Promise<Buffer>} PDF buffer
 */
async function generatePDF(data, templateName = 'sli') {
    try {
        const templatePath = path.join(__dirname, `../templates/${templateName}.hbs`);
        console.log('[Generator] Loading template:', templatePath);
        const templateHtml = fs.readFileSync(templatePath, 'utf8');

        // Register Handlebars helpers
        handlebars.registerHelper('eq', function (a, b) {
            return a === b;
        });

        const template = handlebars.compile(templateHtml);

        // Add current date if not present
        const context = {
            date: new Date().toLocaleDateString(),
            ...data
        };

        console.log('[Generator] Rendering template with context');
        const html = template(context);
        console.log('[Generator] Template rendered successfully, launching browser');

        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox'] // Required for Docker/CI environments
        });

        try {
            const page = await browser.newPage();
            console.log('[Generator] Setting page content');
            await page.setContent(html, { waitUntil: 'networkidle0' });
            console.log('[Generator] Generating PDF');
            const pdfBuffer = await page.pdf({
                format: 'A4',
                printBackground: true,
                margin: {
                    top: '20px',
                    right: '20px',
                    bottom: '20px',
                    left: '20px'
                }
            });
            console.log('[Generator] PDF generated successfully');
            return pdfBuffer;
        } finally {
            await browser.close();
        }
    } catch (error) {
        console.error('[Generator] Error generating PDF:', error);
        console.error('[Generator] Error stack:', error.stack);
        throw error;
    }
}

module.exports = {
    generatePDF
};
