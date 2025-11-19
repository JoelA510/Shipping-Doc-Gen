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
    const templatePath = path.join(__dirname, `../templates/${templateName}.hbs`);
    const templateHtml = fs.readFileSync(templatePath, 'utf8');
    const template = handlebars.compile(templateHtml);

    // Add current date if not present
    const context = {
        date: new Date().toLocaleDateString(),
        ...data
    };

    const html = template(context);

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox'] // Required for Docker/CI environments
    });

    try {
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });
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
        return pdfBuffer;
    } finally {
        await browser.close();
    }
}

module.exports = {
    generatePDF
};
