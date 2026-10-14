package main

type ConnectionRequest struct {
	URL       string `json:"url"`
	Username  string `json:"username"`
	Password  string `json:"password"`
	Token     string `json:"token"`
	CredsFile string `json:"credsFile"`
	NKeySeed  string `json:"nkeySeed"`
}

type ConnectionStatus struct {
	Connected bool   `json:"connected"`
	URL       string `json:"url"`
	ServerID  string `json:"serverId"`
	Server    string `json:"server"`
}

type StreamSummary struct {
	Name      string   `json:"name"`
	Subjects  []string `json:"subjects"`
	Storage   string   `json:"storage"`
	Retention string   `json:"retention"`
	Messages  uint64   `json:"messages"`
	Bytes     uint64   `json:"bytes"`
	Consumers int      `json:"consumers"`
	FirstSeq  uint64   `json:"firstSeq"`
	LastSeq   uint64   `json:"lastSeq"`
}

type CreateStreamRequest struct {
	Name      string   `json:"name"`
	Subjects  []string `json:"subjects"`
	Storage   string   `json:"storage"`
	Retention string   `json:"retention"`
	MaxMsgs   int64    `json:"maxMsgs"`
	MaxBytes  int64    `json:"maxBytes"`
	MaxAgeSec int64    `json:"maxAgeSec"`
}

type ConsumerSummary struct {
	Stream         string   `json:"stream"`
	Name           string   `json:"name"`
	FilterSubjects []string `json:"filterSubjects"`
	AckPolicy      string   `json:"ackPolicy"`
	AckWaitMs      int64    `json:"ackWaitMs"`
	MaxDeliver     int      `json:"maxDeliver"`
	NumPending     uint64   `json:"numPending"`
	NumAckPending  int      `json:"numAckPending"`
	NumRedelivered int      `json:"numRedelivered"`
	Delivered      uint64   `json:"delivered"`
	AckFloor       uint64   `json:"ackFloor"`
}

type CreateConsumerRequest struct {
	Stream         string   `json:"stream"`
	Name           string   `json:"name"`
	FilterSubject  string   `json:"filterSubject"`
	FilterSubjects []string `json:"filterSubjects"`
	DeliverPolicy  string   `json:"deliverPolicy"`
	AckPolicy      string   `json:"ackPolicy"`
	AckWaitSec     int64    `json:"ackWaitSec"`
	MaxDeliver     int      `json:"maxDeliver"`
	MaxAckPending  int      `json:"maxAckPending"`
}

type PublishRequest struct {
	Subject string              `json:"subject"`
	Payload string              `json:"payload"`
	Headers map[string][]string `json:"headers"`
}

type PublishResult struct {
	Stream    string `json:"stream"`
	Sequence  uint64 `json:"sequence"`
	Duplicate bool   `json:"duplicate"`
}

type MessageView struct {
	ID             string              `json:"id"`
	Subject        string              `json:"subject"`
	Payload        string              `json:"payload"`
	Headers        map[string][]string `json:"headers"`
	Stream         string              `json:"stream"`
	Consumer       string              `json:"consumer"`
	StreamSequence uint64              `json:"streamSequence"`
	ConsumerSeq    uint64              `json:"consumerSequence"`
	NumDelivered   uint64              `json:"numDelivered"`
	NumPending     uint64              `json:"numPending"`
	Timestamp      string              `json:"timestamp"`
	Ackable        bool                `json:"ackable"`
}
