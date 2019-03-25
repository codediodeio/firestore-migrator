# Fire Migrate

👀 Firestore now has an [official import/export process](https://firebase.google.com/docs/firestore/manage-data/export-import). Consider that your first option if it suits your needs. If it does not, continue reading...

CLI tool for moving data in-n-out of [Cloud Firestore](https://firebase.google.com/docs/firestore/).

- Import/Export CSV, Excel, or JSON files to/from Firestore.
- Encode/Decode Firestore data types such as GeoPoint, Reference, Timestamp, etc.

Watch the [screencast](https://angularfirebase.com/lessons/import-csv-json-or-excel-to-firestore/)

## Install

- Clone and run `npm install`
- Download the service account from your Firebase project settings, then save it as `credentials.json` in the project root. 
- `npm run build` and you're off and running.

## Import Data to Firestore

- Push your local data to the Firestore database.
- Selectively import [collections...] from source file to Firestore.
- Omitting [collections...], or specifying root "/" will import all collections.

```
import|i [options] <file> [collections...]
```

Options:
```
-i, --id [field]            Field to use for Document IDs. (default: doc_id)
-a, --auto-id [str]         Document ID token specifying auto generated Document ID. (default: Auto-ID)
-m, --merge                 Merge Firestore documents. Default is Replace.
-k, --chunk [size]          Split upload into batches. Max 500 by Firestore constraints. (default: 500)
-p, --coll-prefix [prefix]  (Sub-)Collection prefix. (default: collection)
                            
-s, --sheet [#]             Single mode XLSX Sheet # to import.
                            
-T, --truncate              Delete all documents from target collections before import.
                            
-d, --dry-run               Perform a dry run, without committing data. Implies --verbose.
-v, --verbose               Output document insert paths
-h, --help                  output usage information
```

Examples:
```
fire-migrate import --dry-run test.json myCollection
fire-migrate import --merge test.INDEX.csv myCollection
fire-migrate i -m --id docid test.xlsx myCollection
```

## Export Data from Firestore

- Pull data from Firestore to a JSON, CSV or XLSX file.
- Selectively export [collections...], or entire database with root "/".
- Exports Sub-Collections by default, optionally disabled.
- Splits CSV/XLSX collections into separate files/sheets with an INDEX.

```
export|e [options] <file> [collections...]
```

Options:
```

-n, --no-subcolls           Do not export sub-collections.
-p, --coll-prefix [prefix]  Collection prefix (default: collection)
-i, --id-field [id]         Field name to use for document IDs (default: doc_id)

-v, --verbose               Output traversed document paths
-h, --help                  output usage information
```

Examples:
```
fire-migrate export --verbose --no-subcolls myCollectionRootLevel.json myCollection
fire-migrate export users-posts.json users posts
fire-migrate e -v firestore-dump.xlsx
```
