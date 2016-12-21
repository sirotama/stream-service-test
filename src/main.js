const express = require("express")
const bodyParser = require("body-parser")
const jade = require("jade")
const sendTalk = require("./utils/sendTalk")
const models = require("./models")
const session = require('express-session')
const MongoStore = require('connect-mongo')(session);
const fs  = require("fs")
const exec = require("child_process").exec
const request = require("request-promise")
const config = require("./config")
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
    Promise.all([
        models.lives.find({status:'live'}),
        models.lives.find({status:'archive'}).sort("-endAt")
    ]).then(function(_){
        res.render("index",{
            lives:_[0],
            end_lives:_[1]
        })
    })
})
app.get("/login",function(req,res){
    res.render("login")
})
// misskey.xyz 認証開始
app.get("/login/xyz_start",function(req,res){
    request.post({
        url:"https://api.misskey.xyz/auth/session/generate",
        form:{
            app_secret:config.api_secret
        },
        json:true
    }).then(function(json){
        res.redirect("https://auth.misskey.xyz/"+json.token)
    })
})
app.get("/login/xyz_callback",function(req,res){
    request.post({
        url:"https://api.misskey.xyz/auth/session/userkey",
        form:{
            app_secret:config.api_secret,
            token:req.query.token
        },
        json:true
    }).then(function(json){
        req.session.userkey = json.userkey
        return request.post({
            url:"https://api.misskey.xyz/i",
            form:{
                _userkey:json.userkey
            },
            json:true
        })
    }).then(function(json){
        console.log(json)
        req.session.user = json.username
        req.session.save()
        return models.users.findOne({screenName:json.username})
    }).then(function(user){
        if(!user) {
            user = new models.users()
            user.screenName = req.session.user
        }
        user.xyzToken = req.session.userkey
        return user.save()
    }).then(function(user){
        res.redirect("/login/xyz_end")
    })
})
app.get("/login/xyz_end",function(req,res){
    res.render("login-success")
})
app.get("/profile/:username",function(req,res){
    models.users.findOne({screenName:req.params.username}).then(function(user){
        if(!user) {
            // not found
            res.status(404).send("user not found")
            return
        }
        return Promise.all([
            user,
            models.lives.find({screenName:user.screenName}).sort("-createdAt"), // lives
            models.lives.findOne({screenName:user.screenName,status:"live"}).sort("-createdAt") // now_live
        ])
    }).then(function(_){
        res.render("user-profile.jade",{
            user:_[0],
            lives:_[1],
            now_live:_[2]
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
            models.lives.findOne({screenName:user.screenName,status:'live'}).sort("-createdAt")
        ])
    }).then(function(_){
        var user = _[0]
        var live = _[1]
        if(!live) return res.redirect("/profile/"+user.screenName)
        res.render("show-live.jade",{user,live})
    })
})
app.get("/record/:id",function(req,res){
    models.lives.findById(req.params.id).then(function(live){
        if(!live) {
            // not found
            res.status(404).send("live not found")
            return
        }
        return Promise.all([
            models.users.findOne({screenName:live.screenName}),
            live
        ])
    }).then(function(_){
        var user = _[0]
        var live = _[1]
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
app.post("/start",function(req,res){
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
        user.newStream.name = req.body.name
        user.newStream.description = req.body.description
        return user.save()
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
    })
})
// 録画配信
app.get("/record/:id/mp4",function(req,res){
    models.lives.findById(req.params.id).then(function(live){
        if(!live) return res.status(404).send("not-found")
        if(!live.recordPath) return res.status(404).send("not-found")
        res.sendFile(live.recordPath)
    })
})
app.use("/nginx-callback",require("./nginx-callback"))
app.listen(3000)
