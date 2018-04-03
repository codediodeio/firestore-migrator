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

Push your local data to the Firestore database. 

```
import|i [options] <file> <collection>
```

Options:
```
-i, --id [field]            Field to use for document ID
-m, --merge                 Merge Firestore documents. Default is replace.
-k, --chunk [size]          Split upload into batches. Max 500 by Firestore constraints. (default: 500)
-p, --coll-prefix [prefix]  (Sub-)Collection prefix (default: collection)

-c, --col-oriented          XLSX column orientation. Default is row orientation
-o, --omit-empty-fields     XLSX omit empty fields
-s, --sheet [#]             XLSX Sheet # to import (default: 1)

-d, --dry-run               Perform a dry run, without committing data. Implies --verbose.
-v, --verbose               Output document insert paths
-h, --help                  output usage information
```

Examples:
```
fire-migrate import --dry-run test.json myCollection
fire-migrate import --merge test.csv myCollection
fire-migrate i -m --id docid --sheet 3 test.xlsx myCollection
```

## Export Data from Firestore

Pull data from Firestore to a JSON file. 

```
export|e [options] <file> [collections...]
```

Options:
```
-s, --subcolls              Include sub-collections.
-p, --coll-prefix [prefix]  Collection prefix (default: collection)
-v, --verbose               Output traversed document paths
-h, --help                  output usage information
```

Examples:
```
fire-migrate export --verbose --subcolls myCollection.json myCollection
fire-migrate export users-posts.json users posts
fire-migrate e -sv firestore-dump.json
```