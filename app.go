package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/nats-io/nats.go"
	"github.com/nats-io/nats.go/jetstream"
	"github.com/nats-io/nkeys"
)

type App struct {
	ctx context.Context

	mu      sync.RWMutex
	nc      *nats.Conn
	js      jetstream.JetStream
	pending map[string]jetstream.Msg
}

func NewApp() *App {
	return &App{pending: make(map[string]jetstream.Msg)}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

func (a *App) shutdown(_ context.Context) {
	a.Disconnect()
}

func (a *App) Connect(req ConnectionRequest) (ConnectionStatus, error) {
	url := strings.TrimSpace(req.URL)
	if url == "" {
		url = nats.DefaultURL
	}

	opts := []nats.Option{
		nats.Name("JetStream Workbench"),
		nats.Timeout(5 * time.Second),
		nats.MaxReconnects(-1),
		nats.ReconnectWait(time.Second),
	}

	if strings.TrimSpace(req.CredsFile) != "" {
		opts = append(opts, nats.UserCredentials(strings.TrimSpace(req.CredsFile)))
	} else if strings.TrimSpace(req.NKeySeed) != "" {
		seed := []byte(strings.TrimSpace(req.NKeySeed))

		kp, err := nkeys.FromSeed(seed)
		if err != nil {
			return ConnectionStatus{}, fmt.Errorf("invalid NKey seed: %w", err)
		}

		pub, err := kp.PublicKey()
		if err != nil {
			return ConnectionStatus{}, fmt.Errorf("cannot derive public NKey: %w", err)
		}

		opts = append(opts, nats.Nkey(pub, func(nonce []byte) ([]byte, error) {
			return kp.Sign(nonce)
		}))
	} else if strings.TrimSpace(req.Token) != "" {
		opts = append(opts, nats.Token(strings.TrimSpace(req.Token)))
	} else if strings.TrimSpace(req.Username) != "" {
		opts = append(opts, nats.UserInfo(strings.TrimSpace(req.Username), req.Password))
	}

	nc, err := nats.Connect(url, opts...)
	if err != nil {
		return ConnectionStatus{}, err
	}

	js, err := jetstream.New(nc)
	if err != nil {
		nc.Close()
		return ConnectionStatus{}, err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if _, err := js.AccountInfo(ctx); err != nil {
		nc.Close()
		return ConnectionStatus{}, fmt.Errorf("JetStream is unavailable: %w", err)
	}

	a.mu.Lock()
	if a.nc != nil {
		a.nc.Close()
	}
	a.nc = nc
	a.js = js
	a.pending = make(map[string]jetstream.Msg)
	a.mu.Unlock()

	return a.connectionStatus(), nil
}

func (a *App) Disconnect() {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.nc != nil {
		a.nc.Close()
	}
	a.nc = nil
	a.js = nil
	a.pending = make(map[string]jetstream.Msg)
}

func (a *App) GetConnectionStatus() ConnectionStatus {
	return a.connectionStatus()
}

func (a *App) connectionStatus() ConnectionStatus {
	a.mu.RLock()
	defer a.mu.RUnlock()
	if a.nc == nil || !a.nc.IsConnected() {
		return ConnectionStatus{}
	}
	return ConnectionStatus{
		Connected: true,
		URL:       a.nc.ConnectedUrl(),
		ServerID:  a.nc.ConnectedServerId(),
		Server:    a.nc.ConnectedServerName(),
	}
}

func (a *App) requireJS() (jetstream.JetStream, error) {
	a.mu.RLock()
	defer a.mu.RUnlock()
	if a.js == nil || a.nc == nil || !a.nc.IsConnected() {
		return nil, errors.New("not connected to NATS")
	}
	return a.js, nil
}

func opContext() (context.Context, context.CancelFunc) {
	return context.WithTimeout(context.Background(), 10*time.Second)
}

func (a *App) ListStreams() ([]StreamSummary, error) {
	js, err := a.requireJS()
	if err != nil {
		return nil, err
	}
	ctx, cancel := opContext()
	defer cancel()

	result := make([]StreamSummary, 0)
	lister := js.ListStreams(ctx)
	for info := range lister.Info() {
		result = append(result, streamSummary(info))
	}
	if err := lister.Err(); err != nil {
		return nil, err
	}
	return result, nil
}

func (a *App) GetStream(name string) (StreamSummary, error) {
	js, err := a.requireJS()
	if err != nil {
		return StreamSummary{}, err
	}
	ctx, cancel := opContext()
	defer cancel()
	stream, err := js.Stream(ctx, name)
	if err != nil {
		return StreamSummary{}, err
	}
	info, err := stream.Info(ctx)
	if err != nil {
		return StreamSummary{}, err
	}
	return streamSummary(info), nil
}

func streamSummary(info *jetstream.StreamInfo) StreamSummary {
	return StreamSummary{
		Name:      info.Config.Name,
		Subjects:  info.Config.Subjects,
		Storage:   info.Config.Storage.String(),
		Retention: info.Config.Retention.String(),
		Messages:  info.State.Msgs,
		Bytes:     info.State.Bytes,
		Consumers: info.State.Consumers,
		FirstSeq:  info.State.FirstSeq,
		LastSeq:   info.State.LastSeq,
	}
}

func (a *App) CreateStream(req CreateStreamRequest) (StreamSummary, error) {
	js, err := a.requireJS()
	if err != nil {
		return StreamSummary{}, err
	}
	if strings.TrimSpace(req.Name) == "" {
		return StreamSummary{}, errors.New("stream name is required")
	}
	if len(req.Subjects) == 0 {
		return StreamSummary{}, errors.New("at least one subject is required")
	}

	storage := jetstream.FileStorage
	if strings.EqualFold(req.Storage, "memory") {
		storage = jetstream.MemoryStorage
	}

	retention := jetstream.LimitsPolicy
	switch strings.ToLower(req.Retention) {
	case "workqueue", "work_queue":
		retention = jetstream.WorkQueuePolicy
	case "interest":
		retention = jetstream.InterestPolicy
	}

	cfg := jetstream.StreamConfig{
		Name:      strings.TrimSpace(req.Name),
		Subjects:  cleanStrings(req.Subjects),
		Storage:   storage,
		Retention: retention,
		MaxMsgs:   req.MaxMsgs,
		MaxBytes:  req.MaxBytes,
	}
	if req.MaxAgeSec > 0 {
		cfg.MaxAge = time.Duration(req.MaxAgeSec) * time.Second
	}

	ctx, cancel := opContext()
	defer cancel()
	stream, err := js.CreateStream(ctx, cfg)
	if err != nil {
		return StreamSummary{}, err
	}
	info, err := stream.Info(ctx)
	if err != nil {
		return StreamSummary{}, err
	}
	return streamSummary(info), nil
}

func (a *App) DeleteStream(name string) error {
	js, err := a.requireJS()
	if err != nil {
		return err
	}
	ctx, cancel := opContext()
	defer cancel()
	return js.DeleteStream(ctx, name)
}

func (a *App) ListConsumers(streamName string) ([]ConsumerSummary, error) {
	js, err := a.requireJS()
	if err != nil {
		return nil, err
	}
	ctx, cancel := opContext()
	defer cancel()
	stream, err := js.Stream(ctx, streamName)
	if err != nil {
		return nil, err
	}

	result := make([]ConsumerSummary, 0)
	lister := stream.ListConsumers(ctx)
	for info := range lister.Info() {
		result = append(result, consumerSummary(info))
	}
	if err := lister.Err(); err != nil {
		return nil, err
	}
	return result, nil
}

func (a *App) GetConsumer(streamName, consumerName string) (ConsumerSummary, error) {
	js, err := a.requireJS()
	if err != nil {
		return ConsumerSummary{}, err
	}
	ctx, cancel := opContext()
	defer cancel()
	consumer, err := js.Consumer(ctx, streamName, consumerName)
	if err != nil {
		return ConsumerSummary{}, err
	}
	info, err := consumer.Info(ctx)
	if err != nil {
		return ConsumerSummary{}, err
	}
	return consumerSummary(info), nil
}

func consumerSummary(info *jetstream.ConsumerInfo) ConsumerSummary {
	filters := info.Config.FilterSubjects
	if len(filters) == 0 && info.Config.FilterSubject != "" {
		filters = []string{info.Config.FilterSubject}
	}
	return ConsumerSummary{
		Stream:         info.Stream,
		Name:           info.Name,
		FilterSubjects: filters,
		AckPolicy:      info.Config.AckPolicy.String(),
		AckWaitMs:      info.Config.AckWait.Milliseconds(),
		MaxDeliver:     info.Config.MaxDeliver,
		NumPending:     info.NumPending,
		NumAckPending:  info.NumAckPending,
		NumRedelivered: info.NumRedelivered,
		Delivered:      info.Delivered.Stream,
		AckFloor:       info.AckFloor.Stream,
	}
}

func (a *App) CreateConsumer(req CreateConsumerRequest) (ConsumerSummary, error) {
	js, err := a.requireJS()
	if err != nil {
		return ConsumerSummary{}, err
	}
	if strings.TrimSpace(req.Stream) == "" || strings.TrimSpace(req.Name) == "" {
		return ConsumerSummary{}, errors.New("stream and consumer name are required")
	}

	cfg := jetstream.ConsumerConfig{
		Name:          strings.TrimSpace(req.Name),
		Durable:       strings.TrimSpace(req.Name),
		MaxDeliver:    req.MaxDeliver,
		MaxAckPending: req.MaxAckPending,
	}

	switch strings.ToLower(strings.TrimSpace(req.AckPolicy)) {
	case "", "explicit":
		cfg.AckPolicy = jetstream.AckExplicitPolicy
	case "all":
		cfg.AckPolicy = jetstream.AckAllPolicy
	case "none":
		cfg.AckPolicy = jetstream.AckNonePolicy
	default:
		return ConsumerSummary{}, fmt.Errorf("unsupported ack policy: %s", req.AckPolicy)
	}

	if cfg.AckPolicy != jetstream.AckNonePolicy {
		ackWaitSec := req.AckWaitSec
		if ackWaitSec <= 0 {
			ackWaitSec = 30
		}
		cfg.AckWait = time.Duration(ackWaitSec) * time.Second
	}

	filters := cleanStrings(req.FilterSubjects)
	if len(filters) > 1 {
		cfg.FilterSubjects = filters
	} else if len(filters) == 1 {
		cfg.FilterSubject = filters[0]
	} else if strings.TrimSpace(req.FilterSubject) != "" {
		cfg.FilterSubject = strings.TrimSpace(req.FilterSubject)
	}

	switch strings.ToLower(req.DeliverPolicy) {
	case "new":
		cfg.DeliverPolicy = jetstream.DeliverNewPolicy
	case "last":
		cfg.DeliverPolicy = jetstream.DeliverLastPolicy
	default:
		cfg.DeliverPolicy = jetstream.DeliverAllPolicy
	}

	ctx, cancel := opContext()
	defer cancel()
	consumer, err := js.CreateConsumer(ctx, req.Stream, cfg)
	if err != nil {
		return ConsumerSummary{}, err
	}
	info, err := consumer.Info(ctx)
	if err != nil {
		return ConsumerSummary{}, err
	}
	return consumerSummary(info), nil
}

func (a *App) DeleteConsumer(streamName, consumerName string) error {
	js, err := a.requireJS()
	if err != nil {
		return err
	}
	ctx, cancel := opContext()
	defer cancel()
	return js.DeleteConsumer(ctx, streamName, consumerName)
}

func (a *App) Publish(req PublishRequest) (PublishResult, error) {
	js, err := a.requireJS()
	if err != nil {
		return PublishResult{}, err
	}
	if strings.TrimSpace(req.Subject) == "" {
		return PublishResult{}, errors.New("subject is required")
	}

	msg := &nats.Msg{Subject: strings.TrimSpace(req.Subject), Data: []byte(req.Payload)}
	if len(req.Headers) > 0 {
		msg.Header = nats.Header{}
		for key, values := range req.Headers {
			for _, value := range values {
				msg.Header.Add(key, value)
			}
		}
	}

	ctx, cancel := opContext()
	defer cancel()
	ack, err := js.PublishMsg(ctx, msg)
	if err != nil {
		return PublishResult{}, err
	}
	return PublishResult{Stream: ack.Stream, Sequence: ack.Sequence, Duplicate: ack.Duplicate}, nil
}

func (a *App) FetchMessages(streamName, consumerName string, count int) ([]MessageView, error) {
	js, err := a.requireJS()
	if err != nil {
		return nil, err
	}
	if count < 1 {
		count = 1
	}
	if count > 100 {
		count = 100
	}

	ctx, cancel := opContext()
	defer cancel()
	consumer, err := js.Consumer(ctx, streamName, consumerName)
	if err != nil {
		return nil, err
	}
	batch, err := consumer.FetchNoWait(count)
	if err != nil {
		return nil, err
	}

	result := make([]MessageView, 0, count)
	for msg := range batch.Messages() {
		view, err := a.messageToView(msg, true)
		if err != nil {
			return nil, err
		}
		result = append(result, view)
	}
	if err := batch.Error(); err != nil {
		return nil, err
	}
	return result, nil
}

func (a *App) BrowseMessages(streamName string, startSeq uint64, count int) ([]MessageView, error) {
	js, err := a.requireJS()
	if err != nil {
		return nil, err
	}
	if count < 1 {
		count = 20
	}
	if count > 200 {
		count = 200
	}

	ctx, cancel := opContext()
	defer cancel()
	stream, err := js.Stream(ctx, streamName)
	if err != nil {
		return nil, err
	}
	info, err := stream.Info(ctx)
	if err != nil {
		return nil, err
	}
	if info.State.Msgs == 0 {
		return []MessageView{}, nil
	}
	if startSeq == 0 {
		startSeq = info.State.FirstSeq
	}

	result := make([]MessageView, 0, count)
	for seq := startSeq; seq <= info.State.LastSeq && len(result) < count; seq++ {
		raw, err := stream.GetMsg(ctx, seq)
		if err != nil {
			// Streams may contain sequence gaps after deletes/retention.
			continue
		}
		result = append(result, MessageView{
			Subject:        raw.Subject,
			Payload:        string(raw.Data),
			Headers:        headerToMap(raw.Header),
			Stream:         streamName,
			StreamSequence: raw.Sequence,
			Timestamp:      raw.Time.Format(time.RFC3339Nano),
			Ackable:        false,
		})
	}
	return result, nil
}

func (a *App) AckMessage(id string) error {
	return a.finalizeMessage(id, func(msg jetstream.Msg) error { return msg.Ack() })
}

func (a *App) NakMessage(id string) error {
	return a.finalizeMessage(id, func(msg jetstream.Msg) error { return msg.Nak() })
}

func (a *App) TermMessage(id string) error {
	return a.finalizeMessage(id, func(msg jetstream.Msg) error { return msg.Term() })
}

func (a *App) NakMessageWithDelay(id string, delayMs int64) error {
	if delayMs < 0 {
		delayMs = 0
	}
	return a.finalizeMessage(id, func(msg jetstream.Msg) error {
		return msg.NakWithDelay(time.Duration(delayMs) * time.Millisecond)
	})
}

func (a *App) InProgressMessage(id string) error {
	a.mu.RLock()
	msg, ok := a.pending[id]
	a.mu.RUnlock()
	if !ok {
		return errors.New("message is no longer pending in this Workbench session")
	}
	return msg.InProgress()
}

func (a *App) finalizeMessage(id string, action func(jetstream.Msg) error) error {
	a.mu.RLock()
	msg, ok := a.pending[id]
	a.mu.RUnlock()
	if !ok {
		return errors.New("message is no longer pending in this Workbench session")
	}
	if err := action(msg); err != nil {
		return err
	}
	a.mu.Lock()
	delete(a.pending, id)
	a.mu.Unlock()
	return nil
}

func (a *App) messageToView(msg jetstream.Msg, ackable bool) (MessageView, error) {
	meta, err := msg.Metadata()
	if err != nil {
		return MessageView{}, err
	}
	id := ""
	if ackable {
		id, err = randomID()
		if err != nil {
			return MessageView{}, err
		}
		a.mu.Lock()
		a.pending[id] = msg
		a.mu.Unlock()
	}
	return MessageView{
		ID:             id,
		Subject:        msg.Subject(),
		Payload:        string(msg.Data()),
		Headers:        headerToMap(msg.Headers()),
		Stream:         meta.Stream,
		Consumer:       meta.Consumer,
		StreamSequence: meta.Sequence.Stream,
		ConsumerSeq:    meta.Sequence.Consumer,
		NumDelivered:   meta.NumDelivered,
		NumPending:     meta.NumPending,
		Timestamp:      meta.Timestamp.Format(time.RFC3339Nano),
		Ackable:        ackable,
	}, nil
}

func randomID() (string, error) {
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return hex.EncodeToString(buf), nil
}

func headerToMap(h nats.Header) map[string][]string {
	if len(h) == 0 {
		return nil
	}
	out := make(map[string][]string, len(h))
	for k, v := range h {
		out[k] = append([]string(nil), v...)
	}
	return out
}

func cleanStrings(in []string) []string {
	out := make([]string, 0, len(in))
	for _, value := range in {
		value = strings.TrimSpace(value)
		if value != "" {
			out = append(out, value)
		}
	}
	return out
}
