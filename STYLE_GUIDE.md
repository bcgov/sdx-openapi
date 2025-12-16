# OpenAPI Style Guide

This is the description for the document.  

## Well-formedness rules

This is the description for the section.  

---

### duplicated-entry-in-enum
#### Severity: <span style="color:red">ERROR</span>

Each value of an enum must be different from one another.

**Valid example:**
```yaml
components:
  schemas:
    Status:
      type: string
      enum: [active, inactive, pending]
```

**Invalid example:**
```yaml
components:
  schemas:
    Status:
      type: string
      enum: [active, inactive, active]
```

---

### no-$ref-siblings
#### Severity: <span style="color:red">ERROR</span>

$ref siblings are ignored before 3.1.0

**Valid example:**
```yaml
components:
  schemas:
    User:
      $ref: '#/components/schemas/UserRef'
```

**Invalid example:**
```yaml
components:
  schemas:
    User:
      $ref: '#/components/schemas/UserRef'
      type: object
```

---

### operation-operationId-unique
#### Severity: <span style="color:red">ERROR</span>

Every operation must have a unique operationId.

**Valid example:**
```yaml
paths:
  /users:
    get:
      operationId: listUsers
  /admins:
    get:
      operationId: listAdmins
```

**Invalid example:**
```yaml
paths:
  /users:
    get:
      operationId: listUsers
  /admins:
    get:
      operationId: listUsers
```

---

### operation-operationId-valid-in-url
#### Severity: <span style="color:red">ERROR</span>

Operation ID must avoid non-URL-safe characters

**Valid example:**
```yaml
paths:
  /users:
    get:
      operationId: listUsers_v2
```

**Invalid example (space):**
```yaml
paths:
  /users:
    get:
      operationId: list Users
```

**Invalid example (bracket):**
```yaml
paths:
  /users:
    get:
      operationId: list<Users
```

---

### operation-parameters
#### Severity: <span style="color:red">ERROR</span>

Operation parameters are unique and non-repeating
1. Operation must have unique name + in parameters.
2. Operation cannot have both in: body and in: formData parameters. (OpenAPI v2.0)
3. Operation must have only one in: body parameter. (OpenAPI v2.0)

**Valid example:**
```yaml
paths:
  /users/{id}:
    get:
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
```

**Invalid example (duplicate):**
```yaml
paths:
  /users:
    get:
      parameters:
        - name: page
          in: query
        - name: page
          in: query
```

**Invalid example (body and formdata in oas2):**
```yaml
swagger: '2.0'
paths:
  /users:
    post:
      parameters:
        - name: payload
          in: body
          schema:
            type: object
        - name: file
          in: formData
          type: file
```

---

### path-declarations-must-exist
#### Severity: <span style="color:red">ERROR</span>

Path parameter declarations cannot be empty, ex./given/{} is invalid.

**Valid example:**
```yaml
paths:
  /users/{userId}:
    get:
      operationId: getUser
```

**Invalid example:**
```yaml
paths:
  /users/{}:
    get:
      operationId: getUser
```

---

### path-not-include-query
#### Severity: <span style="color:red">ERROR</span>

Don't put query string items in the path, they belong in parameters.

**Valid example:**
```yaml
paths:
  /users:
    get:
      parameters:
        - name: active
          in: query
          schema:
            type: boolean
```

**Invalid example:**
```yaml
paths:
  /users?active=true:
    get:
      operationId: listActiveUsers
```

---

### path-params
#### Severity: <span style="color:red">ERROR</span>

Path parameters are correct and valid.
1. For every parameter referenced in the path string (i.e: /users/{userId}), the parameter must be defined in either path.parameters,
   or operation.parameters objects (non-standard HTTP operations will be silently ignored.)
2. Every path.parameters and operation.parameters parameter must be used in the path string.

**Valid example:**
```yaml
paths:
  /users/{userId}:
    parameters:
      - name: userId
        in: path
        required: true
        schema:
          type: string
    get:
      operationId: getUser
```

**Invalid example (not defined):**
```yaml
paths:
  /users/{userId}:
    get:
      operationId: getUser
```

**Invalid example (not used):**
```yaml
paths:
  /users:
    parameters:
      - name: userId
        in: path
        required: true
        schema:
          type: string
    get:
      operationId: getUser
```

---

### typed-enum
#### Severity: <span style="color:red">ERROR</span>

Enum values should respect the type specifier.

**Valid example:**
```yaml
components:
  schemas:
    Size:
      type: string
      enum: [small, medium, large]
```

**Invalid example:**
```yaml
components:
  schemas:
    Code:
      type: string
      enum: [200, 404, 500]
```

---

### oas2-anyOf
#### Severity: <span style="color:red">ERROR</span>

OpenAPI v3 keyword anyOf detected in OpenAPI v2 document.

**Valid example:**
```yaml
swagger: '2.0'
info:
  title: API
  version: 1.0.0
```

**Invalid example:**
```yaml
swagger: '2.0'
components:
  schemas:
    Pet:
      anyOf:
        - $ref: '#/components/schemas/Cat'
```

---

### oas2-oneOf
#### Severity: <span style="color:red">ERROR</span>

OpenAPI v3 keyword oneOf detected in OpenAPI v2 document.

**Valid example:**
```yaml
swagger: '2.0'
info:
  title: API
  version: 1.0.0
```

**Invalid example:**
```yaml
swagger: '2.0'
components:
  schemas:
    Response:
      oneOf:
        - $ref: '#/components/schemas/Success'
```

---

### oas2-schema
#### Severity: <span style="color:red">ERROR</span>

Validate structure of OpenAPI v2 specification.

**Valid example:**
```yaml
swagger: '2.0'
info:
  title: Test
  version: '1.0'
paths: {}
```

**Invalid example:**
```yaml
swagger: '2.0'
info:
  version: '1.0'
paths: {}
```

---

### oas3-examples-value-or-externalValue
#### Severity: <span style="color:red">ERROR</span>

Examples for requestBody or response examples can have an externalValue or a value, but they cannot have both.

**Valid example:**
```yaml
components:
  responses:
    UserResponse:
      content:
        application/json:
          example:
            value:
              id: 123
```

**Invalid example:**
```yaml
components:
  responses:
    UserResponse:
      content:
        application/json:
          example:
            value:
              id: 123
            externalValue: 'https://example.com/example.json'
```

---

### oas3-operation-security-defined
#### Severity: <span style="color:red">ERROR</span>

Operation security values must match a scheme defined in the components.securitySchemes object.

**Valid example:**
```yaml
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
paths:
  /admin:
    get:
      security:
        - bearerAuth: []
```

**Invalid example:**
```yaml
components:
  securitySchemes:
    apiKey:
      type: apiKey
paths:
  /admin:
    get:
      security:
        - bearerAuth: []
```

---

### oas3-schema
#### Severity: <span style="color:red">ERROR</span>

Validate structure of OpenAPI v3 specification.

**Valid example:**
```yaml
openapi: 3.0.3
info:
  title: Test API
  version: 1.0.0
paths: {}
```

**Invalid example:**
```yaml
openapi: 3.0.3
info:
  version: 1.0.0
paths: {}
```

---

## Required Content


---

## Recommended Content


---

### info-description
#### Severity: <span style="color:goldenrod">WARN</span>

OpenAPI object info description must be present and non-empty string.

**Valid example:**
```yaml
info:
  title: My API
  description: A description of my API
  version: 1.0.0
```

**Invalid example:**
```yaml
info:
  title: My API
  version: 1.0.0
```

**Invalid example (empty):**
```yaml
info:
  title: My API
  description: ""
  version: 1.0.0
```

---

### no-eval-in-markdown
#### Severity: <span style="color:goldenrod">WARN</span>

No injecting eval() JavaScript statements

**Valid example:**
```yaml
info:
  description: Safe text.
```

**Invalid example:**
```yaml
info:
  description: "Use eval(`dangerous`)."
```

---

### no-script-tags-in-markdown
#### Severity: <span style="color:goldenrod">WARN</span>

No injecting script tags

**Valid example:**
```yaml
info:
  description: Regular text.
```

**Invalid example:**
```yaml
info:
  description: <script>alert()</script>
```

---

### openapi-tags-alphabetical
#### Severity: <span style="color:goldenrod">WARN</span>

OpenAPI object should have alphabetical tags.

**Valid example:**
```yaml
tags:
  - name: admins
  - name: users
```

**Invalid example:**
```yaml
tags:
  - name: users
  - name: admins
```

---

### openapi-tags-uniqueness
#### Severity: <span style="color:goldenrod">WARN</span>

OpenAPI object must not have duplicated tag names (identifiers).

**Valid example:**
```yaml
tags:
  - name: users
  - name: admins
```

**Invalid example:**
```yaml
tags:
  - name: users
  - name: users
```

---

### operation-description
#### Severity: <span style="color:goldenrod">WARN</span>

Operation must have a description

**Valid example:**
```yaml
paths:
  /users:
    get:
      description: List all users
```

**Invalid example:**
```yaml
paths:
  /users:
    get:
      summary: List users
```

**Invalid example (empty):**
```yaml
paths:
  /users:
    get:
      description: ""
```

---

### operation-operationId
#### Severity: <span style="color:goldenrod">WARN</span>

Operation must have an operationId

**Valid example:**
```yaml
paths:
  /users:
    get:
      operationId: listUsers
```

**Invalid example:**
```yaml
paths:
  /users:
    get:
      summary: List users
```

---

### operation-success-response
#### Severity: <span style="color:goldenrod">WARN</span>

Operation must have at least one 2xx or 3xx response.

**Valid example:**
```yaml
paths:
  /users:
    get:
      responses:
        '200':
          description: OK
```

**Invalid example:**
```yaml
paths:
  /users:
    get:
      responses:
        '400':
          description: Bad Request
```

---

### path-keys-no-trailing-slash
#### Severity: <span style="color:goldenrod">WARN</span>

Keep trailing slashes off of paths, as it can causes ambiguity.

**Valid example:**
```yaml
paths:
  /users:
    get:
      operationId: listUsers
```

**Invalid example:**
```yaml
paths:
  /users/:
    get:
      operationId: listUsers
```

---

### array-items
#### Severity: <span style="color:goldenrod">WARN</span>

Schemas with type: array, require a sibling items field.

**Valid example:**
```yaml
components:
  schemas:
    UserList:
      type: array
      items:
        type: string
```

**Invalid example:**
```yaml
components:
  schemas:
    UserList:
      type: array
```

---

### oas2-api-host
#### Severity: <span style="color:goldenrod">WARN</span>

OpenAPI host must be present and non-empty string.

**Valid example:**
```yaml
swagger: '2.0'
host: example.com
```

**Invalid example (missing):**
```yaml
swagger: '2.0'
```

**Invalid example (empty):**
```yaml
swagger: '2.0'
host: ""
```

---

### oas2-api-schemes
#### Severity: <span style="color:goldenrod">WARN</span>

OpenAPI host schemes must be present and non-empty array.

**Valid example:**
```yaml
swagger: '2.0'
schemes:
  - https
```

**Invalid example (missing):**
```yaml
swagger: '2.0'
```

**Invalid example (empty):**
```yaml
swagger: '2.0'
schemes: []
```

---

### oas2-discriminator
#### Severity: <span style="color:goldenrod">WARN</span>

The discriminator property MUST be defined at this schema and it MUST be in the required property list.

**Valid example:**
```yaml
swagger: '2.0'
definitions:
  Pet:
    discriminator: petType
    properties:
      petType:
        type: string
    required:
      - petType
```

**Invalid example:**
```yaml
swagger: '2.0'
definitions:
  Pet:
    discriminator: petType
    properties:
      petType:
        type: string
```

---

### oas2-host-not-example
#### Severity: <span style="color:goldenrod">WARN</span>

Server URL should not point to example.com.

**Valid example:**
```yaml
swagger: '2.0'
host: api.com
```

**Invalid example:**
```yaml
swagger: '2.0'
host: example.com
```

---

### oas2-host-trailing-slash
#### Severity: <span style="color:goldenrod">WARN</span>

Server URL should not have a trailing slash.

**Valid example:**
```yaml
swagger: '2.0'
host: api.com
```

**Invalid example:**
```yaml
swagger: '2.0'
host: api.com/
```

---

### oas2-operation-formData-consume-check
#### Severity: <span style="color:goldenrod">WARN</span>

Operations with an in: formData parameter must include application/x-www-form-urlencoded or multipart/form-data in their consumes property.

**Valid example:**
```yaml
swagger: '2.0'
paths:
  /upload:
    post:
      consumes:
        - multipart/form-data
      parameters:
        - name: file
          in: formData
          type: file
```

**Invalid example:**
```yaml
swagger: '2.0'
paths:
  /upload:
    post:
      parameters:
        - name: file
          in: formData
          type: file
```

---

### oas2-operation-security-defined
#### Severity: <span style="color:goldenrod">WARN</span>

Operation security values must match a scheme defined in the securityDefinitions object.

**Valid example:**
```yaml
swagger: '2.0'
securityDefinitions:
  bearerAuth:
    type: basic
paths:
  /admin:
    get:
      security:
        - bearerAuth: []
```

**Invalid example:**
```yaml
swagger: '2.0'
securityDefinitions:
  apiKey:
    type: apiKey
paths:
  /admin:
    get:
      security:
        - bearerAuth: []
```

---

### oas2-unused-definition
#### Severity: <span style="color:goldenrod">WARN</span>

Potential unused reusable definition entry has been detected.

**Valid example:**
```yaml
swagger: '2.0'
definitions:
  User:
    type: object
paths:
  /users:
    get:
      responses:
        '200':
          schema:
            $ref: '#/definitions/User'
```

**Invalid example:**
```yaml
swagger: '2.0'
definitions:
  User:
    type: object
```

---

### oas2-valid-media-example
#### Severity: <span style="color:goldenrod">WARN</span>

Examples must be valid against their defined schema.  This rule is applied to Media Type objects.
Common reasons you may see errors are:
The value used for property examples is not the same type indicated in the schema (string vs. integer, for example).
Examples contain properties not included in the schema.

**Valid example:**
```yaml
swagger: '2.0'
paths:
  /users:
    get:
      produces:
        - application/json
      responses:
        '200':
          schema:
            type: object
            properties:
              id:
                type: integer
          examples:
            application/json:
              id: 1
```

**Invalid example:**
```yaml
swagger: '2.0'
paths:
  /users:
    get:
      produces:
        - application/json
      responses:
        '200':
          schema:
            type: object
            properties:
              id:
                type: integer
          examples:
            application/json:
              id: "one"
```

---

### oas2-valid-schema-example
#### Severity: <span style="color:goldenrod">WARN</span>

Examples must be valid against their defined schema. This rule is applied to Schema objects.

**Valid example:**
```yaml
swagger: '2.0'
definitions:
  User:
    type: object
    properties:
      id:
        type: integer
    example:
      id: 1
```

**Invalid example:**
```yaml
swagger: '2.0'
definitions:
  User:
    type: object
    properties:
      id:
        type: integer
    example:
      id: "one"
```

---

### oas3-callbacks-in-callbacks
#### Severity: <span style="color:goldenrod">WARN</span>

A callback should not be defined within another callback.

**Valid example:**
```yaml
openapi: 3.0.0
paths:
  /webhook:
    post:
      callbacks:
        onData:
          '{$request.body#/callbackUrl}':
            post:
              responses:
                '200':
                  description: OK
```

**Invalid example:**
```yaml
openapi: 3.0.0
paths:
  /webhook:
    post:
      callbacks:
        onData:
          '{$request.body#/callbackUrl}':
            post:
              callbacks:
                nested:
                  '{$request.body#/nestedUrl}':
                    post:
                      responses:
                        '200':
                          description: OK
```

---

### oas3-server-trailing-slash
#### Severity: <span style="color:goldenrod">WARN</span>

Server URL should not have a trailing slash.

**Valid example:**
```yaml
openapi: 3.0.0
servers:
  - url: https://api.com
```

**Invalid example:**
```yaml
openapi: 3.0.0
servers:
  - url: https://api.com/
```

---

### oas3-server-variables
#### Severity: <span style="color:goldenrod">WARN</span>

This rule ensures that server variables defined in OpenAPI Specification 3 (OAS3) and 3.1 are valid, not unused, and result in a valid URL.

**Valid example:**
```yaml
openapi: 3.0.0
servers:
  - url: https://{subdomain}.api.com
    variables:
      subdomain:
        default: demo
```

**Invalid example (unused variable):**
```yaml
openapi: 3.0.0
servers:
  - url: https://api.com
    variables:
      subdomain:
        default: demo
```

---

### oas3-unused-component
#### Severity: <span style="color:goldenrod">WARN</span>

Potential unused reusable components entry has been detected.

**Valid example:**
```yaml
openapi: 3.0.0
components:
  schemas:
    User:
      type: object
paths:
  /users:
    get:
      responses:
        '200':
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'
```

**Invalid example:**
```yaml
openapi: 3.0.0
components:
  schemas:
    User:
      type: object
```

---

### oas3-valid-media-example
#### Severity: <span style="color:goldenrod">WARN</span>

Examples must be valid against their defined schema. This rule is applied to Media Type objects.

**Valid example:**
```yaml
openapi: 3.0.0
paths:
  /users:
    get:
      responses:
        '200':
          content:
            application/json:
              schema:
                type: object
                properties:
                  id:
                    type: integer
              example:
                id: 1
```

**Invalid example:**
```yaml
openapi: 3.0.0
paths:
  /users:
    get:
      responses:
        '200':
          content:
            application/json:
              schema:
                type: object
                properties:
                  id:
                    type: integer
              example:
                id: "one"
```

---

### oas3-valid-schema-example
#### Severity: <span style="color:goldenrod">WARN</span>

Examples must be valid against their defined schema. This rule is applied to Schema objects.

**Valid example:**
```yaml
openapi: 3.0.0
components:
  schemas:
    User:
      type: object
      properties:
        id:
          type: integer
      example:
        id: 1
```

**Invalid example:**
```yaml
openapi: 3.0.0
components:
  schemas:
    User:
      type: object
      properties:
        id:
          type: integer
      example:
        id: "one"
```

---

## Optional Content


---

### contact-properties
#### Severity: OFF

A contact object is required, including name, url, and email.

---

### info-contact
#### Severity: OFF

Info object should contain contact object.

---

### info-license
#### Severity: OFF

The info object should have a license key.

---

### license-url
#### Severity: OFF

Mentioning a license is only useful if people know what the license means, so add a link to the full text for those who need it.

---

### openapi-tags
#### Severity: OFF

OpenAPI object should have non-empty tags array.

---

### operation-singular-tag
#### Severity: OFF

Use just one tag for an operation

---

### operation-tag-defined
#### Severity: OFF

Operation should have non-empty tags array.

---

### operation-tags
#### Severity: OFF

Operation tags should be defined in global tags.

---

### tag-description
#### Severity: OFF

A tag should have a description.

---

### oas2-parameter-description
#### Severity: OFF

Parameter objects should have a description.

---

### oas3-api-servers
#### Severity: OFF

OpenAPI servers must be present and non-empty array.

---

### oas3-parameter-description
#### Severity: OFF

Parameter objects should have a description.

---

