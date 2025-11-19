const API_URL = 'http://localhost:3001';

// Mock auth token for prototype
const AUTH_TOKEN = 'mysecret';

async function request(endpoint, options = {}) {
    const headers = {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        ...options.headers
    };

    const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || `Request failed: ${response.status}`);
    }

    return response.json();
}

export const api = {
    uploadFile: async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        return request('/upload', {
            method: 'POST',
            body: formData
        });
    },

    getJob: async (jobId) => {
        return request(`/jobs/${jobId}`);
    },

    getDocument: async (docId) => {
        return request(`/documents/${docId}`);
    }
};
