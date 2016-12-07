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
        maxAge: new Date(Date.now() + 60 * 60 * 1000)
    }
})); //追加
app.set("view engine","jade")
app.set("views",__dirname+"/views/")
app.use(bodyParser.urlencoded({extended:false}))
app.use(session({secret:'chikubi kanjirun desita yone?'}))

app.get("/",function(req,res){
    sendTalk('srtm','unchikong tte sitteru?')
    res.render("index",{name:'unchikong'})
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
app.listen(3000)
