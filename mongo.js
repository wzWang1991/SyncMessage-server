var mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1/msgol');
var Schema = mongoose.Schema;

var MessageSchema = new Schema({
    text  :  { type: String },
    fromNumber   :  { type: String },
    recvTime : { type : Number },
    syncTime : { type : Number }
});

var UserSchema = new Schema({
    username : { type : String, index: { unique: true } },
    password : { type : String },
    email : { type : String }
});

var PhoneSchema = new Schema({
    user : {type: Schema.ObjectId, ref: 'User', required : true},
    IMEI : { type : String, required: true },
    IMSI : { type : String, required: true },
    number : { type : String },
    unreadMsgs : [MessageSchema],
    readedMsgs : [MessageSchema]
});



var Message = mongoose.model('Message', MessageSchema);
var Phone = mongoose.model('Phone', PhoneSchema);
var User = mongoose.model('User', UserSchema);

module.exports = {
    Message : Message,
    Phone : Phone,
    User : User
};