const cloudUtil = require('../../utils/cloud')
const util = require('../../utils/util')

const MEASURE_FIELDS = [
  { name: 'waist', label: '腰围' },
  { name: 'hip', label: '臀围' },
  { name: 'chest', label: '胸围' },
  { name: 'thigh', label: '大腿围' },
  { name: 'calf', label: '小腿围' },
  { name: 'arm', label: '手臂围' }
]

Page({
  data: {
    year: 0,
    month: 0,
    weekdays: ['日', '一', '二', '三', '四', '五', '六'],
    emptyCells: [],
    days: [],
    selectedDate: '',
    dayDetail: {},
    stat: {
      continuousDays: 0,
      totalDays: 0,
      totalDuration: 0,
      monthDays: 0,
      monthDuration: 0,
      aerobicMinutes: 0,
      anaerobicMinutes: 0
    },
    _workoutMap: {},
    _weightMap: {},
    _measureMap: {},
    _dietMap: {}
  },

  async onLoad() {
    const now = new Date()
    this.setData({ year: now.getFullYear(), month: now.getMonth() + 1 })
    await cloudUtil.getOpenid()
    this.loadAllData()
  },

  async onShow() {
    await cloudUtil.getOpenid()
    this.loadAllData()
  },

  async loadAllData() {
    try {
      const openid = getApp().globalData.openid
      if (!openid) return
      const { year: y, month: m } = this.data
      const db = cloudUtil.db
      const monthStart = `${y}-${util.pad(m)}-01`
      const monthEnd = `${y}-${util.pad(m)}-${util.getMonthDays(y, m)}`
      const dateFilter = db.command.gte(monthStart).and(db.command.lte(monthEnd))

      const [fitnessRes, weightRes, measureRes, dietRes] = await Promise.all([
        db.collection('fitness_records').where({ _openid: openid, date: dateFilter }).get(),
        db.collection('weight_records').where({ _openid: openid, date: dateFilter }).get(),
        db.collection('measurement_records').where({ _openid: openid, date: dateFilter }).get(),
        db.collection('diet_records').where({ _openid: openid, date: dateFilter }).get()
      ])

      const workoutMap = {}
      const allFitnessRecords = []
      fitnessRes.data.forEach(r => {
        allFitnessRecords.push(r)
        if (!workoutMap[r.date]) workoutMap[r.date] = []
        workoutMap[r.date].push(r)
      })

      const weightMap = {}
      weightRes.data.forEach(r => { weightMap[r.date] = r.weight })

      const measureMap = {}
      measureRes.data.forEach(r => { measureMap[r.date] = r.values })

      const dietMap = {}
      dietRes.data.forEach(r => { dietMap[r.date] = r.status })

      this.setData({
        _workoutMap: workoutMap,
        _weightMap: weightMap,
        _measureMap: measureMap,
        _dietMap: dietMap
      })

      this.calcStats(allFitnessRecords)
      this.buildCalendar()
    } catch (err) { console.error('加载数据失败', err) }
  },

  calcStats(records) {
    const openid = getApp().globalData.openid
    if (!openid) return

    const dateSet = new Set()
    records.forEach(r => { if (r.date) dateSet.add(r.date) })
    const sortedDates = [...dateSet].sort().reverse()

    let continuousDays = 0
    if (sortedDates.length > 0) {
      continuousDays = 1
      for (let i = 1; i < sortedDates.length; i++) {
        if (Math.round((new Date(sortedDates[i - 1]) - new Date(sortedDates[i])) / 86400000) === 1) continuousDays++
        else break
      }
    }

    let totalMinutes = 0
    records.forEach(r => { totalMinutes += (r.durationMinutes || 0) })
    const totalDuration = Math.round(totalMinutes / 60 * 10) / 10

    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthSet = new Set()
    let monthMinutes = 0
    let aerobicMinutes = 0
    let anaerobicMinutes = 0

    records.forEach(r => {
      if (r.date) monthSet.add(r.date)
      monthMinutes += (r.durationMinutes || 0)
      const rawTypes = Array.isArray(r.selectedTypes) ? r.selectedTypes : (r.trainTypes ? [r.trainTypes] : [])
      const typeList = rawTypes.length === 1 && typeof rawTypes[0] === 'string' ? rawTypes[0].split('、') : rawTypes
      if (typeList.includes('有氧')) aerobicMinutes += (r.durationMinutes || 0)
      if (typeList.includes('无氧')) anaerobicMinutes += (r.durationMinutes || 0)
    })

    const monthDuration = Math.round(monthMinutes / 60 * 10) / 10

    this.setData({
      stat: {
        continuousDays,
        totalDays: dateSet.size,
        totalDuration,
        monthDays: monthSet.size,
        monthDuration,
        aerobicMinutes,
        anaerobicMinutes
      }
    })
  },

  buildCalendar() {
    const { year: y, month: m, _workoutMap, _weightMap } = this.data
    const totalDays = util.getMonthDays(y, m)
    const firstDay = util.getFirstDayOfMonth(y, m)
    const emptyCells = Array(firstDay).fill(0)
    const today = util.getDateStr(new Date())

    const days = []
    for (let i = 1; i <= totalDays; i++) {
      const dateStr = `${y}-${util.pad(m)}-${util.pad(i)}`
      const weight = _weightMap[dateStr]
      days.push({
        day: i,
        date: dateStr,
        isToday: dateStr === today,
        hasWorkout: !!_workoutMap[dateStr],
        weight: weight ? weight + '' : ''
      })
    }
    this.setData({ emptyCells, days })
  },

  prevMonth() {
    let { year: y, month: m } = this.data
    m--
    if (m < 1) { m = 12; y-- }
    this.setData({ year: y, month: m, selectedDate: '', dayDetail: {} }, () => {
      this.loadAllData()
    })
  },

  nextMonth() {
    let { year: y, month: m } = this.data
    m++
    if (m > 12) { m = 1; y++ }
    this.setData({ year: y, month: m, selectedDate: '', dayDetail: {} }, () => {
      this.loadAllData()
    })
  },

  onDayTap(e) {
    const { date } = e.currentTarget.dataset
    const { _workoutMap, _weightMap, _measureMap, _dietMap } = this.data
    const workoutRecords = _workoutMap[date] || []
    const weight = _weightMap[date] || ''
    const measureVals = _measureMap[date] || null
    const dietStatus = _dietMap[date] || ''

    let totalMinutes = 0
    let aerobicMinutes = 0
    let anaerobicMinutes = 0
    workoutRecords.forEach(r => {
      const dur = r.durationMinutes || 0
      totalMinutes += dur
      const rawTypes = Array.isArray(r.selectedTypes) ? r.selectedTypes : (r.trainTypes ? [r.trainTypes] : [])
      const typeList = rawTypes.length === 1 && typeof rawTypes[0] === 'string' ? rawTypes[0].split('、') : rawTypes
      if (typeList.includes('有氧')) aerobicMinutes += dur
      if (typeList.includes('无氧')) anaerobicMinutes += dur
    })
    const hasWorkout = workoutRecords.length > 0
    const totalDurationText = totalMinutes > 0 ? (totalMinutes >= 60 ? `${Math.floor(totalMinutes / 60)}时${totalMinutes % 60}分` : `${totalMinutes}分`) : ''

    const measureList = []
    if (measureVals) {
      MEASURE_FIELDS.forEach(f => {
        if (measureVals[f.name]) measureList.push({ label: f.label, value: measureVals[f.name] + 'cm' })
      })
    }

    let dietLabel = ''
    let dietClass = ''
    let dietIcon = ''
    if (dietStatus === 'healthy') { dietLabel = '健康饮食'; dietClass = 'diet-ok'; dietIcon = '🥗' }
    else if (dietStatus === 'high_calorie') { dietLabel = '高热量饮食'; dietClass = 'diet-warn'; dietIcon = '⚠️' }

    const measureSummary = measureList.map(m => `${m.label}${m.value}`).join(' · ')

    this.setData({
      selectedDate: date,
      dayDetail: {
        hasWorkout,
        aerobicMinutes,
        anaerobicMinutes,
        totalDurationText,
        weight: weight || '',
        hasMeasure: measureList.length > 0,
        measureList,
        measureSummary,
        dietLabel,
        dietClass,
        dietIcon
      }
    })
  },

  navigateTo(e) {
    const url = e.currentTarget.dataset.url
    wx.navigateTo({ url })
  }
})