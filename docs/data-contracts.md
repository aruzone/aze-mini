# Data Contracts

The database's shapes are defined in the Prisma schema at `apps/aze-api/prisma/schema.prisma`, with the generated client output to `apps/aze-api/generated/prisma/`. The **wire's** shapes are a different thing and live in the two contract packages under `libs/` — see the Wire Contracts section below and ADR-0006. Nothing generated from the schema reaches the wire.

---

## Database Models

### User

```
NAME:     User
LOCATION: apps/aze-api/prisma/schema.prisma

FIELDS:
- id          String    required  UUID v7, primary key
- email       String    required  unique
- name        String    optional
- password    String    required  bcryptjs hash, written only by src/auth/password.ts
- createdAt   DateTime  required  auto-set on create
- updatedAt   DateTime  required  auto-updated
```

---

### ProductCategory

```
NAME:     ProductCategory
LOCATION: apps/aze-api/prisma/schema.prisma

FIELDS:
- id        Int       required  auto-increment, primary key
- name      String    required  unique
- products  Product[] optional  one-to-many relation (back-reference)
```

---

### Product

```
NAME:     Product
LOCATION: apps/aze-api/prisma/schema.prisma

FIELDS:
- id          String          required  UUID v7, primary key
- name        String          required
- description String          optional
- price       Float           required
- categoryId  Int             required  foreign key → ProductCategory.id
- category    ProductCategory required  relation
- reviews     Review[]        optional  one-to-many relation
- tags        Tag[]           optional  many-to-many relation
- createdAt   DateTime        required  auto-set on create
- updatedAt   DateTime        required  auto-updated
```

---

### Review

```
NAME:     Review
LOCATION: apps/aze-api/prisma/schema.prisma

FIELDS:
- id        String   required  UUID v7, primary key
- rating    Int      required
- comment   String   optional
- productId String   required  foreign key → Product.id
- product   Product  required  relation
- createdAt DateTime required  auto-set on create
```

---

### Tag

```
NAME:     Tag
LOCATION: apps/aze-api/prisma/schema.prisma

FIELDS:
- id       String    required  UUID v7, primary key
- name     String    required  unique
- products Product[] optional  many-to-many relation
```

---

## Wire Contracts

The shapes that cross between the API and the client. They are plain types
depending on nothing, split by tier so that removing the Demo is a delete rather
than an edit (ADR-0006). No endpoint binds a generated Prisma input type:
relations cross as flat ids and the service turns them into Prisma's nested
`connect`, so the generated types stop at the database layer.

Every Nest DTO under a feature's `dto/` declares `implements` against the request
contract below and adds the `class-validator` and OpenAPI decorators. A field
added to a contract and not to its DTO is a compile error.

Responses are declared the same way, pointed the other direction: a
`*.response.ts` class beside each controller carries the OpenAPI decorators and
declares `implements Wire<T>` against the contract the route answers with. It is
read through `Wire` because a document describes what a caller receives, and JSON
delivers a `Date` as a string. Nothing is generated from the Prisma models —
a schema derived from them would describe the rows rather than the responses
(ADR-0007). The classes are documentation: a controller still returns what its
service returned, and nothing is serialized through them.

### Platform — `@aze-mini/platform-contracts`

```
LOCATION: libs/platform-contracts/src/lib/

RegisterRequest    POST /auth/register body     email, password, name?
LoginRequest       POST /auth/login body        email, password
AuthResponse       what both auth routes answer userId, email, accessToken
UserProfile        GET /users/me                id, email, name, createdAt, updatedAt
HealthResponse     GET /                        message
ApiErrorResponse   every refusal, any status    statusCode, timestamp, path, message
Wire<T>            T as JSON delivers it        every Date becomes a string
```

`ApiErrorResponse.message` is a string for a single failure and an array of
strings for a field list — the validation pipe reports one entry per failing
field — so a caller reading it must accept both. `ApiExceptionFilter` is the one
place it is written.

`UserProfile` has no password field, in the type as in the response.

### Demo — `@aze-mini/demo-contracts`

```
LOCATION: libs/demo-contracts/src/lib/

Product                        id, name, description, price, categoryId, createdAt, updatedAt
CreateProductRequest           name, description?, price, categoryId, tagIds?
UpdateProductRequest           Partial<CreateProductRequest>
ProductSort                    'asc' | 'desc' — the order GET /products reads in

ProductCategory                id, name
CreateProductCategoryRequest   name
UpdateProductCategoryRequest   Partial<CreateProductCategoryRequest>

Review                         id, rating, comment, productId, createdAt
CreateReviewRequest            rating, comment?, productId
UpdateReviewRequest            Partial<CreateReviewRequest>

Tag                            id, name
CreateTagRequest               name, productIds?
UpdateTagRequest               Partial<CreateTagRequest>
```

---

## Internal Runtime Structures

Not contracts — these never cross the wire and are not in either package.

### TokenClaims / AuthenticatedUser

```
LOCATION: apps/aze-api/src/auth/token-claims.ts

TokenClaims        what login signs into a JWT     sub (userId), email
AuthenticatedUser  what AuthGuard attaches to req  userId, email
```

### SignInData

```
LOCATION: apps/aze-api/src/auth/auth.service.ts

What login signs a token from, before there is a token: userId, email
```

### NewUser

```
LOCATION: apps/aze-api/src/users/users.service.ts

What AuthService.register hands the users service: email, name?, password
(already hashed — registration is the only caller)
```

### CachedRead

```
LOCATION: apps/aze-api/src/product/products/product-cache.ts

value  T        what the read returned
hit    boolean  whether it came from Redis; becomes the X-Cache header
```
