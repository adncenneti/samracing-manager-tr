
export type SimulatorType = string;

export interface SimulatorGroup {
  id: string; // e.g. 'LOGITECH', 'MOZA', 'FANATEC'
  name: string; // Display name
  seatCount: number;
  order: number;
}

export interface Reservation {
  id: string;
  groupId: string; // To link multiple seats in one booking
  seatId: string;
  name: string;
  phone: string;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  isPaid: boolean;
  createdAt: number;
  date: string; // YYYY-MM-DD
}

export interface BlacklistEntry {
  id?: string; // Added for json-server support
  phone: string;
  reason: string;
  addedAt: number;
  name?: string;
}

export interface Seat {
  id: string;
  label: string;
  type: SimulatorType;
}

export interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  reservationId?: string;
  seatId?: string; // If clicked on empty space
  time?: string; // If clicked on empty space
}
