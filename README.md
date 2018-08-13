# Fire Migrate

CLI tool for moving data in-n-out of [Cloud Firestore](https://firebase.google.com/docs/firestore/).

- Import a CSV, Excel, or JSON file to Firestore
- Export Firestore data to JSON

Watch the [screencast](https://angularfirebase.com/lessons/import-csv-json-or-excel-to-firestore/)

## Install

- Clone and run `npm install`
- Download the service account from your Firebase project settings, then save it as `credentials.json` in the project root. 
- `npm run build` and you're off and running.

## Import Data to Firestore

- Push your local data to the Firestore database.
- Omitting [collections...] will import all collections from source file.
- Properly encodes to Firestore data types such GeoPoint, Reference, Timestamp, etc.

```
import|i [options] <file> [collections...]
```

Options:
```
-i, --id [field]            Field to use for Document IDs (default: doc_id)
-a, --auto-id [str]         Document ID token specifying auto generated Document ID (default: Auto-ID)
-m, --merge                 Merge Firestore documents. Default is Replace.
-k, --chunk [size]          Split upload into batches. Max 500 by Firestore constraints. (default: 500)
-p, --coll-prefix [prefix]  (Sub-)Collection prefix (default: collection)

-d, --dry-run               Perform a dry run, without committing data. Implies --verbose.
-v, --verbose               Output document insert paths
-h, --help                  output usage information
```

Examples:
```
fire-migrate import --dry-run test.json myCollection
fire-migrate import --merge test.INDEX.csv myCollection
fire-migrate i -m --id docid test.xlsx
```

## Export Data from Firestore

- Pull data from Firestore to a JSON, CSV or XLSX file. 
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
fire-migrate export --verbose --no-subcolls myRootCollection.json myCollection
fire-migrate export users-posts.json users posts
fire-migrate e -s firestore-dump.json
```