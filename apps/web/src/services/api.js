const API_URL = 'http://localhost:3003';

let authToken = localStorage.getItem('token');

const request = async (endpoint, options = {}) => {
    const headers = {
        ...options.headers,
        'Authorization': authToken ? `Bearer ${authToken}` : undefined
    };

    const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || `Request failed: ${response.statusText}`);
    }

    return response.json();
};

export const api = {
    setToken: (token) => {
        authToken = token;
        if (token) localStorage.setItem('token', token);
        else localStorage.removeItem('token');
    },

    login: async (username, password) => {
        return request('/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
    },

    register: async (username, password) => {
        return request('/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
    },

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
    },

    updateDocument: async (docId, data) => {
        return request(`/documents/${docId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    },

    triggerExport: async (docId, type = 'sli') => {
        return request(`/documents/${docId}/export`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type })
        });
    },

    getHistory: async (docId) => {
        return request(`/documents/${docId}/history`);
    },

    getComments: async (docId) => {
        return request(`/documents/${docId}/comments`);
    },

    addComment: async (docId, text, user) => {
        return request(`/documents/${docId}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, user })
        });
    }
};
