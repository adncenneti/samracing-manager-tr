
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { format, addDays, isSameDay } from 'date-fns';
import { tr } from 'date-fns/locale';
import { 
  Plus, Settings, AlertOctagon, Loader2, Clock, ChevronLeft, ChevronRight
} from 'lucide-react';
import { Reservation, Seat, ContextMenuState, BlacklistEntry, SimulatorGroup } from './types';
import { generateSeats, checkOverlap, getGridPosition, START_HOUR, DEFAULT_END_HOUR, timeToMinutes, minutesToTime } from './utils';
import { ReservationModal } from './components/ReservationModal';
import { ContextMenu } from './components/ContextMenu';
import { BlacklistModal } from './components/BlacklistModal';
import { SettingsModal } from './components/SettingsModal';
import { InfoModal } from './components/InfoModal';
import { supabase } from './supabaseClient';

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  componentDidCatch(error: Error, errorInfo: any) { console.error("APP CRASH:", error, errorInfo); }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', color: 'red', backgroundColor: '#000', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyItems: 'center', justifyContent: 'center' }}>
          <h2>Bir hata oluştu!</h2>
          <p>{this.state.error?.message}</p>
          <button onClick={() => window.location.reload()} style={{ padding: '10px 20px', cursor: 'pointer', backgroundColor: '#333', color: '#fff', border: 'none', borderRadius: '5px', marginTop: '10px' }}>Yeniden Dene</button>
        </div>
      );
    }
    return this.props.children;
  }
}

const HOUR_HEIGHT = 60;
const HEADER_HEIGHT = 40;

// Basitleştirilmiş Tema
const THEME = {
  border: '#333333',
  main: '#fbbf24',
  timeline: '#fbbf24',
  pastUnpaid: '#454545',
  pastPaid: '#064e3b',
  activeUnpaid: '#dc2626',
  activePaid: '#059669',
  futureUnpaid: '#1e1e1e',
  futurePaid: '#065f46',
  opacity: '0.9'
};

const DEFAULT_GROUPS: SimulatorGroup[] = [
  { id: 'LOGITECH', name: 'Logitech G29', seatCount: 8, order: 0 },
  { id: 'MOZA', name: 'Moza R5', seatCount: 8, order: 1 }
];

function AppContent() {
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [now, setNow] = useState(new Date());
  
  const [simulatorGroups, setSimulatorGroups] = useState<SimulatorGroup[]>(DEFAULT_GROUPS);
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
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [draggedResId, setDraggedResId] = useState<string | null>(null);
  const [dragTarget, setDragTarget] = useState<{ seatId: string, startTime: string, endTime: string, isValid: boolean } | null>(null);
  
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);

  const dateInputRef = useRef<HTMLInputElement>(null);
  const dateStr = format(currentDate, 'yyyy-MM-dd');

  useEffect(() => {
    let mounted = true;
    async function init() {
      try {
        const { data } = await supabase.auth.getSession();
        if (mounted) {
          setSession(data?.session || null);
          setAuthLoading(false);
        }
      } catch (e) {
        if (mounted) setAuthLoading(false);
      }
    }
    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setSession(session);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const fetchData = useCallback(async () => {
    if (!session) return;
    try {
      const [resResult, blResult, groupsResult] = await Promise.allSettled([
        supabase.from('reservations').select('*'),
        supabase.from('blacklist').select('*'),
        supabase.from('simulator_groups').select('*').order('order', { ascending: true })
      ]);

      if (resResult.status === 'fulfilled' && resResult.value.data) {
        setReservations(resResult.value.data.map(r => ({
          id: r.id, groupId: r.group_id, seatId: r.seat_id, name: r.name,
          phone: r.phone, startTime: r.start_time, endTime: r.end_time,
          isPaid: r.is_paid, createdAt: Number(r.created_at || Date.now()), date: r.date
        })));
      }

      if (blResult.status === 'fulfilled' && blResult.value.data) {
        setBlacklist(blResult.value.data);
      }

      if (groupsResult.status === 'fulfilled' && groupsResult.value.data && groupsResult.value.data.length > 0) {
        const mapped = groupsResult.value.data.map((g: any) => ({
          id: g.id,
          name: g.name,
          seatCount: Number(g.seat_count || g.seatCount || 8),
          order: Number(g.order || 0)
        }));
        setSimulatorGroups(mapped);
      }
    } catch (e) {}
  }, [session]);

  useEffect(() => {
    if (session) fetchData();
    const interval = setInterval(() => setNow(new Date()), 1000);
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

  const allSeats = useMemo(() => {
    let seats: Seat[] = [];
    let idx = 1;
    (simulatorGroups || DEFAULT_GROUPS).forEach(g => {
      const count = Number(g.seatCount) || 8;
      const gs = generateSeats(count, g.id as any, idx, seatLabelPrefix);
      seats = [...seats, ...gs];
      idx += count;
    });
    return seats;
  }, [simulatorGroups, seatLabelPrefix]);

  const currentViewSeats = useMemo(() => allSeats.filter(s => s.type === view), [allSeats, view]);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    if (isCtrlPressed) { e.preventDefault(); return; }
    setDraggedResId(id);
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
    
    // Çakışma kontrolü
    const overlap = checkOverlap(s, end, reservations.filter(r => r.seatId === seatId && r.date === dateStr), draggedResId);
    setDragTarget({ seatId, startTime: s, endTime: end, isValid: !overlap });
  };

  const handleDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (dragTarget?.isValid && draggedResId) {
      const { error } = await supabase.from('reservations').update({
        seat_id: targetId, start_time: dragTarget.startTime, end_time: dragTarget.endTime
      }).eq('id', draggedResId);
      
      if (!error) {
        setReservations(prev => prev.map(r => r.id === draggedResId ? {...r, seatId: targetId, startTime: dragTarget.startTime, endTime: dragTarget.endTime} : r));
      } else {
        alert("Güncelleme hatası: " + error.message);
      }
    }
    setDraggedResId(null);
    setDragTarget(null);
    fetchData();
  };

  const finalizeReservation = async (data: any) => {
    const overlapping = data.selectedSeats.some((sid: string) => 
      checkOverlap(data.startTime, data.endTime, reservations.filter(r => r.seatId === sid && r.date === dateStr), data.id)
    );
    if (overlapping) {
      alert("Seçilen saatler dolu! Lütfen kontrol ediniz.");
      return;
    }

    if (data.id) {
       // Düzenleme Modu
       const { error } = await supabase.from('reservations').update({
         name: data.name, phone: data.phone, start_time: data.startTime, end_time: data.endTime, is_paid: data.isPaid
       }).eq('id', data.id);
       if (error) alert("Hata: " + error.message);
    } else {
       // Yeni Kayıt
       const gid = Math.random().toString(36).substr(2, 9);
       const { error } = await supabase.from('reservations').insert(data.selectedSeats.map((sid: string) => ({
         group_id: gid, seat_id: sid, name: data.name, phone: data.phone,
         start_time: data.startTime, end_time: data.endTime, is_paid: data.isPaid,
         created_at: Date.now(), date: dateStr, user_id: session?.user?.id
       })));
       if (error) alert("Hata: " + error.message);
    }
    fetchData();
    setIsModalOpen(false);
  };

  const handleAddToBlacklist = async (data: any) => {
     if(!data.phone) return;
     if(!confirm(`${data.name} (${data.phone}) kara listeye eklensin mi?`)) return;
     
     const { error } = await supabase.from('blacklist').insert({
        phone: data.phone, name: data.name, reason: 'Manuel Eklendi', added_at: Date.now()
     });
     
     if(error) alert('Hata: ' + error.message);
     else {
        alert('Kara listeye eklendi.');
        fetchData();
        setIsModalOpen(false);
     }
  };

  const handleCleanDay = async () => {
    if (!confirm(`${format(currentDate, 'dd MMMM yyyy', { locale: tr })} tarihindeki tüm kayıtları silmek istediğinize emin misiniz?`)) return;
    await supabase.from('reservations').delete().eq('date', dateStr);
    fetchData();
  };

  const handleCleanMonth = async () => {
    // ... clean logic
  };

  if (authLoading) return <div className="fixed inset-0 bg-sim-black flex items-center justify-center text-sim-yellow"><Loader2 className="animate-spin" size={48}/></div>;
  if (!session) return <LoginScreen />;

  return (
    <div className="fixed inset-0 bg-sim-black flex items-center justify-center p-[2vh_2vw]">
      <div className="h-full w-full flex flex-col bg-sim-dark border-4 rounded-xl shadow-2xl relative" style={{ borderColor: THEME.main }} onClick={() => setSelectedIds([])}>
        {/* HEADER */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-sim-border bg-[#121212] shrink-0 z-[70]">
          <div className="flex items-center gap-8">
            <div className="h-12 w-12 bg-sim-yellow/10 rounded-lg flex items-center justify-center border border-sim-yellow/30">
              <Clock className="text-sim-yellow" size={24} />
            </div>
            <div className="flex items-center gap-1">
              <button onClick={(e) => {e.stopPropagation(); setCurrentDate(prev => addDays(prev, -1))}} className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-sim-yellow rounded-full transition-colors"><ChevronLeft size={20}/></button>
              <div onClick={(e) => {e.stopPropagation(); dateInputRef.current?.showPicker()}} className="flex flex-col items-center px-4 cursor-pointer group relative">
                <div className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">{format(currentDate, 'EEEE', { locale: tr })}</div>
                <div className="text-sm font-medium text-gray-200 tracking-tight">{format(currentDate, 'dd MMMM yyyy', { locale: tr })}</div>
                <input ref={dateInputRef} type="date" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => setCurrentDate(new Date(e.target.value))} value={dateStr} />
              </div>
              <button onClick={(e) => {e.stopPropagation(); setCurrentDate(prev => addDays(prev, 1))}} className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-sim-yellow rounded-full transition-colors"><ChevronRight size={20}/></button>
            </div>
          </div>
          <div className="flex items-center gap-3">
             <button onClick={() => setIsSettingsModalOpen(true)} className="p-2 text-sim-yellow hover:bg-sim-yellow/10 rounded-lg transition-colors border border-sim-yellow/20"><Settings size={20} /></button>
             <button onClick={() => setIsBlacklistOpen(true)} className="p-2 text-sim-yellow hover:bg-sim-yellow/10 rounded-lg transition-colors border border-sim-yellow/20"><AlertOctagon size={20} /></button>
             <div className="flex bg-sim-black p-1 rounded-lg border border-sim-border">
                {simulatorGroups.map(g => (
                  <button key={g.id} onClick={(e) => {e.stopPropagation(); setView(g.id)}} className={`px-4 py-1.5 rounded-md font-bold text-[10px] uppercase transition-all ${view === g.id ? 'bg-sim-yellow text-black' : 'text-gray-500 hover:text-gray-300'}`}>{g.name}</button>
                ))}
             </div>
             <button onClick={() => { setInfoData(null); setIsModalOpen(true); }} className="bg-sim-yellow text-black px-6 py-2.5 rounded-lg font-black text-xs uppercase shadow-lg active:scale-95 transition-all flex items-center gap-2"><Plus size={14}/> Yeni Randevu</button>
          </div>
        </header>

        {/* MAIN CONTENT */}
        <div className="flex-1 overflow-auto bg-sim-black relative">
           <div className="flex relative" style={{ height: (endHour - START_HOUR) * HOUR_HEIGHT + HEADER_HEIGHT }}>
              
              {/* TIMELINE CURSOR */}
              {isSameDay(currentDate, now) && (
                 <div className="absolute left-0 right-0 border-b-2 z-[60] pointer-events-none" style={{ 
                   top: HEADER_HEIGHT + (((now.getHours() * 60 + now.getMinutes()) - START_HOUR * 60) / ((endHour - START_HOUR) * 60)) * ((endHour - START_HOUR) * HOUR_HEIGHT),
                   borderColor: THEME.timeline
                 }}>
                   <div className="absolute bottom-0 right-2 bg-sim-yellow text-black text-[10px] font-black px-2 py-1 rounded shadow-lg">
                      {format(now, 'HH:mm')}
                   </div>
                 </div>
              )}

              {/* TIME COLUMN */}
              <div className="w-16 bg-sim-dark border-r border-sim-border flex flex-col sticky left-0 z-[65]">
                <div className="h-[40px] flex items-center justify-center text-[8px] font-bold text-sim-yellow border-b border-sim-yellow sticky top-0 bg-sim-dark z-20">SAAT</div>
                <div className="flex-1">
                  {Array.from({ length: endHour - START_HOUR }).map((_, i) => (
                    <div key={i} className="border-b border-sim-border/10 flex items-center justify-center font-mono text-[10px] text-gray-600" style={{ height: HOUR_HEIGHT }}>
                      {`${(START_HOUR + i) % 24}:00`.padStart(5, '0')}
                    </div>
                  ))}
                </div>
              </div>

              {/* SEATS GRID */}
              <div className="flex-1 flex min-w-[1000px] relative">
                {currentViewSeats.map(seat => (
                  <div key={seat.id} className="flex-1 border-r border-sim-border/20 flex flex-col relative">
                    <div className="h-[40px] flex items-center justify-center font-black text-sim-yellow border-b border-sim-yellow text-[10px] uppercase bg-sim-black/90 sticky top-0 z-[60]">{seat.label}</div>
                    
                    <div className="flex-1 relative w-full" 
                         onDragOver={(e) => handleDragOver(e, seat.id)} 
                         onDrop={(e) => handleDrop(e, seat.id)}
                         onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); const y = e.clientY - e.currentTarget.getBoundingClientRect().top; setContextMenu({ visible: true, x: e.pageX, y: e.pageY, seatId: seat.id, time: minutesToTime(Math.floor(((START_HOUR * 60) + (y / HOUR_HEIGHT * 60)) / 30) * 30) }); }}
                    >
                       {/* Drop Preview */}
                       {dragTarget?.seatId === seat.id && (
                          <div className="absolute left-0 right-0 z-[80] border-4 border-dashed bg-green-500/20 border-green-500 flex items-center justify-center" style={getGridPosition(dragTarget.startTime, dragTarget.endTime, START_HOUR, endHour)}>
                             <span className="text-green-400 font-bold bg-black/50 px-2 rounded">{dragTarget.startTime} - {dragTarget.endTime}</span>
                          </div>
                       )}

                       {/* Reservations */}
                       {reservations.filter(r => r.seatId === seat.id && r.date === dateStr).map(res => {
                          const pos = getGridPosition(res.startTime, res.endTime, START_HOUR, endHour);
                          const isSelected = selectedIds.includes(res.id);
                          const isPast = timeToMinutes(res.endTime) < (now.getHours() * 60 + now.getMinutes()) && isSameDay(currentDate, now);
                          const color = res.isPaid ? (isPast ? THEME.pastPaid : THEME.futurePaid) : (isPast ? THEME.pastUnpaid : THEME.futureUnpaid);
                          
                          return (
                            <div key={res.id} 
                                 draggable={!isCtrlPressed}
                                 onDragStart={(e) => handleDragStart(e, res.id)}
                                 onClick={(e) => { e.stopPropagation(); setSelectedIds([res.id]); }}
                                 onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setContextMenu({ visible: true, x: e.pageX, y: e.pageY, reservationId: res.id }); }}
                                 className={`absolute left-0 right-0 mx-1 rounded-sm border shadow-lg flex flex-col items-center justify-center p-1 overflow-hidden transition-all z-[50] ${isSelected ? 'ring-2 ring-white z-[90]' : ''}`}
                                 style={{ top: pos.top, height: pos.height, backgroundColor: color, borderColor: THEME.border, opacity: THEME.opacity }}>
                              <span className="text-[9px] font-black leading-none opacity-80 mb-0.5">{res.startTime}-{res.endTime}</span>
                              <span className="text-[11px] font-black truncate w-full text-center uppercase text-white">{res.name}</span>
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

      <ReservationModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSubmit={finalizeReservation} 
        onAddToBlacklist={handleAddToBlacklist}
        availableSeats={allSeats} 
        view={view} 
        simulatorGroups={simulatorGroups}
        initialData={infoData}
      />
      <SettingsModal 
         isOpen={isSettingsModalOpen} 
         onClose={() => setIsSettingsModalOpen(false)} 
         groups={simulatorGroups} onUpdateGroups={setSimulatorGroups} 
         endHour={endHour} onUpdateEndHour={setEndHour} 
         seatLabelPrefix={seatLabelPrefix} onUpdatePrefix={setSeatLabelPrefix} 
         onCleanDay={handleCleanDay} onCleanMonth={handleCleanMonth} 
      />
      <BlacklistModal isOpen={isBlacklistOpen} onClose={() => setIsBlacklistOpen(false)} blacklist={blacklist} onUpdate={fetchData} />
      
      {contextMenu.visible && <ContextMenu {...contextMenu} onClose={() => setContextMenu({...contextMenu, visible: false})} onAction={async (action) => {
           if (action === 'CREATE_NEW') { setInfoData({startTime: contextMenu.time}); setIsModalOpen(true); }
           if (action === 'SHOW_INFO') { 
              const r = reservations.find(res => res.id === contextMenu.reservationId); 
              if(r) { setInfoData({...r, selectedSeats: [r.seatId]}); setIsModalOpen(true); }
           }
           setContextMenu({...contextMenu, visible: false});
      }} type={contextMenu.reservationId ? 'RESERVATION' : 'EMPTY'} />}
    </div>
  );
}

function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert(error.message);
    setLoading(false);
  };
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-sim-black">
      <div className="bg-sim-dark p-10 rounded-2xl border border-sim-yellow/20 shadow-2xl w-full max-w-md">
        <div className="flex justify-center mb-6"><Loader2 size={40} className="text-sim-yellow" /></div>
        <h1 className="text-sim-yellow font-black text-2xl uppercase tracking-tighter mb-8 text-center">Sim Manager</h1>
        <form onSubmit={handleLogin} className="space-y-4">
          <input type="email" placeholder="E-Posta" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-sim-black border border-sim-border p-4 rounded-xl outline-none focus:border-sim-yellow text-white" required />
          <input type="password" placeholder="Şifre" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-sim-black border border-sim-border p-4 rounded-xl outline-none focus:border-sim-yellow text-white" required />
          <button type="submit" disabled={loading} className="w-full bg-sim-yellow text-black font-black py-4 rounded-xl uppercase hover:bg-sim-yellowHover transition-all">{loading ? 'Giriş Yapılıyor...' : 'Giriş Yap'}</button>
        </form>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}
