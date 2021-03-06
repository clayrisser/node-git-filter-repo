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
import path from 'path';

export default class Git {
  constructor(public gitPath = process.cwd(), private logger = console) {}

  async filterRepo(
    options: Partial<GitFilterRepoOptions> = {},
    args: string | string[] = []
  ) {
    const {
      blobCallback,
      commitCallback,
      debug,
      dryRun,
      emailCallback,
      filenameCallback,
      force,
      help,
      importScripts,
      invertPaths,
      messageCallback,
      nameCallback,
      partial,
      paths,
      pathsGlob,
      pathsRegex,
      refnameCallback,
      refs,
      resetCallback,
      tagCallback
    } = {
      help: false,
      force: false,
      ...options
    };
    delete options.help;
    const argsArr = [
      ...(Array.isArray(args) ? args : [args]),
      ...(debug ? ['--debug'] : []),
      ...(dryRun ? ['--dry-run'] : []),
      ...(invertPaths ? ['--invert-paths'] : []),
      ...(partial ? ['--partial'] : []),
      ...(paths || []).map((path: string) => ['--path', path]).flat(),
      ...(pathsRegex || [])
        .map((path: string) => ['--path-regex', path])
        .flat(),
      ...(pathsGlob || []).map((path: string) => ['--path-glob', path]).flat(),
      ...(blobCallback
        ? ['--blob-callback', this.renderCallback(blobCallback, importScripts)]
        : []),
      ...(commitCallback
        ? [
            '--commit-callback',
            this.renderCallback(commitCallback, importScripts)
          ]
        : []),
      ...(emailCallback
        ? [
            '--email-callback',
            this.renderCallback(emailCallback, importScripts)
          ]
        : []),
      ...(filenameCallback
        ? [
            '--filename-callback',
            this.renderCallback(filenameCallback, importScripts)
          ]
        : []),
      ...(help ? ['-h'] : []),
      ...(messageCallback
        ? [
            '--message-callback',
            this.renderCallback(messageCallback, importScripts)
          ]
        : []),
      ...(nameCallback
        ? ['--name-callback', this.renderCallback(nameCallback, importScripts)]
        : []),
      ...(refnameCallback
        ? [
            '--refname-callback',
            this.renderCallback(refnameCallback, importScripts)
          ]
        : []),
      ...(refs ? ['--refs', ...refs] : []),
      ...(resetCallback
        ? [
            '--reset-callback',
            this.renderCallback(resetCallback, importScripts)
          ]
        : []),
      ...(tagCallback
        ? ['--tag-callback', this.renderCallback(tagCallback, importScripts)]
        : []),
      force ? '--force' : ''
    ];
    return this.run(['filter-repo', ...argsArr], options);
  }

  async remote(
    options: Partial<GitRemoteOptions> = {},
    args: string | string[] = []
  ) {
    const argsArr = [...(Array.isArray(args) ? args : [args])];
    return this.run(['remote', ...argsArr], options);
  }

  async run(
    args: string | string[],
    options: Partial<GitRunOptions> = {}
  ): Promise<any> {
    const { cwd, pipe, dryrun } = {
      dryrun: false,
      pipe: false,
      cwd: this.gitPath,
      ...options
    };
    const argsArr = [...(Array.isArray(args) ? args : [args])];
    const command = `git ${argsArr.join(' ')}`;
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

  private renderCallback(python: string, importScripts: string[] = []) {
    return `"
${importScripts
  .map((importScript: string) => this.pythonImportScript(importScript))
  .join('\n')}
${python}
"`;
  }

  private pythonImportScript(scriptName: string) {
    const scriptsPath = path.resolve(__dirname, '../scripts');
    const scriptPath = path.resolve(scriptsPath, `${scriptName}.py`);
    return `
from datetime import datetime, timezone
from importlib import util
import os
spec = util.spec_from_file_location('${scriptName}', '${scriptPath}')
${scriptName} = util.module_from_spec(spec)
spec.loader.exec_module(${scriptName})
`;
  }
}

export interface GitRunOptions {
  cwd?: string;
  dryrun?: boolean;
  pipe?: boolean;
}

export interface GitRemoteOptions extends GitRunOptions {}

export interface GitFilterRepoOptions extends GitRunOptions {
  blobCallback?: string;
  commitCallback?: string;
  debug?: boolean;
  dryRun?: boolean;
  emailCallback?: string;
  filenameCallback?: string;
  force?: boolean;
  help?: boolean;
  importScripts?: string[];
  invertPaths?: boolean;
  messageCallback?: string;
  nameCallback?: string;
  partial?: boolean;
  paths?: string[];
  pathsGlob?: string[];
  pathsRegex?: string[];
  refnameCallback?: string;
  refs?: string | string[];
  resetCallback?: string;
  tagCallback?: string;
}
