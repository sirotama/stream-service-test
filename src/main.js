const express = require("express")
const bodyParser = require("body-parser")
const jade = require("jade")
const sendTalk = require("./utils/sendTalk")
const models = require("./models")
const session = require('express-session')
const MongoStore = require('connect-mongo')(session);

var app = express()
app.use(session({
    secret: 'secret',
    store: new MongoStore({
        mongooseConnection:models.mongoose.connection
    }),
    cookie: {
        httpOnly: false,
        maxAge: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) //一週間
    }
}))
app.set("view engine","jade")
app.set("views",__dirname+"/views/")
app.use(bodyParser.urlencoded({extended:false}))
app.use(session({secret:'chikubi kanjirun desita yone?'}))

app.get("/",function(req,res){
    models.lives.find({status:'live'}).then(function(lives){
        res.render("index",{lives})
    })
})
app.get("/login",function(req,res){
    res.render("login")
})
app.post("/login",function(req,res){
    var token = new models.auth_request_tokens();
    token.screenName = req.body.screenName
    token.save().then(function(){
        return sendTalk(req.body.screenName,"login url:http://localhost:3000/logincallback/"+token.token)
    }).then(function(){
        res.render("login-send.jade")
    })
})
app.get("/logincallback/:token",function(req,res){
    models.auth_request_tokens.findOne({token:req.params.token}).then(function(token){
        if(!token) {
            // not found
            res.status(404).send("token invalid?")
            return
        }
        req.session.user = token.screenName
        req.session.save()
        res.render("login-success.jade")
    })
})
app.get("/profile/:username",function(req,res){
    models.users.findOne({screenName:req.params.username}).then(function(user){
        if(!user) {
            // not found
            res.status(404).send("user not found")
            return
        }
        res.render("user-profile.jade",{user})
    })
})

app.get("/start",function(req,res){
    if(!req.session.user) {
        res.send("ろぐいんして")
        return;
    }
    models.users.findOne({screenName:req.session.user}).then(function(user){
        if(!user){
            user = new models.users()
            user.screenName = req.session.user
            return user.save()
        }
        return Promise.resolve(user)
    }).then(function(user){

        res.render("stream-start.jade",{user})
    })
})
app.get("/session",function(req,res){
    res.send(req.session)
})
var username_streamkey_cache = {}
app.get("/hls/:name/:path",function(req,res){
    var promise
    if(username_streamkey_cache[req.params.name]){
        promise = Promise.resolve(username_streamkey_cache[req.params.name])
    } else {
        promise = models.users.findOne({
            screenName:req.params.name
        }).then(function(user){
            username_streamkey_cache[req.params.name]=user.streamKey
            return Promise.resolve(user.streamKey)
        })
    }
    promise.then(function(streamKey){
        res.sendFile("/var/www/hls/"+streamKey+"/"+req.params.path)
    })
})
app.post("/nginx-callback/publish",function(req,res){
    var streamKey = req.body.name
    models.users.findOne({streamKey}).then(function(user){
        if(!user){
            return Promise.reject("notfound")
        }
        return Promise.resolve(user)
    }).then(function(){
        var live = new models.lives()
        live.screenName = user.screenName
        live.status = 'live'
        return live.save()
    }).then(function(){
        res.send("ok")
    },function(){
        res.status(400).send("ng")
    })
})
app.listen(3000)
