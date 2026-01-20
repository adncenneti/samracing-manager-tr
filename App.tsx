
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { format, addDays, isSameDay, startOfMonth } from 'date-fns';
import { tr } from 'date-fns/locale';
import { 
  Plus, Trash, Save, Edit3, MousePointer2, AlertOctagon, Settings, 
  Repeat, CheckCircle2, LogOut, Lock, Mail, Loader2, Check, 
  Clock, PauseCircle, PlayCircle, Palette, RefreshCw, UserPlus,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import { Reservation, Seat, ContextMenuState, BlacklistEntry, SimulatorGroup } from './types';
import { generateSeats, checkOverlap, getGridPosition, START_HOUR, DEFAULT_END_HOUR, timeToMinutes, minutesToTime, formatPhoneNumber } from './utils';
import { ReservationModal } from './components/ReservationModal';
import { ContextMenu } from './components/ContextMenu';
import { BlacklistModal } from './components/BlacklistModal';
import { SettingsModal } from './components/SettingsModal';
import { InfoModal } from './components/InfoModal';
import { supabase } from './supabaseClient';

const SCREENSAVER_TIMEOUT = 10 * 60 * 1000;
const HOUR_HEIGHT = 60;
const HEADER_HEIGHT = 40;

const DEFAULT_THEME = {
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
};

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
  const [suspendedGroups, setSuspendedGroups] = useState<any[]>([]);
  const [blacklist, setBlacklist] = useState<BlacklistEntry[]>([]);
  const [seatLabelPrefix, setSeatLabelPrefix] = useState('S-');
  const [endHour, setEndHour] = useState(DEFAULT_END_HOUR);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBlacklistOpen, setIsBlacklistOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  
  const [infoData, setInfoData] = useState<any>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0 });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [draggedResId, setDraggedResId] = useState<string | null>(null);
  const [dragTarget, setDragTarget] = useState<{ seatId: string, startTime: string, endTime: string, isValid: boolean } | null>(null);
  
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);
  const [theme, setTheme] = useState(DEFAULT_THEME);

  const dateInputRef = useRef<HTMLInputElement>(null);
  const dateStr = format(currentDate, 'yyyy-MM-dd');
  const [editForm, setEditForm] = useState({ name: '', phone: '', startTime: '', endTime: '', isPaid: false, seatId: '' });
  const [activeEditingIds, setActiveEditingIds] = useState<string[]>([]);

  // Automatic Group Mode Logic
  const isGroupMode = useMemo(() => selectedIds.length > 1, [selectedIds]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  const fetchData = useCallback(async () => {
    if (!session) return;
    try {
      const [resResponse, blResponse, groupsResponse] = await Promise.all([
        supabase.from('reservations').select('*'),
        supabase.from('blacklist').select('*'),
        supabase.from('simulator_groups').select('*').order('order', { ascending: true })
      ]);
      if (resResponse.data) {
        setReservations(resResponse.data.map(r => ({
          id: r.id, groupId: r.group_id, seatId: r.seat_id, name: r.name,
          phone: r.phone, startTime: r.start_time, endTime: r.end_time,
          isPaid: r.is_paid, createdAt: Number(r.created_at), date: r.date
        })));
      }
      if (blResponse.data) setBlacklist(blResponse.data);
      if (groupsResponse.data?.length > 0) setSimulatorGroups(groupsResponse.data);
    } catch (error) { console.error(error); }
  }, [session]);

  useEffect(() => {
    if (!session) return;
    fetchData();
    const interval = setInterval(() => setNow(new Date()), 1000); // 1s interval for clock sync
    return () => clearInterval(interval);
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

  // Sidebar Layout Switch
  const mainWidthClass = suspendedGroups.length > 0 ? 'w-[80%]' : 'w-full';

  const allSeats = useMemo(() => {
    let seats: Seat[] = [];
    let idx = 1;
    simulatorGroups.forEach(g => {
      const gs = generateSeats(g.seatCount, g.id as any, idx, seatLabelPrefix);
      seats = [...seats, ...gs];
      idx += g.seatCount;
    });
    return seats;
  }, [simulatorGroups, seatLabelPrefix]);

  const currentViewSeats = allSeats.filter(s => s.type === view);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    if (isCtrlPressed) { e.preventDefault(); return; }
    setDraggedResId(id);
    (e.target as HTMLElement).style.opacity = '0.4';
  };

  const handleDragOver = (e: React.DragEvent, seatId: string) => {
    e.preventDefault();
    if (!draggedResId) return;
    const res = reservations.find(r => r.id === draggedResId);
    if (!res) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const startMins = Math.round(((START_HOUR * 60) + (y / HOUR_HEIGHT * 60)) / 5) * 5;
    const dur = timeToMinutes(res.endTime) - timeToMinutes(res.startTime);
    const s = minutesToTime(Math.max(START_HOUR * 60, Math.min((endHour * 60) - dur, startMins)));
    const end = minutesToTime(timeToMinutes(s) + dur);
    const overlap = checkOverlap(s, end, reservations.filter(r => r.seatId === seatId && r.date === dateStr), draggedResId);
    setDragTarget({ seatId, startTime: s, endTime: end, isValid: !overlap });
  };

  const handleDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (dragTarget?.isValid && draggedResId) {
      await supabase.from('reservations').update({
        seat_id: targetId, start_time: dragTarget.startTime, end_time: dragTarget.endTime
      }).eq('id', draggedResId);
    }
    setDraggedResId(null);
    setDragTarget(null);
  };

  const handleSuspend = async () => {
    if (selectedIds.length === 0) return;
    const ref = reservations.find(r => r.id === selectedIds[0]);
    if (!ref) return;
    const groupToSuspend = reservations.filter(r => r.groupId === ref.groupId);
    setSuspendedGroups(prev => [...prev, {
      id: ref.groupId,
      name: ref.name,
      phone: ref.phone,
      seats: groupToSuspend.map(r => r.seatId),
      startTime: ref.startTime,
      endTime: ref.endTime,
      isPaid: ref.isPaid
    }]);
    await Promise.all(groupToSuspend.map(r => supabase.from('reservations').delete().eq('id', r.id)));
    setSelectedIds([]);
    fetchData();
  };

  const handleRestore = (group: any) => {
    setInfoData({
      name: group.name,
      phone: group.phone,
      startTime: group.startTime,
      endTime: group.endTime,
      selectedSeats: group.seats,
      isPaid: group.isPaid
    });
    setIsModalOpen(true);
    setSuspendedGroups(prev => prev.filter(g => g.id !== group.id));
  };

  const finalizeReservation = async (data: any) => {
    // Critical Overlap Check
    const overlapping = data.selectedSeats.some((sid: string) => 
      checkOverlap(data.startTime, data.endTime, reservations.filter(r => r.seatId === sid && r.date === dateStr))
    );

    if (overlapping) {
      alert("Seçilen saatler dolu! Lütfen kontrol ediniz.");
      return;
    }

    const gid = Math.random().toString(36).substr(2, 9);
    await supabase.from('reservations').insert(data.selectedSeats.map((sid: string) => ({
      group_id: gid, seat_id: sid, name: data.name, phone: data.phone,
      start_time: data.startTime, end_time: data.endTime, is_paid: data.isPaid,
      created_at: Date.now(), date: dateStr, user_id: session.user.id
    })));
    setIsModalOpen(false);
    fetchData();
  };

  const handleBlacklistAdd = async () => {
    const res = reservations.find(r => r.id === selectedIds[0]);
    if (!res) return;
    const reason = prompt(`${res.name} kişisini kara listeye eklemek için sebep giriniz:`);
    if (reason) {
      await supabase.from('blacklist').insert({
        name: res.name, phone: res.phone, reason, added_at: Date.now()
      });
      alert("Kişi kara listeye alındı.");
      fetchData();
    }
  };

  const handleSelectGroup = () => {
    const res = reservations.find(r => r.id === selectedIds[0]);
    if (res) setSelectedIds(reservations.filter(r => r.groupId === res.groupId).map(r => r.id));
  };

  // Fix: Added handleGroupSeatToggle to manage seat changes in group mode
  const handleGroupSeatToggle = async (seatId: string) => {
    if (selectedIds.length === 0) return;
    const referenceRes = reservations.find(r => r.id === selectedIds[0]);
    if (!referenceRes) return;

    const isCurrentlySelected = selectedIds.some(id => reservations.find(r => r.id === id)?.seatId === seatId);
    
    if (isCurrentlySelected) {
      const resToDelete = reservations.find(r => selectedIds.includes(r.id) && r.seatId === seatId);
      if (resToDelete && selectedIds.length > 1) {
        await supabase.from('reservations').delete().eq('id', resToDelete.id);
        setSelectedIds(prev => prev.filter(id => id !== resToDelete.id));
      }
    } else {
      const overlap = checkOverlap(referenceRes.startTime, referenceRes.endTime, reservations.filter(r => r.seatId === seatId && r.date === dateStr));
      if (overlap) {
        alert("Bu masa belirtilen saatlerde dolu.");
        return;
      }
      const { data, error } = await supabase.from('reservations').insert({
        group_id: referenceRes.groupId,
        seat_id: seatId,
        name: referenceRes.name,
        phone: referenceRes.phone,
        start_time: referenceRes.startTime,
        end_time: referenceRes.endTime,
        is_paid: referenceRes.isPaid,
        created_at: Date.now(),
        date: dateStr,
        user_id: session.user.id
      }).select();
      if (data) setSelectedIds(prev => [...prev, data[0].id]);
    }
    fetchData();
  };

  if (authLoading) return <div className="fixed inset-0 bg-sim-black flex items-center justify-center text-sim-yellow"><Loader2 className="animate-spin" size={48}/></div>;
  if (!session) return <LoginScreen />;

  return (
    <div className="fixed inset-0 bg-sim-black overflow-hidden flex items-center justify-center p-[2vh_2vw]">
      <div className={`h-full flex flex-row gap-4 transition-all duration-500 w-full`}>
        
        {/* Main Application */}
        <div className={`h-full flex flex-col bg-sim-dark border-4 rounded-xl shadow-2xl overflow-hidden relative ${mainWidthClass}`} style={{ borderColor: theme.main }} onClick={() => setSelectedIds([])}>
          <header className="flex items-center justify-between px-6 py-4 border-b border-sim-border bg-[#121212] shrink-0 z-[70]">
            <div className="flex items-center gap-8">
              <div className="h-16 w-24 flex items-center justify-center relative group/logo cursor-pointer">
                <div className="absolute inset-0 bg-sim-yellow/0 rounded-full blur-2xl group-hover/logo:bg-sim-yellow/30 transition-all duration-500 scale-75 group-hover/logo:scale-110"></div>
                <img src="/logo.png" alt="Logo" className="w-full h-full object-contain relative z-10" />
              </div>
              <div className="flex items-center gap-1">
                {/* Fix: ChevronLeft now imported */}
                <button onClick={(e) => {e.stopPropagation(); setCurrentDate(prev => addDays(prev, -1))}} className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-sim-yellow rounded-full transition-all"><ChevronLeft size={16}/></button>
                <div onClick={(e) => {e.stopPropagation(); dateInputRef.current?.showPicker()}} className="flex flex-col items-center px-4 cursor-pointer group relative">
                    <span className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">{format(currentDate, 'EEEE', { locale: tr })}</span>
                    <span className="text-sm font-medium text-gray-200 tracking-tight">{format(currentDate, 'dd MMMM yyyy', { locale: tr })}</span>
                    <input ref={dateInputRef} type="date" onChange={(e) => setCurrentDate(new Date(e.target.value))} value={dateStr} className="absolute inset-0 opacity-0 cursor-pointer pointer-events-auto" />
                </div>
                {/* Fix: ChevronRight now imported */}
                <button onClick={(e) => {e.stopPropagation(); setCurrentDate(prev => addDays(prev, 1))}} className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-sim-yellow rounded-full transition-all"><ChevronRight size={16}/></button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button onClick={() => setIsSettingsModalOpen(true)} className="p-2 text-sim-yellow hover:bg-sim-yellow/10 rounded-lg transition-colors border border-sim-yellow/20"><Settings size={20} /></button>
              <button onClick={() => setIsBlacklistOpen(true)} className="p-2 text-sim-yellow hover:bg-sim-yellow/10 rounded-lg transition-colors border border-sim-yellow/20"><AlertOctagon size={20} /></button>
              <div className="flex bg-sim-black p-1 rounded-lg border border-sim-border overflow-hidden">
                  {simulatorGroups.map(g => (
                      <button key={g.id} onClick={(e) => {e.stopPropagation(); setView(g.id)}} className={`px-4 py-1.5 rounded-md font-bold text-[10px] uppercase transition-all whitespace-nowrap ${view === g.id ? 'bg-sim-yellow text-black' : 'text-gray-500 hover:text-gray-300'}`}>{g.name}</button>
                  ))}
              </div>
              <button onClick={() => setIsModalOpen(true)} className="bg-sim-yellow text-black px-5 py-2 rounded-lg font-black text-[11px] uppercase flex items-center gap-2 shadow-lg shadow-yellow-500/10"><Plus size={14}/> Yeni</button>
            </div>
          </header>

          <div className="flex-1 overflow-auto relative bg-sim-black">
             <div className="flex relative" style={{ height: (endHour - START_HOUR) * HOUR_HEIGHT + HEADER_HEIGHT }}>
                 
                 {/* Timeline Indicator with Clock */}
                 {isSameDay(currentDate, now) && (
                   <div className="absolute left-0 right-0 border-b-2 z-[60] pointer-events-none transition-all duration-1000" style={{ 
                     top: 40 + (((now.getHours() * 60 + now.getMinutes()) - START_HOUR * 60) / ((endHour - START_HOUR) * 60)) * ((endHour - START_HOUR) * HOUR_HEIGHT),
                     borderColor: theme.timeline
                   }}>
                     <div className="absolute bottom-0 right-2 bg-sim-yellow text-black text-[10px] font-black px-2 py-1 rounded shadow-lg flex items-center gap-1">
                        <Clock size={10} /> {format(now, 'HH:mm:ss')}
                     </div>
                   </div>
                 )}

                 <div className="w-14 shrink-0 bg-sim-dark border-r border-sim-border sticky left-0 z-[65] flex flex-col">
                    <div className="h-[40px] border-b border-sim-yellow flex items-center justify-center font-bold text-[8px] text-sim-yellow uppercase sticky top-0 bg-sim-dark z-10">TIME</div>
                    <div className="flex-1">
                        {Array.from({ length: endHour - START_HOUR }).map((_, i) => (
                            <div key={i} className="border-b border-sim-border/10 flex items-center justify-center font-mono text-gray-600 text-[10px]" style={{ height: HOUR_HEIGHT }}>
                                <span>{`${(START_HOUR + i) % 24}:00`.padStart(5, '0')}</span>
                            </div>
                        ))}
                    </div>
                 </div>

                 <div className="flex-1 flex min-w-[800px] relative">
                    {currentViewSeats.map((seat) => (
                        <div key={seat.id} className="flex-1 border-r border-sim-border/20 relative flex flex-col">
                            <div className="h-[40px] border-b border-sim-yellow bg-sim-black/80 sticky top-0 z-[60] flex items-center justify-center font-bold text-sim-yellow text-[10px] tracking-widest uppercase">{seat.label}</div>
                            <div className="relative flex-1 w-full" onDragOver={(e) => handleDragOver(e, seat.id)} onDrop={(e) => handleDrop(e, seat.id)}>
                                <div className="absolute inset-0 z-10 cursor-default" onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); const y = e.clientY - e.currentTarget.getBoundingClientRect().top; setContextMenu({ visible: true, x: e.pageX, y: e.pageY, seatId: seat.id, time: minutesToTime(Math.floor(((START_HOUR * 60) + (y / HOUR_HEIGHT * 60)) / 30) * 30) }); }} />
                                
                                {dragTarget?.seatId === seat.id && (
                                  <div className="absolute left-0 right-0 z-[80] border-4 border-dashed bg-green-500/30 border-green-400 shadow-2xl flex items-center justify-center text-2xl font-black text-green-400" style={getGridPosition(dragTarget.startTime, dragTarget.endTime, START_HOUR, endHour)}>
                                    {dragTarget.startTime} - {dragTarget.endTime}
                                  </div>
                                )}

                                {reservations.filter(r => r.seatId === seat.id && r.date === dateStr).map(res => {
                                    const pos = getGridPosition(res.startTime, res.endTime, START_HOUR, endHour);
                                    const selected = selectedIds.includes(res.id);
                                    const currentTimeMins = now.getHours() * 60 + now.getMinutes();
                                    const resStartMins = timeToMinutes(res.startTime);
                                    const resEndMins = timeToMinutes(res.endTime);
                                    
                                    const isCurrent = isSameDay(currentDate, now);
                                    const isPast = (resEndMins < currentTimeMins && isCurrent) || (currentDate < now && !isCurrent);
                                    const isActive = isCurrent && currentTimeMins >= resStartMins && currentTimeMins <= resEndMins;
                                    
                                    let styleKey = 'future';
                                    if (isPast) styleKey = 'past';
                                    else if (isActive) styleKey = 'active';
                                    
                                    const colorKey = `${styleKey}${res.isPaid ? 'Paid' : 'Unpaid'}` as keyof typeof theme;
                                    const color = theme[colorKey] as string;

                                    return (
                                        <div 
                                          key={res.id} draggable={!isCtrlPressed} onDragStart={(e) => handleDragStart(e, res.id)} 
                                          onDragEnd={(e) => (e.target as HTMLElement).style.opacity = '1'}
                                          onClick={(e) => { e.stopPropagation(); if(isCtrlPressed) { setSelectedIds(p => p.includes(res.id) ? p.filter(i => i !== res.id) : [...p, res.id]); } else { setSelectedIds([res.id]); } }} 
                                          onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setContextMenu({ visible: true, x: e.pageX, y: e.pageY, reservationId: res.id }); }}
                                          className={`absolute left-0 right-0 rounded-sm overflow-hidden flex flex-col justify-center text-center p-1 transition-all border z-[50] ${selected ? 'ring-4 ring-white z-[90] shadow-2xl' : ''} ${isActive && !res.isPaid ? 'animate-pulse' : ''}`}
                                          style={{ top: pos.top, height: pos.height, backgroundColor: color, borderColor: selected ? '#fff' : theme.border, opacity: theme.opacity }}
                                        >
                                            <div className="text-[9px] font-black opacity-90 leading-none mb-0.5">{res.startTime}-{res.endTime}</div>
                                            <div className="font-black text-[11px] truncate uppercase px-1">{res.name}</div>
                                            {isActive && (
                                              <div className="text-[8px] font-bold mt-1 bg-black/30 rounded inline-block px-1 mx-auto">
                                                {resEndMins - currentTimeMins > 0 ? `${resEndMins - currentTimeMins}dk kaldı` : 'Süre Doldu'}
                                              </div>
                                            )}
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

        {/* Suspension Sidebar */}
        {suspendedGroups.length > 0 && (
          <aside className="w-[20%] bg-sim-dark border-4 border-sim-yellow/30 rounded-xl p-4 overflow-y-auto space-y-4 animate-in slide-in-from-right duration-300">
             <div className="flex items-center gap-2 text-sim-yellow font-black uppercase text-xs border-b border-sim-border pb-2">
                <PauseCircle size={16}/> Askıdaki Kayıtlar ({suspendedGroups.length})
             </div>
             {suspendedGroups.map(g => (
               <div key={g.id} className="bg-sim-black border border-sim-border rounded-lg p-3 group relative transition-all hover:border-sim-yellow">
                  <div className="text-sm font-black text-white uppercase">{g.name}</div>
                  <div className="text-[10px] text-sim-yellow font-mono">{g.phone}</div>
                  <div className="text-[9px] text-gray-500 mt-2">{g.seats.join(', ')} | {g.startTime}-{g.endTime}</div>
                  <div className="absolute inset-0 bg-sim-yellow/10 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all rounded-lg backdrop-blur-[2px]">
                     <button onClick={() => handleRestore(g)} className="bg-sim-yellow text-black font-black px-4 py-2 rounded text-[10px] uppercase flex items-center gap-2">
                        <PlayCircle size={14}/> Yerleştir
                     </button>
                  </div>
               </div>
             ))}
          </aside>
        )}

        {/* Edit Panel (Sidebar) */}
        <aside className="w-[320px] bg-sim-dark/80 backdrop-blur-xl flex flex-col shrink-0 border-l border-sim-border z-[70] transition-all" onClick={(e) => e.stopPropagation()}>
          <div className="p-5 border-b border-sim-border bg-sim-black/20 flex items-center justify-between">
            <div className="flex items-center gap-3 text-sim-yellow font-black text-xs tracking-widest uppercase"><Edit3 size={16}/> Düzenle</div>
            <div className={`text-[9px] font-black px-2 py-1 rounded border ${isGroupMode ? 'border-green-500 text-green-500 bg-green-500/10' : 'border-gray-500 text-gray-500'}`}>
                {isGroupMode ? 'GRUP MODU' : 'TEKLİ MOD'}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {selectedIds.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center opacity-10 text-center space-y-4"><MousePointer2 size={64} strokeWidth={1} /><p className="text-[10px] font-bold uppercase tracking-widest px-8">İşlem yapmak için takvimden bir kayıt seçin</p></div>
            ) : (
              <div className="space-y-6">
                  <div className="space-y-2">
                    <button onClick={handleSelectGroup} className="w-full bg-sim-yellow/10 border border-sim-yellow text-sim-yellow font-black py-3 rounded-xl text-[10px] uppercase flex items-center justify-center gap-2 hover:bg-sim-yellow hover:text-black transition-all">Tüm Grubu Seç</button>
                    {isGroupMode && (
                       <button onClick={handleSuspend} className="w-full bg-blue-500/10 border border-blue-500 text-blue-500 font-black py-3 rounded-xl text-[10px] uppercase flex items-center justify-center gap-2 hover:bg-blue-500 hover:text-white transition-all">
                          <PauseCircle size={14}/> Askıya Al
                       </button>
                    )}
                  </div>
                  
                  <div className="space-y-4 pt-4 border-t border-sim-border">
                    <div className="space-y-1.5"><label className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Müşteri</label><input type="text" value={editForm.name} onChange={(e) => setEditForm({...editForm, name: e.target.value.toUpperCase()})} className="w-full bg-sim-black border border-sim-border rounded-lg p-3 text-xs text-white uppercase outline-none focus:border-sim-yellow" /></div>
                    <div className="space-y-1.5"><label className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Telefon</label><input type="text" value={editForm.phone} onChange={(e) => setEditForm({...editForm, phone: formatPhoneNumber(e.target.value)})} className="w-full bg-sim-black border border-sim-border rounded-lg p-3 text-xs text-white outline-none focus:border-sim-yellow" /></div>
                    
                    <div className="space-y-2">
                        <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Masa Değiştir/Ekle (Tüm Masalar)</label>
                        <div className="grid grid-cols-4 gap-2 p-3 bg-sim-black rounded-xl border border-sim-border max-h-[200px] overflow-y-auto">
                            {allSeats.map(s => {
                                const isSel = selectedIds.some(id => reservations.find(r => r.id === id)?.seatId === s.id);
                                return <button key={s.id} onClick={() => isGroupMode ? handleGroupSeatToggle(s.id) : setEditForm({...editForm, seatId: s.id})} className={`p-2 text-[8px] font-black rounded border transition-all ${isSel ? 'bg-sim-yellow text-black border-sim-yellow shadow-lg' : 'bg-sim-gray text-gray-400 border-sim-border'}`}>{s.label}</button>
                            })}
                        </div>
                    </div>
                    
                    <button onClick={handleBlacklistAdd} className="w-full bg-red-500/10 border border-red-500 text-red-500 font-black py-3 rounded-xl text-[10px] uppercase flex items-center justify-center gap-2 hover:bg-red-500 hover:text-white transition-all">Kara Listeye Ekle</button>
                    <button onClick={async () => { if(confirm('Sil?')) { await Promise.all(selectedIds.map(id => supabase.from('reservations').delete().eq('id', id))); setSelectedIds([]); fetchData(); } }} className="w-full bg-transparent border border-red-900/50 text-red-700 font-black py-3 rounded-xl text-[10px] uppercase hover:bg-red-950/20 transition-all">Kayıt Sil</button>
                  </div>
              </div>
            )}
          </div>
        </aside>

        <ReservationModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSubmit={finalizeReservation} availableSeats={allSeats} view={view} simulatorGroups={simulatorGroups} initialData={infoData} />
        <BlacklistModal isOpen={isBlacklistOpen} onClose={() => setIsBlacklistOpen(false)} blacklist={blacklist} onUpdate={fetchData} />
        <SettingsModal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} groups={simulatorGroups} onUpdateGroups={setSimulatorGroups} endHour={endHour} onUpdateEndHour={setEndHour} seatLabelPrefix={seatLabelPrefix} onUpdatePrefix={setSeatLabelPrefix} theme={theme} onUpdateTheme={setTheme} />
        <InfoModal data={infoData} onClose={() => { setIsInfoOpen(false); setInfoData(null); }} />
        {contextMenu.visible && <ContextMenu {...contextMenu} onClose={() => setContextMenu({...contextMenu, visible: false})} onAction={async (action) => {
             if (action === 'CREATE_NEW') setIsModalOpen(true);
             if (action === 'SHOW_INFO') { 
                const r = reservations.find(res => res.id === contextMenu.reservationId); 
                if(r) { setInfoData({...r, seats: reservations.filter(res => res.groupId === r.groupId).map(res => res.seatId)}); setIsInfoOpen(true); }
             }
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
    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) alert('Hatalı giriş.');
        setLoading(false);
    };
    return (
        <div className="fixed inset-0 bg-sim-black flex items-center justify-center p-4">
            <div className="w-full max-w-[400px] bg-sim-dark border border-sim-yellow/30 p-10 rounded-2xl shadow-2xl relative">
                <div className="flex flex-col items-center mb-8">
                    <img src="/logo.png" alt="Logo" className="h-24 mb-4 object-contain" />
                    <h2 className="text-sim-yellow font-black text-xs tracking-widest uppercase">SimRacing Manager</h2>
                </div>
                <form onSubmit={handleLogin} className="space-y-6">
                    <div className="space-y-2"><label className="text-[10px] font-bold text-gray-500 uppercase">E-Posta</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full bg-sim-black border border-sim-border rounded-xl p-4 text-white outline-none focus:border-sim-yellow" /></div>
                    <div className="space-y-2"><label className="text-[10px] font-bold text-gray-500 uppercase">Şifre</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full bg-sim-black border border-sim-border rounded-xl p-4 text-white outline-none focus:border-sim-yellow" /></div>
                    <button type="submit" disabled={loading} className="w-full bg-sim-yellow text-black font-black py-4 rounded-xl text-xs uppercase shadow-lg shadow-yellow-500/20">{loading ? 'Giriş Yapılıyor...' : 'Giriş Yap'}</button>
                </form>
            </div>
        </div>
    );
}
