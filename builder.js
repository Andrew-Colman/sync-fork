const fs = require('fs');
const path = require('path');
const util = require('util');

const { minify } = require('terser');

const readdir = util.promisify(fs.readdir);
const readFile = util.promisify(fs.readFile);

const { sync } = require('./lib/icons');

/**source code */
const filesDirectory = './lib/';
/**  optimized code for production destination */
const buildDestination = './dist/index.min.js';

/**
 * @main
 * build (minify) for production
 *
 * custom code -> merge all files, update scope hoisting (requires) then create index.min.js
 *
 * terser- > minify
 */
async function build() {
    //check
    await checkSourceCode(filesDirectory);
    await checkDistFolder(buildDestination);

    //reset
    fs.writeFileSync(buildDestination, '', () => {});

    let files;

    try {
        files = await readdir(filesDirectory);
    } catch (err) {
        console.log(err);
    }
    if (files === undefined) {
        console.log('files not found');
    } else {
        //get content from files
        const getData = async () => {
            return Promise.all(files.map(file => read(file)));
        };

        //run terser to optimize/minify code
        const minifyData = async data => {
            const mini = await minify({ data });
            return mini.code;
        };

        getData().then(data => {
            requires = findRequires(data.join('\n'));
            data = deleteRequiresFromFile(data.join('\n'));
            const hoist = requires + data; // <- hoist fix

            minifyData(hoist).then(minifiedData => {
                fs.appendFileSync(buildDestination, minifiedData);
                console.log(sync, 'build complete!');
            });
        });
    }
}

/**
 * read file content
 * @param {String|Buffer} file
 */
async function read(file) {
    let content;
    try {
        content = await readFile(
            path.join(filesDirectory, file),
            (err, data) => {
                if (err) console.log(err);
                return data;
            }
        );
    } catch (err) {
        console.log(err);
    }
    return content;
}

/**
 * @description find required node_modules or './' requires
 * @example const fs = require('fs')
 * will return this line
 * @param {String} data - the code
 */
function findRequires(data) {
    return data
        .toString()
        .split('\n')
        .map(item => {
            if (item.match('require')) return item;
        })
        .filter(item => item !== undefined)
        .filter(item => !item.match("'./")) //remove local imports <-
        .join('\n');
}

/**
 * @description delete all require('node_module')  lines in code
 * @example const fs = require('fs')
 *
 * @summary will delete this line from code
 * @param {String} data - the code
 */
function deleteRequiresFromFile(data) {
    return data
        .toString()
        .split('\n')
        .map(item => {
            if (!item.match('require')) return item;
        })
        .join('\n');
}

/**
 * verify if source code folder and files exist
 * @param {string} folderPath
 */
function checkSourceCode(folderPath) {
    if (fs.existsSync(folderPath)) {
        return true;
    } else {
        throw new Error('source code error: ', folderPath, ' not found');
    }
}

/**
 *  verify if build destination folder exists, if not create it
 * @param {string} folderPath
 */
function checkDistFolder(folderPath) {
    if (fs.existsSync(folderPath)) {
        return true;
    } else {
        fs.mkdirSync(folderPath.split('/')[1]);
    }
}

build();
