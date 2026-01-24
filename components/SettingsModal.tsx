
import React, { useState } from 'react';
import { X, Settings, Database, Trash2 } from 'lucide-react';
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
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen, onClose, groups, onUpdateGroups, endHour, onUpdateEndHour, 
  seatLabelPrefix, onUpdatePrefix, onCleanDay, onCleanMonth
}) => {
  const [activeTab, setActiveTab] = useState<'GROUPS' | 'GENERAL'>('GROUPS');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-[110] flex items-center justify-center p-4 backdrop-blur-md">
      <div className="bg-sim-dark border border-sim-yellow rounded-xl w-[600px] h-[600px] flex flex-col shadow-2xl overflow-hidden">
        
        <div className="p-4 border-b border-sim-border flex items-center justify-between bg-sim-black/40">
           <h2 className="text-sim-yellow font-black uppercase text-xs tracking-widest flex items-center gap-2">
             <Settings size={16}/> Sistem Ayarları
           </h2>
           <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={20}/></button>
        </div>

        <div className="flex border-b border-sim-border bg-sim-black/20">
            <button onClick={() => setActiveTab('GROUPS')} className={`flex-1 py-3 text-[10px] font-bold uppercase transition-colors ${activeTab === 'GROUPS' ? 'text-sim-yellow border-b-2 border-sim-yellow bg-sim-yellow/5' : 'text-gray-500 hover:text-gray-300'}`}>Gruplar</button>
            <button onClick={() => setActiveTab('GENERAL')} className={`flex-1 py-3 text-[10px] font-bold uppercase transition-colors ${activeTab === 'GENERAL' ? 'text-sim-yellow border-b-2 border-sim-yellow bg-sim-yellow/5' : 'text-gray-500 hover:text-gray-300'}`}>Genel & Temizlik</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-sim-black/20">
            {activeTab === 'GROUPS' && (
              <div className="space-y-4">
                 {groups.map((group, idx) => (
                    <div key={group.id} className="bg-sim-black border border-sim-border rounded-lg p-4 flex items-center justify-between">
                       <div className="space-y-1">
                          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Grup ID / İsim</div>
                          <div className="flex items-center gap-2">
                             <span className="bg-sim-dark px-2 py-1 rounded text-[10px] font-mono text-gray-400 border border-sim-border">{group.id}</span>
                             <input 
                               type="text" 
                               value={group.name}
                               onChange={(e) => {
                                  const newGroups = [...groups];
                                  newGroups[idx].name = e.target.value;
                                  onUpdateGroups(newGroups);
                               }}
                               className="bg-transparent border-b border-gray-700 focus:border-sim-yellow outline-none text-sm font-bold text-white w-32"
                             />
                          </div>
                       </div>
                       <div>
                          <label className="text-[9px] font-bold text-gray-500 uppercase block mb-1">Koltuk Adedi</label>
                          <input 
                            type="number" 
                            min="1" 
                            max="20"
                            value={group.seatCount}
                            onChange={(e) => {
                               const newGroups = [...groups];
                               newGroups[idx].seatCount = parseInt(e.target.value) || 0;
                               onUpdateGroups(newGroups);
                            }}
                            className="bg-sim-dark border border-sim-border text-sim-yellow font-mono text-center w-16 py-1 rounded focus:border-sim-yellow outline-none"
                          />
                       </div>
                    </div>
                 ))}
                 <div className="p-4 border-2 border-dashed border-sim-border rounded-lg flex flex-col items-center justify-center text-gray-600 gap-2 opacity-50 cursor-not-allowed">
                    <Database size={24}/>
                    <span className="text-[10px] font-bold uppercase">Yeni Grup Ekleme Devre Dışı</span>
                 </div>
              </div>
            )}
            
            {activeTab === 'GENERAL' && (
              <div className="space-y-6">
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

                 <div className="h-px bg-sim-border/50 my-4" />

                 <div className="space-y-4">
                     <button onClick={onCleanDay} className="w-full p-4 border border-red-900/50 bg-red-900/10 rounded-lg hover:bg-red-900/20 transition-all flex items-center justify-between group">
                        <div className="text-left">
                            <h4 className="text-red-500 font-bold text-xs uppercase">Bugünü Temizle</h4>
                            <p className="text-[10px] text-gray-500">Seçili gündeki tüm kayıtları siler.</p>
                        </div>
                        <Trash2 size={16} className="text-red-500 opacity-50 group-hover:opacity-100"/>
                     </button>
                 </div>
              </div>
            )}
        </div>
      </div>
    </div>
  );
};
