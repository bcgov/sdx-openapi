# Data Usage Service Mock

## Building

### AI Prompt

- only look for files in current directory
- all code must be in a single `main.ts` typescript file
- use Deno
- use sqlite database
- use `jsr:@std/yaml` for yaml handling
- create database if it does not exist
- do not use any environment variables
- serve on port 8000
- put database at `./data/sqlite.db`
- use the `openapi.yaml` OpenAPI spec for details about the operations and the entity
- build the API rest endpoints, and the corresponding interaction with the database
- only look at the files: openapi.yaml and main.ts (if it exists)

## Deployment

```sh
helm upgrade --install data-usage-mock \
 --set fullnameOverride=data-usage-mock \
 -f chart.yaml \
 --set-file "config[0].contents=main.ts" \
bcgov/generic-api
```

## Importing data

```sh
curl -v http://localhost:8000/activities \
  -X PUT --data-binary @data/import.yaml
```
