module.exports = function(mongoose) {
    var schema = new mongoose.Schema({
        screenName:String,
        recordPath:String,
        status:String
    },{
        timestamps:true
    })
    return mongoose.model("lives",schema)
};
