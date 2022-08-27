import { Meteor } from 'meteor/meteor'
import { WebAppInternals } from 'meteor/webapp'
import { fork } from 'node:child_process'

if (Meteor.isDevelopment) {
  const viteSetup = {
    host: 'localhost',
    port: 0,
    entryFile: '',
  }

  WebAppInternals.registerBoilerplateDataCallback('meteor-vite', (request, data, arch) => {
    const { host, port, entryFile } = viteSetup
    if (entryFile) {
      data.dynamicBody = `${data.dynamicBody || ""}\n<script type="module" src="http://${host}:${port}/${entryFile}"></script>\n`
    } else {
      // Vite not ready yet
      // Refresh page after some time
      data.dynamicBody = `${data.dynamicBody || ""}\n<script>setTimeout(() => location.reload(), 500)</script>\n`
    }
  })

  // Use a worker to skip reify and Fibers
  // Use a child process instead of worker to avoid WASM/archived threads error
  const child = fork(Assets.absoluteFilePath('worker.mjs'), {
    stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
    cwd: process.env.PWD,
    detached: false,
  })
  child.on('message', ({ kind, data }) => {
    switch (kind) {
      case 'viteSetup':
        Object.assign(viteSetup, data)
        if (!viteSetup.entryFile) {
          console.error('[meteor-vite] Missing `meteor.clientEntry` with path to entry file in your vite config.')
          // @TODO handle auto-restart of vite server
          viteSetup.entryFile = 'imports/ui/main.js'
          console.warn('Please add `meteor.clientEntry` into your vite config and restart meteor.')
        }
      break
      default:
        console.log(kind, data)
    }
  })
  child.send('start')
  ;['exit', 'SIGINT', 'SIGHUP', 'SIGTERM'].forEach(event => {
    process.once(event, () => {
      child.kill()
    })
  })
}
