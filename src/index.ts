#!/usr/bin/env node

import * as admin from 'firebase-admin';
import * as fs from 'fs-extra';
import * as args from 'commander';
import * as csv from 'csvtojson';
import * as _ from 'lodash';
import { processFile as processXlsx } from 'excel-as-json';

// Firebase App Initialization
var serviceAccount = require("../credentials.json");
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

import * as importCollection from './importCollection';
import * as exportCollection from './exportCollection';


// Help Descriptions
const rootDescription = [
    'Import/Export JSON data to/from a Firestore Database'
].join('\n').replace(/^/gm, '  ');

const rootHelp = [
    '',
    'For command specific help try:',
    '  fire-migrate import -h',
    '  fire-migrate export -h',
    ''
].join('\n').replace(/^/gm, '  ');

const importDescription = [
    'Import JSON data to a Firestore collection',
    '  Optionally converts Excel or CSV to JSON before import.'
].join('\n').replace(/^/gm, '  ');;

const importHelp = [
    '','Examples:','',
    '  fire-migrate import --dry-run test.json myCollection',
    '  fire-migrate import --merge test.csv myCollection',
    '  fire-migrate i -m --id docid --sheet 3 test.xlsx myCollection',
    ''
].join('\n').replace(/^/gm, '  ');

const exportDescription = 
    'Export Firestore collection(s) to a JSON file';

const exportHelp = [
    '','Examples:','',
    '  fire-migrate export --verbose --subcolls myCollection.json myCollection',
    '  fire-migrate export users-posts.json users posts',
    '  fire-migrate e -sv firestore-dump.json',
    ''
].join('\n').replace(/^/gm, '  ');


// Base options
args.version('0.1.0')
    .description(rootDescription)
    .on('--help', () => {
        console.log(rootHelp);
    });    


// Import options
args.command('import')
    .alias('i')
    .description(importDescription)
    .arguments('<file> <collection>')
    .option('-i, --id [field]', 'Field to use for document ID')
    .option('-m, --merge', 'Merge Firestore documents. Default is replace.')
    .option('-p, --coll-prefix [prefix]', '(Sub-)Collection prefix', 'collection')
    .option('')
    .option('-c, --col-oriented', 'XLSX column orientation. Default is row orientation')
    .option('-o, --omit-empty-fields', 'XLSX omit empty fields')
    .option('-s, --sheet [#]', 'XLSX Sheet # to import', '1')
    .option('')
    .option('-d, --dry-run', 'Perform a dry run, without committing data. Implies --verbose.')
    .option('-v, --verbose', 'Output document insert paths')
    .action((file, collection, options) => {
        importCollection.execute(file, collection, options);
    }).on('--help', () => {
        console.log(importHelp);
    });
    

// Export options
args.command('export <file> [collections...]')
    .alias('e')
    .description('Export Firestore collection(s) to a JSON file')
    .option('-s, --subcolls', 'Include sub-collections.')
    .option('-p, --collection-prefix [prefix]', 'Collection prefix', 'collection')
    .option('-v, --verbose', 'Output traversed document paths')
    .action((file, collections, options) => {
        exportCollection.execute(file, collections, options);
    }).on('--help', () => {
        console.log(exportHelp)
    });


args.parse(process.argv);
