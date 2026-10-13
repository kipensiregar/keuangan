import React from 'react';
import { Tent } from 'lucide-react';
import { useApp } from '../../context/AppContext';

/** Shared event filter; choices always come from the saved Bazar Event master. */
export const BazarEventSelector: React.FC = () => {
  const { selectedStoreId, bazarEvents, selectedBazarEventId, setSelectedBazarEventId } = useApp();
  if (selectedStoreId !== 'store_bazar') return null;
  return (
    <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 flex flex-col sm:flex-row sm:items-center gap-2 text-xs">
      <div className="flex items-center gap-2 font-semibold text-amber-900"><Tent className="w-4 h-4 text-[#800020]" /> Pilih Event Bazar:</div>
      <select value={selectedBazarEventId} onChange={(e) => setSelectedBazarEventId(e.target.value)} className="flex-1 min-w-0 px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs font-bold text-slate-900">
        <option value="">Semua Event Bazar</option>
        {bazarEvents.map((event) => <option key={event.id} value={event.id}>{event.name} ({event.startDate})</option>)}
      </select>
    </div>
  );
};
