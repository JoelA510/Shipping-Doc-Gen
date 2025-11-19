import React from 'react';

export default function DocumentReview({ document, onBack }) {
    const { header, lines, meta } = document;
    const validationErrors = meta.validation || [];

    return (
        <div className="document-review p-4">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Document Review</h2>
                <button onClick={onBack} className="px-4 py-2 text-gray-600 hover:text-gray-800">
                    Back to Upload
                </button>
            </div>

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
                        <div>
                            <label className="block text-xs text-gray-500">Shipper</label>
                            <div className="font-medium">{header.shipper}</div>
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500">Consignee</label>
                            <div className="font-medium">{header.consignee}</div>
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500">Incoterm</label>
                            <div className="font-medium">{header.incoterm}</div>
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500">Currency</label>
                            <div className="font-medium">{header.currency}</div>
                        </div>
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
                                    <td className="p-3">{line.partNumber}</td>
                                    <td className="p-3">{line.description}</td>
                                    <td className="p-3 text-right">{line.quantity}</td>
                                    <td className="p-3 text-right">{line.netWeightKg}</td>
                                    <td className="p-3 text-right">{line.valueUsd}</td>
                                    <td className="p-3">{line.htsCode}</td>
                                    <td className="p-3">{line.countryOfOrigin}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
