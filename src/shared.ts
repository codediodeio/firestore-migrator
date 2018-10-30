import * as admin from 'firebase-admin';
import * as _ from 'lodash';
import { DocumentReference } from '@google-cloud/firestore';
import { isNull } from 'util';

const db = admin.firestore();



const toType = function(obj) {
    return ({}).toString.call(obj).match(/\s([a-zA-Z]+)/)[1].toLowerCase();
}

const arrayOrObject = function(test) {
    return ((test instanceof Array) || (toType(test) === 'object'));
}



export const cleanCollectionPath = (path:string | string[]): string => {
    if (typeof path === 'string') {
        const p = ('/' + path + '/').replace(/\/{2,}/,'/').split('/').filter(v=>!!v).join('/');
        return p || '/';
    } else {
        return cleanCollectionPath(path.join('/'));
    }
}

export const isCollectionPath = (path: string | string[]): boolean  => {
    const sections = cleanCollectionPath(path).split('/').length;
    return sections % 2 === 1;
}

export const isDocumentPath = (path: string | string[]): boolean => {
    const sections = cleanCollectionPath(path).split('/').length;
    return sections % 2 === 0;
}


// Field Handlers, en/decoders, etc

class FieldHandler {    

    constructor(protected prefix: string = 'prefix') {}


    public isDecodeType = (key: string, val, doc): boolean => {
        return false;
    };
    protected decodeFn = (key: string, val, doc) => {
        return val;
    };
    public decode = (key: string, val, doc) => {
        return JSON.stringify({ type: this.prefix, data: this.decodeFn(key, val, doc) });
    };


    public isEncodeType = (key: string, val, doc): boolean => {
        if (typeof val !== 'string') return false;
        return val.startsWith(`{"type":"${this.prefix}"`);
    };
    protected encodeFn = (key: string, val, doc) => {        
        const {type, data} = val;
        return data;
        
    };
    public encode = (key: string, val, doc) => {
        return this.encodeFn(key, JSON.parse(val), doc);
    }
}

class GeoPointFH extends FieldHandler {
    isDecodeType = (key: string, val, doc)  => {
        return (val instanceof admin.firestore.GeoPoint);
    };
    encodeFn = (key: string, val, doc) => {
        const {data} = val;
        return new admin.firestore.GeoPoint(data._latitude, data._longitude);
    }
}

class BooleanFH extends FieldHandler {
    isDecodeType = (key, val, doc) => {
        return (typeof val === 'boolean');
    };
    encodeFn = (key: string, val, doc) => {
        const {data} = val;                
        return data;
    };
}

class TimeStampFH extends FieldHandler {
    isDecodeType = (key, val, doc) => {
        return (val instanceof Date);
    };
    encodeFn = (key: string, val, doc) => {
        const {data} = val;
        return new Date(data);
    };    
}

class NumberFH extends FieldHandler {
    isDecodeType = (key, val, doc) => {
        return (typeof val === 'number');
    };

    public isEncodeType = (key: string, val, doc): boolean => {
        // simple numbers, or number-like strings
        if (+val === +val) return true;
        if (typeof val !== 'string') return false;
        return val.startsWith(`{"type":"${this.prefix}"`);
    };
    public encode = (key: string, val, doc) => {
        if (+val === +val) {
            return +val;
        }
        return this.encodeFn(key, JSON.parse(val), doc);
    }    
}

class ReferenceFH extends FieldHandler {
    isDecodeType = (key: string, val, doc)  => {
        return (val instanceof admin.firestore.DocumentReference);
    };
    decodeFn = (key: string, val:DocumentReference, doc) => {
        return val.path;
    };
    encodeFn = (key: string, val, doc) => {
        const {data} = val;
        return db.doc(data);
    }
}

class NullFH extends FieldHandler {
    isDecodeType = (key: string, val, doc)  => {
        return isNull(val);
    };
    decode = (key: string, val, doc) => {
        return JSON.stringify({ type: this.prefix });
    };    
    encode = (key: string, val, doc) => {       
        return null;
    }
}


class ArrayOrObjectFH extends FieldHandler {
    isDecodeType = (key: string, val, doc) => {
        return arrayOrObject(val);
    };
    decode = (key: string, val, doc) => {
        decodeDoc(val);
        return val;
    };
    isEncodeType = (key: string, val, doc): boolean => {
        return arrayOrObject(val);
    };
    encode = (key: string, val, doc) => {
        encodeDoc(val);
        return val;
    };
}

class TestFH extends FieldHandler {
    isDecodeType = (key, val, doc) => {
        if (['_a'].includes(key)) {
        // if (1) {
            console.log(`Test isDecode on ${key} = ${toType(val)}`);
            console.log('typeof', typeof val);
            console.log('instanceof', val instanceof Object);
            console.log('isNull', isNull(val));
            console.log('val', val);
        }
        return false;
    };
    isEncodeType = (key, val, doc) => {
        if (key==='o') {
            console.log(`Test isEncode on ${key} = ${toType(val)}`);
            console.log('typeof', typeof val);
            console.log('instanceof', val instanceof Object);
            console.log('val', val);
        }
        return false;
    }
}

//  decodeDoc() and encodeDoc() traverses specialFieldTypes[] in order of appearance for every field (and nested fields)
//  of every document of every collection, and uses only the first matched handler per field.
//  So list FieldHandlers by descending order of your typical field type use. But always keep ArrayOrObjectFH last, since matching 
//  objects is tricky and will result in a false positives if moved up the chain.
const specialFieldTypes: FieldHandler[] = [
    // new TestFH('test'),
    new GeoPointFH('geopoint'),
    new BooleanFH('bool'),
    new TimeStampFH('timestamp'),
    new NumberFH('number'),
    new ReferenceFH('ref'),
    new NullFH('null'),
    new ArrayOrObjectFH()       
];

// Decode from Firestore field
export function decodeDoc(doc) {
    _.forEach(doc, (fieldValue, fieldName) => {
        const fieldHandler = specialFieldTypes.find(fieldHandler => fieldHandler.isDecodeType(fieldName, fieldValue, doc));
        if (!fieldHandler) return;
        doc[fieldName] = fieldHandler.decode(fieldName, fieldValue, doc);
    });
}

// Encode to Firestore field
export function encodeDoc(doc) {
    _.forEach(doc, (fieldValue, fieldName) => {
        const fieldHandler = specialFieldTypes.find(fieldHandler => fieldHandler.isEncodeType(fieldName, fieldValue, doc));
        if (!fieldHandler) return;
        doc[fieldName] = fieldHandler.encode(fieldName, fieldValue, doc);
    });
}





// Sorting utils

export interface SortTuple {
    [key: string]: 'ASC' | 'DSC';
}

export function sortByKeysFn(keys: string | (string | SortTuple)[] ): (a:any, b:any) => number {
    const sortTuples: SortTuple[] = [];
    const dir = 'ASC';

    if (typeof keys === 'string') {
        sortTuples.push({ [keys]: dir });
    } else {
        _.forEach(keys, key => sortTuples.push( typeof key === 'string' ? {[key]: dir} : key ));
    }

    return (a, b) => {
        let sort = 0;
        for(let tuple of sortTuples) {
            if (sort !== 0) break;
            for(let key in tuple) {
                if (tuple[key] === 'ASC') {
                    sort= a[key] > b[key] ? 1
                        : a[key] < b[key] ? -1
                        : 0;
                } else {
                    sort= a[key] > b[key] ? -1
                        : a[key] < b[key] ? 1
                        : 0;
                }
            }
        }
        return sort;
    };
}