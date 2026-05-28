const cloudUtil = require('../../utils/cloud')

Page({
  data: {
    ownedRoom: null,
    joinedRooms: [],
    inputRoomId: ''
  },

  onLoad() { this.init() },
  onShow() { this.init() },

  async init() {
    await cloudUtil.getOpenid()
    await this.loadMyRooms()
  },

  async loadMyRooms() {
    try {
      const res = await cloudUtil.callFunction('roomOperation', { action: 'findMyRooms' })
      if (res.result.code !== 0) return
      const owned = res.result.data.filter(r => r.role === 'owner')
      const joined = res.result.data.filter(r => r.role === 'member')
      this.setData({
        ownedRoom: owned.length > 0 ? owned[0] : null,
        joinedRooms: joined
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
      wx.showToast({ title: `房间创建成功：${res.result.data.roomId}`, icon: 'success' })
      this.init()
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
      wx.showToast({ title: '加入成功！', icon: 'success' })
      this.setData({ inputRoomId: '' })
      this.init()
    } catch (err) { console.error(err); wx.showToast({ title: '加入失败', icon: 'none' }) }
  },

  async leaveRoom(e) {
    const roomId = e.currentTarget.dataset.roomid
    if (!roomId) return
    try {
      const res = await cloudUtil.callFunction('roomOperation', { action: 'leaveRoom', roomId })
      if (res.result.code !== 0) { wx.showToast({ title: res.result.msg, icon: 'none' }); return }
      wx.showToast({ title: res.result.msg, icon: 'success' })
      this.init()
    } catch (err) { console.error(err); wx.showToast({ title: '操作失败', icon: 'none' }) }
  }
})
