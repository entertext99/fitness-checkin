const cloudUtil = require('../../utils/cloud')
const { LineChart } = require('../../utils/chart')

const MEMBER_COLORS = ['#FF94B4', '#52C41A', '#1890FF', '#FAAD14', '#722ED1']
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
    roomId: '',
    members: [],
    measureFields: MEASURE_FIELDS,
    loading: true
  },

  onLoad(options) {
    this.setData({ roomId: options.roomId || '' })
    this.loadRoomData()
  },

  async loadRoomData() {
    try {
      const res = await cloudUtil.callFunction('roomOperation', { action: 'getRoomData', roomId: this.data.roomId })
      if (res.result.code !== 0) {
        wx.showToast({ title: res.result.msg, icon: 'none' })
        wx.navigateBack()
        return
      }
      this.setData({ members: res.result.data.members, loading: false }, () => {
        setTimeout(() => {
          this.renderWeightChart()
          this.renderMeasureCharts()
        }, 300)
      })
    } catch (err) {
      console.error(err)
      wx.navigateBack()
    }
  },

  renderWeightChart() {
    const { members } = this.data
    if (members.length < 2) return

    const allHaveEnough = members.every(m => m.weights.length >= 2)
    if (!allHaveEnough) return

    const dataSets = members.map((m, i) => ({
      data: m.weights.map(w => ({ value: w.weight, label: w.date.slice(5) })),
      color: MEMBER_COLORS[i % MEMBER_COLORS.length],
      label: m.nickname
    }))

    new LineChart('weightChart', 320, 180).draw([], {
      multiLine: true,
      dataSets,
      yLabel: 'kg'
    })
  },

  renderMeasureCharts() {
    const { members } = this.data
    if (members.length < 2) return

    MEASURE_FIELDS.forEach(field => {
      const canvasId = `measure_${field.name}`
      const dataSets = members.map((m, i) => ({
        data: m.measures
          .filter(mm => mm.values && mm.values[field.name])
          .map(mm => ({ value: mm.values[field.name], label: mm.date.slice(5) })),
        color: MEMBER_COLORS[i % MEMBER_COLORS.length],
        label: m.nickname
      })).filter(ds => ds.data.length >= 2)

      if (dataSets.length >= 2) {
        new LineChart(canvasId, 320, 150).draw([], {
          multiLine: true,
          dataSets,
          yLabel: 'cm'
        })
      }
    })
  }
})
