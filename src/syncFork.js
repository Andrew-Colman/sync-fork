const util = require('util');
const exec = util.promisify(require('child_process').exec);
const { clearLine } = require('readline');

const { solutions, formatCommitsLog } = require('./messages');

/**
 *  the main execution function
 */
async function syncFork(opts) {
    // console.log(opts);

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
    if (opts.reset) return resetFork(opts);
    if (opts.logOnly) return logOnly();

    /* sync */
    try {
        await executeCommand(verifyCommand).then(({ stdout }) => {
            if (!stdout.match('git version')) log(solutions.gitNotInstalled);
            return log(solutions.started);
        });

        await executeCommand(checkoutCommand).then(({ stdout }) => {
            if (stdout.match('Your branch is ahead of')) {
                return log(solutions.ahead), Stop(); //error
            }
        });

        await executeCommand(fetchCommand).then(({ stderr }) => {
            if (stderr.match('POST git-upload-pack')) log(solutions.fetched);
        });

        await executeCommand(mergeCommand).then(({ stdout }) => {
            if (stdout.match('Already up to date')) {
                log(solutions.alreadyUpdated);
                Stop();
            }
            if (stdout.match('Updating')) log(solutions.merged);
        });

        await executeCommand(pushCommand).then(({ stderr }) => {
            if (stderr.match('POST git-receive-pack')) log(solutions.pushed);
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

    /**
     *  --log-only
     * @description log and skip sync
     */
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
 * log in the same line
 * @param {string} str
 */
const log = str => {
    if (!process.env.DEBUG) {
        process.stdout.write('\r' + str);
    }
};

/**
 * executes commands
 * @param {string} command
 * @returns {object} { stdout, stderr }
 */

async function executeCommand(command) {
    const { stdout, stderr } = await exec(command);

    if (process.env.DEBUG) {
        debug(stdout, stderr, command);
    }

    return { stdout, stderr };
}

/**
 * --reset
 * @description resets your fork (will skip conflicts and discard any commits/changes)
 */
async function resetFork(opts) {
    const upstream = opts.upstream || 'upstream';
    const branch = opts.branch || 'master';

    const verifyMergeCommand = `git status`;
    const abortMergeCommand = `git merge --abort`;
    const checkoutCommand = `git checkout ${branch}`;
    const fetchCommand = `git fetch ${upstream}`;
    const resetCommand = `git reset --hard ${upstream}/${branch}`;
    const pushCommand = `git push -f`;

    try {
        await executeCommand(verifyMergeCommand).then(async ({ stdout }) => {
            if (stdout.match('have unmerged')) {
                await executeCommand(abortMergeCommand);
            }
        });
        await executeCommand(checkoutCommand);
        await executeCommand(fetchCommand).then(() => log(solutions.fetched));
        await executeCommand(resetCommand).then(() => log(solutions.reset));
        await executeCommand(pushCommand).then(() => {
            clearLine(process.stdout);
            console.log('\r' + solutions.done);
        });
    } catch (err) {
        errorHandler(err);
    }
}

/**
 * -a | --add
 * @description add a remote url ( default "upstream" | set with -u \<name> )
 * @description shorthand for git remote add \<url>
 */
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

/**
 * -r | --remove
 * @description removes remote url
 * @description shorthand for git remote remove \<name>
 */
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
 *  handle catch() errors / exceptions
 *  @param {Error} Error
 */
function errorHandler(error) {
    if (process.env.DEBUG) {
        console.log('DEBUG: ', error);
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
        file: stderr.match('would be overwritten'),
        pathspec: stderr.match('pathspec'),
        alreadyAdded: stderr.match('already exists'),

        pathspecReset: stderr.match('fatal: ambiguous argument'),
    };

    /* Alert errors */
    if (message || stderr) {
        if (problems.remote) log(solutions.noRemote);

        if (problems.pathspecReset) log(solutions.pathspecReset);

        if (problems.merge) log(solutions.noMerge);

        if (problems.repo) log(solutions.notRepo);

        if (problems.check) log(solutions.check);

        if (problems.ahead) log(solutions.ahead);

        if (problems.conflict || problems.hasConflict) {
            log(solutions.hasConflict);
            showConflictingFiles();
        }

        if (problems.file) {
            log(solutions.file);
            showConflictingFiles();
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
 * shows conflicting files
 * @todo format stdout in a nice format
 */
async function showConflictingFiles() {
    await executeCommand('git status -s').then(({ stdout }) => {
        return log('\nconflicting files:\n' + stdout);
    });
}

/**
 * debug mode
 * @description runs if using -d
 * */
async function debug(out, err, cmd) {
    console.log('\n - CMD    >> ', cmd);
    console.log(' - STDOUT >> ', out.trim());
    console.log(' - STDERR >> ', err.trim());
}

/* utility: */

/**
 * stop the program from running
 */
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
