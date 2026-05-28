const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { action, roomId } = event
  const wxContext = cloud.getWXContext()
  const callerOpenid = wxContext.OPENID

  if (action === 'findMyRoom') {
    let res = await db.collection('partner_rooms').where({ member1_openid: callerOpenid }).get()
    if (res.data.length > 0) {
      const room = res.data[0]
      return { code: 0, data: { roomId: room.roomId, role: 'owner', partnerOpenid: room.member2_openid || '' } }
    }
    res = await db.collection('partner_rooms').where({ member2_openid: callerOpenid }).get()
    if (res.data.length > 0) {
      const room = res.data[0]
      return { code: 0, data: { roomId: room.roomId, role: 'member', partnerOpenid: room.member1_openid } }
    }
    return { code: 0, data: null }
  }

  if (action === 'createRoom') {
    const existing = await db.collection('partner_rooms')
      .where(db.command.or([{ member1_openid: callerOpenid }, { member2_openid: callerOpenid }]))
      .get()
    if (existing.data.length > 0) return { code: 1, msg: '你已有房间' }

    const newRoomId = Math.random().toString(36).substr(2, 6).toUpperCase()
    await db.collection('partner_rooms').add({
      data: { roomId: newRoomId, member1_openid: callerOpenid, member2_openid: '' }
    })
    return { code: 0, data: { roomId: newRoomId } }
  }

  if (action === 'joinRoom') {
    const existing = await db.collection('partner_rooms')
      .where(db.command.or([{ member1_openid: callerOpenid }, { member2_openid: callerOpenid }]))
      .get()
    if (existing.data.length > 0) return { code: 1, msg: '你已有房间' }

    const res = await db.collection('partner_rooms').where({ roomId }).get()
    if (res.data.length === 0) return { code: 1, msg: '房间不存在' }
    const room = res.data[0]
    if (room.member2_openid) return { code: 1, msg: '房间人数已满' }
    if (room.member1_openid === callerOpenid) return { code: 1, msg: '不能加入自己的房间' }
    await db.collection('partner_rooms').doc(room._id).update({ data: { member2_openid: callerOpenid } })
    return { code: 0, data: { roomId: room.roomId, partnerOpenid: room.member1_openid } }
  }

  if (action === 'leaveRoom') {
    let res = await db.collection('partner_rooms').where({ member1_openid: callerOpenid }).get()
    if (res.data.length > 0) {
      await db.collection('partner_rooms').doc(res.data[0]._id).remove()
      return { code: 0, msg: '已退出' }
    }
    res = await db.collection('partner_rooms').where({ member2_openid: callerOpenid }).get()
    if (res.data.length > 0) {
      await db.collection('partner_rooms').doc(res.data[0]._id).update({ data: { member2_openid: '' } })
      return { code: 0, msg: '已退出' }
    }
    return { code: 1, msg: '未找到房间' }
  }

  return { code: 1, msg: '未知操作' }
}
