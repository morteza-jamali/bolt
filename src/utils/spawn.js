// @flow
import crossSpawn from 'cross-spawn';
import * as logger from './logger';
import type Package from '../package';
import pLimit from 'p-limit';
import os from 'os';

const limit = pLimit(os.cpus().length);

export class ChildProcessError extends Error {
  code: number;
  stdout: string;
  stderr: string;

  constructor(code: number, stdout: string, stderr: string) {
    super(stderr);

    Error.captureStackTrace(this, this.constructor);

    this.code = code;
    this.stdout = stdout;
    this.stderr = stderr;
  }
}

type SpawnOptions = {
  cwd?: string,
  pkg?: Package,
  env?: Object,
};

export default function spawn(cmd: string, args: Array<string>, opts: SpawnOptions = {}) {
  return limit(() => new Promise((resolve, reject) => {
    let stdoutBuf = Buffer.from('');
    let stderrBuf = Buffer.from('');

    let cmdStr = cmd + ' ' + args.join(' ');

    let child = crossSpawn(cmd, args, {
      cwd: opts.cwd,
      env: Object.assign({
        PATH: process.env.PATH,
      }, opts.env),
    });

    if (child.stdout) {
      child.stdout.on('data', data => {
        logger.stdout(cmdStr, data, opts.pkg);
        stdoutBuf = Buffer.concat([stdoutBuf, data]);
      });
    }

    if (child.stderr) {
      child.stderr.on('data', data => {
        logger.stderr(cmdStr, data, opts.pkg);
        stderrBuf = Buffer.concat([stderrBuf, data]);
      });
    }

    child.on('error', reject);

    child.on('close', code => {
      let stdout = stdoutBuf.toString();
      let stderr = stderrBuf.toString();

      if (code === 0) {
        resolve({code, stdout, stderr});
      } else {
        reject(new ChildProcessError(code, stdout, stderr));
      }
    });
  }));
}
