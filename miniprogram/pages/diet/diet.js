const cloudUtil = require('../../utils/cloud')
const util = require('../../utils/util')

Page({
  data: {
    year: 0,
    month: 0,
    weekdays: ['日', '一', '二', '三', '四', '五', '六'],
    emptyCells: [],
    days: [],
    dietRecordsMap: {},
    todayStatus: '',
    editingId: '',
    showModal: false,
    modalType: '',
    modalIcon: '',
    modalText: ''
  },

  onLoad() {
    const now = new Date()
    this.setData({
      year: now.getFullYear(),
      month: now.getMonth() + 1
    })
    this.initAndLoad()
  },

  onShow() {
    this.initAndLoad()
  },

  async initAndLoad() {
    await cloudUtil.getOpenid()
    this.buildCalendar()
    this.loadDietRecords()
  },

  buildCalendar() {
    const { year, month, dietRecordsMap } = this.data
    const totalDays = util.getMonthDays(year, month)
    const firstDay = util.getFirstDayOfMonth(year, month)
    const emptyCells = Array(firstDay).fill(0)
    const today = util.getDateStr(new Date())

    const days = []
    for (let i = 1; i <= totalDays; i++) {
      const dateStr = `${year}-${util.pad(month)}-${util.pad(i)}`
      const status = dietRecordsMap[dateStr] || ''
      days.push({
        day: i,
        date: dateStr,
        isToday: dateStr === today,
        status
      })
    }

    const todayStatus = dietRecordsMap[today] || ''
    this.setData({ emptyCells, days, todayStatus })
  },

  async loadDietRecords() {
    try {
      const openid = getApp().globalData.openid
      if (!openid) return
      const { year, month } = this.data
      const monthStart = `${year}-${util.pad(month)}-01`
      const monthEnd = `${year}-${util.pad(month)}-${util.getMonthDays(year, month)}`
      const db = cloudUtil.db
      const res = await db.collection('diet_records')
        .where({ _openid: openid, date: db.command.gte(monthStart).and(db.command.lte(monthEnd)) })
        .get()

      const map = {}
      const idMap = {}
      res.data.forEach(r => {
        map[r.date] = r.status
        idMap[r.date] = r._id
      })

      const today = util.getDateStr(new Date())
      const todayStatus = map[today] || ''
      const editingId = idMap[today] || ''

      this.setData({ dietRecordsMap: map, todayStatus, editingId })
      this.buildCalendar()
    } catch (err) {
      console.error('加载饮食记录失败', err)
    }
  },

  prevMonth() {
    let { year, month } = this.data
    month--
    if (month < 1) { month = 12; year-- }
    this.setData({ year, month }, () => {
      this.buildCalendar()
      this.loadDietRecords()
    })
  },

  nextMonth() {
    let { year, month } = this.data
    month++
    if (month > 12) { month = 1; year++ }
    this.setData({ year, month }, () => {
      this.buildCalendar()
      this.loadDietRecords()
    })
  },

  onDayTap(e) {
    const { date } = e.currentTarget.dataset
    const status = this.data.dietRecordsMap[date]
    if (status) {
      const label = status === 'healthy' ? '🥗 健康饮食' : '⚠️ 高热量饮食'
      wx.showToast({ title: `${date} ${label}`, icon: 'none' })
      return
    }
    wx.showToast({ title: '该日无饮食记录', icon: 'none' })
  },

  async chooseHealthy() {
    await this.saveDiet('healthy', '😊', '真棒！')
  },

  async chooseJunk() {
    await this.saveDiet('high_calorie', '😅', '明天要好好吃饭哦！')
  },

  async saveDiet(status, icon, text) {
    try {
      const today = util.getDateStr(new Date())
      if (this.data.editingId) {
        await cloudUtil.updateRecord('diet_records', this.data.editingId, { status })
      } else {
        await cloudUtil.addRecord('diet_records', { date: today, status })
      }
      this.setData({
        dietRecordsMap: { ...this.data.dietRecordsMap, [today]: status },
        todayStatus: status,
        showModal: true,
        modalIcon: icon,
        modalText: text,
        modalType: status === 'healthy' ? 'keep' : 'warn'
      })
      this.buildCalendar()
    } catch (err) {
      console.error('保存饮食记录失败', err)
      wx.showToast({ title: '保存失败', icon: 'none' })
    }
  },

  closeModal() {
    this.setData({ showModal: false })
  },

  goCalendar() { wx.switchTab({ url: '/pages/calendar/calendar' }) }
})
