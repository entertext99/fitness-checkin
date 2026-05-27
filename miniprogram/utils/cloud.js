const cloud = wx.cloud

const callFunction = (name, data = {}) => {
  return cloud.callFunction({
    name,
    data
  })
}

const getOpenid = async () => {
  try {
    const app = getApp()
    if (app.globalData.openid) return app.globalData.openid
    const res = await callFunction('login')
    app.globalData.openid = res.result.openid
    return res.result.openid
  } catch (err) {
    console.error('获取 openid 失败', err)
    return ''
  }
}

const db = cloud.database()
const _ = db.command

const addRecord = (collection, data) => {
  return db.collection(collection).add({
    data: {
      ...data,
      createTime: db.serverDate()
    }
  })
}

const getRecords = async (collection, query = {}, orderBy = { field: 'createTime', order: 'desc' }) => {
  return db.collection(collection)
    .where(query)
    .orderBy(orderBy.field, orderBy.order)
    .get()
}

const updateRecord = (collection, id, data) => {
  return db.collection(collection).doc(id).update({
    data: {
      ...data,
      updateTime: db.serverDate()
    }
  })
}

const deleteRecord = (collection, id) => {
  return db.collection(collection).doc(id).remove()
}

module.exports = {
  callFunction,
  getOpenid,
  addRecord,
  getRecords,
  updateRecord,
  deleteRecord,
  db,
  _
}
