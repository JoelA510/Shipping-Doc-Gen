import React, { useState, useEffect } from 'react';
import { Save, ArrowLeft, Edit2, AlertTriangle, X, Plus, Trash2, BookmarkPlus } from 'lucide-react';
import { api, API_URL } from '../../services/api';
import EditableField from '../common/EditableField';
import Comments from './Comments';
import History from './History';

export default function DocumentReview({ document, onBack, user }) {
    const [doc, setDoc] = useState(document);
    const [isEditing, setIsEditing] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [message, setMessage] = useState(null);
    const [newRefType, setNewRefType] = useState('PO');
    const [newRefValue, setNewRefValue] = useState('');
    const [selectedTemplate, setSelectedTemplate] = useState('sli');

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

    const handleAddressChange = (type, field, value) => {
        setDoc(prev => ({
            ...prev,
            header: {
                ...prev.header,
                [type]: {
                    ...prev.header[type],
                    [field]: value
                }
            }
        }));
    };

    const handleAddReference = () => {
        if (!newRefValue) return;
        const newRef = { type: newRefType, value: newRefValue };
        const updatedDoc = {
            ...doc,
            references: [...(doc.references || []), newRef]
        };
        setDoc(updatedDoc);
        setNewRefValue('');
    };

    const handleRemoveReference = (index) => {
        const updatedRefs = [...(doc.references || [])];
        updatedRefs.splice(index, 1);
        setDoc({ ...doc, references: updatedRefs });
    };

    const AddressBlock = ({ title, data, isEditing, onChange }) => {
        // Fallback for legacy string data or null
        if (!data || typeof data !== 'object') {
            return (
                <EditableField
                    label={title}
                    value={data || ''}
                    isEditing={isEditing}
                    onChange={(v) => onChange('name', v)} // Treat string as name
                />
            );
        }

        return (
            <div className="space-y-3 border border-slate-200 p-4 rounded-lg bg-slate-50/50">
                <h4 className="font-medium text-slate-700 text-sm flex items-center gap-2">
                    {title}
                </h4>
                <div className="space-y-3">
                    <EditableField label="Name" value={data.name} isEditing={isEditing} onChange={(v) => onChange('name', v)} />
                    <EditableField label="Address" value={data.address} isEditing={isEditing} onChange={(v) => onChange('address', v)} />
                    <EditableField label="Address 2" value={data.address2} isEditing={isEditing} onChange={(v) => onChange('address2', v)} />
                    <div className="grid grid-cols-2 gap-3">
                        <EditableField label="City" value={data.city} isEditing={isEditing} onChange={(v) => onChange('city', v)} />
                        <EditableField label="State" value={data.state} isEditing={isEditing} onChange={(v) => onChange('state', v)} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <EditableField label="Zip" value={data.zip} isEditing={isEditing} onChange={(v) => onChange('zip', v)} />
                        <EditableField label="Country" value={data.country} isEditing={isEditing} onChange={(v) => onChange('country', v)} />
                    </div>
                </div>
            </div>
        );
    };

    const handleSaveAsTemplate = async () => {
        const templateName = prompt('Enter template name:');
        if (!templateName) return;

        const templateDescription = prompt('Enter description (optional):');

        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/templates', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: templateName,
                    description: templateDescription || '',
                    header: doc.header
                })
            });

            if (res.ok) {
                setMessage({ type: 'success', text: 'Template saved successfully' });
            } else {
                throw new Error('Failed to save template');
            }
        } catch (err) {
            setMessage({ type: 'error', text: `Template save failed: ${err.message}` });
        }
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
            const response = await api.triggerExport(doc.id, 'sli', selectedTemplate);

            if (response && response.url) {
                // Open URL in new window/tab - browser will handle the download
                const fullUrl = `${API_URL}${response.url}`;
                window.open(fullUrl, '_blank');
                setMessage({ type: 'success', text: 'Export complete. Download should begin shortly.' });
            } else {
                setMessage({ type: 'success', text: 'Export started. Check your email or download queue.' });
            }
        } catch (err) {
            console.error('Export failed:', err);
            setMessage({ type: 'error', text: `Export failed: ${err.message}` });
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Sticky Header Actions */}
            <div className="sticky top-20 z-40 bg-white/80 backdrop-blur-md border border-slate-200 shadow-sm rounded-xl p-4 flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors"
                        title="Back"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h2 className="text-lg font-bold text-slate-900">Review & Edit</h2>
                        <p className="text-xs text-slate-500">ID: {doc.id.slice(0, 8)}...</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {!isEditing ? (
                        <>
                            <button
                                onClick={() => setIsEditing(true)}
                                className="btn-secondary flex items-center gap-2"
                            >
                                <Edit2 className="w-4 h-4" />
                                Edit Mode
                            </button>
                            <button
                                onClick={handleSaveAsTemplate}
                                className="btn-secondary flex items-center gap-2 border-purple-300 text-purple-700 hover:bg-purple-50"
                            >
                                <BookmarkPlus className="w-4 h-4" />
                                Save as Template
                            </button>
                            <select
                                value={selectedTemplate}
                                onChange={(e) => setSelectedTemplate(e.target.value)}
                                className="border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200"
                            >
                                <option value="sli">Standard SLI</option>
                                <option value="nippon">Nippon Express</option>
                                <option value="ceva">CEVA Logistics</option>
                            </select>
                            <button
                                onClick={handleExport}
                                disabled={isExporting}
                                className="btn-primary flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-200"
                            >
                                {/* <Download className="w-4 h-4" /> */}
                                {isExporting ? 'Exporting...' : 'Export SLI'}
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={() => { setIsEditing(false); setDoc(document); }}
                                className="btn-secondary flex items-center gap-2"
                            >
                                <X className="w-4 h-4" />
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="btn-primary flex items-center gap-2"
                            >
                                <Save className="w-4 h-4" />
                                {isSaving ? 'Saving...' : 'Save Changes'}
                            </button>
                        </>
                    )}
                </div>
            </div>

            {message && (
                <div
                    className={`p-4 rounded-lg border ${message.type === 'success'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-red-50 border-red-200 text-red-800'
                        }`}
                >
                    {message.text}
                </div>
            )}

            {validationErrors.length > 0 && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2 text-amber-800 font-semibold">
                        <AlertTriangle className="w-5 h-5" />
                        <h3>Validation Issues</h3>
                    </div>
                    <ul className="list-disc pl-5 space-y-1 text-sm text-amber-700">
                        {validationErrors.map((err, i) => (
                            <li key={i}>
                                Line {err.lineIndex + 1}: {err.message} ({err.field}: {err.value})
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Header Section */}
                    <section className="card">
                        <h3 className="text-lg font-semibold text-slate-900 mb-4 pb-2 border-b border-slate-100">
                            Shipment Details
                        </h3>
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <AddressBlock
                                    title="Shipper"
                                    data={header.shipper}
                                    isEditing={isEditing}
                                    onChange={(field, val) => handleAddressChange('shipper', field, val)}
                                />
                                <AddressBlock
                                    title="Consignee"
                                    data={header.consignee}
                                    isEditing={isEditing}
                                    onChange={(field, val) => handleAddressChange('consignee', field, val)}
                                />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                    </section>

                    {/* References Section */}
                    <section className="card">
                        <h3 className="text-lg font-semibold text-slate-900 mb-4 pb-2 border-b border-slate-100">
                            References
                        </h3>

                        <div className="space-y-3 mb-4">
                            {(doc.references || []).map((ref, idx) => (
                                <div key={idx} className="flex items-center gap-2 p-2 bg-slate-50 rounded border border-slate-100">
                                    <span className="font-medium text-slate-700 w-24">{ref.type}:</span>
                                    <span className="flex-1 text-slate-900">{ref.value}</span>
                                    {isEditing && (
                                        <button
                                            onClick={() => handleRemoveReference(idx)}
                                            className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded"
                                            title="Remove reference"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>
                            ))}
                            {(!doc.references || doc.references.length === 0) && (
                                <div className="text-slate-400 italic text-sm">No references added</div>
                            )}
                        </div>

                        {/* Add Form */}
                        {isEditing && (doc.references || []).length < 5 && (
                            <div className="flex gap-3 items-end border-t border-slate-100 pt-4 mt-4">
                                <div className="w-32">
                                    <label className="block text-xs font-medium text-slate-500 mb-1">Type</label>
                                    <select
                                        value={newRefType}
                                        onChange={(e) => setNewRefType(e.target.value)}
                                        className="input-field py-1.5 text-sm"
                                    >
                                        <option value="PO">PO</option>
                                        <option value="SO">SO</option>
                                        <option value="Invoice">Invoice</option>
                                        <option value="Shipment">Shipment</option>
                                        <option value="HAWB">HAWB</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                                <div className="flex-1">
                                    <label className="block text-xs font-medium text-slate-500 mb-1">Value</label>
                                    <input
                                        type="text"
                                        value={newRefValue}
                                        onChange={(e) => setNewRefValue(e.target.value)}
                                        className="input-field py-1.5 text-sm"
                                        placeholder="Enter number"
                                    />
                                </div>
                                <button
                                    onClick={handleAddReference}
                                    className="btn-secondary py-1.5 px-3 flex items-center gap-1 text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                                >
                                    <Plus size={16} /> Add
                                </button>
                            </div>
                        )}
                    </section>

                    {/* Line Items Section */}
                    <section className="card overflow-hidden p-0">
                        <div className="p-6 border-b border-slate-100">
                            <h3 className="text-lg font-semibold text-slate-900">Line Items</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 text-slate-500 font-medium">
                                    <tr>
                                        <th className="p-4">Part #</th>
                                        <th className="p-4">Description</th>
                                        <th className="p-4 text-right">Qty</th>
                                        <th className="p-4 text-right">Weight (kg)</th>
                                        <th className="p-4 text-right">Value (USD)</th>
                                        <th className="p-4">HTS</th>
                                        <th className="p-4">COO</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {lines.map((line, i) => (
                                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                                            <td className="p-4">
                                                <EditableField value={line.partNumber} isEditing={isEditing} onChange={(val) => handleLineChange(i, 'partNumber', val)} />
                                            </td>
                                            <td className="p-4">
                                                <EditableField value={line.description} isEditing={isEditing} onChange={(val) => handleLineChange(i, 'description', val)} />
                                            </td>
                                            <td className="p-4 text-right">
                                                <EditableField value={line.quantity} isEditing={isEditing} type="number" onChange={(val) => handleLineChange(i, 'quantity', val)} />
                                            </td>
                                            <td className="p-4 text-right">
                                                <EditableField value={line.netWeightKg} isEditing={isEditing} type="number" onChange={(val) => handleLineChange(i, 'netWeightKg', val)} />
                                            </td>
                                            <td className="p-4 text-right">
                                                <EditableField value={line.valueUsd} isEditing={isEditing} type="number" onChange={(val) => handleLineChange(i, 'valueUsd', val)} />
                                            </td>
                                            <td className="p-4">
                                                <EditableField value={line.htsCode} isEditing={isEditing} onChange={(val) => handleLineChange(i, 'htsCode', val)} />
                                            </td>
                                            <td className="p-4">
                                                <EditableField value={line.countryOfOrigin} isEditing={isEditing} onChange={(val) => handleLineChange(i, 'countryOfOrigin', val)} />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    <Comments documentId={doc.id} user={user} />
                    <History documentId={doc.id} />
                </div>
            </div>
        </div>
    );
}
