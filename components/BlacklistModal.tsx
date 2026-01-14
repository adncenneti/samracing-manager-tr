
import React, { useState } from 'react';
// Added 'Users' to imports
import { X, Trash2, Edit3, Save, Search, User, Phone, Info, Users } from 'lucide-react';
import { BlacklistEntry } from '../types';

const API_URL = 'http://localhost:3001';

interface BlacklistModalProps {
  isOpen: boolean;
  onClose: () => void;
  blacklist: BlacklistEntry[];
  onUpdate: () => void;
}

export const BlacklistModal: React.FC<BlacklistModalProps> = ({ isOpen, onClose, blacklist, onUpdate }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', phone: '', reason: '' });

  if (!isOpen) return null;

  const filtered = blacklist.filter(entry => 
    entry.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    entry.phone.includes(searchTerm)
  );

  const handleDelete = async (id: string) => {
    if (!confirm('Bu kişiyi kara listeden çıkarmak istediğinize emin misiniz?')) return;
    await fetch(`${API_URL}/blacklist/${id}`, { method: 'DELETE' });
    onUpdate();
  };

  const handleEdit = (entry: BlacklistEntry) => {
    setEditingId(entry.id || null);
    setEditForm({ name: entry.name || '', phone: entry.phone, reason: entry.reason });
  };

  const handleSave = async (id: string) => {
    await fetch(`${API_URL}/blacklist/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm)
    });
    setEditingId(null);
    onUpdate();
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-[110] flex items-center justify-center p-4 backdrop-blur-md">
      <div className="bg-sim-dark border border-sim-yellow rounded-xl w-[600px] h-[70vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="p-4 border-b border-sim-border flex items-center justify-between bg-sim-black/40">
           <h2 className="text-sim-yellow font-black uppercase text-xs tracking-widest flex items-center gap-2">
             <Users size={16}/> Kara Liste Yönetimi
           </h2>
           <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={20}/></button>
        </div>

        <div className="p-4 border-b border-sim-border">
          <div className="relative">
             <Search className="absolute left-3 top-2.5 text-gray-500" size={16}/>
             <input 
               type="text" 
               placeholder="İsim veya telefon ile ara..."
               value={searchTerm}
               onChange={e => setSearchTerm(e.target.value)}
               className="w-full bg-sim-black border border-sim-border rounded-lg pl-10 pr-4 py-2 text-xs text-white outline-none focus:border-sim-yellow transition-all"
             />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filtered.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-600 opacity-20">
               <Search size={48} />
               <p className="text-[10px] font-bold uppercase mt-2">Kayıt Bulunamadı</p>
            </div>
          ) : (
            filtered.map(entry => (
              <div key={entry.id} className="bg-sim-black border border-sim-border rounded-lg p-4 space-y-3">
                {editingId === entry.id ? (
                  <div className="space-y-2">
                    <input 
                      type="text" 
                      value={editForm.name} 
                      onChange={e => setEditForm({...editForm, name: e.target.value.toUpperCase()})}
                      className="w-full bg-sim-dark border border-sim-yellow/30 p-2 text-xs rounded"
                      placeholder="İSİM"
                    />
                    <input 
                      type="text" 
                      value={editForm.phone} 
                      onChange={e => setEditForm({...editForm, phone: e.target.value})}
                      className="w-full bg-sim-dark border border-sim-yellow/30 p-2 text-xs rounded"
                      placeholder="TELEFON"
                    />
                    <textarea 
                      value={editForm.reason} 
                      onChange={e => setEditForm({...editForm, reason: e.target.value})}
                      className="w-full bg-sim-dark border border-sim-yellow/30 p-2 text-xs rounded h-20"
                      placeholder="SEBEP"
                    />
                    <div className="flex gap-2">
                       <button onClick={() => handleSave(entry.id!)} className="flex-1 bg-sim-yellow text-black font-bold py-2 rounded text-[10px] uppercase">Kaydet</button>
                       <button onClick={() => setEditingId(null)} className="flex-1 bg-sim-gray text-white font-bold py-2 rounded text-[10px] uppercase">Vazgeç</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                         <span className="font-black text-white text-sm uppercase">{entry.name || 'İSİMSİZ'}</span>
                         <span className="text-sim-yellow font-mono text-xs">{entry.phone}</span>
                      </div>
                      <div className="text-red-500 text-xs italic bg-red-900/10 p-2 rounded border border-red-900/30">
                        "{entry.reason}"
                      </div>
                    </div>
                    <div className="flex gap-2">
                       <button onClick={() => handleEdit(entry)} className="p-2 text-gray-500 hover:text-sim-yellow transition-colors"><Edit3 size={16}/></button>
                       <button onClick={() => handleDelete(entry.id!)} className="p-2 text-gray-500 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
