
import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { Copy, Info, Edit } from 'lucide-react';

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onAction: (action: string) => void;
  type: 'RESERVATION' | 'EMPTY';
  seatType?: string;
  reservationId?: string;
  seatId?: string;
  time?: string;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, onClose, onAction, type }) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ x, y });

  useLayoutEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let newX = x;
      let newY = y;

      if (x + rect.width > viewportWidth) {
        newX = x - rect.width;
      }
      if (y + rect.height > viewportHeight) {
        newY = y - rect.height;
      }
      
      setCoords({ x: newX, y: newY });
    }
  }, [x, y]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const style = {
    top: coords.y,
    left: coords.x,
  };

  const itemClass = "flex items-center gap-2 px-4 py-2 hover:bg-sim-gray cursor-pointer text-sm text-sim-text transition-colors";

  return (
    <div 
      ref={menuRef}
      style={style}
      className="fixed z-[9999] bg-sim-black border border-sim-yellow/30 shadow-[0_0_15px_rgba(0,0,0,0.8)] rounded-md min-w-[220px] py-1 animate-in fade-in zoom-in duration-100"
    >
      {type === 'RESERVATION' ? (
        <>
          <div onClick={() => onAction('SHOW_INFO')} className={itemClass}>
            <Info size={16} className="text-blue-400" /> Bilgileri Göster
          </div>
          <div className="h-px bg-sim-border my-1" />
          <div onClick={() => onAction('COPY_INFO')} className={itemClass}>
            <Copy size={16} className="text-sim-yellow" /> Bilgileri Kopyala
          </div>
        </>
      ) : (
        <>
           <div onClick={() => onAction('CREATE_NEW')} className={itemClass}>
            <Edit size={16} className="text-sim-yellow" /> Yeni Randevu Oluştur
          </div>
        </>
      )}
    </div>
  );
};
