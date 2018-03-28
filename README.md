# CSV/Excel to Firestore

CLI tool that reads a CSV/Excel spreadsheet or JSON array, then adds each row/item to the Cloud Firestore database. 

Watch the [screencast](https://angularfirebase.com/lessons/import-csv-json-or-excel-to-firestore/)


- Clone and run `npm install`
- Download the service account from your Firebase project settings, then save it as `credentials.json` in the project root. 
- `npm run build` and you're off and running.

## Typical usage

```
# fire-migrate <file-path> <firestore-collection-path>
fire-migrate bunnies.csv animals
```

Optionally use a custom ID from the dataset and/or pass custom XLSX options. 

```
fire-migrate lamps.xlsx products --id sku --sheet 2
``` 

### Options

```
-V, --version            output the version number
-i, --id [id]            Field to use for document ID
-c, --col-oriented       XLSX column orientation. Defaults is row orientation
-o, --omit-empty-fields  XLSX omit empty fields
-s, --sheet [#]          XLSX Sheet # to import (default: 1)
-h, --help               output usage information. 
```

### Data Format

Supports CSV, XLSX, and JSON arrays. See the test files for examples. 