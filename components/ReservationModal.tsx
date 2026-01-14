
import React, { useState, useEffect, useRef } from 'react';
import { X, GripHorizontal, User, Phone, Clock, Monitor } from 'lucide-react';
import { SimulatorType, Seat, SimulatorGroup } from '../types';
import { formatPhoneNumber } from '../utils';

interface ReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  initialData?: any;
  availableSeats: Seat[];
  onAutoFill?: () => void;
  view: SimulatorType;
  simulatorGroups: SimulatorGroup[];
}

export const ReservationModal: React.FC<ReservationModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  availableSeats,
  view,
  simulatorGroups
}) => {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    startTime: '12:00',
    endTime: '13:00',
    selectedSeats: [] as string[],
    isPaid: false
  });

  const [position, setPosition] = useState({ x: 100, y: 100 });
  const draggingRef = useRef(false);
  const offsetRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData({
          name: initialData.name || '',
          phone: initialData.phone || '',
          startTime: initialData.startTime || '12:00',
          endTime: initialData.endTime || '13:00',
          selectedSeats: initialData.selectedSeats || [],
          isPaid: initialData.isPaid || false
        });
      } else {
        // Reset for new entry
        setFormData(prev => ({
            ...prev,
            name: '',
            phone: '',
            selectedSeats: [],
            isPaid: false
        }));
      }
      // Center modal roughly
      setPosition({ 
        x: window.innerWidth / 2 - 250, 
        y: window.innerHeight / 2 - 300 
      });
    }
  }, [isOpen, initialData]);

  const handleMouseDown = (e: React.MouseEvent) => {
    draggingRef.current = true;
    offsetRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (draggingRef.current) {
      setPosition({
        x: e.clientX - offsetRef.current.x,
        y: e.clientY - offsetRef.current.y
      });
    }
  };

  const handleMouseUp = () => {
    draggingRef.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  const handleSeatToggle = (seatId: string) => {
    setFormData(prev => {
      const exists = prev.selectedSeats.includes(seatId);
      if (exists) {
        return { ...prev, selectedSeats: prev.selectedSeats.filter(id => id !== seatId) };
      } else {
        return { ...prev, selectedSeats: [...prev.selectedSeats, seatId] };
      }
    });
  };

  const handleQuickFill = () => {
    setFormData(prev => ({
      ...prev,
      name: 'X',
      phone: '111 111 11 01'
    }));
  };

  const handleSave = () => {
    // Validation
    if (!formData.name.trim()) {
        alert("Lütfen isim giriniz.");
        return;
    }
    if (!formData.phone.trim()) {
        alert("Lütfen telefon numarası giriniz.");
        return;
    }
    if (formData.selectedSeats.length === 0) {
        alert("Lütfen en az bir masa seçiniz.");
        return;
    }
    
    // Validate Time
    if (formData.startTime >= formData.endTime) {
        alert("Bitiş saati başlangıç saatinden sonra olmalıdır.");
        return;
    }

    onSubmit(formData);
  };

  // Helper to reorder seats for display if exactly 8 (Snake layout: 1-4, then 8-5)
  // Or generic grid for others
  const getOrderedSeatsForDisplay = (seatList: Seat[]) => {
    if (seatList.length === 8) {
      return [
        seatList[0], seatList[1], seatList[2], seatList[3],
        seatList[7], seatList[6], seatList[5], seatList[4]
      ];
    }
    return seatList;
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed z-[90] shadow-2xl rounded-lg border border-sim-yellow overflow-hidden flex flex-col w-[500px] bg-sim-dark"
      style={{ left: position.x, top: position.y }}
    >
      {/* Header (Draggable) */}
      <div 
        className="h-10 bg-sim-black border-b border-sim-border flex items-center justify-between px-4 cursor-move select-none"
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2 text-sim-yellow font-bold text-sm uppercase">
          <GripHorizontal size={16} />
          {initialData ? 'Randevu Düzenle' : 'Randevu Oluştur'}
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          <X size={18} />
        </button>
      </div>

      {/* Body */}
      <div className="p-6 overflow-y-auto max-h-[80vh] space-y-4">
        
        {/* Quick Fill Button */}
        {!initialData && (
          <button 
            type="button"
            onClick={handleQuickFill}
            className="w-full py-1 text-xs bg-sim-gray border border-dashed border-gray-500 text-gray-300 hover:text-white hover:border-white transition-colors rounded mb-2"
          >
            Randevusuz Hızlı Kayıt (İsim: X)
          </button>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs text-gray-400 flex items-center gap-1"><User size={12}/> İsim Soyisim <span className="text-red-500">*</span></label>
            <input 
              type="text" 
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value.toUpperCase()})}
              className="w-full bg-sim-black border border-sim-border rounded p-2 text-sim-text focus:border-sim-yellow focus:outline-none uppercase"
              placeholder="AD SOYAD"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-gray-400 flex items-center gap-1"><Phone size={12}/> Telefon <span className="text-red-500">*</span></label>
            <input 
              type="text" 
              value={formData.phone}
              onChange={e => setFormData({...formData, phone: formatPhoneNumber(e.target.value)})}
              className="w-full bg-sim-black border border-sim-border rounded p-2 text-sim-text focus:border-sim-yellow focus:outline-none"
              placeholder="5XX XXX XX XX"
              maxLength={13}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs text-gray-400 flex items-center gap-1"><Clock size={12}/> Başlangıç</label>
            <input 
              type="time" 
              value={formData.startTime}
              onChange={e => setFormData({...formData, startTime: e.target.value})}
              className="w-full bg-sim-black border border-sim-border rounded p-2 text-sim-text focus:border-sim-yellow focus:outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-gray-400 flex items-center gap-1"><Clock size={12}/> Bitiş</label>
            <input 
              type="time" 
              value={formData.endTime}
              onChange={e => setFormData({...formData, endTime: e.target.value})}
              className="w-full bg-sim-black border border-sim-border rounded p-2 text-sim-text focus:border-sim-yellow focus:outline-none"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs text-gray-400 flex items-center gap-1"><Monitor size={12}/> Masa Seçimi <span className="text-red-500">*</span></label>
          <div className="p-3 bg-sim-black rounded border border-sim-border space-y-4">
            
            {simulatorGroups.map(group => {
                const groupSeats = getOrderedSeatsForDisplay(availableSeats.filter(s => s.type === group.id));
                if(groupSeats.length === 0) return null;
                
                return (
                    <div key={group.id}>
                        <div className="mb-2 text-xs text-sim-yellow font-bold uppercase">{group.name}</div>
                        <div className="grid grid-cols-4 gap-2">
                            {groupSeats.map(seat => (
                                <button
                                key={seat.id}
                                onClick={() => handleSeatToggle(seat.id)}
                                className={`
                                    p-2 text-xs font-bold rounded border transition-all
                                    ${formData.selectedSeats.includes(seat.id) 
                                    ? 'bg-sim-yellow text-black border-sim-yellow shadow-[0_0_10px_rgba(251,191,36,0.5)] scale-105' 
                                    : 'bg-sim-gray text-gray-400 border-sim-border hover:border-gray-500'}
                                `}
                                >
                                {seat.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )
            })}
          </div>
        </div>

        <div className="flex items-center gap-4 bg-sim-black p-3 rounded border border-sim-border">
          <span className="text-sm text-gray-300">Ödeme Durumu:</span>
          <label className="flex items-center gap-2 cursor-pointer">
            <input 
              type="radio" 
              name="payment" 
              checked={formData.isPaid} 
              onChange={() => setFormData({...formData, isPaid: true})}
              className="accent-green-500"
            />
            <span className="text-sm text-green-400">Ücret Alındı</span>
          </label>
           <label className="flex items-center gap-2 cursor-pointer">
            <input 
              type="radio" 
              name="payment" 
              checked={!formData.isPaid} 
              onChange={() => setFormData({...formData, isPaid: false})}
              className="accent-red-500"
            />
            <span className="text-sm text-red-400">Alınmadı</span>
          </label>
        </div>

        <button 
          onClick={handleSave}
          className="w-full bg-sim-yellow text-black font-bold py-3 rounded hover:bg-sim-yellowHover transition-colors uppercase tracking-wider"
        >
          {initialData ? 'Değişiklikleri Kaydet' : 'Randevu Oluştur'}
        </button>

      </div>
    </div>
  );
};
