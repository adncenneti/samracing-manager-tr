
export const START_HOUR = 9; // 09:00 default
// END_HOUR is now dynamic in App, but we keep a default here if needed
export const DEFAULT_END_HOUR = 23; // 23:00

export const timeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  return (hours * 60) + minutes;
};

export const minutesToTime = (totalMinutes: number): string => {
  let hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  // Handle overflow if extending past 24h (optional, but good for safety)
  if (hours >= 24) hours = hours % 24;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

export const getGridPosition = (startTime: string, endTime: string, dayStartHour: number, dayEndHour: number) => {
  const startMins = timeToMinutes(startTime);
  const endMins = timeToMinutes(endTime);
  const dayStartMins = dayStartHour * 60;
  const totalMinutes = (dayEndHour - dayStartHour) * 60;

  // Handle crossing midnight for end time logic if needed, but for simple day view:
  // If end time is smaller than start (e.g. 23:00 to 00:00), treat 00:00 as next day minutes
  let effectiveEndMins = endMins;
  if (endMins < startMins) {
      effectiveEndMins += 24 * 60;
  }
  
  // Calculate relative to the dynamic day range
  const top = ((startMins - dayStartMins) / totalMinutes) * 100;
  const height = ((effectiveEndMins - startMins) / totalMinutes) * 100;

  return { top: `${top}%`, height: `${height}%` };
};

export const generateSeats = (count: number, type: 'LOGITECH' | 'MOZA', startLabelIndex: number = 1, prefix: string = 'S-'): any[] => {
  const seats = [];
  for (let i = 1; i <= count; i++) {
    // Generate IDs that are unique per type to avoid collisions
    seats.push({ 
        id: `${type}-${i}`, 
        label: `${prefix}${startLabelIndex + i - 1}`, 
        type: type 
    });
  }
  return seats;
};

export const checkOverlap = (
  newStart: string, 
  newEnd: string, 
  existingReservations: any[], 
  excludeId?: string
): boolean => {
  const newStartMins = timeToMinutes(newStart);
  let newEndMins = timeToMinutes(newEnd);
  if (newEndMins < newStartMins) newEndMins += 24 * 60;

  return existingReservations.some(res => {
    if (res.id === excludeId) return false;
    const resStartMins = timeToMinutes(res.startTime);
    let resEndMins = timeToMinutes(res.endTime);
    if (resEndMins < resStartMins) resEndMins += 24 * 60;

    return (newStartMins < resEndMins) && (newEndMins > resStartMins);
  });
};

export const formatPhoneNumber = (value: string) => {
  if (!value) return value;
  const phoneNumber = value.replace(/[^\d]/g, '');
  const phoneNumberLength = phoneNumber.length;
  if (phoneNumberLength < 4) return phoneNumber;
  if (phoneNumberLength < 7) {
    return `${phoneNumber.slice(0, 3)} ${phoneNumber.slice(3)}`;
  }
  return `${phoneNumber.slice(0, 3)} ${phoneNumber.slice(3, 6)} ${phoneNumber.slice(6, 11)}`;
};
