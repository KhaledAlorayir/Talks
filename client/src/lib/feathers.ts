import { createClient } from '../../../src/client';
import socketio from '@feathersjs/socketio-client';
import io from 'socket.io-client';

const socket = io('http://localhost:3030');

export const client = createClient(socketio(socket));
