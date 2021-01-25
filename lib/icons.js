const c = require('chalk');

const isSupported =
    process.platform !== 'win32' ||
    process.env.CI ||
    process.env.TERM === 'xterm-256color';

const info = c.bold(isSupported ? 'ℹ' : 'i');
const success = c.green(isSupported ? '✔' : '√');
const warning = c.keyword('orange')('<!> warning: '); //'⚠'
const arrowRight = isSupported ? '→' : '>';
const sync = c.red(' § ');
const logo = c.bold('[sync-fork] ');
//const errorIcon = c.red(isSupported ? '✖' : '×');

module.exports = { info, success, warning, sync, logo, arrowRight };
