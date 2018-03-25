#!/usr/bin/env node

import * as admin from 'firebase-admin';
import * as csv from 'csvtojson';
import * as fs from 'fs-extra';
import * as args from 'commander';

var serviceAccount = require('../credentials.json');


args
  .version('0.0.1')
  .option('-s, --src <path>', 'Source file path')
  .option('-c, --collection <path>', 'Collection path in database')
  .option('-i, --id [id]', 'Field to use for document ID')
  .parse(process.argv);


admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function migrate() {

  try {

    const colPath = args.collection;
    const file = args.src;

    // Exit if missing necesary data
    if (!colPath || !file) return Promise.reject("Missing required data");


    const colRef = db.collection(colPath);
    const batch = db.batch();

    let data;
    if (file.includes('.json')) {
      data = await fs.readJSON(file);
    }
  
    if (file.includes('.csv')) {
      data = await readCSV(file)
    }

    for (const item of data) {
      const id = args.id ? item[args.id].toString() : colRef.doc().id;

      const docRef = colRef.doc(id);

      batch.set(docRef, item);

    }

    // Commit the batch
    await batch.commit();

    console.log('Firestore updated. Migration was a success!');

      
  } catch (error) {
    console.log('Migration failed!', error);
  }

}

function readCSV(path): Promise<any> {
  return new Promise((resolve, reject) => {

    let lineCount = 0;

    csv()
    .fromFile(path)
    .on('json', (data) => {
      // fired on every row read
      lineCount++;
    })
    .on('end_parsed', (data) => {
      console.info(`CSV read complete. ${lineCount} rows parsed.`)
      resolve(data)
    })
    .on('error', err => reject(err))
  })

} 


// Run
migrate()