import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DocumentReview from './DocumentReview';
import { api } from '../../services/api';

export default function DocumentReviewPage({ user, onBack }) {
    const { id } = useParams();
    const navigate = useNavigate();
    const [document, setDocument] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (id) {
            fetchDocument(id);
        }
    }, [id]);

    const fetchDocument = async (docId) => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/documents/${docId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Failed to load document');
            const data = await res.json();
            setDocument(data);
        } catch (err) {
            console.error(err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="text-center py-12">Loading document...</div>;
    if (error) return <div className="text-center py-12 text-red-600">Error: {error}</div>;
    if (!document) return <div className="text-center py-12">Document not found</div>;

    return (
        <DocumentReview
            document={document}
            user={user}
            onBack={onBack}
        />
    );
}
