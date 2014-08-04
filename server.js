/**
 * Created by wzwang on 14-7-26.
 */
//Modified from http://ejohn.org/blog/ecmascript-5-strict-mode-json-and-more/
"use strict";

// Optional. You will see this name in eg. 'ps' or 'top' command
process.title = 'node-msgol';

// Port where we'll run the websocket server
var webSocketsServerPort = 1337;

// websocket and http servers
var webSocketServer = require('websocket').server;
var http = require('http');

// MongoDB schema and model.
var MongoDB = require('./mongo.js')

/**
 * Global variables
 */
// list of currently connected clients (users)
var clients = [ ];

/**
 * HTTP server
 */
var server = http.createServer(function (request, response) {
    console.log((new Date()) + ' HTTP server. URL' + request.url + ' requested.');

    if (request.url === '/status') {
        response.writeHead(200, {'Content-Type': 'application/json'});
        var responseObject = {
            currentClients: clients.length
        }
        response.end(JSON.stringify(responseObject));
    } else {
        response.writeHead(404, {'Content-Type': 'text/plain'});
        response.end('Sorry, unknown url');
    }
});
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
    var userName = false;
    var phone_id = null;
    var IMEI = null;
    var IMSI = null;

    console.log((new Date()) + ' Connection accepted.');


    // user sent some message
    connection.on('message', function (message) {
        if (message.type === 'utf8') { // accept only text
            if (userName === false) { // first message sent by user is their name
                var recvMsg = JSON.parse(message.utf8Data);
                if (recvMsg.login == true) {
                    //The phone want to login.
                    if (recvMsg.setUser == false) {
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
                                        var ret = {"login": 404};
                                        connection.sendUTF(JSON.stringify(ret));
                                    } else {
                                        userName = phone.user.username;
                                        phone_id = phone._id;
                                        IMEI = recvIMEI;
                                        IMSI = recvIMSI;
                                        var ret = {"login": 200,
                                            "username": userName};
                                        connection.sendUTF(JSON.stringify(ret));
                                        console.log((new Date()) + " Phone (IMEI: " + recvIMEI + ") belongs to " + userName + ".");
                                    }
                                }
                            });
                    } else {
                        //Set the user.
                        var setUsername = recvMsg.user;
                        var recvIMEI = recvMsg.IMEI;
                        var recvIMSI = recvMsg.IMSI;
                        MongoDB.User.findOne({username: setUsername}, function (err, user) {
                            if (err)
                                throw err;
                            else {
                                if (user == null) {
                                    var ret = {"login": 405, "setUser": 504};
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
                                        var ret = {"login": 405,
                                            "setUser": 502};
                                        connection.sendUTF(JSON.stringify(ret));
                                    });
                                }
                            }
                        });
                    }
                }
            } else { // log and broadcast the message
                var recvMsg = JSON.parse(message.utf8Data).msg;
                var fromNumber = recvMsg.fromNumber;
                var content = recvMsg.content;
                var time = recvMsg.time;
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
        }
    });

    // user disconnected
    connection.on('close', function (connection) {
        if (userName !== false) {
            console.log((new Date()) + " Peer "
                + connection.remoteAddress + " disconnected.");
            // remove user from the list of connected clients
            clients.splice(index, 1);
            // push back user's color to be reused by another user
        }
    });

});
