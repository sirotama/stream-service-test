const rndstr = require("rndstr")
module.exports = function(mongoose) {
    function generateToken(){
        return rndstr();
    }
    var schema = new mongoose.Schema({
        screenName:String,
        streamKey:{type:String,default:generateToken},
        newStream:{
            allowFlag:Boolean,
            allowDate:Date,
            name:String,
            description:String,
        },
        xyzToken:String,
    },{
        timestamps:true
    })
    return mongoose.model("users",schema)
};
