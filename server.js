/**
 * Created by wzwang on 14-7-26.
 */
//Modified from http://ejohn.org/blog/ecmascript-5-strict-mode-json-and-more/
"use strict";

// Optional. You will see this name in eg. 'ps' or 'top' command
process.title = 'node-msgol';

// Port where we'll run the websocket server
var webSocketsServerPort = 2945;

// websocket and http servers
var webSocketServer = require('websocket').server;
var http = require('http');

// MongoDB schema and model.
var MongoDB = require('./mongo.js')

// Express
var express = require('express');
var app = express();


// Express routers
var router_config = require('./router-config');
router_config.register(app);



/**
 * Global variables
 */
// list of currently connected clients (users)
var clients = [ ];
var authorizedClients = { };

var getClients = function (username) {
    if (username in authorizedClients)
        return authorizedClients[username];
    else
        return null;
};

exports.getClients = getClients;


/**
 * Function to send message.
 */
var sendMsg = function (user, phone_id, number, text) {
    var phones = authorizedClients[user];
    var phone = null;
    for (var i = 0; i < phones.length; i++) {
        if (phones[i].phone_id == phone_id) {
            phone = phones[i];
            break;
        }
    }
    if (phone != null) {
        var ret = {
            req : 600,
            number : number,
            text : text
        };
        phone.connection.sendUTF(JSON.stringify(ret));
        return true;
    } else
        return false;
};

exports.sendMsg = sendMsg;

/**
 * HTTP server
 */
var server = http.createServer(app);
server.listen(webSocketsServerPort, function () {
    console.log((new Date()) + " Server is listening on port " + webSocketsServerPort);
});


/**
 * WebSocket server
 */
var wsServer = new webSocketServer({
    // WebSocket server is tied to a HTTP server. WebSocket request is just
    // an enhanced HTTP request. For more info http://tools.ietf.org/html/rfc6455#page-6
    httpServer: server
});

// This callback function is called every time someone
// tries to connect to the WebSocket server
wsServer.on('request', function (request) {
    console.log((new Date()) + ' Connection from origin ' + request.origin + '.');

    // accept connection - you should check 'request.origin' to make sure that
    // client is connecting from your website
    // (http://en.wikipedia.org/wiki/Same_origin_policy)
    var connection = request.accept(null, request.origin);
    // we need to know client index to remove them on 'close' event
    var index = clients.push(connection) - 1;
    var authorizedIndex;
    var userName = false;
    var phone_id = null;
    var IMEI = null;
    var IMSI = null;

    console.log((new Date()) + ' Connection accepted.');


    // user sent some message
    connection.on('message', function (message) {
        if (message.type === 'utf8') { // accept only text
                var recvMsg = JSON.parse(message.utf8Data);
                switch (recvMsg.req) {
                    case 100:
                        // Login request.
                        var recvIMEI = recvMsg.IMEI;
                        var recvIMSI = recvMsg.IMSI;
                        console.log((new Date()) + ' Phone connected. IMEI: ' + recvIMEI
                            + ' and IMSI: ' + recvIMSI + '.');
                        MongoDB.Phone.findOne({IMEI: recvIMEI, IMSI: recvIMSI})
                            .populate('user')
                            .exec(function (err, phone) {
                                if (err)
                                    throw err;
                                else {
                                    if (phone == null) {
                                        var ret = {
                                            "req": 0,
                                            "ret": 201
                                        };
                                        connection.sendUTF(JSON.stringify(ret));
                                    } else {
                                        userName = phone.user.username;
                                        phone_id = phone._id;
                                        IMEI = recvIMEI;
                                        IMSI = recvIMSI;
                                        var ret = {
                                            "req": 0,
                                            "ret": 200,
                                            "username": userName
                                        };
                                        connection.sendUTF(JSON.stringify(ret));
                                        var info = {
                                            IMEI : IMEI,
                                            IMSI : IMSI,
                                            phone_id : phone_id,
                                            connection: connection
                                        };
                                        if (!(userName in authorizedClients)) {
                                            authorizedClients[userName] = [info];
                                        } else
                                            authorizedClients[userName].push(info);
                                        console.log((new Date()) + " Phone (IMEI: " + recvIMEI + ") belongs to " + userName + ".");
                                    }
                                }
                            });
                        break;
                    case 101:
                        // Set user name request.
                        //Set the user.
                        var setUsername = recvMsg.username;
                        var recvIMEI = recvMsg.IMEI;
                        var recvIMSI = recvMsg.IMSI;
                        MongoDB.User.findOne({username: setUsername}, function (err, user) {
                            if (err)
                                throw err;
                            else {
                                if (user == null) {
                                    var ret = {
                                        "req": 0,
                                        "ret": 203
                                    };
                                    connection.sendUTF(JSON.stringify(ret));
                                } else {
                                    var newPhone = new MongoDB.Phone({
                                        IMEI: recvIMEI,
                                        IMSI: recvIMSI,
                                        user: user._id
                                    });
                                    newPhone.save(function (err) {
                                        if (err)
                                            throw err;
                                        var ret = {
                                            "req": 0,
                                            "ret": 202
                                        };
                                        connection.sendUTF(JSON.stringify(ret));
                                    });
                                }
                            }
                        });
                        break;
                    case 300:
                        if (userName != false) {
                            var recvSms = JSON.parse(message.utf8Data).sms;
                            var fromNumber = recvSms.fromNumber;
                            var content = recvSms.text;
                            var time = recvSms.time;
                            var newMessage = new MongoDB.Message({
                                text: content,
                                fromNumber: fromNumber,
                                recvTime: time,
                                syncTime: new Date().getTime()
                            });
                            MongoDB.Phone.update({_id: phone_id}, {$push: {unreadMsgs: newMessage}}, function (err) {
                                if (err)
                                    throw err;
                            });
                            console.log((new Date()) + ' Received Message from '
                                + userName + ': ' + fromNumber + " " + content);
                        }
                        break;
                    default:
                        break;
                }
        }
    });

    // user disconnected
    connection.on('close', function (connection) {
        if (userName == false) {
            console.log((new Date()) + " Peer "
                + connection.remoteAddress + " disconnected.");
            // remove user from the list of connected clients
            clients.splice(index, 1);
            // push back user's color to be reused by another user
        } else {
            clients.splice(index, 1);
            authorizedClients[userName].splice(authorizedIndex, 1);
            console.log((new Date()) + " A phone of "
                + userName + " disconnected.");
        }
    });

});
