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
                {label && <label className="block text-xs text-gray-500">{label}</label>}
                <div className="font-medium min-h-[1.5rem]">{value || '-'}</div>
            </div>
        );
    }

    return (
        <div className={className}>
            {label && <label className="block text-xs text-gray-500 mb-1">{label}</label>}
            <input
                type={type}
                value={localValue || ''}
                onChange={handleChange}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
        </div>
    );
}
