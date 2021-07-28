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

import execa from 'execa';

export default class Pip {
  constructor(public gitPath = process.cwd(), private logger = console) {}

  async install(packageName: string, options: Partial<PipInstallOptions> = {}) {
    const { user } = {
      user: true,
      ...options
    };
    delete options.user;
    return this.run(
      ['install', ...(user ? ['--user'] : []), packageName],
      options
    );
  }

  async run(
    args: string | string[],
    options: Partial<PipRunOptions> = {}
  ): Promise<any> {
    const { cwd, pipe, dryrun } = {
      dryrun: false,
      pipe: false,
      cwd: process.cwd(),
      ...options
    };
    const argsArr = [...(Array.isArray(args) ? args : [args])];
    const command = `pip ${argsArr.join(' ')}`;
    if (dryrun) {
      this.logger.info(command);
      return command;
    }
    const p = execa('sh', ['-c', command], { stdio: 'pipe', cwd });
    if (pipe) p.stdout?.pipe(process.stdout);
    const { stdout } = await p;
    try {
      return JSON.parse(stdout);
    } catch (err) {
      return stdout;
    }
  }
}

export interface PipRunOptions {
  cwd?: string;
  dryrun?: boolean;
  pipe?: boolean;
}

export interface PipInstallOptions extends PipRunOptions {
  user?: boolean;
}
