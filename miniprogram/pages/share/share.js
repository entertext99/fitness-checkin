const cloudUtil = require('../../utils/cloud')

Page({
  data: {
    myRoomId: '',
    partner: null,
    inputRoomId: '',
    hasRoom: false
  },

  onLoad() { this.init() },
  onShow() { this.init() },

  async init() {
    await cloudUtil.getOpenid()
    await this.loadMyRoom()
  },

  async loadMyRoom() {
    try {
      const res = await cloudUtil.callFunction('roomOperation', { action: 'findMyRoom' })
      if (res.result.code !== 0 || !res.result.data) {
        this.setData({ myRoomId: '', hasRoom: false, partner: null })
        return
      }
      const room = res.result.data
      this.setData({
        myRoomId: room.roomId,
        hasRoom: true,
        partner: room.partnerOpenid ? { openid: room.partnerOpenid, nickname: '我的搭子' } : null
      })
    } catch (err) { console.error(err) }
  },

  onInputRoomId(e) { this.setData({ inputRoomId: e.detail.value }) },

  async createRoom() {
    const openid = getApp().globalData.openid
    if (!openid) { wx.showToast({ title: '请先登录', icon: 'none' }); return }
    try {
      const res = await cloudUtil.callFunction('roomOperation', { action: 'createRoom' })
      if (res.result.code !== 0) { wx.showToast({ title: res.result.msg, icon: 'none' }); return }
      this.setData({ myRoomId: res.result.data.roomId, hasRoom: true })
      wx.showToast({ title: `房间创建成功：${res.result.data.roomId}`, icon: 'success' })
    } catch (err) { console.error(err); wx.showToast({ title: '创建失败', icon: 'none' }) }
  },

  async joinRoom() {
    const openid = getApp().globalData.openid
    const roomId = this.data.inputRoomId.trim().toUpperCase()
    if (!openid || !roomId) return
    if (roomId.length !== 6) { wx.showToast({ title: '请输入6位房间号', icon: 'none' }); return }
    try {
      const res = await cloudUtil.callFunction('roomOperation', { action: 'joinRoom', roomId })
      if (res.result.code !== 0) { wx.showToast({ title: res.result.msg, icon: 'none' }); return }
      this.setData({ myRoomId: res.result.data.roomId, hasRoom: true, partner: { openid: res.result.data.partnerOpenid, nickname: '搭子' } })
      wx.showToast({ title: '添加健身搭子成功！', icon: 'success' })
      this.init()
    } catch (err) { console.error(err); wx.showToast({ title: '加入失败', icon: 'none' }) }
  },

  async leaveRoom() {
    const openid = getApp().globalData.openid
    if (!openid) return
    try {
      const res = await cloudUtil.callFunction('roomOperation', { action: 'leaveRoom' })
      if (res.result.code !== 0) { wx.showToast({ title: res.result.msg, icon: 'none' }); return }
      this.setData({ myRoomId: '', hasRoom: false, partner: null })
      wx.showToast({ title: '已退出房间', icon: 'success' })
    } catch (err) { console.error(err); wx.showToast({ title: '退出失败', icon: 'none' }) }
  }
})
