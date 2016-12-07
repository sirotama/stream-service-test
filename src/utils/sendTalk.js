const rp = require("request-promise")

module.exports = function(screen_name,text){
    var headers= {}
    var request = rp.defaults({jar:true})
    return request.get({url:"https://misskey.link"})
    .then(function(httpres){
        var re = /<meta name="csrf-token" content="([A-Za-z0-9\-_]+)">/
        var token = re.exec(httpres)[1]
        console.log(token)
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
        return request.post({
            url:"https://api.misskey.link/users/show",
            form:{
                "screen-name":screen_name
            }
        })
        console.log(httpres)
    }).then(function(httpres){
        httpres = JSON.parse(httpres)
        const userid = httpres.id
        return request.post({
            url:"https://himasaku.misskey.link/talks/messages/say",
            headers,
            form:{
                text,
                "user-id":userid
            }
        })
    })
}
