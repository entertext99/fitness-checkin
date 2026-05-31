const cloudUtil = require('../../utils/cloud')
const util = require('../../utils/util')

Page({
  data: {
    nickname: '',
    gender: '',
    birthday: '',
    height: '',
    initWeight: '',
    currentWeight: '',
    bmi: '',
    bodyType: '',
    bmiPct: 0,
    stats: { continuousDays: 0, totalCheckins: 0, totalHours: 0 },
    profileLoaded: false,
    editing: false
  },

  onLoad() { this.initAndLoad() },
  onShow() { this.initAndLoad() },

  async initAndLoad() {
    await cloudUtil.getOpenid()
    await this.loadProfile()
    this.loadStats()
  },

  async loadProfile() {
    try {
      const openid = getApp().globalData.openid
      if (!openid) return
      const db = cloudUtil.db
      const [profileRes, weightRes] = await Promise.all([
        db.collection('user_profiles').where({ _openid: openid }).get(),
        db.collection('weight_records').where({ _openid: openid }).orderBy('date', 'desc').limit(1).get()
      ])
      const latestWeight = weightRes.data.length > 0 ? String(weightRes.data[0].weight) : ''
      if (profileRes.data.length > 0) {
        const p = profileRes.data[0]
        this.setData({
          nickname: p.nickname || '',
          gender: p.gender || '',
          birthday: p.birthday || '',
          height: p.height ? String(p.height) : '',
          initWeight: p.initWeight ? String(p.initWeight) : '',
          currentWeight: latestWeight || (p.currentWeight ? String(p.currentWeight) : ''),
          profileLoaded: true
        })
        this.calcBMI()
      } else {
        this.setData({ currentWeight: latestWeight, profileLoaded: true })
      }
    } catch (err) { console.error(err) }
  },

  toggleEdit() {
    this.setData({ editing: true })
  },

  cancelEdit() {
    this.setData({ editing: false })
    this.loadProfile()
  },

  async saveProfile() {
    const openid = getApp().globalData.openid
    if (!openid) return
    const data = {
      nickname: this.data.nickname,
      gender: this.data.gender,
      birthday: this.data.birthday,
      height: this.data.height ? parseInt(this.data.height) : '',
      initWeight: this.data.initWeight ? parseFloat(this.data.initWeight) : ''
    }
    try {
      const db = cloudUtil.db
      const existing = await db.collection('user_profiles').where({ _openid: openid }).get()
      if (existing.data.length > 0) {
        await db.collection('user_profiles').doc(existing.data[0]._id).update({ data: { ...data, updateTime: db.serverDate() } })
      } else {
        await db.collection('user_profiles').add({ data: { ...data, _openid: openid, createTime: db.serverDate() } })
      }
      this.setData({ editing: false })
      wx.showToast({ title: '已保存', icon: 'success' })
      this.loadProfile()
    } catch (err) { console.error(err); wx.showToast({ title: '保存失败', icon: 'none' }) }
  },

  onNicknameInput(e) { this.setData({ nickname: e.detail.value }) },
  onGenderChange(e) { this.setData({ gender: e.detail.value }) },
  onBirthdayChange(e) { this.setData({ birthday: e.detail.value }) },
  onHeightInput(e) { this.setData({ height: e.detail.value }) },
  onInitWeightInput(e) { this.setData({ initWeight: e.detail.value }) },

  calcBMI() {
    const h = parseFloat(this.data.height)
    const cw = parseFloat(this.data.currentWeight)
    if (!h || !cw || h <= 0) {
      this.setData({ bmi: '', bodyType: '', bmiPct: 0 })
      return
    }
    const bmi = cw / ((h / 100) * (h / 100))
    const bmiStr = bmi.toFixed(1)
    let type
    if (bmi < 18.5) type = '偏瘦'
    else if (bmi <= 23.9) type = '标准'
    else if (bmi <= 27.9) type = '超重'
    else type = '肥胖'
    const pct = Math.min(Math.max((bmi - 10) / 30 * 100, 0), 100)
    this.setData({ bmi: bmiStr, bodyType: type, bmiPct: Math.round(pct) })
  },

  async loadStats() {
    try {
      const openid = getApp().globalData.openid
      if (!openid) return
      const db = cloudUtil.db
      const res = await db.collection('fitness_records').where({ _openid: openid }).get()
      const records = res.data
      const dates = [...new Set(records.map(r => r.date))]
      let continuousDays = 0
      const sorted = [...dates].sort().reverse()
      if (sorted.length > 0) {
        continuousDays = 1
        for (let i = 1; i < sorted.length; i++) {
          if (Math.round((new Date(sorted[i-1]) - new Date(sorted[i])) / 86400000) === 1) continuousDays++
          else break
        }
      }
      let totalMinutes = 0
      records.forEach(r => { totalMinutes += (r.durationMinutes || 0) })
      this.setData({
        stats: { continuousDays, totalCheckins: dates.length, totalHours: Math.round(totalMinutes / 60 * 10) / 10 }
      })
    } catch (err) { console.error(err) }
  }
})