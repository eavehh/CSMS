class Charger{
    cosntructor(id){
        this.id = id;   
        this.status = "avaiable"
        this.sessions = [];
    }

    startSession(session){
        this.status = "charging" 
        this.sessions.push(session)
    }

    stopSession(sessionId){
        const session = this.sessions.find(id => s.id === sessionId) 
        if (session){
            session.stop();
            this.status = "available";
        }
    }
}

module.exports = Charger;