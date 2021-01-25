const { Command } = require('commander');
const program = new Command();

const version = 'sync-fork version: ' + require('../package.json').version;

const { syncFork } = require('./utils');

/**
 * Program (CLI TOOL)
 * @description call sync-fork
 * @param {string} opts - options called from cmd
 * @example npx sync-fork -b main
 */
program
    .command('sync', { isDefault: true })
    .description('sync your remote fork')
    .version(version, '-v|--version')
    .option('-u,--upstream <upstream>', 'upstream')
    .option('-b,--branch <branch>', 'branch')
    .option('-a,--add <upstream url>', 'add upstream')
    .option('-r,--remove <upstream name>', 'remove upstream')
    .option('-l,--log', 'sync and log recent commits')
    .option('-U,--upcoming', 'Resolve conflicts accepting all upcoming changes')
    .option('-L,--local', 'Resolve conflicts accepting all local changes')
    .option('-R,--reset', 'Reset all local changes and replace with upstream')
    .option('--log-only', 'log recent commits only (will skip sync)')
    .option('-d,--debug', 'advanced debug ')
    .action(opts => {
        if (opts.debug) process.env.DEBUG = true;

        syncFork(opts);
    });

program.parse(process.argv);
