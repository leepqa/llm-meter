export function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

/** дд.мм.гггг */
export function formatDate(date: Date): string {
  return `${pad2(date.getDate())}.${pad2(date.getMonth() + 1)}.${date.getFullYear()}`
}

/** дд.мм */
export function formatDayShort(date: Date): string {
  return `${pad2(date.getDate())}.${pad2(date.getMonth() + 1)}`
}

/** Локальное время события: дд.мм чч:мм */
export function formatEventTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return `${formatDayShort(date)} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

export function formatInt(value: number): string {
  return Math.round(value).toLocaleString('ru-RU')
}

export function formatRub(value: number, digits = 2): string {
  const text = value.toLocaleString('ru-RU', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
  return `${text} ₽`
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1).replace('.', ',')} %`
}
