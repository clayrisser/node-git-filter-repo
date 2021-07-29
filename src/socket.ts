/**
 * Copyright 2021 Silicon Hills LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import path from 'path';
import { createServer, Socket as NetSocket, Server } from 'net';
import { v4 as uuidv4 } from 'uuid';
import os from 'os';
import { HashMap } from './types';

const tmpPath = os.tmpdir();

export default class Socket {
  path: string;

  server?: Server;

  chunks: HashMap<string[]> = {};

  constructor(
    public name = 'captain_hook',
    protected commands: HashMap<(...args: any[]) => any> = {}
  ) {
    this.path = path.resolve(tmpPath, `${this.name}.sock`);
  }

  async handleCommand(commandName: string, data: any) {
    const command = this.commands[commandName];
    let result = command;
    if (typeof command === 'function') {
      result = await command(...(Array.isArray(data) ? data : [data]));
    }
    if (typeof result === 'undefined') return null;
    return result;
  }

  async handleData(chunk: string, client: Client) {
    let chunks = this.chunks[client.id];
    if (!chunks) {
      chunks = [];
      this.chunks[client.id] = chunks;
    }
    if (chunk.match(/\r\n$/)) {
      chunks.push(chunk.slice(0, chunk.length - 2));
      const data = this.parseChunks<HashMap>(chunks);
      if (typeof data === 'string') {
        const err = new Error(`'${data}' is invalid`);
        client.write(
          `${JSON.stringify({ err: { message: err.message } })}\r\n`
        );
        throw err;
      }
      let results = (
        await Promise.all(
          Object.entries(data).map<Promise<[string, any]>>(
            async ([command, data]: [string, any]) => {
              return [command, await this.handleCommand(command, data)];
            }
          )
        )
      ).reduce((result: HashMap, [command, data]: [string, any]) => {
        result[command] = data;
        return result;
      }, {});
      const resultsKeys = Object.keys(results);
      if (resultsKeys.length === 1) results = results[resultsKeys[0]];
      client.write(`${JSON.stringify(results)}\r\n`);
    } else {
      chunks.push(chunk);
    }
  }

  parseChunks<T = any>(chunks: string | string[]): T {
    const data = Array.isArray(chunks) ? chunks.join('') : chunks.toString();
    try {
      return JSON.parse(data);
    } catch (err) {
      return data as unknown as T;
    }
  }

  handleCleanup() {
    this.close();
  }

  async connect() {
    process.on('exit', this.handleCleanup.bind(this));
    process.on('SIGINT', this.handleCleanup.bind(this));
    process.on('SIGUSR1', this.handleCleanup.bind(this));
    process.on('SIGUSR2', this.handleCleanup.bind(this));
    process.on('uncaughtException', this.handleCleanup.bind(this));
    this.server = await new Promise<Server>((resolve, reject) => {
      try {
        const server = createServer((socket: NetSocket) => {
          const client = socket as Client;
          client.id = uuidv4();
          client.setEncoding('utf8');
          client.on('data', (chunk: string) => this.handleData(chunk, client));
        });
        server.on('listening', () => resolve(server));
        server.listen(this.path);
      } catch (err) {
        reject(err);
      }
    });
  }

  async close() {
    if (!this.server) return;
    await new Promise((resolve, reject) => {
      if (!this.server) return resolve(null);
      try {
        process.removeListener('exit', this.handleCleanup.bind(this));
        process.removeListener('SIGINT', this.handleCleanup.bind(this));
        process.removeListener('SIGUSR1', this.handleCleanup.bind(this));
        process.removeListener('SIGUSR2', this.handleCleanup.bind(this));
        process.removeListener(
          'uncaughtException',
          this.handleCleanup.bind(this)
        );
        return this.server.close(() => resolve(null));
      } catch (err) {
        return reject(err);
      }
    });
  }
}

export interface Client extends NetSocket {
  id: string;
}
