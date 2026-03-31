# Data Usage Service Mock

## Building

### AI Guidance

- all code in a single `main.ts` typescript file
- use Deno
- use sqlite database
- use `jsr:@std/yaml` for yaml handling
- create database if it does not exist
- do not use any environment variables
- serve on port 8000
- put database at `./data/sqlite.db`
- always create two operations - one for getting a list of entities, the other to import a full replacement in yaml format

### Requirements

- Build an API for an "Activity" entity, where the entity has: subject, eventId, eventTimeStamp, message and context (context has key value pairs)
- Filter by "subject"
- Filter by "date" where values are: today, yesterday and this_month

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
