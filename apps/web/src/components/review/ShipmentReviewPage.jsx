import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DocumentReview from './DocumentReview';
import { api } from '../../services/api';

export default function ShipmentReviewPage({ user, onBack }) {
    const { id } = useParams();
    const navigate = useNavigate();
    const [document, setDocument] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (id) {
            fetchShipment(id);
        }
    }, [id]);

    const fetchShipment = async (shipmentId) => {
        try {
            // 1. Fetch Shipment Data
            const shipment = await api.getShipment(shipmentId);

            // 2. Fetch Validation Data
            const validation = await api.getValidation(shipmentId);

            // 3. Adapt ShipmentV1 to DocumentReview shape
            // DocumentReview expects: { header: {...}, lines: [...], meta: { validation: [] } }

            const adapter = (s) => {
                const head = {
                    ...s,
                    shipper: s.shipperSnapshot ? JSON.parse(s.shipperSnapshot) : undefined,
                    consignee: s.consigneeSnapshot ? JSON.parse(s.consigneeSnapshot) : undefined,
                    forwarder: s.forwarderSnapshot ? JSON.parse(s.forwarderSnapshot) : undefined,
                    broker: s.brokerSnapshot ? JSON.parse(s.brokerSnapshot) : undefined,
                };

                // Map lineItems to lines and ensure numeric types
                const lines = (s.lineItems || []).map(l => ({
                    ...l,
                    valueUsd: l.unitValue // Mapping unitValue to valueUsd for UI
                }));

                return {
                    id: s.id,
                    header: head,
                    lines: lines,
                    meta: {
                        validation: validation.issues?.map((issue, idx) => ({
                            lineIndex: -1, // TODO: Parse path to get line index if possible
                            message: issue.message,
                            field: issue.path || issue.code,
                            value: issue.severity
                        })) || []
                    },
                    references: [] // TODO: Map references if stored on shipment
                };
            };

            setDocument(adapter(shipment));
        } catch (err) {
            console.error(err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="text-center py-12">Loading shipment...</div>;
    if (error) return <div className="text-center py-12 text-red-600">Error: {error}</div>;
    if (!document) return <div className="text-center py-12">Shipment not found</div>;

    return (
        <DocumentReview
            document={document}
            user={user}
            onBack={() => navigate('/import')} // Or history
        />
    );
}
