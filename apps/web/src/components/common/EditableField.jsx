import React, { useState, useEffect } from 'react';

export default function EditableField({
    value,
    isEditing,
    onChange,
    label,
    type = 'text',
    className = ''
}) {
    const [localValue, setLocalValue] = useState(value);

    useEffect(() => {
        setLocalValue(value);
    }, [value]);

    const handleChange = (e) => {
        const val = e.target.value;
        setLocalValue(val);
        if (onChange) {
            onChange(val);
        }
    };

    if (!isEditing) {
        return (
            <div className={className}>
                {label && <label className="block text-xs font-medium text-slate-500 mb-1 uppercase tracking-wider">{label}</label>}
                <div className="font-medium text-slate-900 min-h-[1.5rem] truncate" title={value}>
                    {value || <span className="text-slate-300 italic">Empty</span>}
                </div>
            </div>
        );
    }

    return (
        <div className={className}>
            {label && <label className="block text-xs font-medium text-slate-500 mb-1 uppercase tracking-wider">{label}</label>}
            <input
                type={type}
                value={localValue || ''}
                onChange={handleChange}
                className="input-field py-1.5 text-sm"
            />
        </div>
    );
}
