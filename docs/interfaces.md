# Interfaces

All backend routes are served under the global prefix `/api` at `http://localhost:3030`.

Guard legend:
- **[open]** — no authentication required
- **[API-Key]** — requires `x-api-key` header
- **[JWT]** — requires `Authorization: Bearer <token>`
- **[API-Key + JWT]** — requires both

---

## Backend API Endpoints

### Health

```
TYPE:     API
NAME:     Health check
LOCATION: apps/aze-api/src/app/app.controller.ts:8
PURPOSE:  Returns API health status message
INPUT:    none
OUTPUT:   { message: string }
GUARD:    [open]
```

---

### Auth

```
TYPE:     API
NAME:     Login
LOCATION: apps/aze-api/src/auth/auth.controller.ts:10
PURPOSE:  Authenticates user credentials and returns a JWT access token
INPUT:    POST /api/auth/login  Body: { email: string, password: string }
OUTPUT:   { accessToken: string, userId: string, email: string }
GUARD:    [open]
```

---

### Users

```
TYPE:     API
NAME:     Create user
LOCATION: apps/aze-api/src/users/users.controller.ts:12
PURPOSE:  Creates a new user record
INPUT:    POST /api/users  Body: Prisma.UserCreateInput
OUTPUT:   User object
GUARD:    [open]

TYPE:     API
NAME:     Get all users
LOCATION: apps/aze-api/src/users/users.controller.ts:17
PURPOSE:  Returns all user records
INPUT:    GET /api/users
OUTPUT:   User[]
GUARD:    [open]

TYPE:     API
NAME:     Get user by ID
LOCATION: apps/aze-api/src/users/users.controller.ts:22
PURPOSE:  Returns a single user by ID
INPUT:    GET /api/users/:id
OUTPUT:   User | null
GUARD:    [open]

TYPE:     API
NAME:     Update user
LOCATION: apps/aze-api/src/users/users.controller.ts:27
PURPOSE:  Updates fields on an existing user
INPUT:    PATCH /api/users/:id  Body: Prisma.UserUpdateInput
OUTPUT:   Updated User object
GUARD:    [open]

TYPE:     API
NAME:     Delete user
LOCATION: apps/aze-api/src/users/users.controller.ts:32
PURPOSE:  Deletes a user record
INPUT:    DELETE /api/users/:id
OUTPUT:   Deleted User object
GUARD:    [open]
```

---

### Products

```
TYPE:     API
NAME:     Create product
LOCATION: apps/aze-api/src/product/products/products.controller.ts:19
PURPOSE:  Creates a new product
INPUT:    POST /api/products  Body: Prisma.ProductCreateInput
OUTPUT:   Product object
GUARD:    [API-Key + JWT]

TYPE:     API
NAME:     Get all products
LOCATION: apps/aze-api/src/product/products/products.controller.ts:23
PURPOSE:  Returns paginated/sorted product list
INPUT:    GET /api/products?sort=asc|desc&limit=number  (defaults: sort=asc, limit=10)
OUTPUT:   Product[]
GUARD:    [open]

TYPE:     API
NAME:     Get product by ID
LOCATION: apps/aze-api/src/product/products/products.controller.ts:31
PURPOSE:  Returns a single product by UUID
INPUT:    GET /api/products/:id
OUTPUT:   Product object (throws 404 if not found)
GUARD:    [open]

TYPE:     API
NAME:     Update product
LOCATION: apps/aze-api/src/product/products/products.controller.ts:36
PURPOSE:  Updates fields on an existing product
INPUT:    PATCH /api/products/:id  Body: Prisma.ProductUpdateInput
OUTPUT:   Updated Product object
GUARD:    [API-Key + JWT]

TYPE:     API
NAME:     Delete product
LOCATION: apps/aze-api/src/product/products/products.controller.ts:42
PURPOSE:  Deletes a product record
INPUT:    DELETE /api/products/:id
OUTPUT:   Deleted Product object
GUARD:    [API-Key + JWT]
```

---

### Product Categories

```
TYPE:     API
NAME:     Create category
LOCATION: apps/aze-api/src/product/product-category/product-category.controller.ts:12
PURPOSE:  Creates a new product category
INPUT:    POST /api/categories  Body: Prisma.ProductCreateInput
OUTPUT:   ProductCategory object
GUARD:    [API-Key + JWT]

TYPE:     API
NAME:     Get all categories
LOCATION: apps/aze-api/src/product/product-category/product-category.controller.ts:18
PURPOSE:  Returns all product categories
INPUT:    GET /api/categories
OUTPUT:   ProductCategory[]
GUARD:    [open]

TYPE:     API
NAME:     Get category by ID
LOCATION: apps/aze-api/src/product/product-category/product-category.controller.ts:23
PURPOSE:  Returns a single category by integer ID
INPUT:    GET /api/categories/:id
OUTPUT:   ProductCategory object (throws 404 if not found)
GUARD:    [open]

TYPE:     API
NAME:     Update category
LOCATION: apps/aze-api/src/product/product-category/product-category.controller.ts:28
PURPOSE:  Updates fields on a product category
INPUT:    PATCH /api/categories/:id  Body: Prisma.ProductCategoryUpdateInput
OUTPUT:   Updated ProductCategory object
GUARD:    [API-Key + JWT]

TYPE:     API
NAME:     Delete category
LOCATION: apps/aze-api/src/product/product-category/product-category.controller.ts:34
PURPOSE:  Deletes a product category
INPUT:    DELETE /api/categories/:id
OUTPUT:   Deleted ProductCategory object
GUARD:    [API-Key + JWT]
```

---

### Reviews

```
TYPE:     API
NAME:     Create review
LOCATION: apps/aze-api/src/product/review/review.controller.ts:12
PURPOSE:  Creates a product review
INPUT:    POST /api/review  Body: Prisma.ReviewCreateInput
OUTPUT:   Review object
GUARD:    [API-Key + JWT]

TYPE:     API
NAME:     Get review by ID
LOCATION: apps/aze-api/src/product/review/review.controller.ts:18
PURPOSE:  Returns a single review by ID
INPUT:    GET /api/review/:id
OUTPUT:   Review object (throws 404 if not found)
GUARD:    [open]

TYPE:     API
NAME:     Update review
LOCATION: apps/aze-api/src/product/review/review.controller.ts:23
PURPOSE:  Updates fields on a review
INPUT:    PATCH /api/review/:id  Body: Prisma.ReviewUpdateInput
OUTPUT:   Updated Review object
GUARD:    [API-Key + JWT]

TYPE:     API
NAME:     Delete review
LOCATION: apps/aze-api/src/product/review/review.controller.ts:29
PURPOSE:  Deletes a review
INPUT:    DELETE /api/review/:id
OUTPUT:   Deleted Review object
GUARD:    [API-Key + JWT]
```

---

### Tags

```
TYPE:     API
NAME:     Create tag
LOCATION: apps/aze-api/src/product/tag/tag.controller.ts:11
PURPOSE:  Creates a new product tag
INPUT:    POST /api/tag  Body: Prisma.TagCreateInput
OUTPUT:   Tag object
GUARD:    [API-Key + JWT]

TYPE:     API
NAME:     Get all tags
LOCATION: apps/aze-api/src/product/tag/tag.controller.ts:17
PURPOSE:  Returns all tags
INPUT:    GET /api/tag
OUTPUT:   Tag[]
GUARD:    [open]

TYPE:     API
NAME:     Get tag by ID
LOCATION: apps/aze-api/src/product/tag/tag.controller.ts:22
PURPOSE:  Returns a single tag by ID
INPUT:    GET /api/tag/:id
OUTPUT:   Tag object (throws 404 if not found)
GUARD:    [open]

TYPE:     API
NAME:     Update tag
LOCATION: apps/aze-api/src/product/tag/tag.controller.ts:27
PURPOSE:  Updates a tag
INPUT:    PATCH /api/tag/:id  Body: Prisma.TagUpdateInput
OUTPUT:   Updated Tag object
GUARD:    [API-Key + JWT]

TYPE:     API
NAME:     Delete tag
LOCATION: apps/aze-api/src/product/tag/tag.controller.ts:33
PURPOSE:  Deletes a tag
INPUT:    DELETE /api/tag/:id
OUTPUT:   Deleted Tag object
GUARD:    [API-Key + JWT]
```

---

## Frontend API Route

```
TYPE:     API
NAME:     Hello route
LOCATION: apps/aze-client/src/app/api/hello/route.ts
PURPOSE:  Static Next.js API route example
INPUT:    GET /api/hello
OUTPUT:   Plain text: "Hello, from API!"
GUARD:    [open]
```

---

## Frontend Components

```
TYPE:     COMPONENT
NAME:     MyComponent
LOCATION: apps/aze-client/src/components/MyComponent.tsx
PURPOSE:  Fetches up to 5 products from the backend and renders them as a list
INPUT:    none (fetches from http://localhost:3030/api/products on mount)
OUTPUT:   JSX — rendered product list with name and price, or loading/error states
```
