const express = require("express")
const bodyParser = require("body-parser")
const jade = require("jade")
const models = require("./models")
const fs  = require("fs")
const request = require("request-promise")
const config = require("./config")
var app = express()
app.set("view engine","jade")
app.set("views",__dirname+"/views/")

app.get("/",function(req,res){
    res.render("login")
})
// misskey.xyz 認証開始
app.get("/xyz_start",function(req,res){
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
app.get("/xyz_callback",function(req,res){
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
app.get("/xyz_end",function(req,res){
    res.render("login-success")
})
module.exports = app
