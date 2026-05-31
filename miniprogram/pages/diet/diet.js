const cloudUtil = require('../../utils/cloud')
const util = require('../../utils/util')

Page({
  data: {
    year: 0, month: 0,
    weekdays: ['日', '一', '二', '三', '四', '五', '六'],
    emptyCells: [], days: [],
    dietRecordsMap: {},
    todayStatus: '',
    editingId: '',
    showModal: false, modalType: '', modalIcon: '', modalText: '',

    // Detailed food recording
    showDetail: false,
    items: [],
    totalCalories: 0,
    bmr: 0,
    age: 0,
    gender: '',
    photoTempPath: '',
    photoCloudId: '',
    foodName: '',
    foodCalories: '',
    uploading: false
  },

  onLoad() {
    const now = new Date()
    this.setData({ year: now.getFullYear(), month: now.getMonth() + 1 })
    this.initAndLoad()
  },

  onShow() { this.initAndLoad() },

  async initAndLoad() {
    await cloudUtil.getOpenid()
    this.buildCalendar()
    await this.loadDietRecords()
    await this.loadUserProfile()
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
      const record = dietRecordsMap[dateStr] || ''
      const status = typeof record === 'string' ? record : (record.status || '')
      days.push({ day: i, date: dateStr, isToday: dateStr === today, status })
    }
    const todayRecord = dietRecordsMap[today]
    const todayStatus = typeof todayRecord === 'string' ? todayRecord : (todayRecord ? todayRecord.status : '')
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
      let idMap = {}
      res.data.forEach(r => {
        map[r.date] = r
        idMap[r.date] = r._id
      })

      const today = util.getDateStr(new Date())
      const todayRec = map[today]
      const todayStatus = todayRec ? (todayRec.status || '') : ''
      const editingId = idMap[today] || ''
      const items = todayRec && todayRec.items ? todayRec.items : []
      const totalCalories = todayRec ? (todayRec.totalCalories || 0) : 0
      const bmr = todayRec ? (todayRec.bmr || 0) : 0

      this.setData({ dietRecordsMap: map, todayStatus, editingId, items, totalCalories, bmr })
      this.buildCalendar()
    } catch (err) { console.error('加载饮食记录失败', err) }
  },

  async loadUserProfile() {
    try {
      const openid = getApp().globalData.openid
      if (!openid) return
      const db = cloudUtil.db
      const [profileRes, weightRes] = await Promise.all([
        db.collection('user_profiles').where({ _openid: openid }).get(),
        db.collection('weight_records').where({ _openid: openid }).orderBy('date', 'desc').limit(1).get()
      ])
      let gender = '', birthday = '', height = 0, weight = 0
      if (profileRes.data.length > 0) {
        const p = profileRes.data[0]
        gender = p.gender || ''
        birthday = p.birthday || ''
        height = p.height || 0
        weight = p.initWeight || 0
      }
      if (weightRes.data.length > 0) weight = weightRes.data[0].weight
      if (!gender || !birthday || !height || !weight) return

      const age = this.calcAge(birthday)
      if (age < 10 || age > 100) return
      const bmr = this.calcBMR(gender, weight, height, age)
      this.setData({ bmr, age, gender })
      if (this.data.items.length > 0) this.autoCalcStatus()
    } catch (err) { console.error(err) }
  },

  calcAge(birthday) {
    if (!birthday) return 0
    const parts = birthday.split('-')
    if (parts.length !== 3) return 0
    const born = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))
    const now = new Date()
    let age = now.getFullYear() - born.getFullYear()
    const m = now.getMonth() - born.getMonth()
    if (m < 0 || (m === 0 && now.getDate() < born.getDate())) age--
    return age
  },

  calcBMR(gender, weightKg, heightCm, age) {
    if (gender === '男') return Math.round(88.362 + 13.397 * weightKg + 4.799 * heightCm - 5.677 * age)
    return Math.round(447.593 + 9.247 * weightKg + 3.098 * heightCm - 4.330 * age)
  },

  autoCalcStatus() {
    const { totalCalories, bmr } = this.data
    if (!bmr || !totalCalories) return
    const status = totalCalories > bmr ? 'high_calorie' : 'healthy'
    this.setData({ todayStatus: status })
  },

  // ---- Quick mark (existing) ----
  chooseHealthy() { this.saveQuickMark('healthy', '😊', '真棒！') },
  chooseJunk() { this.saveQuickMark('high_calorie', '😅', '明天要好好吃饭哦！') },

  async saveQuickMark(status, icon, text) {
    try {
      const today = util.getDateStr(new Date())
      const data = { date: today, status }
      if (this.data.editingId) {
        await cloudUtil.updateRecord('diet_records', this.data.editingId, { status })
      } else {
        const res = await cloudUtil.addRecord('diet_records', data)
        this.setData({ editingId: res._id })
      }
      this.setData({
        dietRecordsMap: { ...this.data.dietRecordsMap, [today]: { ...(this.data.dietRecordsMap[today] || {}), status } },
        todayStatus: status,
        showModal: true, modalIcon: icon, modalText: text,
        modalType: status === 'healthy' ? 'keep' : 'warn'
      })
      this.buildCalendar()
    } catch (err) { console.error(err); wx.showToast({ title: '保存失败', icon: 'none' }) }
  },

  // ---- Photo & Food Recording ----
  toggleDetail() {
    this.setData({ showDetail: !this.data.showDetail })
  },

  takePhoto() {
    wx.chooseImage({ count: 1, sizeType: ['compressed'], sourceType: ['camera', 'album'],
      success: (res) => {
        this.setData({ photoTempPath: res.tempFilePaths[0], photoCloudId: '', foodName: '', foodCalories: '' })
      }
    })
  },

  async uploadPhoto() {
    if (!this.data.photoTempPath || this.data.uploading) return
    this.setData({ uploading: true })
    try {
      const openid = getApp().globalData.openid
      const cloudPath = `diet/${openid}/${Date.now()}.jpg`
      const res = await wx.cloud.uploadFile({ cloudPath, filePath: this.data.photoTempPath })
      this.setData({ photoCloudId: res.fileID, uploading: false })
      wx.showToast({ title: '上传成功', icon: 'success' })
    } catch (err) {
      console.error(err)
      this.setData({ uploading: false })
      wx.showToast({ title: '上传失败', icon: 'none' })
    }
  },

  onFoodNameInput(e) { this.setData({ foodName: e.detail.value }) },
  onFoodCaloriesInput(e) { this.setData({ foodCalories: e.detail.value }) },

  async addFoodItem() {
    const { photoCloudId, photoTempPath, foodName, foodCalories } = this.data
    if (!photoTempPath) { wx.showToast({ title: '请先拍照', icon: 'none' }); return }
    if (!foodName) { wx.showToast({ title: '请输入食物名称', icon: 'none' }); return }
    const cal = parseFloat(foodCalories)
    if (!cal || cal <= 0) { wx.showToast({ title: '请输入有效热量', icon: 'none' }); return }

    // Upload photo if not yet uploaded
    let fileId = photoCloudId
    if (!fileId) {
      this.setData({ uploading: true })
      try {
        const openid = getApp().globalData.openid
        const cloudPath = `diet/${openid}/${Date.now()}.jpg`
        const res = await wx.cloud.uploadFile({ cloudPath, filePath: photoTempPath })
        fileId = res.fileID
      } catch (err) { console.error(err); wx.showToast({ title: '上传失败', icon: 'none' }); return }
    }

    const newItem = { foodName, calories: Math.round(cal), imageUrl: fileId, createTime: new Date() }
    const items = [...this.data.items, newItem]
    const totalCalories = items.reduce((s, i) => s + i.calories, 0)

    try {
      const today = util.getDateStr(new Date())
      const data = { date: today, items, totalCalories, bmr: this.data.bmr, status: totalCalories > this.data.bmr ? 'high_calorie' : 'healthy' }
      if (this.data.editingId) {
        await cloudUtil.updateRecord('diet_records', this.data.editingId, data)
      } else {
        const res = await cloudUtil.addRecord('diet_records', data)
        this.setData({ editingId: res._id })
      }
      this.setData({
        items, totalCalories, photoTempPath: '', photoCloudId: '', foodName: '', foodCalories: '', uploading: false,
        dietRecordsMap: { ...this.data.dietRecordsMap, [today]: { date: today, items, totalCalories, bmr: this.data.bmr, status: data.status } }
      })
      this.autoCalcStatus()
      this.buildCalendar()
      wx.showToast({ title: '已添加', icon: 'success' })
    } catch (err) { console.error(err); wx.showToast({ title: '保存失败', icon: 'none' }) }
  },

  deleteFoodItem(e) {
    const idx = e.currentTarget.dataset.index
    let items = [...this.data.items]
    items.splice(idx, 1)
    const totalCalories = items.reduce((s, i) => s + i.calories, 0)
    this.saveItems(items, totalCalories)
  },

  async saveItems(items, totalCalories) {
    try {
      const today = util.getDateStr(new Date())
      const data = { date: today, items, totalCalories, bmr: this.data.bmr, status: totalCalories > this.data.bmr ? 'high_calorie' : 'healthy' }
      if (this.data.editingId) {
        await cloudUtil.updateRecord('diet_records', this.data.editingId, data)
      } else if (items.length > 0) {
        const res = await cloudUtil.addRecord('diet_records', data)
        this.setData({ editingId: res._id })
      }
      this.setData({ items, totalCalories })
      this.autoCalcStatus()
      this.buildCalendar()
    } catch (err) { console.error(err); wx.showToast({ title: '保存失败', icon: 'none' }) }
  },

  // ---- Navigation ----
  prevMonth() {
    let { year, month } = this.data
    month--
    if (month < 1) { month = 12; year-- }
    this.setData({ year, month }, () => { this.buildCalendar(); this.loadDietRecords() })
  },
  nextMonth() {
    let { year, month } = this.data
    month++
    if (month > 12) { month = 1; year++ }
    this.setData({ year, month }, () => { this.buildCalendar(); this.loadDietRecords() })
  },

  onDayTap(e) {
    const { date } = e.currentTarget.dataset
    const rec = this.data.dietRecordsMap[date]
    if (rec) {
      const status = typeof rec === 'string' ? rec : (rec.status || '')
      const items = rec.items ? rec.items.length : 0
      const cal = rec.totalCalories || 0
      let msg = status === 'healthy' ? '🥗 健康饮食' : '⚠️ 高热量饮食'
      if (items > 0) msg += `\n${items}条食物 · ${cal}千卡`
      wx.showToast({ title: msg, icon: 'none' })
      return
    }
    wx.showToast({ title: '该日无饮食记录', icon: 'none' })
  },

  closeModal() { this.setData({ showModal: false }) },
  goCalendar() { wx.switchTab({ url: '/pages/calendar/calendar' }) }
})
