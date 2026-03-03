import React from 'react';

interface ModeSelectorProps {
    label: string;
    value: string;
    onChange: (v: any) => void;
}

const ModeSelector: React.FC<ModeSelectorProps> = ({ label, value, onChange }) => (
    <div className="flex flex-col gap-2">
        <label className="text-[7px] lg:text-[8px] opacity-30 uppercase tracking-[0.2em] font-bold">{label}</label>
        <div className="flex gap-1 bg-black/40 p-1 border-2 border-white/10">
            {[{ id: 'fill', label: 'Stretch' }, { id: 'contain', label: 'Fit' }, { id: 'cover', label: 'Zoom' }, { id: 'center', label: 'Mid' }].map(mode => (
                <button
                    key={mode.id}
                    onClick={() => onChange(mode.id as any)}
                    className={`flex-1 py-2 text-[7px] font-bold uppercase tracking-widest transition-all active:scale-95 border-2 ${value === mode.id ? 'text-black' : 'border-transparent text-white/40 hover:text-white hover:border-white/20'}`}
                    style={{
                        backgroundColor: value === mode.id ? '#fff' : 'transparent',
                        borderColor: value === mode.id ? '#fff' : 'transparent'
                    }}
                >
                    {mode.label}
                </button>
            ))}
        </div>
    </div>
);

export default ModeSelector;
