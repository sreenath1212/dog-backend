# Products Module

## What This Module Does

Manages the product catalog — listing, searching, filtering, and individual product pages for customers, plus CRUD and image upload for administrators.

## How It Works

- **Public routes** (no auth): browsing, searching, filtering, viewing product details
- **Admin routes** (ADMIN role required): create, edit, soft-delete products, upload images
- All database queries use Prisma's parameterized query builder — no raw SQL

## Key Files

| File | Purpose |
|---|---|
| `products.validators.ts` | Zod schemas for create/update/query inputs |
| `products.service.ts` | Database operations, image storage via StorageProvider interface |
| `products.controller.ts` | HTTP handling, multer for image uploads |
| `products.router.ts` | Route definitions with full documentation |

## Search and Filtering

The catalog supports:
- `category`: one of FOOD, ACCESSORIES, TOYS, GROOMING, HEALTH
- `brand`: case-insensitive exact match
- `minPrice` / `maxPrice`: price range in paise (₹1 = 100 paise)
- `search`: matches product name, brand, or tags using Prisma's `contains` (parameterized, not raw LIKE)
- `sortBy`: price_asc, price_desc, newest, name_asc
- `page` / `limit`: pagination (max 50 per page)

## Image Storage

Images are handled through the `StorageProvider` interface (`backend/src/utils/storage.ts`). The current implementation saves files to the local `/uploads` directory. To switch to S3 or Cloudinary, implement the `StorageProvider` interface and change the export in `storage.ts` — no changes needed here.

## Security Decisions

- **Soft delete**: Products are never hard-deleted (`isActive` set to false). This preserves order history — orders reference products, and deleting a product would break historical order data.
- **No raw SQL**: All search queries use Prisma's `contains` with `mode: 'insensitive'`, which is parameterized and safe from SQL injection.
- **UUID filenames**: Uploaded images get a `crypto.randomUUID()` filename, preventing path traversal attacks via filename manipulation.
- **File type validation**: Only JPG, PNG, and WebP are accepted. The check is on the file extension after parsing by multer.

## API Routes

See `products.router.ts` for full documentation of each route.

## Price Convention

All prices are stored and returned as **integers in paise** (₹1 = 100 paise). The frontend is responsible for displaying them as rupees (divide by 100). This avoids floating-point rounding errors.
