const https = require('https');
const util = require('util');
const path = require('path');
const exec = util.promisify(require('child_process').exec);
const alert = require('boxen');

const { solutions, formatCommitsLog } = require('./messages');
const { clearLine } = require('readline');

const log = str => {
    if (!process.env.DEBUG) {
        clearLine(process.stdout);
        process.stdout.write('\r' + str);
    }
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

    let conflictResolution = '';

    /**
     * UNTESTED
     */
    if (opts.upcoming) conflictResolution = '-X theirs';
    if (opts.local) conflictResolution = '-X ours';

    const verifyCommand = `git --version`;
    const checkoutCommand = `git checkout ${branch}`;
    const fetchCommand = `git fetch ${upstream} -v`;
    const mergeCommand = `git merge ${conflictResolution} ${upstream}/${branch} ${branch} -v`;
    const pushCommand = 'git push -v';

    const logCommand = 'git log --oneline -n 10 --no-decorate';

    /* early returns */
    if (opts.add) return addUpstream(opts);
    if (opts.remove) return removeUpstream(opts);
    if (opts.logOnly) return logOnly();
    if (opts.reset) return resetFork(opts);

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
    // convert period from days to ms
    period *= 8.64e7;

    const fs = require('fs');
    const cachePath = path.resolve(__dirname, './cache.json');
    const isGlobal = cachePath.match('node_modules');
    let dateOverride = false;
    let cache = {};

    // Check if cache file exist
    if (!fs.existsSync(cachePath)) {
        // If cache does not exist then perform a
        // Update check regardless of last Update Check date
        cache.lastChecked = Date.now();
        dateOverride = true;
    } else {
        // If it does then get last Update Check date from cache
        cache = JSON.parse(fs.readFileSync(cachePath));

        // If cache does not have 'lastChecked' key then perform a
        // Update check regardless of last Update Check date
        if (!cache.lastChecked) {
            log('Cache Corrupted. Overwriting cache.');
            dateOverride = true;
        }
    }

    // If in DEBUG mode or cache not found or
    // If last Update Check happened "period" days ago
    if (
        process.env.DEBUG ||
        dateOverride ||
        Date.now() - cache.lastChecked > period
    ) {
        // Ger latest version from NPM
        const latest = await getVersion();
        // GEt current version from package.json
        const current = JSON.parse(
            fs.readFileSync(path.resolve(__dirname, '../package.json'))
        ).version;

        if (process.env.DEBUG || current != latest) {
            // Generate strings
            const str =
                solutions.needsUpdate(current, latest) +
                '\n' +
                solutions.updateInstruction;

            // Display the alert
            console.log(
                alert(str, {
                    padding: 1,
                    align: 'center',
                    borderColor: 'yellow',
                })
            );
        }
    }

    // Update (or create) cache file.
    if (isGlobal) {
        fs.writeFileSync(
            cachePath,
            JSON.stringify({
                lastChecked: Date.now(),
            })
        );
    }
}

async function resetFork(opts) {
    const upstream = opts.upstream || 'upstream';
    const branch = opts.branch || 'master';

    const checkoutCommand = `git checkout ${branch}`;
    const fetchCommand = `git fetch ${upstream}`;
    const resetCommand = `git reset --hard ${upstream}/${branch}`;
    const pushCommand = `git push origin ${branch} --force`;

    try {
        await executeCommand(checkoutCommand).then(() =>
            log(solutions.checkout)
        );
        await executeCommand(fetchCommand).then(() => log(solutions.fetched));
        await executeCommand(resetCommand).then(() => log(solutions.reset));
        await executeCommand(pushCommand).then(() => log(solutions.done));
    } catch (err) {
        errorHandler(err);
    }
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
            ' local changes to the following files would be overwritten'
        ),
        pathspec: stderr.match('pathspec'),
        alreadyAdded: stderr.match('already exists'),

        pathspecReset: stderr.match('fatal: ambiguous argument'),
    };

    /* Alert errors */
    if (message || stderr) {
        if (problems.remote) {
            log(solutions.noRemote);
        }
        if (problems.pathspecReset) {
            log(solutions.pathspecReset);
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

async function getVersion() {
    return new Promise((resolve, reject) => {
        https
            .get('https://registry.npmjs.org/sync-fork/latest', res => {
                let data = '';

                res.on('data', chunk => {
                    data += chunk;
                });

                res.on('end', async () => {
                    resolve(JSON.parse(data).version);
                });
            })
            .on('error', err => {
                reject('Error: ' + err.message);
            });
    });
}

module.exports = {
    sleep,
    executeCommand,
    syncFork,
    errorHandler,
};
