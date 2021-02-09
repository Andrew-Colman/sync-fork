const { white, green, gray } = require('chalk');

const { warning, success, sync, arrowRight } = require('./icons');

const solutions = {
    //STDOUT / STDERR:
    alreadyUpdated: sync + 'Already up to date ' + success + '\n',
    started: '\n' + sync + '| sync-fork |',
    fetched: sync + '| fetching | ',
    merged: sync + '| updating | ',
    pushed: sync + '| pushing | ',
    reset: sync + '| resetting | ',
    remoteAdded: sync + 'remote url added',
    synced: sync + green.bold('project synced ' + success + '\n'),
    done: sync + green.bold('Done! ' + success + '\n'),

    //ERRORS / EXCEPTIONS:

    gitNotInstalled:
        warning +
        "Looks like you don't have git installed, install it at: https://git-scm.com/",

    noRemote:
        warning +
        'no remote upstream found, you should add a git remote url with:\n' +
        green('sync-fork -a <remote git url>'),

    noMerge:
        warning + 'not something we can merge, please verify your branch names',

    notRepo:
        warning +
        'you are not in a git repository, run ' +
        green('git init ') +
        'to start' +
        '\n',

    notBranch:
        warning +
        'no branch found, run sync-fork -b <branch-name>' +
        gray('(usually master or main)'), //check()

    hasConflict:
        warning +
        'your repository has conflicts, you need to resolve them manually',

    ahead:
        warning +
        gray('Your branch is ahead of remote upstream ') +
        white('use "git push" to publish your local commits'), //maybe this is for conflict

    file:
        warning +
        white('Conflict, Local files would be overwritten') +
        gray(' //Please commit or stash your changes before you sync') +
        gray('\n optional: ') +
        green('\n sync-fork --reset') +
        gray(
            ' //resets your fork (will skip conflicts and discard any commits/changes)'
        ) +
        gray('\n//we recommend resolving complex conflicts manually') +
        gray(' (like accepting local or upcoming changes'),

    pathspec:
        warning +
        white('Not the correct branch, run with: ') +
        green('-b "branchName"') +
        gray(' //by default we run with "master" '),

    pathspecReset:
        warning +
        white('Not the correct upstream or branch, run with: ') +
        green('-u "upstream" and -b "branchName"') +
        gray(' //by default we run with "upstream/master" '),

    alreadyAdded: warning + white('remote url already exists: '),

    needsUpdate: (current, latest) =>
        sync +
        'Update Available ' +
        gray(current) +
        ' ' +
        arrowRight +
        ' ' +
        white(latest) +
        ' ',

    updateInstruction: ' Run ' + green('npm i -g sync-fork') + ' to update ',

    alert: msg => `
┌───────────────────────────────────────┐
│                                       │
│                                       │
│  ${msg[0]}   │
│  ${msg[1]}   │
│                                       │
│                                       │
└───────────────────────────────────────┘`,
};

/**
 * format git log - commit messages
 * @param {string} stdout
 */
function formatCommitsLog(stdout) {
    const formattedStdout = stdout
        .split('\n')
        .map(arr => {
            return arr
                .split(' ')
                .map((item, index) => {
                    if (index === 0 && item !== '') {
                        return green('• ') + gray(item);
                    }
                    return item;
                })
                .join(' ');
        })
        .join('\n');

    return '\n' + sync + 'log: \n' + '\n' + formattedStdout;
}

module.exports = { solutions, formatCommitsLog };
