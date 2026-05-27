const formatTime = date => {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  return `${year}-${pad(month)}-${pad(day)}`
}

const pad = n => n.toString().padStart(2, '0')

const getDateStr = (date, separator = '-') => {
  const d = date || new Date()
  return `${d.getFullYear()}${separator}${pad(d.getMonth() + 1)}${separator}${pad(d.getDate())}`
}

const getMonthDays = (year, month) => {
  return new Date(year, month, 0).getDate()
}

const getFirstDayOfMonth = (year, month) => {
  return new Date(year, month - 1, 1).getDay()
}

const getWeekNumber = date => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
}

const calcDuration = (startTime, endTime) => {
  const start = new Date(startTime)
  const end = new Date(endTime)
  const diff = Math.floor((end - start) / 1000)
  const hours = Math.floor(diff / 3600)
  const minutes = Math.floor((diff % 3600) / 60)
  return { hours, minutes, totalMinutes: Math.floor(diff / 60) }
}

const formatDuration = (hours, minutes) => {
  if (hours > 0) return `${hours}小时${minutes}分钟`
  return `${minutes}分钟`
}

const formatHM = date => {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

module.exports = {
  formatTime,
  formatHM,
  getDateStr,
  getMonthDays,
  getFirstDayOfMonth,
  getWeekNumber,
  calcDuration,
  formatDuration,
  pad
}
