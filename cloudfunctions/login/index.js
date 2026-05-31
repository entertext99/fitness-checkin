const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const COLLECTIONS = ['diet_records', 'user_profiles', 'partner_rooms', 'fitness_records', 'weight_records', 'measurement_records']

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()

  for (const name of COLLECTIONS) {
    try {
      await db.createCollection(name)
    } catch (e) {
      if (e.errCode !== -502001) console.error(`createCollection ${name} error:`, e)
    }
  }

  return {
    openid: wxContext.OPENID,
    appid: wxContext.APPID,
    unionid: wxContext.UNIONID
  }
}
