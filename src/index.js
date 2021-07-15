const { Command } = require('commander');
const { getVersion } = require('nanov');

const { syncFork } = require('./syncFork');
const { solutions } = require('./messages');

const version = require('../package.json').version;

/**
 * Program (CLI TOOL)
 * @description call sync-fork
 * @param {string} opts - options called from cmd
 * @example npx sync-fork -b main
 */
const program = new Command();

program
    .command('sync', { isDefault: true })
    .description('sync your remote fork')
    .version('sync-fork version: ' + version, '-v|--version')
    .option('-u,--upstream <upstream>', 'upstream')
    .option('-b,--branch <branch>', 'branch')
    .option('-a,--add <upstream url>', 'add upstream')
    .option('-r,--remove <upstream name>', 'remove upstream')
    .option('-l,--log', 'sync and log recent commits')
    .option(
        '--reset',
        'Resets your fork (will skip conflicts and discard your commits/changes)'
    )
    .option('--log-only', 'log recent commits only (will skip sync)')
    .option('-d,--debug', 'advanced debug ')
    .action(async opts => {
        if (opts.debug) process.env.DEBUG = true;

        try {
            await syncFork(opts);
            //verify updates
            getVersion('sync-fork', version, { cacheTime: 12 }).then(
                ({ latestVersion }) => {
                    if (latestVersion)
                        console.log(
                            solutions.needsUpdate(version, latestVersion)
                        );
                }
            );
        } catch (error) {
            console.log(error);
        }
    });

program.parse(process.argv);
