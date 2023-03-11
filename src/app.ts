// For more information about this file see https://dove.feathersjs.com/guides/cli/application.html
import { feathers } from '@feathersjs/feathers';
import configuration from '@feathersjs/configuration';
import { koa, rest, bodyParser, errorHandler, parseAuthentication, cors, serveStatic } from '@feathersjs/koa';
import socketio from '@feathersjs/socketio';

import { configurationValidator } from './configuration';
import type { Application } from './declarations';
import { logError } from './hooks/log-error';
import { sqlite } from './sqlite';
import { authentication } from './authentication';
import { services } from './services/index';
import { channels } from './channels';

let queue = new Map<string, { uid: number; socketId: string }>();
let rooms = new Map<string, string>();

const app: Application = koa(feathers());

// Load our app configuration (see config/ folder)
app.configure(configuration(configurationValidator));

// Set up Koa middleware
app.use(cors());
app.use(serveStatic(app.get('public')));
app.use(errorHandler());
app.use(parseAuthentication());
app.use(bodyParser());

// Configure services and transports
app.configure(rest());
app.configure(
  socketio(
    {
      cors: {
        origin: app.get('origins')
      }
    },
    (io) => {
      io.on('connection', (socket) => {
        socket.on('join', ({ uid, subject }) => {
          //check if already in queue

          const waitingSocket = queue.get(subject);
          if (waitingSocket) {
            const room = `${socket.id}-${waitingSocket.socketId}-${subject.trim()}`;
            socket.join(room);
            io.sockets.sockets.get(waitingSocket.socketId)?.join(room);
            queue.delete(subject);
            rooms.set(socket.id, room);
            rooms.set(waitingSocket.socketId, room);
            io.to(room).emit('joined', { room });
          } else {
            queue.set(subject, { uid, socketId: socket.id });
          }
        });

        socket.on('message', ({ message }) => {
          const room = rooms.get(socket.id);
          if (room) {
            socket.broadcast.to(room).emit('receive', { message });
          }
        });

        // remove from queue/room on disconnect
        socket.on('disconnect', () => {
          console.log('yay');
        });
      });
    }
  )
);
app.configure(channels);
app.configure(sqlite);
app.configure(authentication);
app.configure(services);

// Register hooks that run on all service methods
app.hooks({
  around: {
    all: [logError]
  },
  before: {},
  after: {},
  error: {}
});
// Register application setup and teardown hooks here
app.hooks({
  setup: [],
  teardown: []
});

export { app };
