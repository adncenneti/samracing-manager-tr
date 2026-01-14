
import React, { useState } from 'react';
import { X, Settings, Plus, Trash2, Save, Monitor, Clock, Type } from 'lucide-react';
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
  onUpdatePrefix
}) => {
  const [localGroups, setLocalGroups] = useState<SimulatorGroup[]>(groups);
  const [newGroupName, setNewGroupName] = useState('');
  const [activeTab, setActiveTab] = useState<'GROUPS' | 'GENERAL'>('GROUPS');

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

    try {
      await fetch(`${API_URL}/simulator_groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newGroup)
      });
      
      const updated = [...localGroups, newGroup];
      setLocalGroups(updated);
      onUpdateGroups(updated);
      setNewGroupName('');
    } catch (e) {
      console.error("Grup ekleme hatası", e);
    }
  };

  const handleDeleteGroup = async (id: string) => {
    if (!confirm('Bu tablo grubunu silmek istediğinize emin misiniz?')) return;
    
    try {
      await fetch(`${API_URL}/simulator_groups/${id}`, { method: 'DELETE' });
      const updated = localGroups.filter(g => g.id !== id);
      setLocalGroups(updated);
      onUpdateGroups(updated);
    } catch (e) {
      console.error("Grup silme hatası", e);
    }
  };

  const handleUpdateGroup = async (id: string, updates: Partial<SimulatorGroup>) => {
    const group = localGroups.find(g => g.id === id);
    if (!group) return;

    const updatedGroup = { ...group, ...updates };
    
    // Optimistic update
    const updatedList = localGroups.map(g => g.id === id ? updatedGroup : g);
    setLocalGroups(updatedList);

    try {
        await fetch(`${API_URL}/simulator_groups/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });
        onUpdateGroups(updatedList);
    } catch (e) {
        console.error("Güncelleme hatası", e);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-[110] flex items-center justify-center p-4 backdrop-blur-md">
      <div className="bg-sim-dark border border-sim-yellow rounded-xl w-[600px] h-[70vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-4 border-b border-sim-border flex items-center justify-between bg-sim-black/40">
           <h2 className="text-sim-yellow font-black uppercase text-xs tracking-widest flex items-center gap-2">
             <Settings size={16}/> Sistem Ayarları
           </h2>
           <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={20}/></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-sim-border bg-sim-black/20">
            <button 
                onClick={() => setActiveTab('GROUPS')}
                className={`flex-1 py-3 text-xs font-bold uppercase transition-colors ${activeTab === 'GROUPS' ? 'text-sim-yellow border-b-2 border-sim-yellow bg-sim-yellow/5' : 'text-gray-500 hover:text-gray-300'}`}
            >
                Tablo & Gruplar
            </button>
            <button 
                onClick={() => setActiveTab('GENERAL')}
                className={`flex-1 py-3 text-xs font-bold uppercase transition-colors ${activeTab === 'GENERAL' ? 'text-sim-yellow border-b-2 border-sim-yellow bg-sim-yellow/5' : 'text-gray-500 hover:text-gray-300'}`}
            >
                Genel Ayarlar
            </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-sim-black/20">
            
            {activeTab === 'GROUPS' && (
                <div className="space-y-6">
                    {/* Add New */}
                    <div className="flex gap-2 p-4 bg-sim-black border border-sim-border rounded-lg">
                        <input 
                            type="text" 
                            value={newGroupName}
                            onChange={(e) => setNewGroupName(e.target.value)}
                            placeholder="Yeni Tablo İsmi (Örn: Fanatec)"
                            className="flex-1 bg-sim-dark border border-sim-border rounded px-3 text-xs text-white focus:border-sim-yellow outline-none"
                        />
                        <button onClick={handleAddGroup} className="bg-sim-yellow text-black font-bold px-4 rounded text-xs uppercase flex items-center gap-2 hover:brightness-110">
                            <Plus size={14}/> Ekle
                        </button>
                    </div>

                    {/* List */}
                    <div className="space-y-3">
                        {localGroups.map((group) => (
                            <div key={group.id} className="bg-sim-black border border-sim-border rounded-lg p-4 flex items-center gap-4 group hover:border-sim-border/60 transition-colors">
                                <div className="p-3 bg-sim-dark rounded text-sim-yellow border border-sim-border">
                                    <Monitor size={20}/>
                                </div>
                                <div className="flex-1 space-y-2">
                                    <div className="flex items-center gap-2">
                                        <input 
                                            type="text" 
                                            value={group.name}
                                            onChange={(e) => handleUpdateGroup(group.id, { name: e.target.value })}
                                            className="bg-transparent text-sm font-black text-white uppercase border-b border-transparent focus:border-sim-yellow outline-none w-full"
                                        />
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-2 bg-sim-dark rounded px-2 py-1 border border-sim-border/50">
                                            <span className="text-[10px] text-gray-500 font-bold uppercase">Masa Sayısı</span>
                                            <input 
                                                type="number" 
                                                min="1" 
                                                max="20"
                                                value={group.seatCount}
                                                onChange={(e) => handleUpdateGroup(group.id, { seatCount: parseInt(e.target.value) || 1 })}
                                                className="w-12 bg-transparent text-center text-xs font-mono text-sim-yellow outline-none"
                                            />
                                        </div>
                                    </div>
                                </div>
                                <button onClick={() => handleDeleteGroup(group.id)} className="p-2 text-gray-600 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                                    <Trash2 size={18}/>
                                </button>
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
                                <div>
                                    <div className="text-xs font-black text-gray-300 uppercase">Kapanış Saati</div>
                                    <div className="text-[10px] text-gray-500">Takvimin son saati</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 bg-sim-dark rounded p-1 border border-sim-border">
                                <button onClick={() => onUpdateEndHour(Math.max(10, endHour - 1))} className="w-8 h-8 flex items-center justify-center hover:bg-sim-gray rounded text-gray-400 font-bold">-</button>
                                <span className="w-12 text-center text-sm font-mono text-sim-yellow font-bold">{endHour}:00</span>
                                <button onClick={() => onUpdateEndHour(endHour + 1)} className="w-8 h-8 flex items-center justify-center hover:bg-sim-gray rounded text-gray-400 font-bold">+</button>
                            </div>
                        </div>

                        <div className="h-px bg-sim-border/50"></div>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-sim-dark rounded text-gray-400"><Type size={18}/></div>
                                <div>
                                    <div className="text-xs font-black text-gray-300 uppercase">Masa Etiket Ön Eki</div>
                                    <div className="text-[10px] text-gray-500">Örn: M-1, S-1, T-1</div>
                                </div>
                            </div>
                            <div className="w-32">
                                <input 
                                    type="text" 
                                    value={seatLabelPrefix}
                                    onChange={(e) => onUpdatePrefix(e.target.value)}
                                    className="w-full bg-sim-dark border border-sim-border rounded p-2 text-center text-sm font-bold text-sim-yellow outline-none focus:border-sim-yellow"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
      </div>
    </div>
  );
};
