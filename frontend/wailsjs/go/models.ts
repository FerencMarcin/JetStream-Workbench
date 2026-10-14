export namespace main {
	
	export class ConnectionRequest {
	    url: string;
	    username: string;
	    password: string;
	    token: string;
	    credsFile: string;
	    nkeySeed: string;
	
	    static createFrom(source: any = {}) {
	        return new ConnectionRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.url = source["url"];
	        this.username = source["username"];
	        this.password = source["password"];
	        this.token = source["token"];
	        this.credsFile = source["credsFile"];
	        this.nkeySeed = source["nkeySeed"];
	    }
	}
	export class ConnectionStatus {
	    connected: boolean;
	    url: string;
	    serverId: string;
	    server: string;
	
	    static createFrom(source: any = {}) {
	        return new ConnectionStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.connected = source["connected"];
	        this.url = source["url"];
	        this.serverId = source["serverId"];
	        this.server = source["server"];
	    }
	}
	export class ConsumerSummary {
	    stream: string;
	    name: string;
	    filterSubjects: string[];
	    ackPolicy: string;
	    ackWaitMs: number;
	    maxDeliver: number;
	    numPending: number;
	    numAckPending: number;
	    numRedelivered: number;
	    delivered: number;
	    ackFloor: number;
	
	    static createFrom(source: any = {}) {
	        return new ConsumerSummary(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.stream = source["stream"];
	        this.name = source["name"];
	        this.filterSubjects = source["filterSubjects"];
	        this.ackPolicy = source["ackPolicy"];
	        this.ackWaitMs = source["ackWaitMs"];
	        this.maxDeliver = source["maxDeliver"];
	        this.numPending = source["numPending"];
	        this.numAckPending = source["numAckPending"];
	        this.numRedelivered = source["numRedelivered"];
	        this.delivered = source["delivered"];
	        this.ackFloor = source["ackFloor"];
	    }
	}
	export class CreateConsumerRequest {
	    stream: string;
	    name: string;
	    filterSubject: string;
	    filterSubjects: string[];
	    deliverPolicy: string;
	    ackPolicy: string;
	    ackWaitSec: number;
	    maxDeliver: number;
	    maxAckPending: number;
	
	    static createFrom(source: any = {}) {
	        return new CreateConsumerRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.stream = source["stream"];
	        this.name = source["name"];
	        this.filterSubject = source["filterSubject"];
	        this.filterSubjects = source["filterSubjects"];
	        this.deliverPolicy = source["deliverPolicy"];
	        this.ackPolicy = source["ackPolicy"];
	        this.ackWaitSec = source["ackWaitSec"];
	        this.maxDeliver = source["maxDeliver"];
	        this.maxAckPending = source["maxAckPending"];
	    }
	}
	export class CreateStreamRequest {
	    name: string;
	    subjects: string[];
	    storage: string;
	    retention: string;
	    maxMsgs: number;
	    maxBytes: number;
	    maxAgeSec: number;
	
	    static createFrom(source: any = {}) {
	        return new CreateStreamRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.subjects = source["subjects"];
	        this.storage = source["storage"];
	        this.retention = source["retention"];
	        this.maxMsgs = source["maxMsgs"];
	        this.maxBytes = source["maxBytes"];
	        this.maxAgeSec = source["maxAgeSec"];
	    }
	}
	export class MessageView {
	    id: string;
	    subject: string;
	    payload: string;
	    headers: Record<string, Array<string>>;
	    stream: string;
	    consumer: string;
	    streamSequence: number;
	    consumerSequence: number;
	    numDelivered: number;
	    numPending: number;
	    timestamp: string;
	    ackable: boolean;
	
	    static createFrom(source: any = {}) {
	        return new MessageView(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.subject = source["subject"];
	        this.payload = source["payload"];
	        this.headers = source["headers"];
	        this.stream = source["stream"];
	        this.consumer = source["consumer"];
	        this.streamSequence = source["streamSequence"];
	        this.consumerSequence = source["consumerSequence"];
	        this.numDelivered = source["numDelivered"];
	        this.numPending = source["numPending"];
	        this.timestamp = source["timestamp"];
	        this.ackable = source["ackable"];
	    }
	}
	export class PublishRequest {
	    subject: string;
	    payload: string;
	    headers: Record<string, Array<string>>;
	
	    static createFrom(source: any = {}) {
	        return new PublishRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.subject = source["subject"];
	        this.payload = source["payload"];
	        this.headers = source["headers"];
	    }
	}
	export class PublishResult {
	    stream: string;
	    sequence: number;
	    duplicate: boolean;
	
	    static createFrom(source: any = {}) {
	        return new PublishResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.stream = source["stream"];
	        this.sequence = source["sequence"];
	        this.duplicate = source["duplicate"];
	    }
	}
	export class StreamSummary {
	    name: string;
	    subjects: string[];
	    storage: string;
	    retention: string;
	    messages: number;
	    bytes: number;
	    consumers: number;
	    firstSeq: number;
	    lastSeq: number;
	
	    static createFrom(source: any = {}) {
	        return new StreamSummary(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.subjects = source["subjects"];
	        this.storage = source["storage"];
	        this.retention = source["retention"];
	        this.messages = source["messages"];
	        this.bytes = source["bytes"];
	        this.consumers = source["consumers"];
	        this.firstSeq = source["firstSeq"];
	        this.lastSeq = source["lastSeq"];
	    }
	}

}

