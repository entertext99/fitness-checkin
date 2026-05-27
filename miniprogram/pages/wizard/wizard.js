const cloudUtil = require('../../utils/cloud')
const util = require('../../utils/util')

Page({
  data: {
    step: 1,
    nickname: '',
    gender: '',
    birthday: '',
    height: '',
    initWeight: ''
  },

  onLoad() { this.init() },

  async init() {
    await cloudUtil.getOpenid()
  },

  onNicknameInput(e) { this.setData({ nickname: e.detail.value }) },
  onHeightInput(e) { this.setData({ height: e.detail.value }) },
  onInitWeightInput(e) { this.setData({ initWeight: e.detail.value }) },
  onBirthdayChange(e) { this.setData({ birthday: e.detail.value }) },

  setGender(e) {
    this.setData({ gender: e.currentTarget.dataset.gender })
  },

  nextStep() {
    if (this.data.step === 1) {
      if (!this.data.nickname) { wx.showToast({ title: '请输入昵称', icon: 'none' }); return }
      if (!this.data.gender) { wx.showToast({ title: '请选择性别', icon: 'none' }); return }
    }
    if (this.data.step === 2) {
      if (!this.data.birthday) { wx.showToast({ title: '请选择生日', icon: 'none' }); return }
    }
    this.setData({ step: this.data.step + 1 })
  },

  prevStep() {
    this.setData({ step: Math.max(1, this.data.step - 1) })
  },

  async finish() {
    const h = parseFloat(this.data.height)
    const w = parseFloat(this.data.initWeight)
    if (!h || h <= 0) { wx.showToast({ title: '请输入有效身高', icon: 'none' }); return }
    if (!w || w <= 0) { wx.showToast({ title: '请输入有效体重', icon: 'none' }); return }
    try {
      const data = {
        nickname: this.data.nickname,
        gender: this.data.gender,
        birthday: this.data.birthday,
        height: Math.round(h),
        initWeight: Math.round(w * 10) / 10
      }
      await cloudUtil.addRecord('user_profiles', data)
      wx.showToast({ title: '设置完成！', icon: 'success' })
      setTimeout(() => {
        wx.switchTab({ url: '/pages/profile/profile' })
      }, 1000)
    } catch (err) {
      console.error('wizard save error:', err)
      wx.showToast({ title: '保存失败: ' + (err.errMsg || err.message || '未知错误'), icon: 'none' })
    }
  }
})