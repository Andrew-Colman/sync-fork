
const { white, green, gray } = require('chalk');

const { warning, success, sync, arrowRight } = require('./icons');

const solutions = {
    //STDOUT / STDERR:
    alreadyUpdated: sync + 'Already up to date ' + success + '\n',
    started: '\n' + sync + '| sync-fork |',
    fetched: sync + '| fetching | ',
    merged: sync + '| updating | ',
    pushed: sync + '| pushing | ',
    remoteAdded: sync + 'remote url added',
    synced: sync + green.bold('project synced ' + success + '\n'),

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

    conflict:
        warning +
        'your repository has conflicts, you need to resolve it manually',

    hasConflict:
        warning +
        'your repository has conflicts, you need to resolve manually - conflicted files:',

    ahead:
        warning +
        gray('Your branch is ahead of remote upstream ') +
        white('use "git push" to publish your local commits'), //maybe this is for conflict
    file:
        warning +
        white('Conflict, Local files would be overwritten by merge') +
        gray(' //Please commit or stash your changes before you merge / sync'),
    pathspec:
        warning +
        white('Not the correct branch, run with: ') +
        green('-b "branchName"') +
        gray(' //by default we run with "master" '),

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
