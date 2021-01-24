const util = require('util');
const exec = util.promisify(require('child_process').exec);
const alert = require('boxen');

const { solutions, formatCommitsLog } = require('./messages');

const log = str => {
    if (!process.env.DEBUG) process.stdout.write('\r' + str);
};

async function executeCommand(command) {
    const { stdout, stderr } = await exec(command);

    if (process.env.DEBUG) {
        debug(stdout, stderr, command);
    }

    return { stdout, stderr };
}

async function syncFork(opts) {
    // console.log(opts);

    await checkForUpdates();

    const upstream = opts.upstream || 'upstream';
    const branch = opts.branch || 'master';

    const verifyCommand = `git --version`;
    const checkoutCommand = `git checkout ${branch}`;
    const fetchCommand = `git fetch ${upstream} -v`;
    const mergeCommand = `git merge ${upstream}/${branch} ${branch} -v`;
    const pushCommand = 'git push -v';

    const logCommand = 'git log --oneline -n 10 --no-decorate';

    /* early returns */
    if (opts.add) return addUpstream(opts);
    if (opts.remove) return removeUpstream(opts);
    if (opts.logOnly) return logOnly();

    /* sync */
    try {
        await executeCommand(verifyCommand).then(({ stdout }) => {
            if (!stdout.match('git version')) {
                return log(solutions.gitNotInstalled);
            } else {
                return log(solutions.started);
            }
        });

        await executeCommand(checkoutCommand).then(({ stdout }) => {
            if (stdout.match('Your branch is ahead of')) {
                return log(solutions.ahead), Stop(); //error
            }
        });

        await executeCommand(fetchCommand).then(({ stderr }) => {
            if (stderr.match('POST git-upload-pack'))
                return log(solutions.fetched);
        });

        await executeCommand(mergeCommand).then(({ stdout }) => {
            if (stdout.match('Already up to date')) {
                return log(solutions.alreadyUpdated), Stop();
            } else if (stdout.match('Updating')) {
                return log(solutions.merged);
            }
        });

        await executeCommand(pushCommand).then(({ stderr }) => {
            if (stderr.match('POST git-receive-pack'))
                return log(solutions.pushed);
        });

        await log(solutions.synced);

        if (opts.log === true) {
            await executeCommand(logCommand).then(({ stdout }) => {
                return console.log(formatCommitsLog(stdout));
            });
        }
    } catch (err) {
        errorHandler(err);
    }

    /* closures */
    async function logOnly() {
        try {
            await executeCommand(logCommand).then(({ stdout }) => {
                return console.log(formatCommitsLog(stdout));
            });
        } catch (err) {
            errorHandler(err);
        }
    }
}

/**
 * Checks if an upate check as been made in the past "period" days,
 * if not, checks for update.
 *
 * @param period Frequency of update checks in days.
 */
async function checkForUpdates(period = 1) {
    period *= 8.64e7;
    const fs = require('fs');
    const cachePath = './cache.json';
    let dateOverride = false;
    let cache = {};

    if (!fs.existsSync(cachePath)) {
        cache.lastChecked = Date.now();
        dateOverride = true;
    } else {
        cache = JSON.parse(fs.readFileSync('./cache.json'));

        if (!cache.lastChecked) {
            log('Cache Corrupted. Overwriting cache.');
            dateOverride = true;
        }
    }

    if (
        process.env.DEBUG ||
        dateOverride ||
        Date.now() - cache.lastChecked > period
    ) {
        const packageName = process.env.DEBUG ? 'add-two-number' : 'sync-fork';
        const checkOutdatedCommand = `npm outdated ${packageName} -json`;

        try {
            await executeCommand(checkOutdatedCommand);
        } catch ({ code, stdout }) {
            if (code === 1) {
                const obj = JSON.parse(stdout);

                const { current, latest } = obj[packageName];
                const str =
                    solutions.needsUpdate(current, latest) +
                    '\n' +
                    solutions.updateInstruction;

                console.log(
                    alert(str, {
                        padding: 2,
                        align: 'center',
                        borderColor: 'yellow',
                    })
                );
            }
        }
    }

    fs.writeFileSync(
        './cache.json',
        JSON.stringify({
            lastChecked: Date.now(),
        })
    );
}

async function addUpstream(opts) {
    const upstream = opts.upstream || 'upstream';
    const remoteUrl = opts.add;
    try {
        const addCommand = `git remote add ${upstream} ${remoteUrl}`;
        const verifyCommand = `git remote -v`;
        await executeCommand(addCommand);
        await executeCommand(verifyCommand).then(({ stdout }) => {
            if (stdout.match(upstream)) {
                return log(
                    '\n' +
                        'remote added, you can now sync with: sync-fork -u ' +
                        upstream
                );
            }
        });
    } catch (err) {
        errorHandler(err);
    }
}

async function removeUpstream(opts) {
    const upstream = opts.remove || 'upstream';
    try {
        const removeCommand = `git remote remove ${upstream}`;
        const verifyCommand = `git remote -v`;
        await executeCommand(removeCommand);
        await executeCommand(verifyCommand).then(({ stdout }) => {
            if (!stdout.match(upstream)) {
                return log('\n' + 'remote removed: ' + upstream);
            }
        });
    } catch (err) {
        errorHandler(err);
    }
}

/**
 *  handle errors / exceptions
 *  @param {Error} Error
 */
function errorHandler(error) {
    if (process.env.DEBUG) {
        console.log('DEBUG: ', error.stderr);
    }
    const { message, stdout, stderr } = error;

    const problems = {
        remote: message.match('does not appear to be a git repository'),
        merge: message.match('not something we can merge'),
        repo: message.match('fatal: not a git repository'),
        check: message.match('did not match any'),
        conflict: stdout.match('CONFLICT'), //conflict
        hasConflict: stderr.match('you need to resolve your current index'), //conflict in edit
        ahead: stderr.match('Your branch is ahead of'),
        file: stderr.match(
            ' local changes to the following files would be overwritten by merge:'
        ),
        pathspec: stderr.match('pathspec'),
        alreadyAdded: stderr.match('already exists'),
    };

    /* Alert errors */
    if (message || stderr) {
        if (problems.remote) {
            log(solutions.noRemote);
        }
        if (problems.merge) {
            log(solutions.noMerge);
        }
        if (problems.repo) {
            log(solutions.notRepo);
        }
        if (problems.check) {
            log(solutions.check);
        }
        if (problems.conflict) {
            log(solutions.conflict);
        }
        if (problems.hasConflict) {
            log(solutions.hasConflict);
            executeCommand('git diff --name-only --diff-filter=U').then(
                ({ stdout }) => {
                    return log('\n' + stdout);
                }
            );
        }
        if (problems.ahead) {
            log(solutions.ahead);
        }
        if (problems.file) {
            log(solutions.file);
            executeCommand('git status -s').then(({ stdout }) => {
                return log('\n' + stdout);
            });
        }
        if (problems.pathspec) {
            log(solutions.pathspec);
            executeCommand('git branch').then(({ stdout }) => {
                return log('\n' + stdout);
            });
        }
        if (problems.alreadyAdded) {
            log(solutions.alreadyAdded);
            executeCommand('git remote -v').then(({ stdout }) => {
                return log('\n' + stdout);
            });
        }
    }
}

/**
 * debug mode
 * */
async function debug(out, err, cmd) {
    console.log('\n - CMD    >> ', cmd);
    console.log(' - STDOUT >> ', out.trim());
    console.log(' - STDERR >> ', err.trim());
}

/* utility: */

async function Stop() {
    process.exit();
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
    sleep,
    executeCommand,
    syncFork,
    errorHandler,
};
