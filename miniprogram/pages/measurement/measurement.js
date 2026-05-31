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
    editingId: '',
    currentValues: [],
    currentDate: '',
    displayDate: '',
    measureFields: MEASURE_FIELDS
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
      const { currentDate } = this.data
      const currentRecord = records.find(r => r.date === currentDate)
      const items = this.data.items.map(item => ({
        ...item,
        value: currentRecord && currentRecord.values && currentRecord.values[item.name] ? String(currentRecord.values[item.name]) : ''
      }))
      const currentValues = []
      if (currentRecord && currentRecord.values) {
        MEASURE_FIELDS.forEach(f => {
          if (currentRecord.values[f.name]) currentValues.push({ label: f.label, value: currentRecord.values[f.name] + 'cm' })
        })
      }
      this.setData({
        records,
        editingId: currentRecord ? currentRecord._id : '',
        items,
        currentValues
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
      const { currentDate, editingId } = this.data
      if (editingId) {
        await cloudUtil.updateRecord('measurement_records', editingId, { values })
      } else {
        const res = await cloudUtil.addRecord('measurement_records', { values, date: currentDate })
        this.setData({ editingId: res._id })
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
    const colors = ['#FF94B4', '#52C41A', '#FFB84D', '#7EB8FF', '#722ED1', '#FAAD14']
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
