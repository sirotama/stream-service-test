const express = require("express")
const bodyParser = require("body-parser")
const models = require("./models")
const fs  = require("fs")
const exec = require("child_process").exec
const request = require("request-promise")

var app = express()
app.use(bodyParser.urlencoded({extended:false}))
// 放送開始
app.post("/publish",function(req,res){
    var streamKey = req.body.name
    models.users.findOne({streamKey}).then(function(user){
        if(!user){
            return Promise.reject("notfound")
        }
        // 開始されたのにもう始まってる放送があったら終わったことに
        models.lives.find({
            screenName:user.screenName,
            status:"live"
        }).then(function(lives){
            lives.forEach(function(live){
                live.status = "archive"
                live.save(function(err){})
            })
        })
        return Promise.resolve(user)
    }).then(function(user){
        // 告知
        if(user.xyzToken) {
            setTimeout(function(){
                request.post({
                    url:"https://api.misskey.xyz/posts/create",
                    form:{
                        text:"MisskeyTVで配信を開始しました: http://misskey.tk/live/"+user.screenName,
                        _userkey:user.xyzToken
                    },
                    json:true
                }).then(function(){},function(){})
            },2000);
        }
        var live = new models.lives()
        live.screenName = user.screenName
        live.name = user.newStream.name || live.screenName+' live'
        live.description = user.newStream.description
        live.status = 'live'
        exec("rm /var/www/html/hls/"+user.screenName,function(){
            exec("ln -s /var/www/hls/"+streamKey+"/ /var/www/html/hls/"+user.screenName,function(err){});
        })
        return live.save()
    }).then(function(){
        res.send("ok")
    },function(){
        res.status(400).send("ng")
    })
})
// 放送終了
app.post("/record",function(req,res){
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
        live.endAt= new Date()
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
module.exports = app
