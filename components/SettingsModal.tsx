
import React, { useState } from 'react';
import { X, Settings, Plus, Trash2, Save, Monitor, Clock, Type, Database } from 'lucide-react';
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

const API_URL = 'http://localhost:3001';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  groups,
  onUpdateGroups,
  endHour,
  onUpdateEndHour,
  seatLabelPrefix,
  onUpdatePrefix,
  onCleanDay,
  onCleanMonth
}) => {
  const [localGroups, setLocalGroups] = useState<SimulatorGroup[]>(groups);
  const [newGroupName, setNewGroupName] = useState('');
  const [activeTab, setActiveTab] = useState<'GROUPS' | 'GENERAL' | 'CLEAN'>('GROUPS');

  React.useEffect(() => {
    setLocalGroups(groups);
  }, [groups]);

  if (!isOpen) return null;

  const handleAddGroup = async () => {
    if (!newGroupName.trim()) return;
    const newId = newGroupName.toUpperCase().replace(/\s+/g, '_');
    const newGroup: SimulatorGroup = {
      id: newId,
      name: newGroupName,
      seatCount: 4,
      order: localGroups.length
    };
    const updated = [...localGroups, newGroup];
    setLocalGroups(updated);
    onUpdateGroups(updated);
    setNewGroupName('');
  };

  const handleDeleteGroup = async (id: string) => {
    if (!confirm('Bu tablo grubunu silmek istediğinize emin misiniz?')) return;
    const updated = localGroups.filter(g => g.id !== id);
    setLocalGroups(updated);
    onUpdateGroups(updated);
  };

  const handleUpdateGroup = (id: string, updates: Partial<SimulatorGroup>) => {
    const updatedList = localGroups.map(g => g.id === id ? { ...g, ...updates } : g);
    setLocalGroups(updatedList);
    onUpdateGroups(updatedList);
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-[110] flex items-center justify-center p-4 backdrop-blur-md">
      <div className="bg-sim-dark border border-sim-yellow rounded-xl w-[600px] h-[70vh] flex flex-col shadow-2xl overflow-hidden">
        
        <div className="p-4 border-b border-sim-border flex items-center justify-between bg-sim-black/40">
           <h2 className="text-sim-yellow font-black uppercase text-xs tracking-widest flex items-center gap-2">
             <Settings size={16}/> Sistem Ayarları
           </h2>
           <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={20}/></button>
        </div>

        <div className="flex border-b border-sim-border bg-sim-black/20">
            <button 
                onClick={() => setActiveTab('GROUPS')}
                className={`flex-1 py-3 text-[10px] font-bold uppercase transition-colors ${activeTab === 'GROUPS' ? 'text-sim-yellow border-b-2 border-sim-yellow bg-sim-yellow/5' : 'text-gray-500 hover:text-gray-300'}`}
            >
                Tablo & Gruplar
            </button>
            <button 
                onClick={() => setActiveTab('GENERAL')}
                className={`flex-1 py-3 text-[10px] font-bold uppercase transition-colors ${activeTab === 'GENERAL' ? 'text-sim-yellow border-b-2 border-sim-yellow bg-sim-yellow/5' : 'text-gray-500 hover:text-gray-300'}`}
            >
                Genel Ayarlar
            </button>
            <button 
                onClick={() => setActiveTab('CLEAN')}
                className={`flex-1 py-3 text-[10px] font-bold uppercase transition-colors ${activeTab === 'CLEAN' ? 'text-red-500 border-b-2 border-red-500 bg-red-500/5' : 'text-gray-500 hover:text-gray-300'}`}
            >
                Veri Temizliği
            </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-sim-black/20">
            {activeTab === 'GROUPS' && (
                <div className="space-y-6">
                    <div className="flex gap-2 p-4 bg-sim-black border border-sim-border rounded-lg">
                        <input 
                            type="text" 
                            value={newGroupName}
                            onChange={(e) => setNewGroupName(e.target.value)}
                            placeholder="Yeni Tablo İsmi"
                            className="flex-1 bg-sim-dark border border-sim-border rounded px-3 text-xs text-white focus:border-sim-yellow outline-none"
                        />
                        <button onClick={handleAddGroup} className="bg-sim-yellow text-black font-bold px-4 rounded text-xs uppercase flex items-center gap-2 hover:brightness-110 transition-all">
                            <Plus size={14}/> Ekle
                        </button>
                    </div>
                    <div className="space-y-3">
                        {localGroups.map((group) => (
                            <div key={group.id} className="bg-sim-black border border-sim-border rounded-lg p-4 flex items-center gap-4 group hover:border-sim-border/60 transition-colors">
                                <div className="p-3 bg-sim-dark rounded text-sim-yellow border border-sim-border"><Monitor size={20}/></div>
                                <div className="flex-1 space-y-2">
                                    <input 
                                        type="text" 
                                        value={group.name}
                                        onChange={(e) => handleUpdateGroup(group.id, { name: e.target.value })}
                                        className="bg-transparent text-sm font-black text-white uppercase border-b border-transparent focus:border-sim-yellow outline-none w-full"
                                    />
                                    <div className="flex items-center gap-2 bg-sim-dark rounded px-2 py-1 border border-sim-border/50 w-fit">
                                        <span className="text-[10px] text-gray-500 font-bold uppercase">Masa Sayısı</span>
                                        <input 
                                            type="number" 
                                            value={group.seatCount}
                                            onChange={(e) => handleUpdateGroup(group.id, { seatCount: parseInt(e.target.value) || 1 })}
                                            className="w-12 bg-transparent text-center text-xs font-mono text-sim-yellow outline-none"
                                        />
                                    </div>
                                </div>
                                <button onClick={() => handleDeleteGroup(group.id)} className="p-2 text-gray-600 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"><Trash2 size={18}/></button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {activeTab === 'GENERAL' && (
                <div className="space-y-6">
                    <div className="bg-sim-black border border-sim-border rounded-lg p-4 space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-sim-dark rounded text-gray-400"><Clock size={18}/></div>
                                <div><div className="text-xs font-black text-gray-300 uppercase">Kapanış Saati</div></div>
                            </div>
                            <div className="flex items-center gap-2 bg-sim-dark rounded p-1 border border-sim-border">
                                <button onClick={() => onUpdateEndHour(Math.max(10, endHour - 1))} className="w-8 h-8 flex items-center justify-center hover:bg-sim-gray rounded text-gray-400 font-bold">-</button>
                                <span className="w-12 text-center text-sm font-mono text-sim-yellow font-bold">{endHour}:00</span>
                                <button onClick={() => onUpdateEndHour(endHour + 1)} className="w-8 h-8 flex items-center justify-center hover:bg-sim-gray rounded text-gray-400 font-bold">+</button>
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-sim-dark rounded text-gray-400"><Type size={18}/></div>
                                <div><div className="text-xs font-black text-gray-300 uppercase">Masa Etiket Ön Eki</div></div>
                            </div>
                            <input 
                                type="text" 
                                value={seatLabelPrefix}
                                onChange={(e) => onUpdatePrefix(e.target.value)}
                                className="w-24 bg-sim-dark border border-sim-border rounded p-2 text-center text-sm font-bold text-sim-yellow outline-none"
                            />
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'CLEAN' && (
                <div className="space-y-4">
                    <div className="p-4 bg-red-900/10 border border-red-900/30 rounded-lg">
                        <h3 className="text-red-500 font-black text-xs uppercase mb-1 flex items-center gap-2"><Database size={14}/> Veri Temizleme</h3>
                        <p className="text-[10px] text-gray-500 uppercase font-bold mb-4">Bu işlemler kalıcıdır ve geri alınamaz.</p>
                        
                        <div className="space-y-3">
                            <button 
                                onClick={onCleanDay}
                                className="w-full flex items-center justify-between p-4 bg-sim-dark border border-sim-border rounded-lg hover:border-red-500 transition-all group"
                            >
                                <div className="text-left">
                                    <div className="text-[10px] font-black text-white uppercase">Günlük Temizlik</div>
                                    <div className="text-[9px] text-gray-500 uppercase">Seçili gündeki tüm kayıtları siler</div>
                                </div>
                                <Trash2 size={16} className="text-gray-600 group-hover:text-red-500 transition-colors"/>
                            </button>

                            <button 
                                onClick={onCleanMonth}
                                className="w-full flex items-center justify-between p-4 bg-sim-dark border border-sim-border rounded-lg hover:border-red-500 transition-all group"
                            >
                                <div className="text-left">
                                    <div className="text-[10px] font-black text-white uppercase">Aylık Temizlik</div>
                                    <div className="text-[9px] text-gray-500 uppercase">Geçmiş ay verilerini siler (Bugün hariç)</div>
                                </div>
                                <Trash2 size={16} className="text-gray-600 group-hover:text-red-500 transition-colors"/>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};
