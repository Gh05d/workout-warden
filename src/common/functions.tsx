export function displayDate(start: string, end: string) {
  const [pureDate] = start.split(' ');
  const [pureEndDate] = end.split(' ');

  let [_, monthStart, dayStart] = pureDate.split('-');
  let startDateFormatted = `${dayStart}.${monthStart}`;

  let [yearEnd, monthEnd, dayEnd] = pureEndDate.split('-');
  let endDateFormatted = `${dayEnd}.${monthEnd}`;

  return `${startDateFormatted} - ${endDateFormatted}.${yearEnd}`;
}

export const formatTime = (timeLeft: number) => {
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
};
