class Session{
    constructor(id, connectorId, userId){
        this.id = id
        this.connectorId = connectorId
        this.userId = userId
        this.startTime = new Date()
        this.endTime = null
    }   

    stopSession(){
        this.endTime = new Date();
    }

    getDuration(){
        if (!this.endTime) return null;
        return (this.endTime - this.startTime) / 1000; 
    }
}

module.exports = Session;