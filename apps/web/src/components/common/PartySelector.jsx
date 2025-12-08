import React, { useState, useEffect } from 'react';
import { Search, Building, User, X } from 'lucide-react';
import { api } from '../../services/api';

export default function PartySelector({ isOpen, onClose, onSelect }) {
    const [parties, setParties] = useState([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');

    useEffect(() => {
        if (isOpen) {
            fetchParties();
        }
    }, [isOpen, search]);

    const fetchParties = async () => {
        try {
            setLoading(true);
            const res = await api.getParties(search);
            setParties(res.data || []);
        } catch (error) {
            console.error('Failed to fetch parties:', error);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
                <div className="p-4 border-b flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-slate-900">Select Address Book Party</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-4 border-b bg-slate-50">
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search by name, city, or country..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-10 w-full rounded-md border border-slate-300 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
                            autoFocus
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2">
                    {loading ? (
                        <div className="text-center py-8 text-slate-500">Loading...</div>
                    ) : parties.length === 0 ? (
                        <div className="text-center py-8 text-slate-500">No parties found.</div>
                    ) : (
                        <div className="space-y-2">
                            {parties.map(party => (
                                <button
                                    key={party.id}
                                    onClick={() => onSelect(party)}
                                    className="w-full text-left p-3 hover:bg-primary-50 rounded-lg border border-transparent hover:border-primary-100 transition-all group"
                                >
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="font-medium text-slate-900 flex items-center gap-2">
                                                <Building className="w-4 h-4 text-slate-400 group-hover:text-primary-500" />
                                                {party.name}
                                            </div>
                                            <div className="text-sm text-slate-500 ml-6">
                                                {party.addressLine1}, {party.city}, {party.countryCode}
                                            </div>
                                        </div>
                                        {party.contactName && (
                                            <div className="text-xs text-slate-400 flex items-center gap-1 bg-slate-100 px-2 py-1 rounded">
                                                <User className="w-3 h-3" />
                                                {party.contactName}
                                            </div>
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="p-3 border-t bg-slate-50 text-right text-xs text-slate-400">
                    {parties.length} available parties
                </div>
            </div>
        </div>
    );
}
