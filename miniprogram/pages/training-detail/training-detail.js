const cloudUtil = require('../../utils/cloud')
const util = require('../../utils/util')

Page({
  data: {
    date: '',
    displayDate: '',
    records: [],
    typeOptions: ['有氧', '无氧'],
    formTypeIdx: 0,
    formDuration: ''
  },

  onLoad(options) {
    const date = options.date || util.getDateStr(new Date())
    const d = date.split('-')
    this.setData({ date, displayDate: `${d[0]}年${parseInt(d[1])}月${parseInt(d[2])}日` })
    this.initAndLoad()
  },

  onShow() { this.initAndLoad() },

  async initAndLoad() {
    await cloudUtil.getOpenid()
    this.loadRecords()
  },

  async loadRecords() {
    try {
      const openid = getApp().globalData.openid
      if (!openid) return
      const db = cloudUtil.db
      const res = await db.collection('fitness_records')
        .where({ _openid: openid, date: this.data.date })
        .orderBy('startTime', 'asc')
        .get()
      this.setData({ records: res.data || [] })
    } catch (err) { console.error(err) }
  },

  onTypeChange(e) {
    this.setData({ formTypeIdx: e.detail.value })
  },

  onDurationInput(e) {
    this.setData({ formDuration: e.detail.value })
  },

  async addRecord() {
    const { formTypeIdx, formDuration, date, typeOptions } = this.data
    const dur = parseInt(formDuration)
    if (!dur || dur <= 0) { wx.showToast({ title: '请输入有效时长', icon: 'none' }); return }
    const now = new Date()
    const nowStr = date + 'T' + util.formatHM(now) + ':00'
    try {
      await cloudUtil.addRecord('fitness_records', {
        date,
        trainTypes: typeOptions[formTypeIdx],
        selectedTypes: [typeOptions[formTypeIdx]],
        durationMinutes: dur,
        startTime: nowStr,
        endTime: new Date(new Date(nowStr).getTime() + dur * 60000).toISOString().slice(0, 19)
      })
      this.setData({ formDuration: '' })
      wx.showToast({ title: '已添加', icon: 'success' })
      this.loadRecords()
    } catch (err) { console.error(err); wx.showToast({ title: '保存失败', icon: 'none' }) }
  },

  async editDuration(e) {
    const idx = e.currentTarget.dataset.index
    const record = this.data.records[idx]
    wx.showModal({
      title: '修改时长',
      editable: true,
      placeholderText: String(record.durationMinutes || ''),
      success: async (res) => {
        if (!res.confirm || !res.content) return
        const dur = parseInt(res.content)
        if (!dur || dur <= 0) { wx.showToast({ title: '无效时长', icon: 'none' }); return }
        try {
          await cloudUtil.updateRecord('fitness_records', record._id, { durationMinutes: dur })
          wx.showToast({ title: '已更新', icon: 'success' })
          this.loadRecords()
        } catch (err) { console.error(err); wx.showToast({ title: '更新失败', icon: 'none' }) }
      }
    })
  },

  async deleteRecord(e) {
    const idx = e.currentTarget.dataset.index
    const record = this.data.records[idx]
    wx.showModal({
      title: '确认删除',
      content: '删除该训练记录？',
      success: async (res) => {
        if (!res.confirm) return
        try {
          await cloudUtil.deleteRecord('fitness_records', record._id)
          wx.showToast({ title: '已删除', icon: 'success' })
          this.loadRecords()
        } catch (err) { console.error(err); wx.showToast({ title: '删除失败', icon: 'none' }) }
      }
    })
  }
})
