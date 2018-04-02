import * as admin from 'firebase-admin';
import * as fs from 'fs-extra';
import * as csv from 'csvtojson';
import * as _ from 'lodash';
import { processFile as processXlsx } from 'excel-as-json';


const db = admin.firestore();
const batch = db.batch();
let batchSetCount = 0;
let args;


export const execute = async (file, collection, options) => {    
    args = options;
    if( args.dryRun ) args.verbose = true;

    console.log('Chunk: ' + args.chunk);
    process.exit(1);

    try {
    
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
    
        await writeCollection(data, collection);
    
        // Commit the batch
        if (args.dryRun) {
            console.log("Dry-run complete, Firestore was not updated!");
        } else {
            batchCommit();
            console.log("Firestore updated. Import was a success!");
        }
    
    } catch (error) {
        console.log("Import failed!", error);
    }


}

async function batchSet(ref: FirebaseFirestore.DocumentReference, item, options) {
    // Log if requested
    args.verbose && console.log(ref.path);    

    // Set the Data
    await batch.set(ref, item, options);

    // Commit batch on chunk size
    if (!args.dryRun && (++batchSetCount % args.chunk === 0)) {
        await batchCommit()
    }
}

async function batchCommit() {
    // Log if requested
    args.verbose && console.log('Committing write batch...')

    // Commit batch
    await batch.commit();    
}

function writeCollection(data:JSON, path: string): Promise<any> {
    return new Promise((resolve, reject) => {
        const mode = (data instanceof Array) ? 'array' : 'object';
        const colRef = db.collection(path);
        _.forEach(data, async (item:object, id) => {
            // doc-id preference: object key, invoked --id option, auto-id
            id = (mode === 'object') ? id : (args.id && _.hasIn(item, args.id)) ? item[args.id].toString() : colRef.doc().id;
            
            // Look for and process sub-collections
            const subColKeys = Object.keys(item).filter(k => k.startsWith(args.collPrefix+':'));
            await subColKeys.forEach(async (key:string) => {
                const subPath = [path, id, key.slice(args.collPrefix.length + 1) ].join('/');
                await writeCollection(item[key], subPath);
                delete item[key];
            });
            
            // set document data into path/id
            const docRef = colRef.doc(id);
            await batchSet(docRef, item, { merge: !!(args.merge) });

        });
        
        resolve();
    });
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
