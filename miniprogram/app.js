App({
  onLaunch() {
    wx.cloud.init({
      env: wx.cloud.DYNAMIC_CURRENT_ENV
    })
    this.globalData = {}
  },

  globalData: {
    userInfo: null,
    openid: ''
  }
})
