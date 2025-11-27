const TEMPLATE_MAP = {
    'sli': 'sli',
    'nippon': 'nippon-sli',
    'nippon-sli': 'nippon-sli',
    'ceva': 'ceva-sli',
    'ceva-sli': 'ceva-sli',
    'dhl': 'dhl-invoice',
    'dhl-invoice': 'dhl-invoice',
    'bol': 'generic-bol',
    'generic-bol': 'generic-bol',
    'fedex': 'fedex-bol',
    'fedex-bol': 'fedex-bol',
    'ups': 'ups-bol',
    'ups-bol': 'ups-bol',
    'usps': 'usps-label',
    'usps-label': 'usps-label'
};

const TEMPLATE_DEFAULTS = {
    'sli': { format: 'A4' },
    'fedex-bol': { format: 'Letter' },
    'ups-bol': { format: 'Letter' },
    'usps-label': { format: 'A6', width: '4in', height: '6in' }
};

module.exports = {
    TEMPLATE_MAP,
    TEMPLATE_DEFAULTS
};
