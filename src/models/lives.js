module.exports = function(mongoose) {
    var schema = new mongoose.Schema({
        screenName:String,
        name:String,
        description:String,
        recordPath:String,
        status:String,
        endAt:Date,
    },{
        timestamps:true
    })
    return mongoose.model("lives",schema)
};
