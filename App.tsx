
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
/* Removed startOfMonth as it was unused and causing import error, fixed tr locale import */
import { format, addDays, isSameDay } from 'date-fns';
import { tr } from 'date-fns/locale/tr';
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
          <button onClick={() => window.location.reload()} style={{ padding: '10px 20px', cursor: 'pointer' }}>Yeniden Dene</button>
        </div>
      );
    }
    return this.props.children;
  }
}

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

  if (authLoading) {
    return (
      <div className="fixed inset-0 bg-sim-black flex flex-col items-center justify-center text-sim-yellow">
        <Loader2 className="animate-spin mb-4" size={48} />
        <span className="text-[10px] font-bold uppercase tracking-widest">Sistem Hazırlanıyor...</span>
      </div>
    );
  }

  if (!session) return <LoginScreen />;

  return (
    <div className="fixed inset-0 bg-sim-black flex items-center justify-center p-[2vh_2vw]">
      <div className="h-full w-full flex flex-col bg-sim-dark border-4 rounded-xl shadow-2xl relative" style={{ borderColor: theme.main }}>
        <header className="flex items-center justify-between px-6 py-4 border-b border-sim-border bg-[#121212] shrink-0">
          <div className="flex items-center gap-8">
            <div className="h-12 w-12 bg-sim-yellow/10 rounded-lg flex items-center justify-center border border-sim-yellow/30">
              <Clock className="text-sim-yellow" size={24} />
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setCurrentDate(prev => addDays(prev, -1))} className="p-2 text-gray-500 hover:text-sim-yellow"><ChevronLeft size={20}/></button>
              <div className="text-center px-4 cursor-pointer" onClick={() => dateInputRef.current?.showPicker()}>
                <div className="text-[10px] text-gray-500 uppercase font-bold">{format(currentDate, 'EEEE', { locale: tr })}</div>
                <div className="text-sm font-medium text-gray-200">{format(currentDate, 'dd MMMM yyyy', { locale: tr })}</div>
                <input ref={dateInputRef} type="date" className="hidden" onChange={(e) => setCurrentDate(new Date(e.target.value))} />
              </div>
              <button onClick={() => setCurrentDate(prev => addDays(prev, 1))} className="p-2 text-gray-500 hover:text-sim-yellow"><ChevronRight size={20}/></button>
            </div>
          </div>
          <div className="flex items-center gap-3">
             <div className="flex bg-sim-black p-1 rounded-lg border border-sim-border">
                {simulatorGroups.map(g => (
                  <button key={g.id} onClick={() => setView(g.id)} className={`px-4 py-1.5 rounded-md font-bold text-[10px] uppercase transition-all ${view === g.id ? 'bg-sim-yellow text-black' : 'text-gray-500 hover:text-gray-300'}`}>{g.name}</button>
                ))}
             </div>
             <button onClick={() => setIsModalOpen(true)} className="bg-sim-yellow text-black px-6 py-2.5 rounded-lg font-black text-xs uppercase shadow-lg active:scale-95 transition-all">Yeni Kayıt</button>
             <button onClick={() => setIsSettingsModalOpen(true)} className="p-2.5 text-sim-yellow border border-sim-yellow/20 rounded-lg"><Settings size={20}/></button>
          </div>
        </header>

        <div className="flex-1 overflow-auto bg-sim-black relative">
           <div className="flex min-h-full" style={{ height: (endHour - START_HOUR) * HOUR_HEIGHT + HEADER_HEIGHT }}>
              <div className="w-16 bg-sim-dark border-r border-sim-border flex flex-col sticky left-0 z-20">
                <div className="h-10 flex items-center justify-center text-[8px] font-bold text-sim-yellow border-b border-sim-yellow">SAAT</div>
                {Array.from({ length: endHour - START_HOUR }).map((_, i) => (
                  <div key={i} className="h-[60px] border-b border-sim-border/10 flex items-center justify-center font-mono text-[10px] text-gray-600">
                    {`${START_HOUR + i}:00`.padStart(5, '0')}
                  </div>
                ))}
              </div>
              <div className="flex-1 flex min-w-[1000px]">
                {currentViewSeats.map(seat => (
                  <div key={seat.id} className="flex-1 border-r border-sim-border/20 flex flex-col">
                    <div className="h-10 flex items-center justify-center font-black text-sim-yellow border-b border-sim-yellow text-[10px] uppercase bg-sim-black/50 sticky top-0 z-10">{seat.label}</div>
                    <div className="flex-1 relative">
                      {reservations.filter(r => r.seatId === seat.id && r.date === dateStr).map(res => {
                        const pos = getGridPosition(res.startTime, res.endTime, START_HOUR, endHour);
                        const isPast = timeToMinutes(res.endTime) < (now.getHours() * 60 + now.getMinutes()) && isSameDay(currentDate, now);
                        const color = res.isPaid ? (isPast ? theme.pastPaid : theme.futurePaid) : (isPast ? theme.pastUnpaid : theme.futureUnpaid);
                        return (
                          <div key={res.id} className="absolute inset-x-1 rounded border shadow-lg flex flex-col items-center justify-center p-1 overflow-hidden" 
                               style={{ top: pos.top, height: pos.height, backgroundColor: color, borderColor: theme.border, opacity: theme.opacity }}
                               onClick={() => { setInfoData({...res, seats: reservations.filter(x => x.groupId === res.groupId).map(x => x.seatId)}); setIsInfoOpen(true); }}>
                            <span className="text-[8px] font-black leading-none opacity-80">{res.startTime}-{res.endTime}</span>
                            <span className="text-[10px] font-black truncate w-full text-center uppercase">{res.name}</span>
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

      <ReservationModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSubmit={fetchData} availableSeats={allSeats} view={view} simulatorGroups={simulatorGroups} />
      <SettingsModal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} groups={simulatorGroups} onUpdateGroups={setSimulatorGroups} endHour={endHour} onUpdateEndHour={setEndHour} seatLabelPrefix={seatLabelPrefix} onUpdatePrefix={setSeatLabelPrefix} theme={theme} onUpdateTheme={setTheme} onCleanDay={() => {}} onCleanMonth={() => {}} />
      <InfoModal data={infoData} onClose={() => { setIsInfoOpen(false); setInfoData(null); }} />
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
    <div className="bg-sim-dark p-10 rounded-2xl border border-sim-yellow/20 shadow-2xl w-full max-w-md">
      <h1 className="text-sim-yellow font-black text-2xl uppercase tracking-tighter mb-8 text-center">Yönetici Girişi</h1>
      <form onSubmit={handleLogin} className="space-y-4">
        <input type="email" placeholder="E-Posta" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-sim-black border border-sim-border p-4 rounded-xl outline-none focus:border-sim-yellow text-white" required />
        <input type="password" placeholder="Şifre" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-sim-black border border-sim-border p-4 rounded-xl outline-none focus:border-sim-yellow text-white" required />
        <button type="submit" disabled={loading} className="w-full bg-sim-yellow text-black font-black py-4 rounded-xl uppercase hover:bg-sim-yellowHover transition-all">{loading ? 'Giriş Yapılıyor...' : 'Giriş Yap'}</button>
      </form>
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
