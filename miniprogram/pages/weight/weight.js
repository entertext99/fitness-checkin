const cloudUtil = require('../../utils/cloud')
const util = require('../../utils/util')
const { LineChart } = require('../../utils/chart')

Page({
  data: {
    weightInput: '',
    editingId: '',
    currentValue: '',
    currentDate: '',
    displayDate: '',
    records: []
  },

  onLoad(options) {
    const date = options.date || util.getDateStr(new Date())
    const d = date.split('-')
    this.setData({ currentDate: date, displayDate: `${d[0]}年${parseInt(d[1])}月${parseInt(d[2])}日` })
    this.initAndLoad()
  },

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
      const { currentDate } = this.data
      const currentRecord = records.find(r => r.date === currentDate)
      this.setData({
        records,
        editingId: currentRecord ? currentRecord._id : '',
        weightInput: currentRecord ? String(currentRecord.weight) : '',
        currentValue: currentRecord ? currentRecord.weight : ''
      })
      this.drawChart()
    } catch (err) { console.error(err) }
  },

  async saveWeight() {
    const val = parseFloat(this.data.weightInput)
    if (!val || val <= 0) { wx.showToast({ title: '请输入有效体重', icon: 'none' }); return }
    try {
      const { currentDate, editingId } = this.data
      const weight = Math.round(val * 10) / 10
      if (editingId) {
        await cloudUtil.updateRecord('weight_records', editingId, { weight })
      } else {
        const res = await cloudUtil.addRecord('weight_records', { weight, date: currentDate })
        this.setData({ editingId: res._id })
      }
      wx.showToast({ title: '保存成功', icon: 'success' })
      this.setData({ weightInput: '', currentValue: weight })
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
