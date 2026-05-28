const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { action, roomId, openid } = event
  const wxContext = cloud.getWXContext()
  const callerOpenid = wxContext.OPENID

  if (action === 'findRoom') {
    const res = await db.collection('partner_rooms').where({ roomId }).get()
    return { code: 0, data: res.data }
  }

  if (action === 'joinRoom') {
    const res = await db.collection('partner_rooms').where({ roomId }).get()
    if (res.data.length === 0) return { code: 1, msg: '房间不存在' }
    const room = res.data[0]
    if (room.member2_openid) return { code: 1, msg: '房间人数已满' }
    if (room.member1_openid === callerOpenid) return { code: 1, msg: '不能加入自己的房间' }
    await db.collection('partner_rooms').doc(room._id).update({ data: { member2_openid: callerOpenid } })
    return { code: 0, data: { roomId: room.roomId, partnerOpenid: room.member1_openid } }
  }

  return { code: 1, msg: '未知操作' }
}
