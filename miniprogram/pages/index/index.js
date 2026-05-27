const cloudUtil = require('../../utils/cloud')
const util = require('../../utils/util')

Page({
  data: {
    isWorking: false,
    isPaused: false,
    statusText: '未开始',
    timerDisplay: '00:00:00',
    selectedTypes: [],
    aerobicClass: 'type-unselected',
    anaerobicClass: 'type-unselected',
    todayRecords: [],
    stats: { continuousDays: 0, totalDays: 0, weekMinutes: 0 },
    monthStats: { totalSessions: 0, totalHours: 0, avgMinutes: 0 },
    startTime: null,
    pauseStartTime: null,
    pausedTotalMs: 0,
    timerInterval: null,
    _profileChecked: false
  },

  onLoad() { this.setData({ _profileChecked: false }); this.initUser() },

  onShow() { this.loadTodayRecords(); this.loadStats() },

  onUnload() { if (this.data.timerInterval) clearInterval(this.data.timerInterval) },

  async initUser() {
    await cloudUtil.getOpenid()
    this.loadData()
  },

  async loadData() { this.loadTodayRecords(); this.loadStats(); this.checkProfilePrompt() },

  async loadTodayRecords() {
    try {
      const openid = getApp().globalData.openid
      if (!openid) return
      const today = util.getDateStr(new Date())
      const res = await cloudUtil.db.collection('fitness_records')
        .where({ _openid: openid, date: today })
        .orderBy('createTime', 'desc').get()
      this.setData({ todayRecords: res.data.map(r => ({ ...r, timeStr: r.startTime ? util.formatHM(new Date(r.startTime)) : '' })) })
    } catch (err) { console.error(err) }
  },

  async loadStats() {
    try {
      const openid = getApp().globalData.openid
      if (!openid) return
      const allRes = await cloudUtil.db.collection('fitness_records').where({ _openid: openid }).orderBy('createTime', 'desc').get()
      const records = allRes.data
      const allDates = [...new Set(records.map(r => r.date))].sort().reverse()
      const totalDays = allDates.length
      let continuousDays = 0
      if (allDates.length > 0) {
        continuousDays = 1
        for (let i = 1; i < allDates.length; i++) {
          if (Math.round((new Date(allDates[i - 1]) - new Date(allDates[i])) / 86400000) === 1) continuousDays++
          else break
        }
      }
      const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - weekStart.getDay()); weekStart.setHours(0,0,0,0)
      let weekMinutes = 0
      records.forEach(r => { const d = new Date(r.startTime); if (d >= weekStart) weekMinutes += (r.durationMinutes || 0) })
      this.setData({ stats: { continuousDays, totalDays, weekMinutes } })
      this.loadMonthStats(records)
    } catch (err) { console.error(err) }
  },

  loadMonthStats(records) {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthRecords = records.filter(r => new Date(r.startTime) >= monthStart)
    const totalSessions = monthRecords.length
    let totalMinutes = 0
    monthRecords.forEach(r => { totalMinutes += (r.durationMinutes || 0) })
    this.setData({ monthStats: { totalSessions, totalHours: Math.round(totalMinutes / 60 * 10) / 10, avgMinutes: totalSessions > 0 ? Math.round(totalMinutes / totalSessions) : 0 } })
  },

  toggleType(e) {
    const type = e.currentTarget.dataset.type
    let selected = [...this.data.selectedTypes]
    const idx = selected.indexOf(type)
    idx > -1 ? selected.splice(idx, 1) : selected.push(type)
    this.setData({
      selectedTypes: selected,
      aerobicClass: selected.indexOf('有氧') > -1 ? 'type-selected-pink' : 'type-unselected',
      anaerobicClass: selected.indexOf('无氧') > -1 ? 'type-selected-pink' : 'type-unselected'
    })
  },

  startWorkout() {
    if (!this.data.selectedTypes.length) { wx.showToast({ title: '请选择训练类型', icon: 'none' }); return }
    const startTime = new Date()
    this.setData({ isWorking: true, isPaused: false, statusText: '训练中', startTime, pausedTotalMs: 0, timerDisplay: '00:00:00' })
    this.data.timerInterval = setInterval(() => {
      const elapsed = Math.max(0, new Date() - this.data.startTime - this.data.pausedTotalMs)
      const t = Math.floor(elapsed / 1000)
      this.setData({ timerDisplay: `${String(Math.floor(t / 3600)).padStart(2,'0')}:${String(Math.floor((t % 3600) / 60)).padStart(2,'0')}:${String(t % 60).padStart(2,'0')}` })
    }, 1000)
  },

  pauseWorkout() { clearInterval(this.data.timerInterval); this.setData({ isWorking: false, isPaused: true, statusText: '已暂停', pauseStartTime: new Date() }) },

  resumeWorkout() {
    this.setData({ isWorking: true, isPaused: false, statusText: '训练中', pausedTotalMs: this.data.pausedTotalMs + (new Date() - this.data.pauseStartTime), pauseStartTime: null })
    this.data.timerInterval = setInterval(() => {
      const elapsed = Math.max(0, new Date() - this.data.startTime - this.data.pausedTotalMs)
      const t = Math.floor(elapsed / 1000)
      this.setData({ timerDisplay: `${String(Math.floor(t / 3600)).padStart(2,'0')}:${String(Math.floor((t % 3600) / 60)).padStart(2,'0')}:${String(t % 60).padStart(2,'0')}` })
    }, 1000)
  },

  stopTimer() {
    clearInterval(this.data.timerInterval)
    const endTime = new Date()
    const totalSeconds = Math.floor(Math.max(0, endTime - this.data.startTime - this.data.pausedTotalMs) / 1000)
    const hours = Math.floor(totalSeconds / 3600); const minutes = Math.floor((totalSeconds % 3600) / 60)
    wx.showModal({
      title: '完成训练', content: `训练时长：${util.formatDuration(hours, minutes)}`, confirmText: '保存记录', cancelText: '放弃',
      success: async (res) => { if (res.confirm) await this.saveRecord(this.data.startTime, endTime, { hours, minutes, totalMinutes: Math.floor(totalSeconds / 60) }); this.resetTimer() }
    })
  },

  async saveRecord(startTime, endTime, duration) {
    try {
      await cloudUtil.addRecord('fitness_records', { startTime: startTime.toISOString(), endTime: endTime.toISOString(), date: util.getDateStr(new Date()), durationMinutes: duration.totalMinutes, durationText: util.formatDuration(duration.hours, duration.minutes), trainTypes: this.data.selectedTypes.join('、') || '未选择', selectedTypes: this.data.selectedTypes })
      wx.showToast({ title: '记录成功', icon: 'success' })
      this.loadTodayRecords(); this.loadStats()
    } catch (err) { console.error(err); wx.showToast({ title: '保存失败', icon: 'none' }) }
  },

  resetTimer() { this.setData({ isWorking: false, isPaused: false, statusText: '未开始', timerDisplay: '00:00:00', startTime: null, pauseStartTime: null, pausedTotalMs: 0, selectedTypes: [], aerobicClass: 'type-unselected', anaerobicClass: 'type-unselected' }) },

  navigateTo(e) { wx.navigateTo({ url: e.currentTarget.dataset.url }) },

  goCalendar() { wx.switchTab({ url: '/pages/calendar/calendar' }) },

  async checkProfilePrompt() {
    try {
      const openid = getApp().globalData.openid
      if (!openid || this.data._profileChecked) return
      this.setData({ _profileChecked: true })
      const res = await cloudUtil.db.collection('user_profiles').where({ _openid: openid }).get()
      const hasProfile = res.data.length > 0 && res.data[0].nickname
      if (!hasProfile) {
        wx.navigateTo({ url: '/pages/wizard/wizard' })
      }
    } catch (err) { console.error(err) }
  }
})
