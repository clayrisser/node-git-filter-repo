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

import { DateArr } from 'kiss-date';
import { ExecaError } from 'execa';
import { xxhash3 } from 'hash-wasm';
import Git, { GitFilterRepoOptions } from './git';
import GitDate from './gitDate';
import Pip from './pip';
import Socket from './socket';
import { Options } from './types';

const gitDate = new GitDate();

export default class GitFilterRepo {
  private git: Git;

  private pip: Pip;

  private options: Options;

  constructor(public gitPath = process.cwd(), options: Partial<Options>) {
    this.options = {
      pipe: true,
      preserveOrigin: false,
      ...options
    };
    this.git = new Git(gitPath);
    this.pip = new Pip(gitPath);
  }

  async ensure(): Promise<any> {
    const previousPath = this.gitPath;
    process.chdir(this.gitPath);
    if (!(await this.installed())) {
      await this.pip.install('git-filter-repo', {
        user: true,
        pipe: this.options.pipe
      });
    }
    process.chdir(previousPath);
  }

  async installed(): Promise<boolean> {
    try {
      await this.git.filterRepo({ help: true, pipe: this.options.pipe });
      return true;
    } catch (err) {
      const execaErr = err as ExecaError;
      if (execaErr.stderr?.indexOf('is not a git command') > -1) {
        return false;
      }
      throw err;
    }
  }

  async blobCallback(
    callback: (blob: Blob) => Blob | Promise<Blob>,
    options: Partial<FilterBlobCallbackOptions> = {}
  ) {
    return this.callback('blob', options, async (blob: Blob) => {
      return callback(blob);
    });
  }

  async commitCallback(
    callback: (commit: Commit) => Commit | Promise<Commit>,
    options: Partial<FilterCommitCallbackOptions> = {}
  ) {
    return this.callback(
      'commit',
      options,
      async (pythonCommit: PythonCommit) => {
        return commitToPythonCommit(
          await callback(pythonCommitToCommit(pythonCommit))
        );
      }
    );
  }

  async tagCallback(
    callback: (tag: Tag) => Tag | Promise<Tag>,
    options: Partial<FilterTagCallbackOptions> = {}
  ) {
    return this.callback('tag', options, (tag: Tag) => {
      return callback(tag);
    });
  }

  async resetCallback(
    callback: (reset: Reset) => Reset | Promise<Reset>,
    options: Partial<FilterResetCallbackOptions> = {}
  ) {
    return this.callback('reset', options, async (reset: Reset) => {
      return callback(reset);
    });
  }

  async filenameCallback(
    callback: (filename: Filename) => Filename | Promise<Filename>,
    options: Partial<FilterFilenameCallbackOptions> = {}
  ) {
    return this.callback('filename', options, async (filename: Filename) => {
      return callback(filename);
    });
  }

  async messageCallback(
    callback: (message: Message) => Message | Promise<Message>,
    options: Partial<FilterMessageCallbackOptions> = {}
  ) {
    return this.callback('message', options, async (message: Message) => {
      return callback(message);
    });
  }

  async nameCallback(
    callback: (name: Name) => Name | Promise<Name>,
    options: Partial<FilterNameCallbackOptions> = {}
  ) {
    return this.callback('name', options, async (name: Name) => {
      return callback(name);
    });
  }

  async emailCallback(
    callback: (email: Email) => Email | Promise<Email>,
    options: Partial<FilterEmailCallbackOptions> = {}
  ) {
    return this.callback('email', options, async (email: Email) => {
      return callback(email);
    });
  }

  async refnameCallback(
    callback: (refname: Refname) => Refname | Promise<Refname>,
    options: Partial<FilterRefnameCallbackOptions> = {}
  ) {
    return this.callback('refname', options, async (refname: Refname) => {
      return callback(refname);
    });
  }

  async callback(
    name: string,
    options: Partial<GitFilterRepoOptions> = {},
    callback: (...args: any[]) => any = () => null
  ) {
    await this.ensure();
    const socket = new Socket('captain_hook', {
      [`${name}Callback`]: callback
    });
    await socket.connect();
    const hasOriginRemote =
      this.options.preserveOrigin && (await this.hasRemote('origin'));
    if (hasOriginRemote) {
      await this.git.remote({ pipe: this.options.pipe }, [
        'rename',
        'origin',
        await xxhash3('origin')
      ]);
    }
    const result = await this.git.filterRepo({
      force: true,
      ...options,
      [`${name}Callback`]: `return callbacks.callback('${name}', ${name})`,
      pipe: this.options.pipe,
      importScripts: ['callbacks']
    });
    if (hasOriginRemote) {
      await this.git.remote({ pipe: this.options.pipe }, [
        'rename',
        await xxhash3('origin'),
        'origin'
      ]);
    }
    await socket.close();
    return result;
  }

  async help(options: Partial<FilterRepoHelpOptions> = {}) {
    return this.git.filterRepo({
      ...options,
      help: true,
      pipe: this.options.pipe
    });
  }

  async hasRemote(remote: string): Promise<boolean> {
    return new Set(
      (
        await this.git.remote(
          {
            pipe: this.options.pipe
          },
          '-v'
        )
      )
        .split('\n')
        .map((remote: string) => remote.replace(/\s+.*$/g, ''))
    ).has(remote);
  }
}

export interface FilterRepoHelpOptions
  extends Omit<GitFilterRepoOptions, 'help'> {}

export interface FilterBlobCallbackOptions
  extends Omit<GitFilterRepoOptions, 'blobCallback' | 'pipe'> {}

export interface FilterCommitCallbackOptions
  extends Omit<GitFilterRepoOptions, 'commitCallback' | 'pipe'> {}

export interface FilterTagCallbackOptions
  extends Omit<GitFilterRepoOptions, 'tagCallback' | 'pipe'> {}

export interface FilterResetCallbackOptions
  extends Omit<GitFilterRepoOptions, 'resetCallback' | 'pipe'> {}

export interface FilterFilenameCallbackOptions
  extends Omit<GitFilterRepoOptions, 'filenameCallback' | 'pipe'> {}

export interface FilterMessageCallbackOptions
  extends Omit<GitFilterRepoOptions, 'messageCallback' | 'pipe'> {}

export interface FilterNameCallbackOptions
  extends Omit<GitFilterRepoOptions, 'nameCallback' | 'pipe'> {}

export interface FilterEmailCallbackOptions
  extends Omit<GitFilterRepoOptions, 'emailCallback' | 'pipe'> {}

export interface FilterRefnameCallbackOptions
  extends Omit<GitFilterRepoOptions, 'refnameCallback' | 'pipe'> {}

export enum Operator {
  Equal = '=',
  GreaterThan = '>',
  GreaterThanOrEqual = '>=',
  LessThan = '<',
  LessThanOrEqual = '<=',
  NotEqual = '!='
}

export interface PythonCommit {
  author_date: string;
  author_email: string;
  author_name: string;
  branch: string;
  committer_date: string;
  committer_email: string;
  committer_name: string;
  dumped: number;
  id: number;
  message: string;
  old_id: number;
  original_id: string;
  type: string;
}

export type Blob = any;

export type Name = string;

export type Filename = string;

export type Tag = string;

export type Email = string;

export type Message = string;

export type Reset = any;

export type Refname = any;

export interface Commit {
  authorDate: DateArr;
  authorEmail: string;
  authorName: string;
  branch: string;
  committerDate: DateArr;
  committerEmail: string;
  committerName: string;
  dumped: number;
  id: number;
  message: string;
  oldId: number;
  originalId: string;
  type: string;
}

export function pythonCommitToCommit(pythonCommit: PythonCommit): Commit {
  return {
    authorDate: gitDate.dateFromGitDate(pythonCommit.author_date),
    authorEmail: pythonCommit.author_email,
    authorName: pythonCommit.author_name,
    branch: pythonCommit.branch,
    committerDate: gitDate.dateFromGitDate(pythonCommit.committer_date),
    committerEmail: pythonCommit.committer_email,
    committerName: pythonCommit.committer_name,
    dumped: pythonCommit.dumped,
    id: pythonCommit.id,
    message: pythonCommit.message,
    oldId: pythonCommit.old_id,
    originalId: pythonCommit.original_id,
    type: pythonCommit.type
  };
}

export function commitToPythonCommit(commit: Commit): PythonCommit {
  return {
    author_date: gitDate.gitDateFromDate(commit.authorDate),
    author_email: commit.authorEmail,
    author_name: commit.authorName,
    branch: commit.branch,
    committer_date: gitDate.gitDateFromDate(commit.committerDate),
    committer_email: commit.committerEmail,
    committer_name: commit.committerName,
    dumped: commit.dumped,
    id: commit.id,
    message: commit.message,
    old_id: commit.oldId,
    original_id: commit.originalId,
    type: commit.type
  };
}
