const cloudUtil = require('../../utils/cloud')
const util = require('../../utils/util')
const { LineChart } = require('../../utils/chart')

Page({
  data: {
    weightInput: '',
    todayRecorded: false,
    records: [],
    editingId: '',
    todayWeight: '',
    todayDate: ''
  },

  onLoad() { this.initAndLoad() },
  onShow() { this.initAndLoad() },

  async initAndLoad() {
    await cloudUtil.getOpenid()
    this.loadRecords()
  },

  onWeightInput(e) { this.setData({ weightInput: e.detail.value }) },

  async loadRecords() {
    try {
      const openid = getApp().globalData.openid
      if (!openid) return
      const db = cloudUtil.db
      const res = await db.collection('weight_records').where({ _openid: openid }).orderBy('date', 'desc').get()
      const records = res.data
      const today = util.getDateStr(new Date())
      const todayRecord = records.find(r => r.date === today)
      this.setData({
        records,
        todayRecorded: !!todayRecord,
        editingId: todayRecord ? todayRecord._id : '',
        weightInput: todayRecord ? String(todayRecord.weight) : '',
        todayWeight: todayRecord ? todayRecord.weight : '',
        todayDate: todayRecord ? today : ''
      })
      this.drawChart()
    } catch (err) { console.error(err) }
  },

  async saveWeight() {
    const val = parseFloat(this.data.weightInput)
    if (!val || val <= 0) { wx.showToast({ title: '请输入有效体重', icon: 'none' }); return }
    try {
      const today = util.getDateStr(new Date())
      const weight = Math.round(val * 10) / 10
      if (this.data.editingId) {
        await cloudUtil.updateRecord('weight_records', this.data.editingId, { weight })
      } else {
        await cloudUtil.addRecord('weight_records', { weight, date: today })
      }
      wx.showToast({ title: '保存成功', icon: 'success' })
      this.setData({ weightInput: '' })
      this.loadRecords()
    } catch (err) { console.error(err); wx.showToast({ title: '保存失败', icon: 'none' }) }
  },

  drawChart() {
    const { records } = this.data
    if (records.length < 2) return
    const chartData = [...records].reverse().map(r => ({ value: r.weight, label: r.date.slice(5) }))
    const chart = new LineChart('weightChart', 320, 180)
    chart.draw(chartData, { color: '#FF94B4', showLabels: chartData.length <= 15, yLabel: 'kg' })
  },

  goCalendar() { wx.switchTab({ url: '/pages/calendar/calendar' }) }
})