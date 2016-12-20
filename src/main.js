const express = require("express")
const bodyParser = require("body-parser")
const jade = require("jade")
const sendTalk = require("./utils/sendTalk")
const models = require("./models")
const session = require('express-session')
const MongoStore = require('connect-mongo')(session);
const fs  = require("fs")
const exec = require("child_process").exec

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
app.use(function(req,res,next){
    console.log(req.method+" "+req.path);
    next()
})
app.set("view engine","jade")
app.set("views",__dirname+"/views/")
app.use(bodyParser.urlencoded({extended:false}))
app.use(session({secret:'chikubi kanjirun desita yone?'}))
app.use(function (req,res,next){
    res.locals.login = !!req.session.user
    next();
})
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
        return models.lives.find({screenName:user.screenName}).then(function(lives){
            res.render("user-profile.jade",{user,lives})
        })
    })
})
app.get("/live/:username",function(req,res){
    models.users.findOne({screenName:req.params.username}).then(function(user){
        if(!user) {
            // not found
            res.status(404).send("user not found")
            return
        }
        return Promise.all([
            user,
            models.lives.findOne({screenName:user.screenName}).sort("-createdAt")
        ])
    }).then(function(_){
        var user = _[0]
        var live = _[1]
        console.log(arguments)
        res.render("show-live.jade",{user,live})
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
// HLS配信
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
        res.sendFile("/var/www/hls/"+streamKey+"/"+req.params.path,function(err){if(err)res.status(404).send("not-found")})
	console.log("/var/www/hls/"+streamKey+"/"+req.params.path)
    })
})
// 録画配信
app.get("/records/mp4/:id",function(req,res){
    models.lives.findById(req.params.id).then(function(live){
        if(!live) return res.status(404).send("not-found")
        if(!live.recordPath) return res.status(404).send("not-found")
        res.sendFile(live.recordPath)
    })
})
// 放送開始
app.post("/nginx-callback/publish",function(req,res){
    var streamKey = req.body.name
    models.users.findOne({streamKey}).then(function(user){
        if(!user){
            return Promise.reject("notfound")
        }
        return Promise.resolve(user)
    }).then(function(user){
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
// 放送終了
app.post("/nginx-callback/record",function(req,res){
    var recordFilePath = req.body.path
    console.log(recordFilePath)
    var streamKey = /^.+\/(.+?)\.flv$/.exec(recordFilePath)[1]
    if(0 !== recordFilePath.indexOf("/var/www/html/records")) return res.status(403).send("invalid")
    if(~recordFilePath.indexOf("'")) return res.status(403).send("invalid")
    if(~recordFilePath.indexOf('"')) return res.status(403).send("invalid")
    if(~recordFilePath.indexOf("..")) return res.status(403).send("invalid")
    models.users.findOne({streamKey}).then(function(user){
        if(!user) {
            return Promise.reject("user-not-found")
        }
        return models.lives.findOne({screenName:user.screenName,status:"live"})
    }).then(function(live){
        live.status="archive"
        return live.save()
    }).then(function(live){
        return new Promise(function(resolve,reject){
            exec("ffmpeg -i "+recordFilePath+" -vcodec copy -acodec copy ../records/"+live.id+".mp4",function(err){
                if(err) reject(err)
                fs.unlink(recordFilePath,function(err){
                    if(err) reject(err)
                    resolve()
                })
            })
        }).then(function(){
            live.recordPath="/var/www/html/records/"+live.id+".mp4"
            return live.save()
        })
    }).then(function(){
        res.send("ok");
    },function(err){
        res.status(400).send(err)
    })
})
app.listen(3000)
