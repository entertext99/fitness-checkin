class LineChart {
  constructor(canvasId, width, height) {
    this.canvasId = canvasId
    this.width = width
    this.height = height
    this.padding = { top: 30, right: 20, bottom: 40, left: 50 }
  }

  draw(data, options = {}) {
    const ctx = wx.createCanvasContext(this.canvasId)
    const pad = this.padding
    const w = this.width - pad.left - pad.right
    const h = this.height - pad.top - pad.bottom

    ctx.clearRect(0, 0, this.width, this.height)

    const color = options.color || '#FF8A9B'
    const showLabels = options.showLabels !== false
    const showGrid = options.showGrid !== false
    const dataSets = options.multiLine ? (options.dataSets || []) : [{ data, color, label: options.label || '' }]

    if (!dataSets.length || !dataSets[0].data.length) {
      ctx.draw()
      return
    }

    let allValues = []
    dataSets.forEach(ds => {
      ds.data.forEach(d => {
        if (d.value !== undefined) allValues.push(d.value)
        else if (typeof d === 'number') allValues.push(d)
      })
    })

    if (!allValues.length) {
      ctx.draw()
      return
    }

    const minVal = Math.min(...allValues)
    const maxVal = Math.max(...allValues)
    const range = maxVal - minVal || 1

    if (showGrid) {
      ctx.setStrokeStyle('#F0F0F0')
      ctx.setLineWidth(1)
      for (let i = 0; i <= 4; i++) {
        const y = pad.top + (h / 4) * i
        ctx.beginPath()
        ctx.moveTo(pad.left, y)
        ctx.lineTo(pad.left + w, y)
        ctx.stroke()
      }
    }

    dataSets.forEach((ds, idx) => {
      const lineColor = ds.color || color
      const points = ds.data.map((d, i) => {
        const val = d.value !== undefined ? d.value : d
        const x = pad.left + (w / (ds.data.length - 1 || 1)) * i
        const y = pad.top + h - ((val - minVal) / range) * h
        return { x, y, val, label: d.label || '' }
      })

      ctx.setStrokeStyle(lineColor)
      ctx.setLineWidth(3)
      ctx.setLineCap('round')
      ctx.setLineJoin('round')

      ctx.beginPath()
      points.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x, p.y)
        else ctx.lineTo(p.x, p.y)
      })
      ctx.stroke()

      points.forEach(p => {
        ctx.beginPath()
        ctx.arc(p.x, p.y, 5, 0, 2 * Math.PI)
        ctx.setFillStyle('#FFFFFF')
        ctx.fill()
        ctx.setStrokeStyle(lineColor)
        ctx.setLineWidth(2)
        ctx.stroke()
      })

      if (showLabels && points.length <= 31) {
        points.forEach((p) => {
          ctx.setFillStyle('#999999')
          ctx.setFontSize(20)
          ctx.setTextAlign('center')
          const labelText = p.label || p.val.toString()
          ctx.fillText(labelText, p.x, pad.top + h + 20)
        })
      }
    })

    if (options.yLabel) {
      ctx.setFillStyle('#999999')
      ctx.setFontSize(20)
      ctx.setTextAlign('right')
      ctx.fillText(options.yLabel, pad.left - 10, pad.top + 10)
    }

    if (options.multiLine) {
      const legendY = 15
      let legendX = pad.left
      dataSets.forEach((ds, idx) => {
        ctx.setFillStyle(ds.color)
        ctx.fillRect(legendX, legendY - 6, 20, 4)
        ctx.setFillStyle('#666666')
        ctx.setFontSize(20)
        ctx.setTextAlign('left')
        ctx.fillText(ds.label || '', legendX + 26, legendY + 4)
        legendX += ctx.measureText ? (26 + (ds.label || '').length * 20 + 30) : 120
      })
    }

    ctx.draw()
  }

  clear() {
    const ctx = wx.createCanvasContext(this.canvasId)
    ctx.clearRect(0, 0, this.width, this.height)
    ctx.draw()
  }
}

module.exports = { LineChart }
