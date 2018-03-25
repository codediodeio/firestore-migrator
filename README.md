# CLI Tool for Converting JSON or CSV to Firestore Documents

Reads data as a CSV spreadsheet or JSON array, then adds it to the Firestore database. 

Status: WIP

- Clone and run `npm install`
- Download the service account from your Firebase project settings, then save it as `credentials.json` in the project root. 
- `npm run build` and you're off and running.

## Typical usage

Convert each row in a CSV/Excel spreadsheet to a document in the database. Firestore will generated an auto-id. 

`fire-migrate --src bunnies.csv --collection animals`

Optionally use a custom ID from the dataset. 

`fire-migrate -s lamps.json -c products --id sku` 

### Options

- `--src` (alias: -s): Required. The source file, path/to/posts.csv
- `--collection` (alias: -c): Required. The firestore collection path, users/jeffd23/posts
- `--id` (alias: -i): Optional. Pass a specified field for the doc ID (instead of an auto-id). 

### Data Format

Supports CSV and JSON arrays. Each row in the CSV should represent a document. 

#### CSV

Must have a header row. See test.csv

#### JSON

Must be a JSON array of objects. See test.json

```json
[  
   {  
      "id":11111,
      "first_name":"Breezy",

   },
   {  
      "id":22222,
      "first_name":"Wendy",

   }
]
```