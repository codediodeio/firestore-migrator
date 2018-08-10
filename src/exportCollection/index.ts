import * as admin from 'firebase-admin';
import * as fs from 'fs-extra';
import * as _ from 'lodash';
import * as XLSX from 'xlsx';
import * as shortid from 'shortid';
import * as dot from 'dot-object';

const db = admin.firestore();
let args;

export const execute = async (file: string, collectionPaths: string[], options) => {    
    args = options;
    let json = {};

    // If no collection arguments, select all root collections
    if (collectionPaths.length === 0) {
        console.log('Fetching root collections...');
        collectionPaths = await db.getCollections().then(colls => colls.map(coll => coll.path));    
    }

    // Get selected collections
    getCollections(collectionPaths)
        .then(collections => {

            if (file.endsWith('.xlsx')) {
                console.log('Writing to Excel:', file);

                const book = json2book(collections);
                XLSX.writeFile(book, file);

            } else if (file.endsWith('.csv')) {
                console.log('Writing to CSV:', file);

                const book = json2book(collections); 
                bookWriteCSV(book, file);

            } else {                
                console.log('Writing to JSON:', file);

                return fs.writeJson(file, collections);
            }
        })
        .then(() => {
            console.log('Download was a success!');
        })
        .catch(err => {
            console.log('Failure: ', err);
        });

}

function getCollections(paths): Promise<any> {
    return new Promise(async (resolve, reject) =>{
        let collections = {};

        // A heavily nested sub-collection-tree will cause a parallel promise explosion,
        // so we rather request them sequentially. Might be worth allowing parallel
        // recursion upon user request, for smaller trees and faster execution.
        for (const path of paths) {
            const collection = await getCollection(path);
            _.assign(collections, collection);
        }

        resolve(collections);
    });    
} 

function getCollection(path): Promise<any> {
    let collection = {};
    const labelFieldTypes = {
        'geopoint' : admin.firestore.GeoPoint
    };

    return db.collection(path).get().then( async snaps => {
        for (let snap of snaps.docs) {
            let doc = { [snap.id]: snap.data() };

            // log if requested
            args.verbose && console.log(snap.ref.path);

            // label special field types
            const relabelFields = {};
            _.forEach(doc[snap.id], (fieldValue, fieldName) => _.forEach(labelFieldTypes, (fieldType, fieldLabel) => {
                if (fieldValue instanceof fieldType) {
                    relabelFields[fieldName] = fieldLabel;
                }
            }));            
            _.forEach(relabelFields, (prefix, oldFieldName) => {
                const newFieldName = `${prefix}:${oldFieldName}`;
                doc[snap.id][newFieldName] = doc[snap.id][oldFieldName];
                delete(doc[snap.id][oldFieldName]);
            });

            // process sub-collections
            if (args.subcolls) {
                const subCollPaths = await snap.ref.getCollections().then(colls => colls.map(coll => coll.path));
                if (subCollPaths.length) {
                    const subCollections = await getCollections(subCollPaths);
                    _.assign(doc[snap.id], subCollections);
                }
            }
            
            // doc to collection
            _.assign(collection, doc);
        }
    }).then(() =>{
        const collId = path.split('/').pop();
        const collPath = `${args.collPrefix}:${collId}`;
        return ({[collPath]: collection });
    });            
}   

function bookWriteCSV(book: XLSX.WorkBook, file: string) {
    const fileParts = file.split('.');
    const indexSheet = book.Sheets['INDEX'];
    const indexJson = XLSX.utils.sheet_to_json(indexSheet);

    // If only one collection, write single file
    const single = book.SheetNames.length === 2;
    if (single) {
        const sheet = book.Sheets[indexJson[0]['Sheet Name']];
        XLSX.writeFile(book, file, { bookType: 'csv' });
        return;
    }
    // Otherwise write an index file and csv per collection
    
    // write index file
    const filename = [...fileParts];
    filename.splice(-1, 0, 'INDEX');
    XLSX.writeFile(book, filename.join('.'), { bookType: 'csv', sheet: 'INDEX' });
    
    // write collection files
    indexJson.forEach(index => {
        const sheetName = index['Sheet Name'];
        const sheet = book.Sheets[sheetName];
        const filename = [...fileParts];
        filename.splice(-1, 0, sheetName );
        XLSX.writeFile(book, filename.join('.'), { bookType: 'csv', sheet: sheetName });
    });
}

function json2book(json): XLSX.WorkBook {
    let book = XLSX.utils.book_new();
    const collPrefixSliceLength = (<string>args.collPrefix).length + 1;
    const collectionIndex = [];

    book.Props = {
        ...book.Props,
        Title: 'FireStore Export',
        Author: 'firestore-migrator',
        CreatedDate: new Date()
    }

    const addCollection = (coll, path:string) => {
        const sheetName = shortid.generate();
        const docs = [];

        // Turn key'd document objects into an array of flat documents objects, each with a document id
        _.forEach(coll, (doc, id:string) => {
            // process any sub-collections
            const subCollFields = Object.keys(doc).filter(key => key.startsWith(args.collPrefix+':'));
            subCollFields.forEach(name => {
                addCollection(doc[name], [path, id, name.slice(collPrefixSliceLength)].join(args.separator));
                delete(doc[name]);
            });

            // flatten objects
            const flatDoc = dot.dot(doc);

            docs.push({ [args.idField]: id, ...flatDoc });
        });

        // add collection sheet to book
        const sheet = XLSX.utils.json_to_sheet(docs);
        XLSX.utils.book_append_sheet(book, sheet, sheetName);
    
        // add an index entry
        collectionIndex.push({
            sheetName,
            path,
            depth: path.split(args.separator).length
        });

    };

    // process collections
    _.forEach(json, (coll, key) => {
        addCollection(coll, key.slice(collPrefixSliceLength));
    });

    // index sheet
    const indexSheet = XLSX.utils.aoa_to_sheet([
        ['Sheet Name', 'Path', 'Depth', 'Link']
    ]);
    const f1 = 'depth';
    const f2 = 'path';
    collectionIndex.sort((a, b) => {
        return a[f1] > b[f1] ? 1
            : a[f1] < b[f1] ? -1
            : a[f2] > b[f2] ? 1
            : a[f2] < b[f2] ? -1
            : 0;
    });
    collectionIndex.forEach((coll, index) => {
        const n = index + 2;
        indexSheet['!ref'] = `A1:D${n}`;
        indexSheet[`A${n}`] = { t: 's', v: coll.sheetName };
        indexSheet[`B${n}`] = { t: 's', v: coll.path };
        indexSheet[`C${n}`] = { t: 'n', v: +coll.depth };
        indexSheet[`D${n}`] = { t: 's', v: 'link', l: { Target: `#${coll.sheetName}!A1` }};
    });    
    XLSX.utils.book_append_sheet(book, indexSheet, 'INDEX');

    
    return book;
}