import * as admin from 'firebase-admin';
import * as fs from 'fs-extra';
import * as _ from 'lodash';

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
            return fs.writeJson(file, collections);
        })
        .then(() => {
            console.log('JSON file written. Download was a success!');
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
    return db.collection(path).get().then( async snaps => {
        for (let snap of snaps.docs) {
            let doc = { [snap.id]: snap.data() };

            // log if requested
            args.verbose && console.log(snap.ref.path);

            // process sub-collections
            if (args.subcolls) {
                const subCollPaths = await snap.ref.getCollections().then(colls => colls.map(coll => coll.path));
                if (subCollPaths.length) {
                    const subCollections = await getCollections(subCollPaths);
                    _.assign(doc[snap.id], subCollections);
                }
            }
            
            _.assign(collection, doc);
        }
    }).then(() =>{
        const collId = path.split('/').pop();
        const collPath = `${args.collPrefix}:${collId}`;
        return ({[collPath]: collection });
    });            
}   