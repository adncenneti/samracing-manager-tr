
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { format, addDays, isSameDay } from 'date-fns';
import { tr } from 'date-fns/locale';
import { 
  Calendar, ChevronLeft, ChevronRight, Plus, Trash, Save, Edit3, 
  MousePointer2, FileSpreadsheet, AlertOctagon, Clock, Coins, Ban, 
  Users, Image as ImageIcon, MousePointerSquareDashed, Settings, 
  Minus, Repeat, CheckCircle2, UserPlus, LogOut, Lock, Mail, Loader2 
} from 'lucide-react';
import { Reservation, SimulatorType, Seat, ContextMenuState, BlacklistEntry, SimulatorGroup } from './types';
import { generateSeats, checkOverlap, getGridPosition, START_HOUR, DEFAULT_END_HOUR, timeToMinutes, minutesToTime, formatPhoneNumber } from './utils';
import { ReservationModal } from './components/ReservationModal';
import { ContextMenu } from './components/ContextMenu';
import { BlacklistModal } from './components/BlacklistModal';
import { SettingsModal } from './components/SettingsModal';
import { InfoModal } from './components/InfoModal';
import { supabase } from './supabaseClient';
import * as XLSX from 'xlsx';

const SCREENSAVER_TIMEOUT = 10 * 60 * 1000;
const HOUR_HEIGHT = 60;
const HEADER_HEIGHT = 40;

const DEFAULT_GROUPS: SimulatorGroup[] = [
    { id: 'LOGITECH', name: 'Logitech G29', seatCount: 8, order: 0 },
    { id: 'MOZA', name: 'Moza R5', seatCount: 8, order: 1 }
];

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showScreensaver, setShowScreensaver] = useState(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [now, setNow] = useState(new Date());
  
  const [simulatorGroups, setSimulatorGroups] = useState<SimulatorGroup[]>([]);
  const [view, setView] = useState<string>('LOGITECH');
  
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [blacklist, setBlacklist] = useState<BlacklistEntry[]>([]);
  const [seatLabelPrefix, setSeatLabelPrefix] = useState('S-');
  const [endHour, setEndHour] = useState(DEFAULT_END_HOUR);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBlacklistOpen, setIsBlacklistOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  
  const [infoData, setInfoData] = useState<any>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0 });
  const [alertData, setAlertData] = useState<{isOpen: boolean, name: string, phone: string, reason: string} | null>(null);
  const [pendingReservationData, setPendingReservationData] = useState<any>(null);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [draggedResId, setDraggedResId] = useState<string | null>(null);
  const [dragTarget, setDragTarget] = useState<{ seatId: string, startTime: string, endTime: string, isValid: boolean } | null>(null);
  
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);
  const [isGroupMode, setIsGroupMode] = useState(false);

  const dateInputRef = useRef<HTMLInputElement>(null);
  const dateStr = format(currentDate, 'yyyy-MM-dd');
  const [editForm, setEditForm] = useState({ name: '', phone: '', startTime: '', endTime: '', isPaid: false, seatId: '' });
  const [activeEditingIds, setActiveEditingIds] = useState<string[]>([]);

  // Auth Listener
  useEffect(() => {
    // FIX: Using supabase.auth.getSession() which is the correct property path
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    // FIX: Using supabase.auth.onAuthStateChange()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const mapReservation = useCallback((r: any): Reservation => ({
    id: r.id,
    groupId: r.group_id,
    seatId: r.seat_id,
    name: r.name,
    phone: r.phone,
    startTime: r.start_time,
    endTime: r.end_time,
    isPaid: r.is_paid,
    createdAt: Number(r.created_at),
    date: r.date
  }), []);

  const mapBlacklist = useCallback((b: any): BlacklistEntry => ({
    id: b.id,
    phone: b.phone,
    reason: b.reason,
    name: b.name,
    addedAt: Number(b.added_at)
  }), []);

  const fetchData = useCallback(async () => {
    if (!session) return;
    try {
      const [resResponse, blResponse, groupsResponse] = await Promise.all([
        supabase.from('reservations').select('*'),
        supabase.from('blacklist').select('*'),
        supabase.from('simulator_groups').select('*').order('order', { ascending: true })
      ]);

      if (resResponse.data) setReservations(resResponse.data.map(mapReservation));
      if (blResponse.data) setBlacklist(blResponse.data.map(mapBlacklist));
      
      if (groupsResponse.data && groupsResponse.data.length > 0) {
        setSimulatorGroups(groupsResponse.data);
      } else if (simulatorGroups.length === 0) {
        setSimulatorGroups(DEFAULT_GROUPS);
      }
    } catch (error) {
      console.error("Data fetch error:", error);
    }
  }, [session, mapReservation, mapBlacklist, simulatorGroups.length]);

  // Realtime Subscriptions
  useEffect(() => {
    if (!session) return;
    
    fetchData();

    const resChannel = supabase.channel('realtime-reservations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, () => {
          fetchData();
      })
      .subscribe();

    const blChannel = supabase.channel('realtime-blacklist')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'blacklist' }, () => {
          fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(resChannel);
      supabase.removeChannel(blChannel);
    };
  }, [session, fetchData]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.ctrlKey || e.metaKey) setIsCtrlPressed(true); };
    const handleKeyUp = (e: KeyboardEvent) => { if (!e.ctrlKey && !e.metaKey) setIsCtrlPressed(false); };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Update logic for current time indicator
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedIds.length === 0) {
      setEditForm({ name: '', phone: '', startTime: '', endTime: '', isPaid: false, seatId: '' });
      setActiveEditingIds([]);
      setIsGroupMode(false);
      return;
    }
    
    if (selectedIds.length > 1) {
        setIsGroupMode(true);
    } else if (selectedIds.length === 1 && !activeEditingIds.includes(selectedIds[0])) {
        setIsGroupMode(false);
    }
    
    if (JSON.stringify(selectedIds) !== JSON.stringify(activeEditingIds)) {
      const firstRes = reservations.find(r => r.id === selectedIds[0]);
      if (firstRes) {
        const isSameName = selectedIds.every(id => reservations.find(r => r.id === id)?.name === firstRes.name);
        const isSamePhone = selectedIds.every(id => reservations.find(r => r.id === id)?.phone === firstRes.phone);
        const isSamePaid = selectedIds.every(id => reservations.find(r => r.id === id)?.isPaid === firstRes.isPaid);

        setEditForm({ 
          name: isSameName ? firstRes.name : '', 
          phone: isSamePhone ? firstRes.phone : '', 
          startTime: firstRes.startTime, 
          endTime: firstRes.endTime, 
          isPaid: isSamePaid ? firstRes.isPaid : false, 
          seatId: selectedIds.length === 1 ? firstRes.seatId : '' 
        });
        setActiveEditingIds([...selectedIds]);
      }
    }
  }, [selectedIds, reservations, activeEditingIds]);

  const seats = useMemo(() => {
    let allSeats: Seat[] = [];
    let currentIndex = 1;
    simulatorGroups.forEach(group => {
        const groupSeats = generateSeats(group.seatCount, group.id as any, currentIndex, seatLabelPrefix);
        allSeats = [...allSeats, ...groupSeats];
        currentIndex += group.seatCount;
    });
    return allSeats;
  }, [simulatorGroups, seatLabelPrefix]);

  const currentViewSeats = seats.filter(s => s.type === view);
  const totalHours = endHour - START_HOUR;
  const totalContentHeight = (totalHours * HOUR_HEIGHT) + HEADER_HEIGHT;

  const handleDragStart = (e: React.DragEvent, id: string) => {
    if (isCtrlPressed) { e.preventDefault(); return; }
    e.dataTransfer.setData('text/plain', id);
    setDraggedResId(id);
    setSelectedIds([]); 
  };

  const handleDragOver = useCallback((e: React.DragEvent, seatId: string) => {
    e.preventDefault();
    if (!draggedResId) return;
    const res = reservations.find(r => r.id === draggedResId);
    if (!res) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const relY = e.clientY - rect.top;
    const startMins = Math.round(((START_HOUR * 60) + (relY / HOUR_HEIGHT * 60)) / 5) * 5;
    const duration = timeToMinutes(res.endTime) - timeToMinutes(res.startTime);
    const clampedStart = Math.max(START_HOUR * 60, Math.min((endHour * 60) - duration, startMins));
    const newS = minutesToTime(clampedStart);
    const newE = minutesToTime(clampedStart + duration);
    const dayReservations = reservations.filter(r => r.seatId === seatId && r.date === dateStr);
    const overlap = checkOverlap(newS, newE, dayReservations, draggedResId);
    setDragTarget({ seatId, startTime: newS, endTime: newE, isValid: !overlap });
  }, [draggedResId, reservations, endHour, dateStr]);

  const handleDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const currentDraggedId = draggedResId;
    const currentDragTarget = dragTarget;
    setDraggedResId(null);
    setDragTarget(null);

    if (currentDragTarget?.isValid && currentDraggedId) {
      try {
        await supabase.from('reservations').update({
          seat_id: targetId,
          start_time: currentDragTarget.startTime,
          end_time: currentDragTarget.endTime
        }).eq('id', currentDraggedId);
      } catch (err) { console.error("Update error:", err); }
    }
  };

  const handleSaveEdit = async () => {
    if (selectedIds.length === 0) return;
    try {
      await Promise.all(selectedIds.map(id => {
        const payload: any = {
            name: editForm.name,
            phone: editForm.phone,
            start_time: editForm.startTime,
            end_time: editForm.endTime,
            is_paid: editForm.isPaid
        };
        if (!isGroupMode && selectedIds.length === 1 && editForm.seatId) {
            payload.seat_id = editForm.seatId;
        }
        return supabase.from('reservations').update(payload).eq('id', id);
      }));
      alert("Seçili tüm kayıtlar güncellendi.");
    } catch (e) { console.error("Update error:", e); }
  };

  const handleGroupSeatToggle = async (targetSeatId: string) => {
    const refRes = reservations.find(r => r.id === selectedIds[0]);
    if (!refRes) return;

    const existingRes = reservations.find(r => 
        r.groupId === refRes.groupId && r.date === refRes.date && r.seatId === targetSeatId
    );

    if (existingRes) {
        if (selectedIds.length <= 1) { alert("Gruptaki son kaydı buradan silemezsiniz."); return; }
        if(confirm(`${targetSeatId} masasını gruptan çıkarmak istiyor musunuz?`)){
            try {
                await supabase.from('reservations').delete().eq('id', existingRes.id);
                setSelectedIds(prev => prev.filter(id => id !== existingRes.id));
            } catch (e) { console.error(e); }
        }
    } else {
        if (checkOverlap(editForm.startTime, editForm.endTime, reservations.filter(r => r.seatId === targetSeatId && r.date === dateStr))) {
            alert("Bu masa dolu!"); return;
        }
        try {
            const { data } = await supabase.from('reservations').insert({
                group_id: refRes.groupId,
                seat_id: targetSeatId,
                name: editForm.name || refRes.name,
                phone: editForm.phone || refRes.phone,
                start_time: editForm.startTime,
                end_time: editForm.endTime,
                is_paid: editForm.isPaid,
                created_at: Date.now(),
                date: dateStr,
                user_id: session.user.id
            }).select();
            if(data) setSelectedIds(prev => [...prev, data[0].id]);
        } catch(e) { console.error(e); }
    }
  };

  const handleSelectGroup = () => {
    if (selectedIds.length === 0) return;
    const currentRes = reservations.find(r => r.id === selectedIds[0]);
    if (!currentRes) return;
    const groupToSelect = reservations.filter(r => r.groupId === currentRes.groupId && r.date === currentRes.date);
    setSelectedIds(groupToSelect.map(r => r.id));
  };

  const handleSelection = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (e.ctrlKey || e.metaKey) {
      setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    } else {
      setSelectedIds([id]);
    }
  };

  const finalizeReservation = async (data: any) => {
    const newGroupId = Math.random().toString(36).substr(2, 9);
    try {
      await supabase.from('reservations').insert(data.selectedSeats.map((seatId: string) => ({
            group_id: newGroupId,
            seat_id: seatId, 
            name: data.name, 
            phone: data.phone,
            start_time: data.startTime, 
            end_time: data.endTime,
            is_paid: data.isPaid, 
            created_at: Date.now(),
            date: dateStr,
            user_id: session.user.id
      })));
      setIsModalOpen(false);
    } catch (e) { console.error("Insert error:", e); }
  };

  const handleLogout = async () => {
    // FIX: Using supabase.auth.signOut()
    await supabase.auth.signOut();
  };

  if (authLoading) return <div className="fixed inset-0 bg-sim-black flex items-center justify-center text-sim-yellow"><Loader2 className="animate-spin" size={48}/></div>;

  if (!session) return <LoginScreen />;

  if (showScreensaver) return <div className="fixed inset-0 z-[9999] bg-black flex items-center justify-center" onMouseMove={resetIdleTimer}><video src="/screensaver.mp4" autoPlay loop muted className="w-full h-full object-cover" /></div>;

  return (
    <div className="fixed inset-0 bg-sim-black overflow-hidden flex items-center justify-center p-[5vh_5vw]">
      <div className="w-full h-full flex bg-sim-dark border-4 border-sim-yellow rounded-xl shadow-2xl overflow-hidden relative" onClick={() => setSelectedIds([])}>
        
        <div className="flex-1 flex flex-col min-w-0 border-r border-sim-border">
          <header className="flex items-center justify-between px-6 py-4 border-b border-sim-border bg-[#121212] shrink-0 z-[70]">
            <div className="flex items-center gap-8">
                <div className="h-20 w-28 flex items-center justify-center overflow-hidden">
                    <img src="https://i.ibb.co/Lz00B2y8/input-file-0.png" alt="Logo" className="w-full h-full object-contain" />
                </div>
                
                <div className="flex items-center gap-1">
                    <button onClick={(e) => {e.stopPropagation(); setCurrentDate(prev => addDays(prev, -1))}} className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-sim-yellow rounded-full transition-all"><ChevronLeft size={16}/></button>
                    <div onClick={(e) => {e.stopPropagation(); dateInputRef.current?.showPicker()}} className="flex flex-col items-center px-4 cursor-pointer group relative">
                        <span className="text-[10px] text-gray-500 uppercase font-bold tracking-widest group-hover:text-sim-yellow transition-colors">{format(currentDate, 'EEEE', { locale: tr })}</span>
                        <span className="text-sm font-medium text-gray-200 tracking-tight">{format(currentDate, 'dd MMMM yyyy', { locale: tr })}</span>
                        <input ref={dateInputRef} type="date" onChange={(e) => setCurrentDate(new Date(e.target.value))} value={dateStr} className="absolute inset-0 opacity-0 cursor-pointer pointer-events-auto" />
                    </div>
                    <button onClick={(e) => {e.stopPropagation(); setCurrentDate(prev => addDays(prev, 1))}} className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-sim-yellow rounded-full transition-all"><ChevronRight size={16}/></button>
                </div>
            </div>

            <div className="flex items-center gap-3 relative">
                <button onClick={handleLogout} className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors border border-red-500/20" title="Çıkış Yap"><LogOut size={20} /></button>
                <button onClick={(e) => {e.stopPropagation(); setIsSettingsModalOpen(true)}} className="p-2 text-sim-yellow hover:bg-sim-yellow/10 rounded-lg transition-colors border border-sim-yellow/20" title="Ayarlar"><Settings size={20} /></button>
                <button onClick={(e) => {e.stopPropagation(); setIsBlacklistOpen(true)}} className="p-2 text-sim-yellow hover:bg-sim-yellow/10 rounded-lg transition-colors border border-sim-yellow/20" title="Kara Liste"><AlertOctagon size={20} /></button>
                
                <div className="flex bg-sim-black p-1 rounded-lg border border-sim-border overflow-hidden">
                    {simulatorGroups.map(group => (
                        <button key={group.id} onClick={(e) => {e.stopPropagation(); setView(group.id)}} className={`px-4 py-1.5 rounded-md font-bold text-[10px] uppercase transition-all whitespace-nowrap ${view === group.id ? 'bg-sim-yellow text-black' : 'text-gray-500 hover:text-gray-300'}`}>{group.name}</button>
                    ))}
                </div>

                <button onClick={(e) => {e.stopPropagation(); setIsModalOpen(true)}} className="bg-sim-yellow text-black px-5 py-2 rounded-lg font-black text-[11px] uppercase shadow-lg shadow-yellow-500/10 hover:brightness-110 flex items-center gap-2"><Plus size={14}/> Yeni</button>
            </div>
          </header>

          <div className="flex-1 overflow-auto relative bg-sim-black">
             <div className="flex relative" style={{ height: totalContentHeight }}>
                 <div className="w-14 shrink-0 bg-sim-dark border-r border-sim-border sticky left-0 z-[65] flex flex-col">
                    <div className="h-[40px] border-b border-sim-yellow flex items-center justify-center font-bold text-[8px] text-sim-yellow uppercase sticky top-0 bg-sim-dark z-10">TIME</div>
                    <div className="flex-1">
                        {Array.from({ length: totalHours }).map((_, i) => (
                            <div key={i} className="border-b border-sim-border/10 flex items-center justify-center font-mono text-gray-600 text-[10px]" style={{ height: HOUR_HEIGHT }}>
                                <span>{`${(START_HOUR + i) % 24}:00`.padStart(5, '0')}</span>
                            </div>
                        ))}
                    </div>
                 </div>

                 <div className="flex-1 flex min-w-[800px] relative">
                    {isSameDay(currentDate, now) && (
                      <div className="absolute left-0 right-0 bg-sim-yellow/15 border-b-2 border-sim-yellow/60 pointer-events-none z-[50] transition-all duration-1000" style={{ top: 40, height: `${Math.max(0, (((now.getHours() * 60 + now.getMinutes()) - START_HOUR * 60) / (totalHours * 60)) * 100)}%`, maxHeight: `calc(100% - 40px)` }}>
                         <div className="absolute bottom-0 right-2 bg-sim-yellow text-black text-[8px] font-black px-1.5 py-0.5 rounded shadow-[0_0_10px_rgba(251,191,36,0.5)]">ŞUAN</div>
                      </div>
                    )}

                    {currentViewSeats.map((seat) => (
                        <div key={seat.id} className="flex-1 border-r border-sim-border/20 relative flex flex-col">
                            <div className="h-[40px] border-b border-sim-yellow bg-sim-black/80 sticky top-0 z-[60] flex items-center justify-center font-bold text-sim-yellow text-[10px] tracking-widest uppercase backdrop-blur-md">{seat.label}</div>
                            <div className="relative flex-1 w-full" onDragOver={(e) => handleDragOver(e, seat.id)} onDrop={(e) => handleDrop(e, seat.id)}>
                                <div className="absolute inset-0 z-10 cursor-default" onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); const y = e.clientY - e.currentTarget.getBoundingClientRect().top; const t = minutesToTime(Math.floor(((START_HOUR * 60) + (y / HOUR_HEIGHT * 60)) / 30) * 30); setContextMenu({ visible: true, x: e.pageX, y: e.pageY, seatId: seat.id, time: t }); }} />
                                
                                {reservations.filter(r => r.seatId === seat.id && r.date === dateStr).map(res => {
                                    const pos = getGridPosition(res.startTime, res.endTime, START_HOUR, endHour);
                                    const selected = selectedIds.includes(res.id);
                                    const status = now.getHours() * 60 + now.getMinutes() > timeToMinutes(res.endTime) && isSameDay(currentDate, now) ? 'PAST' : 'FUTURE';
                                    
                                    return (
                                        <div 
                                          key={res.id} draggable={!isCtrlPressed} onDragStart={(e) => handleDragStart(e, res.id)} onClick={(e) => handleSelection(e, res.id)} 
                                          onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setContextMenu({ visible: true, x: e.pageX, y: e.pageY, reservationId: res.id }); }}
                                          className={`absolute left-0 right-0 rounded-sm overflow-hidden flex flex-col justify-center text-center p-1 transition-all border z-[50] ${selected ? 'border-white ring-4 ring-sim-yellow/50 scale-[1.05] z-[70] shadow-[0_0_30px_rgba(251,191,36,0.6)] brightness-125' : ''} ${res.isPaid ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-red-600 text-white border-red-500 animate-pulse'} ${status === 'PAST' ? 'opacity-40 grayscale pointer-events-none' : 'cursor-grab active:cursor-grabbing'}`}
                                          style={{ top: pos.top, height: pos.height }}
                                        >
                                            <div className="text-[10px] font-bold opacity-90 leading-none mb-0.5">{res.startTime}-{res.endTime}</div>
                                            <div className="font-black text-[12px] truncate uppercase px-1 tracking-tight">{res.name}</div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                 </div>
             </div>
          </div>
        </div>

        <aside className="w-[320px] bg-sim-dark/50 backdrop-blur-xl flex flex-col shrink-0 border-l border-sim-border z-[70]" onClick={(e) => e.stopPropagation()}>
          <div className="p-5 border-b border-sim-border bg-sim-black/20 flex items-center justify-between">
            <div className="flex items-center gap-3 text-sim-yellow font-black text-xs tracking-widest uppercase"><Edit3 size={16}/> Düzenle</div>
            {selectedIds.length > 0 && <span className="bg-sim-yellow text-black text-[9px] font-black px-2 py-0.5 rounded-full shadow-[0_0_10px_rgba(251,191,36,0.4)]">{selectedIds.length} SEÇİLİ</span>}
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {selectedIds.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center opacity-10 text-center space-y-4"><MousePointer2 size={64} strokeWidth={1} /><p className="text-[10px] font-bold uppercase tracking-widest px-8">İşlem yapmak için takvimden bir kayıt seçin</p></div>
            ) : (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                  <button onClick={handleSelectGroup} className="w-full bg-sim-yellow/10 border border-sim-yellow text-sim-yellow font-black py-3 rounded-xl text-[10px] uppercase flex items-center justify-center gap-2 hover:bg-sim-yellow hover:text-black transition-all"><MousePointerSquareDashed size={14} /> Tüm Grubu Seç</button>
                  <div className="space-y-4">
                    <div className="space-y-1.5"><label className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Müşteri</label><input type="text" value={editForm.name} onChange={(e) => setEditForm({...editForm, name: e.target.value.toUpperCase()})} className="w-full bg-sim-black border border-sim-border rounded-lg p-3 text-xs text-white uppercase outline-none focus:border-sim-yellow transition-all" placeholder="AD SOYAD" /></div>
                    <div className="space-y-1.5"><label className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Telefon</label><input type="text" value={editForm.phone} onChange={(e) => setEditForm({...editForm, phone: formatPhoneNumber(e.target.value)})} className="w-full bg-sim-black border border-sim-border rounded-lg p-3 text-xs text-white outline-none focus:border-sim-yellow transition-all" placeholder="5XX XXX XX XX" /></div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5"><label className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Başlangıç</label><input type="time" value={editForm.startTime} onChange={(e) => setEditForm({...editForm, startTime: e.target.value})} className="w-full bg-sim-black border border-sim-border rounded-lg p-3 text-xs text-white outline-none" /></div>
                        <div className="space-y-1.5"><label className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Bitiş</label><input type="time" value={editForm.endTime} onChange={(e) => setEditForm({...editForm, endTime: e.target.value})} className="w-full bg-sim-black border border-sim-border rounded-lg p-3 text-xs text-white outline-none" /></div>
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between mb-1.5"><label className={`text-[9px] font-black uppercase tracking-widest flex items-center gap-1 ${isGroupMode ? 'text-green-500' : 'text-gray-500'}`}>{isGroupMode ? <CheckCircle2 size={10}/> : <Repeat size={10}/>} {isGroupMode ? "GRUP MODU: AKTİF" : "MASA DEĞİŞTİRME"}</label><button onClick={() => setIsGroupMode(!isGroupMode)} className={`text-[8px] font-bold px-2 py-1 rounded border transition-all ${isGroupMode ? 'bg-green-600 text-white border-green-500 shadow-lg shadow-green-500/20' : 'bg-sim-dark text-gray-400 border-sim-border hover:text-white'}`}>{isGroupMode ? "MOD: GRUP" : "MOD: TEK"}</button></div>
                        <div className={`grid grid-cols-4 gap-2 p-3 rounded-xl border-2 transition-all duration-300 ${isGroupMode ? 'bg-green-950/20 border-green-500' : 'bg-sim-black border-sim-border'}`}>
                            {seats.filter(s => s.type === view).map(s => {
                                const isSel = selectedIds.some(id => reservations.find(r => r.id === id)?.seatId === s.id);
                                return <button key={s.id} onClick={() => isGroupMode ? handleGroupSeatToggle(s.id) : setEditForm({...editForm, seatId: s.id})} className={`p-2 text-[8px] font-black rounded border transition-all ${isSel ? 'bg-sim-yellow text-black border-sim-yellow shadow-lg shadow-yellow-500/20' : 'bg-sim-gray text-gray-400 border-sim-border hover:border-gray-500'}`}>{s.label}</button>
                            })}
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Ödeme Durumu</label>
                        <div className="flex bg-sim-black p-1 rounded-xl border border-sim-border">
                            <button onClick={() => setEditForm({...editForm, isPaid: true})} className={`flex-1 py-3 text-[10px] font-black rounded-lg transition-all ${editForm.isPaid ? 'bg-green-600 text-white shadow-lg shadow-green-500/20' : 'text-gray-600'}`}>ALINDI</button>
                            <button onClick={() => setEditForm({...editForm, isPaid: false})} className={`flex-1 py-3 text-[10px] font-black rounded-lg transition-all ${!editForm.isPaid ? 'bg-red-900 text-white shadow-lg shadow-red-900/20' : 'text-gray-600'}`}>ALINMADI</button>
                        </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 pt-6 border-t border-sim-border">
                    <button onClick={handleSaveEdit} className="w-full bg-sim-yellow text-black font-black py-4 rounded-xl text-[11px] uppercase flex items-center justify-center gap-2 shadow-lg shadow-yellow-500/20 hover:scale-[1.02] active:scale-95 transition-all"><Save size={16} /> Güncelle</button>
                    <button onClick={async () => { if(confirm('Silmek istediğine emin misin?')) { await Promise.all(selectedIds.map(id => supabase.from('reservations').delete().eq('id', id))); setSelectedIds([]); } }} className="w-full bg-transparent border border-red-900/50 text-red-700 font-black py-3 rounded-xl text-[10px] uppercase hover:bg-red-950/20 transition-all">Sil</button>
                  </div>
              </div>
            )}
          </div>
        </aside>

        <ReservationModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSubmit={finalizeReservation} availableSeats={seats} view={view} simulatorGroups={simulatorGroups} />
        <BlacklistModal isOpen={isBlacklistOpen} onClose={() => setIsBlacklistOpen(false)} blacklist={blacklist} onUpdate={fetchData} />
        <SettingsModal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} groups={simulatorGroups} onUpdateGroups={setSimulatorGroups} endHour={endHour} onUpdateEndHour={setEndHour} seatLabelPrefix={seatLabelPrefix} onUpdatePrefix={setSeatLabelPrefix} />
        <InfoModal data={infoData} onClose={() => { setIsInfoOpen(false); setInfoData(null); }} />
        {contextMenu.visible && <ContextMenu {...contextMenu} onClose={() => setContextMenu({...contextMenu, visible: false})} onAction={async (action) => {
             if (action === 'CREATE_NEW') setIsModalOpen(true);
             if (action === 'SHOW_INFO') { const r = reservations.find(res => res.id === contextMenu.reservationId); if(r) { setInfoData({...r, seats: reservations.filter(res => res.groupId === r.groupId).map(res => res.seatId)}); setIsInfoOpen(true); } }
             setContextMenu({...contextMenu, visible: false});
        }} type={contextMenu.reservationId ? 'RESERVATION' : 'EMPTY'} />}
      </div>
    </div>
  );

  function resetIdleTimer() {
    setShowScreensaver(false);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => setShowScreensaver(true), SCREENSAVER_TIMEOUT);
  }
}

function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        // FIX: Using supabase.auth.signInWithPassword()
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) setError('Giriş başarısız. Bilgilerinizi kontrol edin.');
        setLoading(false);
    };

    return (
        <div className="fixed inset-0 bg-sim-black flex items-center justify-center p-4">
            <div className="w-full max-w-[400px] bg-sim-dark border border-sim-yellow/30 p-10 rounded-2xl shadow-2xl relative overflow-hidden transition-all">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-sim-yellow to-transparent"></div>
                <div className="flex flex-col items-center mb-8">
                    <img src="https://i.ibb.co/Lz00B2y8/input-file-0.png" alt="Logo" className="h-24 mb-4 object-contain" />
                    <h2 className="text-sim-yellow font-black text-xs tracking-[0.3em] uppercase opacity-80">SimRacing Manager</h2>
                </div>
                <form onSubmit={handleLogin} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2"><Mail size={12}/> E-Posta</label>
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full bg-sim-black border border-sim-border rounded-xl p-4 text-sm text-white outline-none focus:border-sim-yellow focus:ring-1 focus:ring-sim-yellow transition-all" placeholder="admin@simracing.com" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2"><Lock size={12}/> Şifre</label>
                        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full bg-sim-black border border-sim-border rounded-xl p-4 text-sm text-white outline-none focus:border-sim-yellow focus:ring-1 focus:ring-sim-yellow transition-all" placeholder="••••••••" />
                    </div>
                    {error && <div className="text-red-500 text-[10px] font-bold text-center uppercase tracking-wider bg-red-500/10 p-2 rounded-lg border border-red-500/20">{error}</div>}
                    <button type="submit" disabled={loading} className="w-full bg-sim-yellow text-black font-black py-4 rounded-xl text-xs uppercase hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-yellow-500/20 disabled:opacity-50 disabled:cursor-not-allowed">
                        {loading ? <Loader2 className="animate-spin" size={18}/> : 'Giriş Yap'}
                    </button>
                </form>
                <div className="mt-8 text-center"><p className="text-[8px] text-gray-600 font-bold uppercase tracking-widest">© 2024 SIMRACING MANAGEMENT SYSTEM</p></div>
            </div>
        </div>
    );
}
