
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { format, addDays, isSameDay, startOfMonth } from 'date-fns';
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

// Hata Kalkanı Bileşeni
class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  componentDidCatch(error: Error, errorInfo: any) { console.error("CRITICAL APP ERROR:", error, errorInfo); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 bg-black text-red-500 flex flex-col items-center justify-center p-10 z-[9999]">
          <h1 className="text-3xl font-black mb-4">UYGULAMA HATASI</h1>
          <p className="text-gray-400 mb-4">Uygulama beklenmedik bir hata ile karşılaştı.</p>
          <pre className="bg-gray-900 p-6 rounded border border-gray-700 overflow-auto max-w-full text-xs font-mono mb-6">
            {this.state.error?.toString()}
          </pre>
          <button onClick={() => window.location.reload()} className="px-6 py-3 bg-red-600 text-white font-bold rounded hover:bg-red-700 transition-colors">
            SAYFAYI YENİLE
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

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

const DEFAULT_GROUPS: SimulatorGroup[] = [
  { id: 'LOGITECH', name: 'Logitech G29', seatCount: 8, order: 0 },
  { id: 'MOZA', name: 'Moza R5', seatCount: 8, order: 1 }
];

function AppContent() {
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [now, setNow] = useState(new Date());
  
  // Varsayılan olarak default grupları yükle, böylece DB boşsa bile arayüz gelir
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
  const [theme, setTheme] = useState(DEFAULT_THEME);

  const dateInputRef = useRef<HTMLInputElement>(null);
  const dateStr = format(currentDate, 'yyyy-MM-dd');

  useEffect(() => {
    let mounted = true;
    const initAuth = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (mounted) {
          setSession(data.session);
          setAuthLoading(false);
        }
      } catch (err) {
        console.error("Auth init warning (offline mode or invalid creds):", err);
        if (mounted) setAuthLoading(false);
      }
    };
    initAuth();

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
      // Promise.allSettled kullanıyoruz, böylece biri hata verse bile diğerleri yüklenir
      const [resResult, blResult, groupsResult] = await Promise.allSettled([
        supabase.from('reservations').select('*'),
        supabase.from('blacklist').select('*'),
        supabase.from('simulator_groups').select('*').order('order', { ascending: true })
      ]);

      if (resResult.status === 'fulfilled' && resResult.value.data) {
        setReservations(resResult.value.data.map(r => ({
          id: r.id, groupId: r.group_id, seatId: r.seat_id, name: r.name,
          phone: r.phone, startTime: r.start_time, endTime: r.end_time,
          isPaid: r.is_paid, createdAt: Number(r.created_at), date: r.date
        })));
      }

      if (blResult.status === 'fulfilled' && blResult.value.data) {
        setBlacklist(blResult.value.data);
      }

      if (groupsResult.status === 'fulfilled' && groupsResult.value.data && groupsResult.value.data.length > 0) {
        setSimulatorGroups(groupsResult.value.data);
      } else {
        // Eğer veritabanında grup tablosu yoksa veya boşsa varsayılanları koru
        console.warn("Simulator groups not found in DB, using defaults.");
      }
    } catch (error) { 
      console.error("Critical Fetch Error:", error); 
    }
  }, [session]);

  useEffect(() => {
    if (!session) return;
    fetchData();
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
    // Güvenlik kontrolü: simulatorGroups null/undefined ise boş dizi kullan
    (simulatorGroups || []).forEach(g => {
      if (!g) return;
      const gs = generateSeats(g.seatCount || 8, g.id as any, idx, seatLabelPrefix);
      seats = [...seats, ...gs];
      idx += (g.seatCount || 8);
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
      // Optimistik güncelleme
      setReservations(prev => prev.map(r => r.id === draggedResId ? {...r, seatId: targetId, startTime: dragTarget.startTime, endTime: dragTarget.endTime} : r));
    }
    setDraggedResId(null);
    setDragTarget(null);
    fetchData(); // Arka planda senkronize et
  };

  const finalizeReservation = async (data: any) => {
    const overlapping = data.selectedSeats.some((sid: string) => 
      checkOverlap(data.startTime, data.endTime, reservations.filter(r => r.seatId === sid && r.date === dateStr))
    );
    if (overlapping) {
      alert("Seçilen saatler dolu! Lütfen kontrol ediniz.");
      return;
    }
    const gid = Math.random().toString(36).substr(2, 9);
    
    // Optimistik Ekleme
    const newReservations = data.selectedSeats.map((sid: string, idx: number) => ({
      id: `temp-${Date.now()}-${idx}`,
      groupId: gid, seatId: sid, name: data.name, phone: data.phone,
      startTime: data.startTime, endTime: data.endTime, isPaid: data.isPaid,
      createdAt: Date.now(), date: dateStr
    }));
    setReservations(prev => [...prev, ...newReservations]);

    const { error } = await supabase.from('reservations').insert(data.selectedSeats.map((sid: string) => ({
      group_id: gid, seat_id: sid, name: data.name, phone: data.phone,
      start_time: data.startTime, end_time: data.endTime, is_paid: data.isPaid,
      created_at: Date.now(), date: dateStr, user_id: session?.user?.id
    })));

    if (error) {
      alert("Kayıt sırasında hata oluştu: " + error.message);
      fetchData(); // Hata varsa gerçek veriyi geri yükle
    } else {
      fetchData(); // ID'leri güncellemek için
    }
    setIsModalOpen(false);
  };

  const handleCleanDay = async () => {
    if (!confirm(`${format(currentDate, 'dd MMMM yyyy', { locale: tr })} tarihindeki tüm kayıtları silmek istediğinize emin misiniz?`)) return;
    await supabase.from('reservations').delete().eq('date', dateStr);
    fetchData();
  };

  const handleCleanMonth = async () => {
    if (!confirm(`Bu ay içindeki geçmiş tüm kayıtları silmek istediğinize emin misiniz?`)) return;
    const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');
    const yesterday = format(addDays(new Date(), -1), 'yyyy-MM-dd');
    await supabase.from('reservations').delete().gte('date', monthStart).lte('date', yesterday);
    fetchData();
  };

  if (authLoading) return <div className="fixed inset-0 bg-sim-black flex items-center justify-center text-sim-yellow"><Loader2 className="animate-spin" size={48}/></div>;
  if (!session) return <LoginScreen />;

  return (
    <div className="fixed inset-0 bg-sim-black overflow-hidden flex items-center justify-center p-[2vh_2vw]">
      <div className={`h-full flex flex-row gap-4 transition-all duration-500 w-full`}>
        <div className={`h-full flex flex-col bg-sim-dark border-4 rounded-xl shadow-2xl overflow-hidden relative w-full`} style={{ borderColor: theme.main }} onClick={() => setSelectedIds([])}>
          <header className="flex items-center justify-between px-6 py-4 border-b border-sim-border bg-[#121212] shrink-0 z-[70]">
            <div className="flex items-center gap-8">
              <div className="h-16 w-24 flex items-center justify-center relative group/logo cursor-pointer">
                <img src="logo.png" alt="Logo" className="w-full h-full object-contain relative z-10" onError={(e) => (e.currentTarget.style.display = 'none')} />
                <span className="text-xs font-black text-sim-yellow absolute opacity-20">LOGO</span>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={(e) => {e.stopPropagation(); setCurrentDate(prev => addDays(prev, -1))}} className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-sim-yellow rounded-full"><ChevronLeft size={16}/></button>
                <div onClick={(e) => {e.stopPropagation(); dateInputRef.current?.showPicker()}} className="flex flex-col items-center px-4 cursor-pointer group relative">
                    <span className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">{format(currentDate, 'EEEE', { locale: tr })}</span>
                    <span className="text-sm font-medium text-gray-200 tracking-tight">{format(currentDate, 'dd MMMM yyyy', { locale: tr })}</span>
                    <input ref={dateInputRef} type="date" onChange={(e) => setCurrentDate(new Date(e.target.value))} value={dateStr} className="absolute inset-0 opacity-0 cursor-pointer pointer-events-auto" />
                </div>
                <button onClick={(e) => {e.stopPropagation(); setCurrentDate(prev => addDays(prev, 1))}} className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-sim-yellow rounded-full"><ChevronRight size={16}/></button>
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
                                          onClick={(e) => { e.stopPropagation(); setSelectedIds([res.id]); }} 
                                          onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setContextMenu({ visible: true, x: e.pageX, y: e.pageY, reservationId: res.id }); }}
                                          className={`absolute left-0 right-0 rounded-sm overflow-hidden flex flex-col justify-center text-center p-1 transition-all border z-[50] ${selected ? 'ring-4 ring-white z-[90] shadow-2xl' : ''}`}
                                          style={{ top: pos.top, height: pos.height, backgroundColor: color, borderColor: selected ? '#fff' : theme.border, opacity: theme.opacity }}
                                        >
                                            <div className="text-[9px] font-black opacity-90 leading-none mb-0.5">{res.startTime}-{res.endTime}</div>
                                            <div className="font-black text-[11px] truncate uppercase px-1">{res.name}</div>
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
        <ReservationModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSubmit={finalizeReservation} availableSeats={allSeats} view={view} simulatorGroups={simulatorGroups} initialData={infoData} />
        <BlacklistModal isOpen={isBlacklistOpen} onClose={() => setIsBlacklistOpen(false)} blacklist={blacklist} onUpdate={fetchData} />
        <SettingsModal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} groups={simulatorGroups} onUpdateGroups={setSimulatorGroups} endHour={endHour} onUpdateEndHour={setEndHour} seatLabelPrefix={seatLabelPrefix} onUpdatePrefix={setSeatLabelPrefix} theme={theme} onUpdateTheme={setTheme} onCleanDay={handleCleanDay} onCleanMonth={handleCleanMonth} />
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
}

function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) alert('Hatalı giriş: ' + error.message);
        setLoading(false);
    };
    return (
        <div className="fixed inset-0 bg-sim-black flex items-center justify-center p-4">
            <div className="w-full max-w-[400px] bg-sim-dark border border-sim-yellow/30 p-10 rounded-2xl shadow-2xl relative">
                <div className="flex flex-col items-center mb-8">
                    <img src="logo.png" alt="Logo" className="h-24 mb-4 object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
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

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}
