#!/usr/bin/env node

import * as admin from 'firebase-admin';
import * as fs from 'fs-extra';
import * as args from 'commander';
import * as csv from 'csvtojson';
import { processFile as processXlsx } from 'excel-as-json';

let fileValue, collValue;

args
    .version('0.0.2')
    .arguments('<file> <collection>')
    .description('Imports JSON, CSV or XLSX data to a Firestore Collection.')
    .option('-i, --id [id]', 'Field to use for document ID')
    .option('-c, --col-oriented', 'XLSX column orientation. Defaults is row orientation')
    .option('-o, --omit-empty-fields', 'XLSX omit empty fields')
    .option('-s, --sheet [#]', 'XLSX Sheet # to import', '1')
    .action((file, coll) => {
        fileValue = file;
        collValue = coll;
    })
    .parse(process.argv);

if (typeof fileValue === 'undefined') {
    console.error('No file given!');
    args.outputHelp();
    process.exit(1);
}

if (typeof collValue === 'undefined') {
    console.error('No collection given!');
    args.outputHelp();
    process.exit(2);
}

// Firebase App Initialization
var serviceAccount = require("../credentials.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Main migration function

async function migrate() {
    try {
        const colPath = collValue;
        const file: string = fileValue;
    
        // Create a batch to run an atomic write
        const colRef = db.collection(colPath);
        const batch = db.batch();
    
        let data;
        if (file.endsWith(".json")) {
            data = await fs.readJSON(file);
        }

        else if (file.endsWith(".csv")) {
            data = await readCSV(file);
        }

        else if (file.endsWith(".xlsx")) {
            data = await readXLSX(file);
        }

        else {
            throw "Unknown file extension. Supports .json, .csv or .xlsx!";
        }
    
        for (const item of data) {
            const id = args.id ? item[args.id].toString() : colRef.doc().id;
    
            const docRef = colRef.doc(id);
    
            batch.set(docRef, item);
        }
    
        // Commit the batch
        await batch.commit();
    
        console.log("Firestore updated. Migration was a success!");
    } catch (error) {
        console.log("Migration failed!", error);
    }
} 

function readCSV(path): Promise<any> {
    return new Promise((resolve, reject) => {
        let lineCount = 0;

        csv()
            .fromFile(path)
            .on("json", data => {
                // fired on every row read
                lineCount++;
            })
            .on("end_parsed", data => {
                console.info(`CSV read complete. ${lineCount} rows parsed.`);
                resolve(data);
            })
            .on("error", err => reject(err));
    });
}

function readXLSX(path): Promise<any> {
    return new Promise((resolve, reject) => {
        const options = {
            sheet: args.sheet,
            isColOriented: args.colOriented ? true : false,
            omitEmtpyFields: args.omitEmptyFields ? true : false
        }
        console.log('Reading XLSX with options', options);
        processXlsx(path, null, options, (err,data) => {
            if (err) reject(err);
            console.info('XLSX read complete.');
            resolve(data);
        })
    });
}

// Run
migrate();
