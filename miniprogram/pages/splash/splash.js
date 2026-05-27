Page({
  data: {},

  onLoad() {
    this.initDietCollection()
    setTimeout(() => {
      wx.switchTab({
        url: '/pages/index/index'
      })
    }, 2500)
  },

  async initDietCollection() {
    try {
      await wx.cloud.callFunction({ name: 'login' })
    } catch (err) {
      console.log('调用 login 云函数失败', err)
    }
  }
})
