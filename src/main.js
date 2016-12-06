const express = require("express")
const bodyParser = require("body-parser")
const jade = require("jade")
const rp = require("request-promise");

var app = express()
app.set("view engine","jade")
app.set("views",__dirname+"/views/")
app.use(bodyParser.urlencoded({extended:false}))

app.get("/",function(req,res){
    var jar = rp.jar()
    var headers= {}
    var request = rp
    request.defaults({jar:true})
    request.get({url:"https://misskey.link"})
    .then(function(httpres){
        var re = /<meta name="csrf-token" content="([A-Za-z0-9\-_]+)">/
        var token = re.exec(httpres)[1]
        console.log(token)
        console.log(jar.getCookies())
        headers["csrf-token"] = token
        return request.post({
            url:"https://login.misskey.link",
            headers,
            form:{
                "screen-name":"misskey-tv",
                "password":"genkaimenhera3059sasa",
                "_csrf":token
            }
        })
    }).then(function(httpres){
        console.log(httpres)
    })
    res.render("index",{name:'unchikong'})
})
app.post("/login")

app.listen(3000)
