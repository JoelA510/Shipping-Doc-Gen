import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Save, Download, ArrowLeft, Edit2, AlertTriangle, Clock, MessageSquare, Send, X } from 'lucide-react';
import { api } from '../../services/api';
import EditableField from '../common/EditableField';

export default function DocumentReview({ document, onBack, user }) {
    const [doc, setDoc] = useState(document);
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [message, setMessage] = useState(null);
    const [history, setHistory] = useState([]);
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState('');

    useEffect(() => {
        if (doc.id) {
            loadHistoryAndComments();
        }
    }, [doc.id]);

    const loadHistoryAndComments = async () => {
        try {
            const [h, c] = await Promise.all([
                api.getHistory(doc.id),
                api.getComments(doc.id)
            ]);
            setHistory(h);
            setComments(c);
        } catch (err) {
            console.error('Failed to load history/comments', err);
        }
    };

    const handleAddComment = async (e) => {
        e.preventDefault();
        if (!newComment.trim()) return;
        try {
            await api.addComment(doc.id, newComment, user.username);
            setNewComment('');
            loadHistoryAndComments();
        } catch (err) {
            setMessage({ type: 'error', text: `Failed to add comment: ${err.message}` });
        }
    };

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
                                onClick={handleExport}
                                disabled={isExporting}
                                className="btn-primary flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-200"
                            >
                                <Download className="w-4 h-4" />
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
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-4 rounded-lg border ${message.type === 'success'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : 'bg-red-50 border-red-200 text-red-800'
                        }`}
                >
                    {message.text}
                </motion.div>
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
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                    {/* History */}
                    <section className="card">
                        <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
                            <Clock className="w-4 h-4 text-slate-400" />
                            <h3 className="font-semibold text-slate-900">History</h3>
                        </div>
                        <div className="max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                            {history.length === 0 ? (
                                <p className="text-slate-400 text-sm italic">No history yet.</p>
                            ) : (
                                <ul className="space-y-3">
                                    {history.map((item, i) => (
                                        <li key={i} className="text-sm relative pl-4 border-l-2 border-slate-200">
                                            <div className="flex justify-between items-start">
                                                <span className="font-medium text-slate-700">{item.user}</span>
                                                <span className="text-xs text-slate-400">{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                            <p className="text-slate-500 text-xs mt-0.5">{item.action}</p>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </section>

                    {/* Comments */}
                    <section className="card flex flex-col h-[400px]">
                        <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
                            <MessageSquare className="w-4 h-4 text-slate-400" />
                            <h3 className="font-semibold text-slate-900">Comments</h3>
                        </div>

                        <div className="flex-1 overflow-y-auto mb-4 pr-2 space-y-3 custom-scrollbar">
                            {comments.length === 0 ? (
                                <div className="h-full flex items-center justify-center text-slate-400 text-sm italic">
                                    No comments yet.
                                </div>
                            ) : (
                                comments.map((comment) => (
                                    <div key={comment.id} className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="font-semibold text-xs text-primary-700">{comment.user}</span>
                                            <span className="text-[10px] text-slate-400">{new Date(comment.timestamp).toLocaleDateString()}</span>
                                        </div>
                                        <p className="text-sm text-slate-600">{comment.text}</p>
                                    </div>
                                ))
                            )}
                        </div>

                        <form onSubmit={handleAddComment} className="relative">
                            <input
                                type="text"
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                placeholder="Add a comment..."
                                className="input-field pr-10"
                            />
                            <button
                                type="submit"
                                disabled={!newComment.trim()}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-primary-600 hover:bg-primary-50 rounded-md disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
                            >
                                <Send className="w-4 h-4" />
                            </button>
                        </form>
                    </section>
                </div>
            </div>
        </div>
    );
}
