import { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { FileJson, Loader, Eye, ArrowUpFromLine } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function ShipmentList() {
    const [shipments, setShipments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [importing, setImporting] = useState(false);



    // I will write this file assuming api.getShipments() exists, and then ensuring I add it.
    useEffect(() => {
        const fetchList = async () => {
            try {
                const data = await api.getShipments({ limit: 10 });
                setShipments(data.data || []);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchList();
    }, []);

    const handleExport = async (id) => {
        try {
            const blob = await api.exportShipment(id);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `shipment-${id}.json`;
            a.click();
        } catch (err) {
            alert('Export failed');
        }
    };

    const handleImportClick = () => {
        document.getElementById('json-import-input').click();
    };

    const handleImportFile = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setImporting(true);
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const json = JSON.parse(event.target.result);
                await api.importShipment(json);
                alert('Shipment imported successfully!');
                window.location.reload(); // Simple refresh
            } catch (err) {
                alert('Import failed: ' + err.message);
            } finally {
                setImporting(false);
            }
        };
        reader.readAsText(file);
    };

    if (loading) return <div className="p-8 text-center"><Loader className="w-8 h-8 animate-spin mx-auto text-slate-400" /></div>;

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                <h3 className="font-semibold text-slate-800">Recent Shipments</h3>
                <div className="flex gap-2">
                    <input
                        type="file"
                        id="json-import-input"
                        accept=".json"
                        className="hidden"
                        onChange={handleImportFile}
                    />
                    <button
                        onClick={handleImportClick}
                        disabled={importing}
                        className="btn-secondary text-sm flex items-center gap-2"
                    >
                        {importing ? <Loader className="w-3 h-3 animate-spin" /> : <ArrowUpFromLine className="w-3 h-3" />}
                        Import Backup
                    </button>
                    <Link to="/import" className="btn-primary text-sm flex items-center gap-2">
                        + New
                    </Link>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-500 bg-slate-50 uppercase border-b border-slate-200">
                        <tr>
                            <th className="px-4 py-3">ID</th>
                            <th className="px-4 py-3">Consignee</th>
                            <th className="px-4 py-3">Destination</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3">Date</th>
                            <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {shipments.length === 0 && (
                            <tr>
                                <td colSpan="6" className="px-4 py-8 text-center text-slate-400 italic">
                                    No shipments found. Import or create one!
                                </td>
                            </tr>
                        )}
                        {shipments.map(shipment => (
                            <tr key={shipment.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-4 py-3 font-mono text-xs text-slate-500">
                                    {shipment.id.substring(0, 8)}...
                                </td>
                                <td className="px-4 py-3 font-medium text-slate-900">
                                    {shipment.consignee?.name || 'Unknown User'}
                                </td>
                                <td className="px-4 py-3 text-slate-600">
                                    {shipment.destinationCountry}
                                </td>
                                <td className="px-4 py-3">
                                    <span className={`px-2 py-0.5 rounded text-xs font-medium 
                                        ${shipment.status === 'booked' ? 'bg-green-100 text-green-700' :
                                            shipment.status === 'draft' ? 'bg-slate-100 text-slate-700' : 'bg-blue-100 text-blue-700'}`}>
                                        {shipment.status || 'draft'}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-slate-500">
                                    {new Date(shipment.createdAt).toLocaleDateString()}
                                </td>
                                <td className="px-4 py-3 flex gap-2 justify-end">
                                    <button
                                        onClick={() => handleExport(shipment.id)}
                                        title="Export JSON Backup"
                                        className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-blue-600"
                                    >
                                        <FileJson className="w-4 h-4" />
                                    </button>
                                    <Link
                                        to={`/shipments/${shipment.id}`}
                                        className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-primary-600"
                                    >
                                        <Eye className="w-4 h-4" />
                                    </Link>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
