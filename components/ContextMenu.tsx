
import React, { useState } from 'react';
import { X, Settings, Plus, Trash2, Monitor, Clock, Type, Database, Palette, RefreshCw } from 'lucide-react';
import { SimulatorGroup } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  groups: SimulatorGroup[];
  onUpdateGroups: (groups: SimulatorGroup[]) => void;
  endHour: number;
  onUpdateEndHour: (hour: number) => void;
  seatLabelPrefix: string;
  onUpdatePrefix: (prefix: string) => void;
  onCleanDay: () => void;
  onCleanMonth: () => void;
  theme: any;
  onUpdateTheme: (theme: any) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen, onClose, groups, onUpdateGroups, endHour, onUpdateEndHour, 
  seatLabelPrefix, onUpdatePrefix, onCleanDay, onCleanMonth, theme, onUpdateTheme
}) => {
  const [activeTab, setActiveTab] = useState<'GROUPS' | 'GENERAL' | 'THEME' | 'CLEAN'>('GROUPS');

  if (!isOpen) return null;

  const handleResetTheme = () => {
    onUpdateTheme({
      border: '#333333',
      main: '#fbbf24',
      timeline: '#fbbf24',
      pastUnpaid: '#454545',
      pastPaid: '#064e3b',
      activeUnpaid: '#dc2626',
      activePaid: '#059669',
      futureUnpaid: '#1e1e1e',
      futurePaid: '#065f46',
      opacity: '0.8'
    });
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-[110] flex items-center justify-center p-4 backdrop-blur-md">
      <div className="bg-sim-dark border border-sim-yellow rounded-xl w-[700px] h-[80vh] flex flex-col shadow-2xl overflow-hidden">
        
        <div className="p-4 border-b border-sim-border flex items-center justify-between bg-sim-black/40">
           <h2 className="text-sim-yellow font-black uppercase text-xs tracking-widest flex items-center gap-2">
             <Settings size={16}/> Sistem Ayarları
           </h2>
           <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={20}/></button>
        </div>

        <div className="flex border-b border-sim-border bg-sim-black/20">
            {['GROUPS', 'GENERAL', 'THEME', 'CLEAN'].map((tab: any) => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 py-3 text-[10px] font-bold uppercase transition-colors ${activeTab === tab ? 'text-sim-yellow border-b-2 border-sim-yellow bg-sim-yellow/5' : 'text-gray-500 hover:text-gray-300'}`}>
                {tab === 'GROUPS' ? 'Gruplar' : tab === 'GENERAL' ? 'Genel' : tab === 'THEME' ? 'Görünüm' : 'Temizlik'}
              </button>
            ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-sim-black/20">
            {activeTab === 'THEME' && (
              <div className="space-y-6">
                 <div className="flex items-center justify-between">
                    <h3 className="text-white font-black text-xs uppercase flex items-center gap-2"><Palette size={14}/> Tema Ayarları</h3>
                    <button onClick={handleResetTheme} className="text-[10px] font-bold text-sim-yellow flex items-center gap-1 uppercase hover:underline"><RefreshCw size={10}/> Varsayılanlara Dön</button>
                 </div>

                 <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-4 bg-sim-black p-4 rounded-lg border border-sim-border">
                       <h4 className="text-[9px] font-black text-gray-500 uppercase border-b border-sim-border pb-1">Genel Yapı</h4>
                       {['main', 'border', 'timeline'].map(key => (
                         <div key={key} className="flex items-center justify-between">
                            <span className="text-[10px] text-gray-300 uppercase font-bold">{key === 'main' ? 'Ana Tema' : key === 'border' ? 'Hücre Kenarlığı' : 'Saat Perdesi'}</span>
                            <input type="color" value={theme[key]} onChange={(e) => onUpdateTheme({...theme, [key]: e.target.value})} className="bg-transparent border-0 w-8 h-8 cursor-pointer" />
                         </div>
                       ))}
                       <div className="pt-2">
                          <label className="text-[9px] text-gray-500 font-bold uppercase">Hücre Saydamlığı: {Math.round(theme.opacity * 100)}%</label>
                          <input type="range" min="0.1" max="1" step="0.1" value={theme.opacity} onChange={(e) => onUpdateTheme({...theme, opacity: e.target.value})} className="w-full h-1 bg-sim-dark rounded-lg appearance-none cursor-pointer accent-sim-yellow" />
                       </div>
                    </div>

                    <div className="space-y-4 bg-sim-black p-4 rounded-lg border border-sim-border">
                       <h4 className="text-[9px] font-black text-gray-500 uppercase border-b border-sim-border pb-1">Hücre Durumları</h4>
                       {['pastPaid', 'pastUnpaid', 'activePaid', 'activeUnpaid', 'futurePaid', 'futureUnpaid'].map(key => (
                         <div key={key} className="flex items-center justify-between">
                            <span className="text-[9px] text-gray-300 uppercase font-bold">
                               {key.includes('past') ? 'Geçmiş' : key.includes('active') ? 'Aktif' : 'Gelecek'} - {key.includes('Paid') ? 'Ödendi' : 'Ödenmedi'}
                            </span>
                            <input type="color" value={theme[key]} onChange={(e) => onUpdateTheme({...theme, [key]: e.target.value})} className="bg-transparent border-0 w-6 h-6 cursor-pointer" />
                         </div>
                       ))}
                    </div>
                 </div>
              </div>
            )}
            
            {/* Other tabs remain same logic but styled consistently */}
            {activeTab === 'GENERAL' && (
              <div className="space-y-4">
                 <div className="flex items-center justify-between p-4 bg-sim-black border border-sim-border rounded-lg">
                    <span className="text-xs font-bold text-gray-300 uppercase">Kapanış Saati</span>
                    <input type="number" value={endHour} onChange={(e) => onUpdateEndHour(parseInt(e.target.value))} className="bg-sim-dark border border-sim-border text-sim-yellow font-mono px-3 py-1 rounded w-16" />
                 </div>
                 <div className="flex items-center justify-between p-4 bg-sim-black border border-sim-border rounded-lg">
                    <span className="text-xs font-bold text-gray-300 uppercase">Koltuk Ön Eki</span>
                    <input type="text" value={seatLabelPrefix} onChange={(e) => onUpdatePrefix(e.target.value)} className="bg-sim-dark border border-sim-border text-sim-yellow font-bold px-3 py-1 rounded w-24" />
                 </div>
              </div>
            )}
            
            {activeTab === 'CLEAN' && (
              <div className="space-y-4">
                 <button onClick={onCleanDay} className="w-full p-6 border-2 border-dashed border-red-500/30 bg-red-500/5 rounded-xl hover:bg-red-500/10 transition-all text-left">
                    <h4 className="text-red-500 font-black text-sm uppercase">Bugünü Temizle</h4>
                    <p className="text-xs text-gray-500 uppercase font-bold">Sadece seçili takvim günündeki randevuları kalıcı olarak siler.</p>
                 </button>
                 <button onClick={onCleanMonth} className="w-full p-6 border-2 border-dashed border-red-900/30 bg-red-900/5 rounded-xl hover:bg-red-900/10 transition-all text-left">
                    <h4 className="text-red-900 font-black text-sm uppercase">Geçmişi Temizle</h4>
                    <p className="text-xs text-gray-500 uppercase font-bold">Mevcut aydaki bugün hariç geçmiş tüm kayıtları siler.</p>
                 </button>
              </div>
            )}
        </div>
      </div>
    </div>
  );
};
