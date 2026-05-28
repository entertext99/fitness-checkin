const cloudUtil = require('../../utils/cloud')
const util = require('../../utils/util')
const { LineChart } = require('../../utils/chart')

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
    items: MEASURE_FIELDS.map(f => ({ ...f, value: '' })),
    records: [],
    todayRecorded: false,
    editingId: '',
    todayMeasure: [],
    todayDate: '',
    measureFields: MEASURE_FIELDS
  },

  onLoad() { this.initAndLoad() },
  onShow() { this.initAndLoad() },

  async initAndLoad() {
    await cloudUtil.getOpenid()
    this.loadRecords()
  },

  onInput(e) {
    const { name } = e.currentTarget.dataset
    const items = [...this.data.items]
    const idx = items.findIndex(i => i.name === name)
    if (idx > -1) { items[idx].value = e.detail.value; this.setData({ items }) }
  },

  async loadRecords() {
    try {
      const openid = getApp().globalData.openid
      if (!openid) return
      const db = cloudUtil.db
      const res = await db.collection('measurement_records').where({ _openid: openid }).orderBy('date', 'desc').get()
      const records = res.data
      const today = util.getDateStr(new Date())
      const todayRecord = records.find(r => r.date === today)
      const items = this.data.items.map(item => ({
        ...item,
        value: todayRecord && todayRecord.values && todayRecord.values[item.name] ? String(todayRecord.values[item.name]) : ''
      }))
      const todayMeasure = []
      if (todayRecord && todayRecord.values) {
        MEASURE_FIELDS.forEach(f => {
          if (todayRecord.values[f.name]) todayMeasure.push({ label: f.label, value: todayRecord.values[f.name] + 'cm' })
        })
      }
      this.setData({
        records,
        todayRecorded: !!todayRecord,
        editingId: todayRecord ? todayRecord._id : '',
        items,
        todayMeasure,
        todayDate: todayRecord ? today : ''
      })
      this.drawChart()
    } catch (err) { console.error(err) }
  },

  async save() {
    const values = {}
    let hasValue = false
    this.data.items.forEach(item => {
      const v = parseFloat(item.value)
      if (v && v > 0) { values[item.name] = Math.round(v * 10) / 10; hasValue = true }
    })
    if (!hasValue) { wx.showToast({ title: '请至少填写一项', icon: 'none' }); return }
    try {
      const today = util.getDateStr(new Date())
      if (this.data.editingId) {
        await cloudUtil.updateRecord('measurement_records', this.data.editingId, { values })
      } else {
        await cloudUtil.addRecord('measurement_records', { values, date: today })
      }
      wx.showToast({ title: '保存成功', icon: 'success' })
      this.setData({ items: this.data.items.map(i => ({ ...i, value: '' })) })
      this.loadRecords()
    } catch (err) { console.error(err); wx.showToast({ title: '保存失败', icon: 'none' }) }
  },

  drawChart() {
    const { records } = this.data
    if (records.length < 2) return
    const sorted = [...records].reverse()
    const colors = ['#FF94B4', '#52C41A', '#FFB84D', '#7EB8FF']
    const dataSets = MEASURE_FIELDS.map((f, i) => ({
      data: sorted.filter(r => r.values && r.values[f.name]).map(r => ({ value: r.values[f.name], label: r.date.slice(5) })),
      color: colors[i],
      label: f.label
    })).filter(ds => ds.data.length >= 2)
    if (!dataSets.length) return
    const chart = new LineChart('measureChart', 320, 180)
    chart.draw([], { multiLine: true, dataSets, yLabel: 'cm' })
  },

  goCalendar() { wx.switchTab({ url: '/pages/calendar/calendar' }) }
})
