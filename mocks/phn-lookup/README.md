# PHN Lookup Mock

## Building

### AI Prompt

- only look for files in the /mocks directory
- follow the example structure provided by /mocks/data-usage-service
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
- include sample data in the data/import.yaml file

## Deployment

```sh
helm upgrade --install phn-lookup-mock \
 --set fullnameOverride=phn-lookup-mock \
 -f chart.yaml \
 --set-file "config[0].contents=main.ts" \
bcgov/generic-api
```

## Testing the API

## Requirements

- [deno](https://docs.deno.com/runtime/getting_started/installation/)

### Running the API

```sh
deno run --allow-net --allow-read --allow-write main.ts
```

### Importing data

```sh
curl -s http://localhost:8000/patient \
  -X PUT --data-binary @data/import.yaml
```

### GET calls

```sh
curl -s "http://localhost:8000/patient?hdid=P6FFO433A5WPMVTGM7T4ZVWBKCSVNAYGTWTU3J2LWMGUMERKI72A"
```

```sh
PAYLOAD=$(printf '{"sub":"P6FFO433A5WPMVTGM7T4ZVWBKCSVNAYGTWTU3J2LWMGUMERKI72A"}' | base64 | tr -d '=' | tr '+/' '-_' | tr -d '\n')
curl -s -H "Authorization: Bearer header.${PAYLOAD}.sig" http://localhost:8000/patient
```
