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
      const openid = getApp().globalData.openid
      if (!openid) return
      const db = cloudUtil.db
      const res = await db.collection('partner_rooms').where({ member1_openid: openid }).get()
      if (res.data.length > 0) {
        const room = res.data[0]
        this.setData({ myRoomId: room.roomId, hasRoom: true })
        if (room.member2_openid) {
          this.setData({ partner: { openid: room.member2_openid, nickname: '我的搭子' } })
        }
        return
      }
      const res2 = await db.collection('partner_rooms').where({ member2_openid: openid }).get()
      if (res2.data.length > 0) {
        const room = res2.data[0]
        this.setData({ myRoomId: room.roomId, hasRoom: true, partner: { openid: room.member1_openid, nickname: '我的搭子' } })
      }
    } catch (err) { console.error(err) }
  },

  onInputRoomId(e) { this.setData({ inputRoomId: e.detail.value }) },

  async createRoom() {
    const openid = getApp().globalData.openid
    if (!openid || this.data.hasRoom) { wx.showToast({ title: this.data.hasRoom ? '已有房间' : '请先登录', icon: 'none' }); return }
    const roomId = Math.random().toString(36).substr(2, 6).toUpperCase()
    try {
      await cloudUtil.addRecord('partner_rooms', { roomId, member1_openid: openid, member2_openid: '' })
      this.setData({ myRoomId: roomId, hasRoom: true })
      wx.showToast({ title: `房间创建成功：${roomId}`, icon: 'success' })
    } catch (err) { console.error(err); wx.showToast({ title: '创建失败', icon: 'none' }) }
  },

  async joinRoom() {
    const openid = getApp().globalData.openid
    const roomId = this.data.inputRoomId.trim().toUpperCase()
    if (!openid || !roomId) return
    if (roomId.length !== 6) { wx.showToast({ title: '请输入6位房间号', icon: 'none' }); return }
    if (this.data.hasRoom) { wx.showToast({ title: '你已有房间', icon: 'none' }); return }
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
      const db = cloudUtil.db
      const res = await db.collection('partner_rooms').where({ member1_openid: openid }).get()
      if (res.data.length > 0) {
        await db.collection('partner_rooms').doc(res.data[0]._id).remove()
      } else {
        const res2 = await db.collection('partner_rooms').where({ member2_openid: openid }).get()
        if (res2.data.length > 0) {
          await db.collection('partner_rooms').doc(res2.data[0]._id).update({ data: { member2_openid: '' } })
        }
      }
      this.setData({ myRoomId: '', hasRoom: false, partner: null })
      wx.showToast({ title: '已退出房间', icon: 'success' })
    } catch (err) { console.error(err); wx.showToast({ title: '退出失败', icon: 'none' }) }
  }
})