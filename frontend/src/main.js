import './style.css'

import {
  Connect,
  Disconnect,
  GetConnectionStatus,
  ListStreams,
  CreateStream,
  DeleteStream,
  ListConsumers,
  CreateConsumer,
  DeleteConsumer,
  Publish,
  FetchMessages,
  BrowseMessages,
  AckMessage,
  NakMessage,
  NakMessageWithDelay,
  TermMessage,
  InProgressMessage,
} from '../wailsjs/go/main/App'

const state = {
  connected: false,
  selectedStream: '',
  selectedConsumer: '',
  streams: [],
  consumers: [],
  messages: [],
  mode: 'consume',
}

const app = document.querySelector('#app')

app.innerHTML = `
<div class="shell">

  <header class="topbar">
    <div>
      <h1>JetStream Workbench</h1>
      <div class="subtitle">
        Small local devtool for NATS JetStream
      </div>
    </div>

    <div
      id="connection-badge"
      class="badge offline"
    >
      Disconnected
    </div>
  </header>


  <section class="connection panel">

    <div class="row wrap">

      <label class="grow">
        NATS URL

        <input
          id="conn-url"
          value="nats://localhost:4223"
        />
      </label>


      <label>
        Username

        <input
          id="conn-user"
        />
      </label>


      <label>
        Password

        <input
          id="conn-pass"
          type="password"
        />
      </label>


      <label>
        Token

        <input
          id="conn-token"
          type="password"
        />
      </label>


      <label class="grow">
        Creds file (optional)

        <input
          id="conn-creds"
          placeholder="/path/to/user.creds"
        />
      </label>


      <label class="grow">
        NKey Seed

        <input
          id="conn-nkey"
          type="password"
          placeholder="SU..."
          autocomplete="off"
        />
      </label>


      <button
        id="connect"
        class="primary"
      >
        Connect
      </button>


      <button
        id="disconnect"
        class="secondary"
      >
        Disconnect
      </button>

    </div>

  </section>


  <main class="grid">

    <aside class="sidebar panel">

      <div class="section-title">

        <span>
          Streams
        </span>

        <button
          id="refresh-streams"
          class="icon"
        >
          ↻
        </button>

      </div>


      <div
        id="streams"
        class="list empty"
      >
        Connect to NATS
      </div>


      <button
        id="show-create-stream"
        class="full"
      >
        + Create stream
      </button>


      <div class="section-title spaced">

        <span>
          Consumers
        </span>

        <button
          id="refresh-consumers"
          class="icon"
        >
          ↻
        </button>

      </div>


      <div
        id="consumers"
        class="list empty"
      >
        Select a stream
      </div>


      <button
        id="show-create-consumer"
        class="full"
      >
        + Create consumer
      </button>

    </aside>


    <section class="content">

      <div class="tabs">

        <button
          data-tab="messages"
          class="tab active"
        >
          Messages
        </button>

        <button
          data-tab="publish"
          class="tab"
        >
          Publish
        </button>

        <button
          data-tab="admin"
          class="tab"
        >
          Admin
        </button>

      </div>


      <div
        id="tab-messages"
        class="panel tabbody"
      >

        <div class="toolbar">

          <div class="segmented">

            <button
              id="mode-consume"
              class="active"
            >
              Consume as consumer
            </button>

            <button
              id="mode-browse"
            >
              Browse stream
            </button>

          </div>


          <label>
            Count

            <input
              id="fetch-count"
              type="number"
              value="10"
              min="1"
              max="100"
            />
          </label>


          <label
            id="start-seq-label"
            class="hidden"
          >
            Start sequence

            <input
              id="start-seq"
              type="number"
              value="0"
              min="0"
            />
          </label>


          <button
            id="fetch"
            class="primary"
          >
            Fetch
          </button>

        </div>


        <div
          class="hint"
          id="messages-hint"
        >
          Select a stream and consumer,
          then fetch messages.
          Consumed messages stay pending
          until ACK / NAK / TERM.
        </div>


        <div
          id="messages"
          class="messages"
        ></div>

      </div>


      <div
        id="tab-publish"
        class="panel tabbody hidden"
      >

        <h2>
          Publish message
        </h2>


        <label>
          Subject

          <input
            id="pub-subject"
            value="events.application"
          />
        </label>


        <label>
          Headers (JSON object)

          <textarea
            id="pub-headers"
            rows="5"
            placeholder='{"Content-Type":["application/json"]}'
          ></textarea>
        </label>


        <label>
          Payload

          <textarea
            id="pub-payload"
            rows="16"
          >{
  "application_id": "11111111-1111-1111-1111-111111111111"
}</textarea>
        </label>


        <div class="row">

          <button
            id="publish"
            class="primary"
          >
            Publish
          </button>


          <span
            id="publish-result"
            class="hint"
          ></span>

        </div>

      </div>


      <div
        id="tab-admin"
        class="panel tabbody hidden"
      >

        <h2>
          Selected resources
        </h2>


        <div
          id="admin-details"
          class="details"
        >
          Select a stream or consumer.
        </div>


        <div class="danger-zone">

          <button
            id="delete-consumer"
            class="danger"
          >
            Delete selected consumer
          </button>


          <button
            id="delete-stream"
            class="danger"
          >
            Delete selected stream
          </button>

        </div>

      </div>

    </section>

  </main>

</div>


<div
  id="modal"
  class="modal hidden"
>

  <div class="modal-card">

    <div class="modal-head">

      <h2
        id="modal-title"
      ></h2>


      <button
        id="modal-close"
        class="icon"
      >
        ×
      </button>

    </div>


    <div
      id="modal-body"
    ></div>

  </div>

</div>


<div
  id="toast"
  class="toast hidden"
></div>
`

const $ = id =>
  document.getElementById(id)


const escapeHtml = (s = '') =>
  String(s).replace(
    /[&<>'"]/g,
    c =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;',
      })[c]
  )


function toast(message, error = false) {

  const el = $('toast')

  el.textContent = message

  el.className =
    `toast ${error ? 'error' : 'ok'}`

  setTimeout(() => {
    el.classList.add('hidden')
  }, 3500)
}


async function run(action) {

  try {
    return await action()
  } catch (e) {

    toast(
      String(e),
      true
    )

    throw e
  }
}


function renderConnection(status) {

  state.connected =
    !!status.connected

  const badge =
    $('connection-badge')

  badge.className =
    `badge ${
      status.connected
        ? 'online'
        : 'offline'
    }`

  badge.textContent =
    status.connected
      ? `Connected · ${status.url}`
      : 'Disconnected'
}


async function refreshStreams() {

  if (!state.connected) {
    return
  }

  state.streams =
    await run(() =>
      ListStreams()
    )

  const el =
    $('streams')

  if (!state.streams.length) {

    el.className =
      'list empty'

    el.textContent =
      'No streams'

    return
  }

  el.className =
    'list'

  el.innerHTML =
    state.streams
      .map(
        s => `
          <button
            class="list-item ${
              s.name === state.selectedStream
                ? 'selected'
                : ''
            }"
            data-stream="${escapeHtml(s.name)}"
          >

            <strong>
              ${escapeHtml(s.name)}
            </strong>

            <small>
              ${s.messages} msgs ·
              ${formatBytes(s.bytes)}
            </small>

          </button>
        `
      )
      .join('')

  el
    .querySelectorAll('[data-stream]')
    .forEach(btn => {

      btn.onclick = () =>
        selectStream(
          btn.dataset.stream
        )
    })
}


async function selectStream(name) {

  state.selectedStream =
    name

  state.selectedConsumer =
    ''

  state.messages =
    []

  renderMessages()

  await refreshStreams()
  await refreshConsumers()

  renderAdmin()
}


async function refreshConsumers() {

  const el =
    $('consumers')

  if (!state.selectedStream) {

    el.className =
      'list empty'

    el.textContent =
      'Select a stream'

    return
  }

  state.consumers =
    await run(() =>
      ListConsumers(
        state.selectedStream
      )
    )

  if (!state.consumers.length) {

    el.className =
      'list empty'

    el.textContent =
      'No consumers'

    return
  }

  el.className =
    'list'

  el.innerHTML =
    state.consumers
      .map(
        c => `
          <button
            class="list-item ${
              c.name === state.selectedConsumer
                ? 'selected'
                : ''
            }"
            data-consumer="${escapeHtml(c.name)}"
          >

            <strong>
              ${escapeHtml(c.name)}
            </strong>

            <small>
              ${c.numPending} pending ·
              ${c.numAckPending} ack pending
            </small>

          </button>
        `
      )
      .join('')

  el
    .querySelectorAll('[data-consumer]')
    .forEach(btn => {

      btn.onclick = () => {

        state.selectedConsumer =
          btn.dataset.consumer

        refreshConsumers()
        renderAdmin()
      }
    })
}


function renderAdmin() {

  const stream =
    state.streams.find(
      s =>
        s.name ===
        state.selectedStream
    )

  const consumer =
    state.consumers.find(
      c =>
        c.name ===
        state.selectedConsumer
    )

  if (!stream) {

    $('admin-details').textContent =
      'Select a stream or consumer.'

    return
  }

  $('admin-details').innerHTML = `

    <div class="detail-card">

      <h3>
        Stream ${escapeHtml(stream.name)}
      </h3>

      <dl>

        <dt>
          Subjects
        </dt>

        <dd>
          ${escapeHtml(
            stream.subjects.join(', ')
          )}
        </dd>


        <dt>
          Storage
        </dt>

        <dd>
          ${stream.storage}
        </dd>


        <dt>
          Retention
        </dt>

        <dd>
          ${stream.retention}
        </dd>


        <dt>
          Messages
        </dt>

        <dd>
          ${stream.messages}
        </dd>


        <dt>
          Sequence
        </dt>

        <dd>
          ${stream.firstSeq}
          →
          ${stream.lastSeq}
        </dd>

      </dl>

    </div>


    ${
      consumer
        ? `

          <div class="detail-card">

            <h3>
              Consumer
              ${escapeHtml(consumer.name)}
            </h3>

            <dl>

              <dt>
                Stream
              </dt>

              <dd>
                ${escapeHtml(consumer.stream)}
              </dd>


              <dt>
                Name / Durable
              </dt>

              <dd>
                ${escapeHtml(consumer.name)}
              </dd>


              <dt>
                Filters
              </dt>

              <dd>
                ${escapeHtml(
                  consumer.filterSubjects.join(', ')
                    ||
                  '(none)'
                )}
              </dd>


              <dt>
                Ack policy
              </dt>

              <dd>
                ${consumer.ackPolicy}
              </dd>


              <dt>
                Ack wait
              </dt>

              <dd>
                ${
                  consumer.ackWaitMs
                    ? `${consumer.ackWaitMs} ms`
                    : '-'
                }
              </dd>


              <dt>
                Max deliver
              </dt>

              <dd>
                ${consumer.maxDeliver}
              </dd>


              <dt>
                Pending
              </dt>

              <dd>
                ${consumer.numPending}
              </dd>


              <dt>
                Ack pending
              </dt>

              <dd>
                ${consumer.numAckPending}
              </dd>


              <dt>
                Redelivered
              </dt>

              <dd>
                ${consumer.numRedelivered}
              </dd>


              <dt>
                Delivered
              </dt>

              <dd>
                ${consumer.delivered}
              </dd>


              <dt>
                Ack floor
              </dt>

              <dd>
                ${consumer.ackFloor}
              </dd>

            </dl>

          </div>

        `
        : ''
    }
  `
}


function renderMessages() {

  const el =
    $('messages')

  if (!state.messages.length) {

    el.innerHTML =
      `
        <div class="empty-state">
          No fetched messages.
        </div>
      `

    return
  }

  el.innerHTML =
    state.messages
      .map(
        m => `

          <article
            class="message-card"
            data-id="${m.id || ''}"
          >

            <div class="message-head">

              <div>

                <strong>
                  ${escapeHtml(m.subject)}
                </strong>

                <small>

                  stream seq
                  ${m.streamSequence}

                  ${
                    m.consumerSequence
                      ? `
                        · consumer seq
                        ${m.consumerSequence}
                      `
                      : ''
                  }

                  ${
                    m.numDelivered
                      ? `
                        · delivery #
                        ${m.numDelivered}
                      `
                      : ''
                  }

                </small>

              </div>


              <time>

                ${
                  m.timestamp
                    ? new Date(
                        m.timestamp
                      ).toLocaleString()
                    : ''
                }

              </time>

            </div>


            ${
              m.headers &&
              Object.keys(m.headers).length
                ? `

                  <details>

                    <summary>
                      Headers
                    </summary>

                    <pre>${
                      escapeHtml(
                        JSON.stringify(
                          m.headers,
                          null,
                          2
                        )
                      )
                    }</pre>

                  </details>

                `
                : ''
            }


            <pre class="payload">${
              escapeHtml(
                prettyPayload(
                  m.payload
                )
              )
            }</pre>


            ${
              m.ackable
                ? `

                  <div class="actions">

                    <button
                      data-action="ack"
                      class="success"
                    >
                      ACK
                    </button>


                    <button
                      data-action="nak"
                    >
                      NAK
                    </button>


                    <button
                      data-action="delay"
                    >
                      NAK + 5s
                    </button>


                    <button
                      data-action="progress"
                    >
                      In progress
                    </button>


                    <button
                      data-action="term"
                      class="danger"
                    >
                      TERM
                    </button>

                  </div>

                `
                : ''
            }

          </article>

        `
      )
      .join('')

  el
    .querySelectorAll('[data-action]')
    .forEach(btn => {

      btn.onclick = () =>
        handleMessageAction(
          btn
            .closest('.message-card')
            .dataset.id,

          btn.dataset.action
        )
    })
}


async function handleMessageAction(
  id,
  action
) {

  if (action === 'ack') {

    await run(() =>
      AckMessage(id)
    )
  }


  if (action === 'nak') {

    await run(() =>
      NakMessage(id)
    )
  }


  if (action === 'delay') {

    await run(() =>
      NakMessageWithDelay(
        id,
        5000
      )
    )
  }


  if (action === 'term') {

    await run(() =>
      TermMessage(id)
    )
  }


  if (action === 'progress') {

    await run(() =>
      InProgressMessage(id)
    )

    toast(
      'Ack timer extended'
    )

    return
  }


  state.messages =
    state.messages.filter(
      m =>
        m.id !== id
    )

  renderMessages()

  await refreshConsumers()
  await refreshStreams()

  toast(
    action.toUpperCase() +
    ' sent'
  )
}


function prettyPayload(payload) {

  try {

    return JSON.stringify(
      JSON.parse(payload),
      null,
      2
    )

  } catch {

    return payload
  }
}


function formatBytes(n) {

  if (n < 1024) {
    return `${n} B`
  }

  if (n < 1024 * 1024) {

    return `${(
      n / 1024
    ).toFixed(1)} KB`
  }

  return `${(
    n /
    1024 /
    1024
  ).toFixed(1)} MB`
}


function openModal(
  title,
  body
) {

  $('modal-title').textContent =
    title

  $('modal-body').innerHTML =
    body

  $('modal').classList.remove(
    'hidden'
  )
}


function closeModal() {

  $('modal').classList.add(
    'hidden'
  )
}


$('modal-close').onclick =
  closeModal


$('modal').onclick = e => {

  if (e.target === $('modal')) {
    closeModal()
  }
}


$('connect').onclick = async () => {

  const status =
    await run(() =>
      Connect({

        url:
          $('conn-url').value,

        username:
          $('conn-user').value,

        password:
          $('conn-pass').value,

        token:
          $('conn-token').value,

        credsFile:
          $('conn-creds').value,

        nkeySeed:
          $('conn-nkey').value,
      })
    )

  renderConnection(status)

  await refreshStreams()

  toast('Connected')
}


$('disconnect').onclick =
  async () => {

    await Disconnect()

    renderConnection({
      connected: false,
    })

    state.streams = []
    state.consumers = []
    state.messages = []

    state.selectedStream = ''
    state.selectedConsumer = ''

    $('streams').textContent =
      'Connect to NATS'

    $('consumers').textContent =
      'Select a stream'

    renderMessages()
  }


$('refresh-streams').onclick =
  refreshStreams


$('refresh-consumers').onclick =
  refreshConsumers


$('show-create-stream').onclick =
  () => {

    openModal(
      'Create stream',
      `

        <label>
          Name

          <input
            id="cs-name"
            value="events"
          />
        </label>


        <label>
          Subjects
          (comma separated)

          <input
            id="cs-subjects"
            value="events.>"
          />
        </label>


        <div class="row">

          <label>
            Storage

            <select id="cs-storage">

              <option value="file">
                File
              </option>

              <option value="memory">
                Memory
              </option>

            </select>
          </label>


          <label>
            Retention

            <select id="cs-retention">

              <option value="limits">
                Limits
              </option>

              <option value="workqueue">
                Work queue
              </option>

              <option
                value="interest"
                selected
              >
                Interest
              </option>

            </select>
          </label>

        </div>


        <div class="row">

          <label>
            Max messages
            (-1 unlimited)

            <input
              id="cs-maxmsgs"
              type="number"
              value="-1"
            />
          </label>


          <label>
            Max bytes
            (-1 unlimited)

            <input
              id="cs-maxbytes"
              type="number"
              value="-1"
            />
          </label>


          <label>
            Max age seconds
            (0 unlimited)

            <input
              id="cs-maxage"
              type="number"
              value="0"
            />
          </label>

        </div>


        <button
          id="cs-submit"
          class="primary full"
        >
          Create
        </button>

      `
    )


    $('cs-submit').onclick =
      async () => {

        await run(() =>
          CreateStream({

            name:
              $('cs-name').value,

            subjects:
              $('cs-subjects')
                .value
                .split(',')
                .map(x =>
                  x.trim()
                )
                .filter(Boolean),

            storage:
              $('cs-storage').value,

            retention:
              $('cs-retention').value,

            maxMsgs:
              Number(
                $('cs-maxmsgs').value
              ),

            maxBytes:
              Number(
                $('cs-maxbytes').value
              ),

            maxAgeSec:
              Number(
                $('cs-maxage').value
              ),
          })
        )

        closeModal()

        await refreshStreams()

        toast(
          'Stream created'
        )
      }
  }


$('show-create-consumer').onclick =
  () => {

    if (!state.selectedStream) {

      return toast(
        'Select a stream first',
        true
      )
    }


    openModal(
      'Create consumer',
      `

        <div class="hint">

          Stream:

          <strong>
            ${escapeHtml(
              state.selectedStream
            )}
          </strong>

        </div>


        <label>
          Name / durable

          <input
            id="cc-name"
            value="transaction-srv"
          />
        </label>


        <label>
          Filter subjects
          (comma separated, optional)

          <input
            id="cc-filter"
            value="events.>"
          />
        </label>


        <div class="row">

          <label>
            Deliver policy

            <select id="cc-deliver">

              <option value="all">
                All
              </option>

              <option value="new">
                New
              </option>

              <option value="last">
                Last
              </option>

            </select>
          </label>


          <label>
            Ack policy

            <select id="cc-ackpolicy">

              <option
                value="explicit"
                selected
              >
                Explicit
              </option>

              <option value="all">
                All
              </option>

              <option value="none">
                None
              </option>

            </select>
          </label>


          <label>
            Ack wait seconds

            <input
              id="cc-ackwait"
              type="number"
              min="1"
              max="86400"
              value="30"
            />
          </label>


          <label>
            Max delivery
            (-1 unlimited)

            <input
              id="cc-maxdeliver"
              type="number"
              value="5"
            />
          </label>


          <label>
            Max ack pending

            <input
              id="cc-maxack"
              type="number"
              value="1000"
            />
          </label>

        </div>


        <button
          id="cc-submit"
          class="primary full"
        >
          Create
        </button>

      `
    )


    $('cc-submit').onclick =
      async () => {

        const filters =
          $('cc-filter')
            .value
            .split(',')
            .map(x =>
              x.trim()
            )
            .filter(Boolean)


        await run(() =>
          CreateConsumer({

            stream:
              state.selectedStream,

            name:
              $('cc-name').value,

            filterSubject:
              filters[0] || '',

            filterSubjects:
              filters,

            deliverPolicy:
              $('cc-deliver').value,

            ackPolicy:
              $('cc-ackpolicy').value,

            ackWaitSec:
              Number(
                $('cc-ackwait').value
              ),

            maxDeliver:
              Number(
                $('cc-maxdeliver').value
              ),

            maxAckPending:
              Number(
                $('cc-maxack').value
              ),
          })
        )

        closeModal()

        await refreshConsumers()

        toast(
          'Consumer created'
        )
      }
  }


$('delete-stream').onclick =
  async () => {

    if (!state.selectedStream) {

      return toast(
        'Select a stream',
        true
      )
    }


    if (
      !confirm(
        `Delete stream ${state.selectedStream}? This is destructive.`
      )
    ) {
      return
    }


    await run(() =>
      DeleteStream(
        state.selectedStream
      )
    )


    state.selectedStream =
      ''

    state.selectedConsumer =
      ''


    await refreshStreams()
    await refreshConsumers()

    renderAdmin()

    toast(
      'Stream deleted'
    )
  }


$('delete-consumer').onclick =
  async () => {

    if (
      !state.selectedStream ||
      !state.selectedConsumer
    ) {

      return toast(
        'Select a consumer',
        true
      )
    }


    if (
      !confirm(
        `Delete consumer ${state.selectedConsumer}?`
      )
    ) {
      return
    }


    await run(() =>
      DeleteConsumer(
        state.selectedStream,
        state.selectedConsumer
      )
    )


    state.selectedConsumer =
      ''


    await refreshConsumers()

    renderAdmin()

    toast(
      'Consumer deleted'
    )
  }


$('mode-consume').onclick =
  () => {

    state.mode =
      'consume'


    $('mode-consume')
      .classList
      .add('active')


    $('mode-browse')
      .classList
      .remove('active')


    $('start-seq-label')
      .classList
      .add('hidden')


    $('messages-hint').textContent =
      'Consume using the selected consumer. Fetched messages stay pending until ACK / NAK / TERM.'
  }


$('mode-browse').onclick =
  () => {

    state.mode =
      'browse'


    $('mode-browse')
      .classList
      .add('active')


    $('mode-consume')
      .classList
      .remove('active')


    $('start-seq-label')
      .classList
      .remove('hidden')


    $('messages-hint').textContent =
      'Browse raw stream messages without changing consumer state.'
  }


$('fetch').onclick =
  async () => {

    if (!state.selectedStream) {

      return toast(
        'Select a stream',
        true
      )
    }


    const count =
      Number(
        $('fetch-count').value
      )


    if (state.mode === 'consume') {

      if (!state.selectedConsumer) {

        return toast(
          'Select a consumer',
          true
        )
      }


      state.messages =
        await run(() =>
          FetchMessages(
            state.selectedStream,
            state.selectedConsumer,
            count
          )
        )


      await refreshConsumers()

    } else {

      state.messages =
        await run(() =>
          BrowseMessages(
            state.selectedStream,
            Number(
              $('start-seq').value
            ),
            count
          )
        )
    }


    renderMessages()
  }


$('publish').onclick =
  async () => {

    let headers = {}

    const raw =
      $('pub-headers')
        .value
        .trim()


    if (raw) {

      try {

        headers =
          JSON.parse(raw)

      } catch {

        return toast(
          'Headers must be valid JSON',
          true
        )
      }


      for (
        const [
          key,
          value,
        ] of Object.entries(headers)
      ) {

        headers[key] =
          Array.isArray(value)
            ? value.map(String)
            : [String(value)]
      }
    }


    const result =
      await run(() =>
        Publish({

          subject:
            $('pub-subject').value,

          payload:
            $('pub-payload').value,

          headers,
        })
      )


    $('publish-result').textContent =
      `Stored in ${result.stream} at seq ${result.sequence}`


    await refreshStreams()

    toast(
      'Message published'
    )
  }


document
  .querySelectorAll('.tab')
  .forEach(btn => {

    btn.onclick = () => {

      document
        .querySelectorAll('.tab')
        .forEach(x =>
          x.classList.remove(
            'active'
          )
        )


      btn.classList.add(
        'active'
      )


      document
        .querySelectorAll('.tabbody')
        .forEach(x =>
          x.classList.add(
            'hidden'
          )
        )


      $(
        `tab-${btn.dataset.tab}`
      ).classList.remove(
        'hidden'
      )


      if (
        btn.dataset.tab ===
        'admin'
      ) {

        renderAdmin()
      }
    }
  })


;(async () => {

  try {

    const status =
      await GetConnectionStatus()

    renderConnection(status)


    if (status.connected) {

      await refreshStreams()
    }

  } catch {}


  renderMessages()

})()