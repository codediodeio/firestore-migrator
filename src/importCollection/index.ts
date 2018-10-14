import * as admin from 'firebase-admin';
import * as fs from 'fs-extra';
import * as _ from 'lodash';
import * as XLSX from 'xlsx';
import * as dot from 'dot-object';

import { encodeDoc, cleanCollectionPath, isCollectionPath, isDocumentPath } from '../shared';


const db = admin.firestore();
let batch = db.batch();
let batchCount = 0;
let totalSetCount = 0;
let totalDelCount = 0;
let args;
let delPaths = [];

export const execute = async (file: string, collections: string[], options) => {    
    args = options;
    if( args.dryRun ) args.verbose = true;

    try {

        if( collections.length === 0 ) {
            // root if no paths
            collections = ['/'];
        } else {
            // clean all collection paths
            collections.map(cleanCollectionPath);
            // root overrides all other selections
            if (collections.includes('/')) {
                collections = ['/'];
            }
        }

        let data = {};

        if (file.endsWith(".json")) {
            data = await readJSON(file, collections);
        }

        else if (file.endsWith('.xlsx')) {
            data = await readXLSXBook(file, collections);
        }

        else if (file.endsWith(".csv")) {
            data = await readCSV(file, collections);
        }

        else {
            throw "Unknown file extension. Supports .json, .csv or .xlsx!";
        }

        await writeCollections(data);    

        // Final Batch commit and completion message.
        await batchCommit(false);
        console.log(args.dryRun
            ? 'Dry-Run complete, Firestore was not updated.'
            : 'Import success, Firestore updated!'
        );
        args.truncate && console.log(`Total documents deleted: ${totalDelCount}`);
        console.log(`Total documents written: ${totalSetCount}`);
    
    } catch (error) {
        console.log("Import failed: ", error);
    }


}


// Firestore Write/Batch Handlers
async function batchDel(ref: FirebaseFirestore.DocumentReference) {
    // Log if requested
    args.verbose && console.log(`Deleting: ${ref.path}`);

    // Mark for batch delete
    ++totalDelCount;
    await batch.delete(ref);

    // Commit batch on chunk size
    if (++batchCount % args.chunk === 0) {
        await batchCommit()
    }

}

async function batchSet(ref: FirebaseFirestore.DocumentReference, item, options) {
    // Log if requested
    args.verbose && console.log(`Writing: ${ref.path}`);    

    // Set the Document Data
    ++totalSetCount;
    await batch.set(ref, item, options);

    // Commit batch on chunk size
    if (++batchCount % args.chunk === 0) {
        await batchCommit()
    }
}

async function batchCommit(recycle:boolean = true) {
    // Nothing to commit
    if (!batchCount) return;
    // Don't commit on Dry Run
    if (args.dryRun) return;

    // Log if requested
    args.verbose && console.log('Committing write batch...')

    // Commit batch
    await batch.commit();    

    // Get a new batch
    if (recycle) {
        batch = db.batch();
        batchCount = 0;
    }
}

function writeCollections(data): Promise<any> {
    const promises = [];
    _.forEach(data, (docs, coll) => {
        promises.push(
            writeCollection(docs, coll)
        );
    });
    return Promise.all(promises);
}

function writeCollection(data:JSON, path: string): Promise<any> {
    return new Promise(async (resolve, reject) => {        
        const colRef = db.collection(path);

        if (args.truncate) {
            await truncateCollection(colRef);
        }

        const mode = (data instanceof Array) ? 'array' : 'object';
        for ( let [id, item] of Object.entries(data)) {
            
            // doc-id preference: object key, invoked --id field, auto-id
            if (mode === 'array') {
                id = args.autoId;
            }
            if (_.hasIn(item, args.id)) {                
                id = item[args.id].toString();
                delete(item[args.id]);
            }
            if (!id || (id.toLowerCase() === args.autoId.toLowerCase()) ) {
                id = colRef.doc().id;
            }      
            
            // Look for and process sub-collections
            const subColKeys = Object.keys(item).filter(k => k.startsWith(args.collPrefix+':'));
            for ( let key of subColKeys ) {
                const subPath = [path, id, key.slice(args.collPrefix.length + 1) ].join('/');
                await writeCollection(item[key], subPath);
                delete item[key];
            }
            
            // Encode item to Firestore
            encodeDoc(item);
            
            // set document data into path/id
            const docRef = colRef.doc(id);
            await batchSet(docRef, item, { merge: !!(args.merge) });

        }
        
        resolve();
    });
}

async function truncateCollection(colRef: FirebaseFirestore.CollectionReference) {
    // TODO: Consider firebase-tools:delete

    const path = colRef.path;
    if (delPaths.includes(path)) {
        // Collection Path already processed
        return;
    }    
    delPaths.push(path);

    await colRef.get().then(async (snap) => {
        for (let doc of snap.docs) {
            // recurse sub-collections
            const subCollPaths = await doc.ref.getCollections();
            for (let subColRef of subCollPaths) {
                await truncateCollection(subColRef);
            }
            // mark doc for deletion
            await batchDel(doc.ref);
        }
    });
}

// File Handling Helpers
function dataFromJSON(json) {
    _.forEach(json, row => {
        dot.object(row);
    });
    return json;
}

function dataFromSheet(sheet)  {
    const json = XLSX.utils.sheet_to_json(sheet);
    return dataFromJSON(json);
}

function JSONfromCSV(file:string) {
    const book = XLSX.readFile(file);
    const sheet = book.Sheets['Sheet1'];
    return XLSX.utils.sheet_to_json(sheet);
}

function datafromCSV(file:string) {
    const json = JSONfromCSV(file);
    return dataFromJSON(json);
}



// File Handlers

function readJSON(path: string, collections: string[]): Promise<any> {
    return new Promise(async (resolve, reject) => {        
        const json = await fs.readJSON(path);
        const data = {};

        const mode = (json instanceof Array) ? 'array' : 'object';

        // Array of Docs, Single Anonymous Collection;
        if (mode === 'array') {
            const coll = collections[0];
            if (coll === '/' || collections.length > 1 || isDocumentPath(coll)) {
                reject('Specify single target collection path for import of JSON array of documents.');
                return;
            }
            data[coll] = json;
            resolve(data);
            return;
        }

        const rootJsonCollections = Object.keys(json).filter(k => k.startsWith(args.collPrefix + ':'));        
        
        // Docs of Keyed Objects, Single Anonymous Collection;
        if (rootJsonCollections.length === 0) {
            const coll = collections[0];
            if (coll === '/' || collections.length > 1 || isDocumentPath(coll)) {
                reject('Specify single target collection path for import of JSON keyed object documents.');
                return;
            }

            data[collections[0]] = json;
            resolve(data);
            return;
        }

        // Selected Collections;
        if (collections[0] !== '/') {
            collections.forEach(collection => {
                if (isDocumentPath(collection)) {
                    console.log('ISDOC');
                    reject(`Invalid collection path: ${collection}`);
                    return;
                };
                
                const labelledPath = collection.split('/').map((segment, index) => {
                    return (index % 2 === 0) ? args.collPrefix + ':' + segment : segment;
                }).join('.');

                const coll = dot.pick(labelledPath, json);
                if (!coll) {
                    reject(`Source JSON file contains no collection named: ${collection}`);
                    return;
                }

                data[collection] = coll;
            });
            resolve(data);
            return;
        }

        // All Collections from JSON file
        if (collections[0] === '/') {
            rootJsonCollections.forEach(coll => {
                const path = coll.substr(args.collPrefix.length + 1);
                data[path] = json[coll];
            })
            resolve(data);
            return;
        } 

        // Import options exhausted
        reject(`Invalid import options`);
    });
}


function readCSV(file: string, collections: string[]): Promise<any> {
    return new Promise((resolve, reject) => {
        let lineCount = 0;
        let data = {};        
        
        // Single Mode CSV, single collection
        if (!file.endsWith('INDEX.csv')) {
            args.verbose && console.log(`Mode: Single CSV Collection`); 

            if (collections.length > 1) {
                reject('Multiple collection import from CSV requires an *.INDEX.csv file.');
                return;
            }
            const collection = collections[0];
            if (collection === '/') {
                reject('Specify a collection for single mode CSV import.');
                return;
            }
            data[collection] = datafromCSV(file);
            resolve(data);
            return;
        }

        const index = JSONfromCSV(file);

        // Indexed Mode CSV, selected collections and sub-cols
        if (collections[0] !== '/') {
            args.verbose && console.log(`Mode: Selected collections from Indexed CSV`); 
            collections.forEach(collection => {                
                const colls = index.filter(coll => (coll['Collection'] + '/').startsWith(collection + '/'));
                if (colls.length) {
                    colls.forEach(coll => {
                        const colPath = coll['Collection'];
                        const sheetName = coll['Sheet Name'];
                        const fileParts = file.split('.');
                        fileParts.splice(-2,1,sheetName);
                        const fileName = fileParts.join('.');
                        data[colPath] = datafromCSV(fileName);
                    });
                } else {
                    reject(`INDEX contains no paths matching: ${collection}`);
                    return;
                }
            });
            resolve(data);
            return;
        }

        // Indexed Mode CSV, all collections
        if (collections[0] === '/') {
            args.verbose && console.log(`Mode: All collections from Indexed CSV`); 
            const collection = collections[0];
            _.forEach(index, coll => {
                const colPath = coll['Collection'];
                const sheetName = coll['Sheet Name'];
                const fileParts = file.split('.');
                fileParts.splice(-2,1,sheetName);
                const fileName = fileParts.join('.');
                data[colPath] = datafromCSV(fileName);
            });
            resolve(data);
            return;
        }

        // Import options exhausted
        reject(`Invalid collections or CSV`);

    });
}


function readXLSXBook(path, collections: string[]): Promise<any> {

    return new Promise((resolve, reject) => {
        const book = XLSX.readFile(path);
        const sheetCount = book.SheetNames.length;
        const indexSheet = book.Sheets['INDEX'];
        let data = {};

        let sheetNum = args.sheet;
        if ((sheetCount === 1) && (sheetNum == undefined)) {
            sheetNum = 1;
        }

        // Single Sheet as Collection, typically from Non-Indexed Workbook
        if (sheetNum !== undefined) {
            args.verbose && console.log(`Mode: Single XLSX Sheet #${sheetNum}`); 
            const collection = collections[0];
            if(isDocumentPath(collection)) {
                reject(`Invalid collection path for single collection: ${collection}`);
                return;
            }
            const sheetName = book.SheetNames[+sheetNum - 1];
            const sheet = book.Sheets[sheetName];
            if (!sheet) {
                reject(`Sheet #${sheetNum} not found in workbook`);
                return;
            }
            data[collection] = dataFromSheet(sheet);
            resolve(data);
            return;
        }

        const index = XLSX.utils.sheet_to_json(indexSheet);

        // Selected Collections and Sub Colls from Indexed Workbook
        if (collections[0] !== '/') {
            args.verbose && console.log('Mode: Selected Sheets from indexed XLSX Workbook'); 
            collections.forEach(collection => {                
                const colls = index.filter(coll => (coll['Collection'] + '/').startsWith(collection + '/'));
                if (colls.length) {
                    colls.forEach(coll => {
                        const colPath = coll['Collection'];
                        const sheetName = coll['Sheet Name'];
                        const sheet = book.Sheets[sheetName];
                        data[colPath] = dataFromSheet(sheet);
                    });
                } else {
                    reject(`INDEX contains no paths matching: ${collection}`);
                    return;
                }
            });
            resolve(data);
            return;
        }

        // All Collections from Indexed Workbook
        if (collections[0] === '/') {
            args.verbose && console.log('Mode: All Sheets from indexed XLSX Workbook'); 
            const collection = collections[0];
            _.forEach(index, coll => {
                const sheetName = coll['Sheet Name'];
                const path = cleanCollectionPath([collection, coll['Collection']]);
                const sheet = book.Sheets[sheetName];            
                data[path] = dataFromSheet(sheet);
            });
            resolve(data);
            return;
        }

        // Import options exhausted
        reject(`Invalid collections`);
    });
}
