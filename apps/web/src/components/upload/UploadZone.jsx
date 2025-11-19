import React, { useState, useCallback } from 'react';
import { api } from '../../services/api';

export default function UploadZone({ onDocumentReady }) {
    const [status, setStatus] = useState('idle'); // idle, uploading, processing, error
    const [error, setError] = useState(null);

    const handleFile = async (file) => {
        setStatus('uploading');
        setError(null);

        try {
            const job = await api.uploadFile(file);
            setStatus('processing');
            pollJob(job.id);
        } catch (err) {
            setStatus('error');
            setError(err.message);
        }
    };

    const pollJob = async (jobId) => {
        const interval = setInterval(async () => {
            try {
                const job = await api.getJob(jobId);
                if (job.status === 'completed') {
                    clearInterval(interval);
                    const doc = await api.getDocument(job.documentId);
                    onDocumentReady(doc);
                } else if (job.status === 'failed') {
                    clearInterval(interval);
                    setStatus('error');
                    setError(job.error || 'Processing failed');
                }
            } catch (err) {
                clearInterval(interval);
                setStatus('error');
                setError(err.message);
            }
        }, 1000);
    };

    const onDrop = useCallback((e) => {
        e.preventDefault();
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0]);
        }
    }, []);

    const onDragOver = (e) => e.preventDefault();

    return (
        <div
            className="upload-zone p-8 border-2 border-dashed border-gray-300 rounded-lg text-center cursor-pointer hover:border-blue-500 transition-colors"
            onDrop={onDrop}
            onDragOver={onDragOver}
        >
            {status === 'idle' && (
                <div>
                    <p className="text-lg mb-2">Drag & Drop your CIPL file here</p>
                    <p className="text-sm text-gray-500">Supports PDF, XLSX, CSV, DOCX</p>
                    <input
                        type="file"
                        className="hidden"
                        onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])}
                        id="file-upload"
                    />
                    <label htmlFor="file-upload" className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer">
                        Browse Files
                    </label>
                </div>
            )}

            {status === 'uploading' && <p>Uploading...</p>}
            {status === 'processing' && <p>Processing document...</p>}

            {status === 'error' && (
                <div className="text-red-600">
                    <p>Error: {error}</p>
                    <button
                        onClick={() => setStatus('idle')}
                        className="mt-2 px-3 py-1 border border-red-600 rounded hover:bg-red-50"
                    >
                        Try Again
                    </button>
                </div>
            )}
        </div>
    );
}
