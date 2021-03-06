'use strict'

const yargs = require('yargs')

const processReporter = require('./reporters/human/process')
const errorReporter = require('./reporters/human/error')
const BaseServer = require('./base-server')

yargs
  .option('h', {
    alias: 'host',
    describe: 'Host to bind server.',
    type: 'string'
  })
  .option('p', {
    alias: 'port',
    describe: 'Port to bind server',
    type: 'number'
  })
  .option('k', {
    alias: 'key',
    describe: 'Path to SSL key ',
    type: 'string'
  })
  .option('c', {
    alias: 'cert',
    describe: 'Path to SSL certificate',
    type: 'string'
  })
  .epilog(
    'Corresponding ENV variables: LOGUX_HOST, LOGUX_PORT, LOGUX_KEY, LOGUX_CERT'
  )
  .example('$0 --port 31337 --host 127.0.0.1')
  .example('LOGUX_PORT=1337 $0')
  .locale('en')
  .help()

/**
 * End-user API to create Logux server.
 *
 * @param {object} options Server options.
 * @param {string} options.subprotocol Server current application
 *                                     subprotocol version in SemVer format.
 * @param {string} options.supports npm’s version requirements for client
 *                                  subprotocol version.
 * @param {string|number} [options.nodeId] Unique server ID. Be default,
 *                                         `server:` with compacted UUID.
 * @param {string} [options.root=process.cwd()] Application root to load files
 *                                              and show errors.
 * @param {number} [options.timeout=20000] Timeout in milliseconds
 *                                         to disconnect connection.
 * @param {number} [options.ping=10000] Milliseconds since last message to test
 *                                      connection by sending ping.
 * @param {function} [options.timer] Timer to use in log. Will be default
 *                                   timer with server `nodeId`, by default.
 * @param {Store} [options.store] Store to save log. Will be `MemoryStore`,
 *                                by default.
 * @param {"production"|"development"} [options.env] Development or production
 *                                                   server mode. By default,
 *                                                   it will be taken from
 *                                                   `NODE_ENV` environment
 *                                                   variable. On empty
 *                                                   `NODE_ENV` it will
 *                                                   be `"development"`.
 *
 * @example
 * import { Server } from 'logux-server'
 * const app = new Server({
 *   subprotocol: '1.0.0',
 *   supports: '1.x || 0.x',
 *   root: __dirname
 * })
 * if (app.env === 'production') {
 *   app.listen({ cert: 'cert.pem', key: 'key.pem' })
 * } else {
 *   app.listen()
 * }
 *
 * @extends BaseServer
 */
class Server extends BaseServer {
  constructor (options) {
    options.pid = process.pid

    super(options, function () {
      process.stderr.write(processReporter.apply(null, arguments))
    })

    const onError = e => {
      this.emitter.emit('error', e)
      this.destroy().then(() => {
        process.exit(1)
      })
    }
    process.on('uncaughtException', onError)
    process.on('unhandledRejection', onError)

    const onExit = () => {
      this.destroy().then(() => {
        process.exit(0)
      })
    }
    process.on('SIGINT', onExit)

    this.unbind.push(() => {
      process.removeListener('SIGINT', onExit)
    })
  }

  listen () {
    const origin = BaseServer.prototype.listen
    return origin.apply(this, arguments).catch(e => {
      process.stderr.write(errorReporter(e, this))
      process.exit(1)
    })
  }

  /**
   * Load options from command-line arguments and/or environment
   *
   * @param {object} process Current process object.
   * @param {object} defaults Default options.
   * @return {object} Parsed options object.
   *
   * @example
   * app.listen(app.loadOptions(process, { port: 31337 }))
   */
  loadOptions (process, defaults) {
    defaults = defaults || { }

    const argv = yargs.parse(process.argv)
    const env = process.env

    return {
      host: argv.h || env.LOGUX_HOST || defaults.host,
      port: parseInt(argv.p || env.LOGUX_PORT || defaults.port, 10),
      cert: argv.c || env.LOGUX_CERT || defaults.cert,
      key: argv.k || env.LOGUX_KEY || defaults.key
    }
  }
}

module.exports = Server
