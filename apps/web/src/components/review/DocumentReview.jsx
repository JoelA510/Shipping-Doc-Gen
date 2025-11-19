import React, { useState } from 'react';
import { api } from '../../services/api';
import EditableField from '../common/EditableField';

export default function DocumentReview({ document, onBack }) {
    const [doc, setDoc] = useState(document);
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [message, setMessage] = useState(null);

    const { header, lines, meta } = doc;
    const validationErrors = meta.validation || [];

    const handleHeaderChange = (field, value) => {
        setDoc(prev => ({
            ...prev,
            header: { ...prev.header, [field]: value }
        }));
    };

    const handleLineChange = (index, field, value) => {
        setDoc(prev => {
            const newLines = [...prev.lines];
            newLines[index] = { ...newLines[index], [field]: value };
            return { ...prev, lines: newLines };
        });
    };

    const handleSave = async () => {
        setIsSaving(true);
        setMessage(null);
        try {
            await api.updateDocument(doc.id, doc);
            setIsEditing(false);
            setMessage({ type: 'success', text: 'Document saved successfully' });
        } catch (err) {
            setMessage({ type: 'error', text: `Save failed: ${err.message}` });
        } finally {
            setIsSaving(false);
        }
    };

    const handleExport = async () => {
        setIsExporting(true);
        setMessage(null);
        try {
            await api.triggerExport(doc.id, 'sli');
            setMessage({ type: 'success', text: 'Export started. Check your email or download queue.' });
        } catch (err) {
            setMessage({ type: 'error', text: `Export failed: ${err.message}` });
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="document-review p-4">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Document Review</h2>
                <div className="flex gap-2">
                    {!isEditing ? (
                        <>
                            <button
                                onClick={() => setIsEditing(true)}
                                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                            >
                                Edit
                            </button>
                            <button
                                onClick={handleExport}
                                disabled={isExporting}
                                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                            >
                                {isExporting ? 'Exporting...' : 'Export SLI'}
                            </button>
                            <button onClick={onBack} className="px-4 py-2 text-gray-600 hover:text-gray-800">
                                Back
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                            >
                                {isSaving ? 'Saving...' : 'Save Changes'}
                            </button>
                            <button
                                onClick={() => { setIsEditing(false); setDoc(document); }}
                                className="px-4 py-2 text-gray-600 hover:text-gray-800"
                            >
                                Cancel
                            </button>
                        </>
                    )}
                </div>
            </div>

            {message && (
                <div className={`mb-6 p-4 rounded ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                    {message.text}
                </div>
            )}

            {validationErrors.length > 0 && (
                <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded">
                    <h3 className="font-bold text-yellow-800 mb-2">Validation Issues</h3>
                    <ul className="list-disc pl-5 text-yellow-700">
                        {validationErrors.map((err, i) => (
                            <li key={i}>
                                Line {err.lineIndex + 1}: {err.message} ({err.field}: {err.value})
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <div className="grid grid-cols-2 gap-6 mb-8">
                <div className="p-4 bg-white shadow rounded">
                    <h3 className="font-bold mb-2 text-gray-700">Header</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <EditableField
                            label="Shipper"
                            value={header.shipper}
                            isEditing={isEditing}
                            onChange={(val) => handleHeaderChange('shipper', val)}
                        />
                        <EditableField
                            label="Consignee"
                            value={header.consignee}
                            isEditing={isEditing}
                            onChange={(val) => handleHeaderChange('consignee', val)}
                        />
                        <EditableField
                            label="Incoterm"
                            value={header.incoterm}
                            isEditing={isEditing}
                            onChange={(val) => handleHeaderChange('incoterm', val)}
                        />
                        <EditableField
                            label="Currency"
                            value={header.currency}
                            isEditing={isEditing}
                            onChange={(val) => handleHeaderChange('currency', val)}
                        />
                    </div>
                </div>
            </div>

            <div className="bg-white shadow rounded overflow-hidden">
                <h3 className="font-bold p-4 border-b text-gray-700">Line Items</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 text-gray-500 text-sm">
                            <tr>
                                <th className="p-3">Part #</th>
                                <th className="p-3">Description</th>
                                <th className="p-3 text-right">Qty</th>
                                <th className="p-3 text-right">Weight (kg)</th>
                                <th className="p-3 text-right">Value (USD)</th>
                                <th className="p-3">HTS</th>
                                <th className="p-3">COO</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {lines.map((line, i) => (
                                <tr key={i} className="hover:bg-gray-50">
                                    <td className="p-3">
                                        <EditableField value={line.partNumber} isEditing={isEditing} onChange={(val) => handleLineChange(i, 'partNumber', val)} />
                                    </td>
                                    <td className="p-3">
                                        <EditableField value={line.description} isEditing={isEditing} onChange={(val) => handleLineChange(i, 'description', val)} />
                                    </td>
                                    <td className="p-3 text-right">
                                        <EditableField value={line.quantity} isEditing={isEditing} type="number" onChange={(val) => handleLineChange(i, 'quantity', val)} />
                                    </td>
                                    <td className="p-3 text-right">
                                        <EditableField value={line.netWeightKg} isEditing={isEditing} type="number" onChange={(val) => handleLineChange(i, 'netWeightKg', val)} />
                                    </td>
                                    <td className="p-3 text-right">
                                        <EditableField value={line.valueUsd} isEditing={isEditing} type="number" onChange={(val) => handleLineChange(i, 'valueUsd', val)} />
                                    </td>
                                    <td className="p-3">
                                        <EditableField value={line.htsCode} isEditing={isEditing} onChange={(val) => handleLineChange(i, 'htsCode', val)} />
                                    </td>
                                    <td className="p-3">
                                        <EditableField value={line.countryOfOrigin} isEditing={isEditing} onChange={(val) => handleLineChange(i, 'countryOfOrigin', val)} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
