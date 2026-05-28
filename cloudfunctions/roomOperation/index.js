const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const MAX_JOINED_ROOMS = 5

exports.main = async (event, context) => {
  const { action, roomId } = event
  const wxContext = cloud.getWXContext()
  const callerOpenid = wxContext.OPENID

  if (action === 'findMyRooms') {
    const own = await db.collection('partner_rooms').where({ member1_openid: callerOpenid }).get()
    const joined = await db.collection('partner_rooms').where({ member2_openid: callerOpenid }).get()
    const rooms = []
    own.data.forEach(r => rooms.push({ roomId: r.roomId, role: 'owner', partnerOpenid: r.member2_openid || '' }))
    joined.data.forEach(r => rooms.push({ roomId: r.roomId, role: 'member', partnerOpenid: r.member1_openid }))
    return { code: 0, data: rooms }
  }

  if (action === 'createRoom') {
    const own = await db.collection('partner_rooms').where({ member1_openid: callerOpenid }).get()
    if (own.data.length > 0) return { code: 1, msg: '你已创建过房间，不能重复创建' }

    const newRoomId = Math.random().toString(36).substr(2, 6).toUpperCase()
    await db.collection('partner_rooms').add({
      data: { roomId: newRoomId, member1_openid: callerOpenid, member2_openid: '' }
    })
    return { code: 0, data: { roomId: newRoomId } }
  }

  if (action === 'joinRoom') {
    if (!roomId) return { code: 1, msg: '请输入房间号' }

    const joined = await db.collection('partner_rooms').where({ member2_openid: callerOpenid }).get()
    if (joined.data.length >= MAX_JOINED_ROOMS) return { code: 1, msg: `最多加入${MAX_JOINED_ROOMS}个房间` }

    const own = await db.collection('partner_rooms').where({ member1_openid: callerOpenid }).get()
    const existingRoomIds = new Set()
    own.data.forEach(r => existingRoomIds.add(r.roomId))
    joined.data.forEach(r => existingRoomIds.add(r.roomId))

    const res = await db.collection('partner_rooms').where({ roomId }).get()
    if (res.data.length === 0) return { code: 1, msg: '房间不存在' }
    const room = res.data[0]
    if (existingRoomIds.has(room.roomId)) return { code: 1, msg: '你已经在这个房间中了' }
    if (room.member1_openid === callerOpenid) return { code: 1, msg: '不能加入自己的房间' }
    if (room.member2_openid) return { code: 1, msg: '房间人数已满' }

    await db.collection('partner_rooms').doc(room._id).update({ data: { member2_openid: callerOpenid } })
    return { code: 0, data: { roomId: room.roomId, partnerOpenid: room.member1_openid } }
  }

  if (action === 'getRoomData') {
    if (!roomId) return { code: 1, msg: '缺少房间号' }

    const roomRes = await db.collection('partner_rooms').where({ roomId }).get()
    if (roomRes.data.length === 0) return { code: 1, msg: '房间不存在' }
    const room = roomRes.data[0]

    const openids = [room.member1_openid]
    if (room.member2_openid) openids.push(room.member2_openid)

    const [profileRaw, weightRaw, measureRaw] = await Promise.all([
      db.collection('user_profiles').where({ _openid: db.command.in(openids) }).get(),
      db.collection('weight_records').where({ _openid: db.command.in(openids) }).orderBy('date', 'asc').get(),
      db.collection('measurement_records').where({ _openid: db.command.in(openids) }).orderBy('date', 'asc').get()
    ])

    const members = openids.map(oid => {
      const profile = profileRaw.data.find(p => p._openid === oid)
      const weights = weightRaw.data.filter(w => w._openid === oid).map(w => ({ date: w.date, weight: w.weight }))
      const measures = measureRaw.data.filter(m => m._openid === oid).map(m => ({ date: m.date, values: m.values }))
      return {
        openid: oid,
        nickname: profile ? (profile.nickname || '健身达人') : '健身达人',
        gender: profile ? (profile.gender || '') : '',
        height: profile ? (profile.height || '') : '',
        weights,
        measures
      }
    })

    return { code: 0, data: { roomId: room.roomId, members } }
  }

  if (action === 'leaveRoom') {
    if (!roomId) return { code: 1, msg: '缺少房间号' }

    let res = await db.collection('partner_rooms').where({ roomId, member1_openid: callerOpenid }).get()
    if (res.data.length > 0) {
      await db.collection('partner_rooms').doc(res.data[0]._id).remove()
      return { code: 0, msg: '已删除房间' }
    }

    res = await db.collection('partner_rooms').where({ roomId, member2_openid: callerOpenid }).get()
    if (res.data.length > 0) {
      await db.collection('partner_rooms').doc(res.data[0]._id).update({ data: { member2_openid: '' } })
      return { code: 0, msg: '已退出房间' }
    }

    return { code: 1, msg: '未找到房间' }
  }

  return { code: 1, msg: '未知操作' }
}
