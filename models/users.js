const { Schema, model } = require('mongoose')

const dataModel = model('Users', new Schema({}, { strict: false, versionKey: false, timestamps: true }))

module.exports = dataModel
