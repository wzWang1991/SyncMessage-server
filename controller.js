"use strict";
var MongoDB = require('./mongo.js')

exports.index = function (req, res) {
    res.render('index.html',
        {
            title : "SyncMessage",
            session : req.session
        });
};

exports.login = function (req, res) {
    res.render('login.html', {title : "Log in"});
};

exports.doLogin = function (req, res) {
    var username = req.body.username;
    var password = req.body.password;
    if (username == null || password == null) {
        res.send("Please input correct username and password.");
    } else {
        MongoDB.User.findOne({username : username}, function(err, user) {
            if (err)
                throw err;
            else {
                if (user == null) {
                    res.render('login.html',
                        {
                            title : "Log in",
                            error : "We can't find you in the database. Please register first."
                        });
                } else {
                    if (user.password != password) {
                        res.render('login.html',
                            {
                                title : "Log in",
                                error : "Your password is not correct. Please try it again."
                            });
                    } else {
                        req.session.user = username;
                        req.session.user_id = user._id;
                        res.redirect('/user');
                    }
                }
            }
        });
    }
};

exports.logout = function (req, res) {
    req.session.destroy(function () {
        res.redirect('/');
    });
};

exports.userCenter = function (req, res) {
    var phones = require('./server').getClients(req.session.user);
    var onlinePhoneId = [ ];
    if (phones != null) {
        for (var key in phones) {
            onlinePhoneId.push(phones[key].phone_id);
        }
    }
    var onlinePhones = [ ];
    var offlinePhones = [ ];
    MongoDB.Phone.find({_id: {$in : onlinePhoneId}}, '_id IMEI IMSI unreadMsgs', function (err, phone) {
        if (err)
            throw err;
        else {
            onlinePhones = phone;
            MongoDB.Phone.find({_id: {$nin : onlinePhoneId}}, '_id IMEI IMSI unreadMsgs', function (err, phone) {
                if (err)
                    throw err;
                else {
                    offlinePhones = phone;
                    res.render('userCenter.html',
                        {
                            title : "User Center",
                            session: req.session,
                            onlinePhones : onlinePhones,
                            offlinePhones : offlinePhones
                        });
                }

            });
        }
    });

};

exports.requiredAuthentication = function requiredAuthentication(req, res, next) {
    if (req.session.user) {
        next();
    } else {
        req.session.error = 'Access denied!';
        res.redirect('/login');
    }
};

exports.sendmsg = function (req, res) {
    var user = req.session.user;
    var phone_id = req.body.phoneid;
    var number = req.body.sendingNumber;
    var text = req.body.sendingText;
    // In fact, we need to check if this phone belongs this user.
    require('./server').sendMsg(user, phone_id, number, text);
    res.send("Success!")
};

exports.register = function (req, res) {
    res.render('register.html', {title : "Register"});
};

exports.doRegister = function (req, res) {
    var username = req.body.username;
    var password = req.body.password;
    var email = req.body.email;
    if (username == null || password == null || email == null) {
        res.send("Please input correct username, password and email.");
    } else {
        MongoDB.User.findOne({username : username}, function(err, user) {
           if (user != null) {
               res.render('register.html',
                   {
                       title : "Register",
                       error : "This username exists. Please choose another one."
                   });
           } else {
               var newUser = new MongoDB.User({
                   username: username,
                   password: password,
                   email: email
               });
               newUser.save(function (err, product) {
                   if (err)
                       throw err;
                   req.session.user = username;
                   req.session.user_id = product._id;
                   res.redirect('/user');
               });
           }
        });
    }

};

exports.setRead = function(req, res) {
    var phone_id = req.body.phone_id;
    var message_id = req.body.message_id;
    MongoDB.Phone.findOne({_id : phone_id, unreadMsgs : {$elemMatch: {_id : message_id}}}, {"unreadMsgs.$": 1}, function(err, phone) {
        if (err)
            throw err;
        else {
            var message = phone.unreadMsgs[0];
            MongoDB.Phone.update({_id : phone_id}, {$pull : {unreadMsgs : {_id : message_id}}}, function(err) {
                if (err)
                    throw err;
                else {
                    MongoDB.Phone.update({_id: phone_id}, {$push: {readedMsgs: message}}, function (err) {
                        if (err)
                            throw err;
                        else
                            res.send("success!")
                    });
                }
            });
        }
    })
};

exports.historymsg = function(req, res) {
    var phone_id = req.body.phone_id;
    MongoDB.Phone.findOne({_id : phone_id}, function(err, phone){
        if (err)
            throw err;
        else {
            res.send(JSON.stringify(phone.readedMsgs));
        }
    });
}
