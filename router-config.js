'use strict';
var express = require('express');
var path = require('path');
var bodyParser = require('body-parser')
var controller = require('./controller');
var session = require('express-session')
var register = function (app) {
    app.engine('html', require('ejs').renderFile);
    app.use(bodyParser.urlencoded({
        extended: true
    }));
    app.use(session({
        secret: 'egasseMcnys',
        resave: true,
        saveUninitialized: true
    }))
    app.use(express.static(path.join(__dirname, 'public')));
    // Index page
    app.get('/', controller.index);

    // Login page
    app.get('/login', controller.login);
    app.post('/login', controller.doLogin);
    app.get('/logout', controller.logout);

    // User center.
    app.get('/user', controller.requiredAuthentication, controller.userCenter);

    // Sending message
    app.post('/sendmsg', controller.requiredAuthentication, controller.sendmsg);

    app.get('/register', controller.register);
    app.post('/register', controller.doRegister);
};
module.exports = {
    register :  register
};