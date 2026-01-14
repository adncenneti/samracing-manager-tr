import React from 'react';
import { X, User, Phone, Clock, Monitor, Calendar } from 'lucide-react';
import { format } from 'date-fns';

interface InfoModalProps {
  data: any;
  onClose: () => void;
}

export const InfoModal: React.FC<InfoModalProps> = ({ data, onClose }) => {
  if (!data) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-sim-dark border border-sim-yellow rounded-lg w-[400px] shadow-2xl relative">
        <div className="flex justify-between items-center p-4 border-b border-sim-border bg-sim-black/50 rounded-t-lg">
           <h2 className="text-lg font-bold text-sim-yellow flex items-center gap-2">
             <Calendar size={18}/> Randevu Detayı
           </h2>
           <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
             <X size={20}/>
           </button>
        </div>
        <div className="p-6 space-y-5">
           <div className="space-y-1">
             <label className="text-xs text-gray-400 flex items-center gap-1 uppercase tracking-wider font-bold"><User size={12}/> İsim Soyisim</label>
             <div className="text-2xl font-black text-white tracking-wide uppercase">{data.name}</div>
           </div>
           
           <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                 <label className="text-xs text-gray-400 flex items-center gap-1 uppercase tracking-wider font-bold"><Phone size={12}/> Telefon</label>
                 <div className="text-lg font-mono text-sim-yellow font-bold">{data.phone}</div>
              </div>
              <div className="space-y-1">
                 <label className="text-xs text-gray-400 flex items-center gap-1 uppercase tracking-wider font-bold"><Clock size={12}/> Saat</label>
                 <div className="text-lg font-mono text-white font-bold">{data.startTime} - {data.endTime}</div>
              </div>
           </div>

           <div className="space-y-2">
              <label className="text-xs text-gray-400 flex items-center gap-1 uppercase tracking-wider font-bold"><Monitor size={12}/> Masalar</label>
              <div className="flex flex-wrap gap-2">
                 {data.seats.map((s: string) => (
                   <span key={s} className="px-3 py-1 bg-sim-gray border border-sim-border rounded text-sm font-bold text-gray-300 shadow-sm">
                     {s}
                   </span>
                 ))}
              </div>
           </div>
           
           <div className="pt-4 border-t border-sim-border text-xs text-gray-500 flex justify-between items-center">
              <span>Oluşturulma: {format(new Date(data.createdAt), 'HH:mm dd.MM.yyyy')}</span>
              <span className={`px-2 py-1 rounded border ${data.isPaid ? "bg-green-900/30 border-green-500 text-green-400" : "bg-red-900/30 border-red-500 text-red-400"} font-bold`}>
                {data.isPaid ? 'ÜCRET ALINDI' : 'ÜCRET ALINMADI'}
              </span>
           </div>
        </div>
      </div>
    </div>
  );
};