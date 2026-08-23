# MITFAST B2B Platform
## Complete Product Specification, Website Structure, Business Rules, Database Architecture & AI/IDE Implementation Checklist

---

# 1. PROJECT PURPOSE

MITFAST is a customized B2B product sourcing and purchasing platform.

The platform connects:

- Customers / Buyers
- Suppliers
- Admin

The platform is **not a normal e-commerce checkout system**.

The storefront behaves somewhat like e-commerce:

**Browse → Product → Cart → Checkout**

But checkout ultimately creates an **RFQ**, not an immediate paid order.

The central business flow is:

**Customer → Enquiry / RFQ → Admin Review → Negotiation/Modification → Order → Manual Payment Handling → Packing → Dispatched**

The Admin is the central operational authority.

Suppliers provide products and supplier/base prices but do not control customer orders.

Customers never see supplier identity or supplier confidential pricing.

---

# 2. CORE USER TYPES

There are exactly four visitor/account states:

## 2.1 Guest

Guest users:

- Can browse the storefront
- Can view products
- Can submit Enquiries
- Cannot submit RFQs
- Cannot create orders directly
- Can later create a Customer account
- Previous guest Enquiries can be attached to the new Customer account

---

## 2.2 Customer

Customers can:

- Browse products
- Submit Enquiries
- Create RFQs
- Add multiple products to one RFQ
- View their Enquiries
- View their RFQs
- View their Orders
- Track Orders
- Edit profile
- Edit phone
- Edit email
- Edit name
- Edit one delivery address
- Configure account settings

Customer navigation:

- Dashboard
- My Enquiries
- My RFQs
- My Orders
- Order Tracking
- Profile
- Settings

---

## 2.3 Supplier

Suppliers can:

- Register
- Login
- Wait for Admin approval
- View Supplier Dashboard
- Create products
- Submit products for approval
- Edit products
- Submit product updates for approval
- View their own products
- View product demand statistics
- View read-only order/activity counts
- Manage profile
- Manage settings

Supplier navigation:

- Dashboard
- My Products
- Orders / Activity
- Profile
- Settings

Important:

Supplier does NOT receive customer information.

Supplier does NOT manage order status.

Supplier does NOT see customer price/payment/address information.

---

## 2.4 Admin

Admin has full operational control.

Admin navigation:

1. Dashboard
2. Enquiries & RFQs
3. Orders
4. Products
5. Manage Categories
6. Suppliers
7. Approval Center
8. Settings

There are no separate staff roles at this stage.

There is no dedicated Customer Management module.

---

# 3. AUTHENTICATION

## 3.1 Supplier Authentication

Supplier uses:

- Email
- Password
- Email verification

Supplier registration:

```text
Supplier Registration
        ↓
Enter registration information
        ↓
Create Email + Password
        ↓
Email OTP verification
        ↓
Account status = Pending Approval
        ↓
Supplier can login
        ↓
Pending Approval screen
        ↓
Admin approves
        ↓
Supplier becomes Active
        ↓
Supplier Portal becomes available
```

Supplier cannot access the normal Supplier Dashboard while Pending.

---

## 3.2 Supplier Rejection

If Admin rejects supplier registration:

```text
Pending
   ↓
Admin Rejects
   ↓
Rejection reason REQUIRED
   ↓
Supplier logs in
   ↓
Sees rejection reason
   ↓
Edits registration information
   ↓
Resubmits
   ↓
Pending Approval
```

The same supplier account is reused.

Do NOT create another supplier account for resubmission.

---

## 3.3 Customer Authentication

Customers support:

### Method 1

Email + Password

Registration requires:

- Email
- Password
- OTP verification

OTP is required during registration.

Normal future login:

```text
Email + Password
```

OTP is not required every login.

---

### Method 2

Google Login

Google provides:

- Name
- Email

Customer must still provide:

- Phone

Customer profile must ultimately contain:

- Name
- Email
- Phone
- One delivery address

---

# 4. SUPPLIER REGISTRATION

Initial supplier registration fields:

- Contact Person
- Business Email
- Phone
- Company Name
- Company Website
- Country
- Password
- Confirm Password
- Terms & Conditions

Do NOT include:

- Company Description
- Documents

in the initial registration form.

Those are intentionally excluded from the current scope.

---

# 5. SUPPLIER ACCOUNT CREATION

There are two supplier creation paths.

## Path A — Admin creates supplier

```text
Admin
 ↓
Create Supplier
 ↓
Enter supplier details
 ↓
Supplier account created
 ↓
Supplier gets same Supplier Portal
```

## Path B — Supplier self-registration

```text
Supplier
 ↓
Register
 ↓
Verify email
 ↓
Pending Approval
 ↓
Admin approves
 ↓
Supplier becomes Active
```

After approval, both supplier types behave exactly the same.

There are no permission differences based on how the supplier was created.

---

# 6. SUPPLIER PROFILE

Supplier profile contains:

- Company Name
- Contact Person
- Email
- Phone
- Address
- Country
- Website

Company Description and Documents are not currently included.

---

# 7. SUPPLIER DASHBOARD

Supplier Dashboard must be simple and clear.

Do not create complex analytics.

Show summary counts:

- Product Views
- Enquiries
- RFQs
- Orders

Also show:

## My Products

A list of products belonging to that supplier.

Supplier only sees their own product information.

---

# 8. SUPPLIER PRODUCT ACTIVITY

Supplier does NOT see individual customers.

Supplier sees only aggregate counts.

Example:

```text
Product: Flight Controller X

Views:       120
Enquiries:   15
RFQs:         7
Orders:       3
```

Do not show:

- Customer name
- Customer phone
- Customer email
- Customer address
- Customer identity
- Final customer order price
- GST
- Discount
- Payment information

---

# 9. PRODUCT CREATION

Supplier creates products with:

- Product Name
- Supplier Price
- Minimum Quantity / MOQ
- Description
- Category
- Key Specifications
- Images

---

# 10. PRODUCT SPECIFICATIONS

Key specifications use a two-column structure:

| Specification | Value |
|---|---|
| Voltage | 12V |
| Material | Aluminium |
| Weight | 250g |

The UI should allow multiple specification rows.

No complicated schema builder is required.

---

# 11. PRODUCT IMAGES

Maximum:

**8 images per product**

Supplier can upload multiple images.

Admin can:

- Add image
- Replace image
- Delete image
- Reorder images
- Select main/thumbnail image

Admin can perform image management even after the product is published.

---

# 12. PRODUCT CATEGORIES

There are:

**Categories only**

There are:

**NO subcategories.**

Admin manages categories.

Admin can:

- Add category
- Delete category

Supplier can only:

- Select an existing category

Supplier cannot create categories.

---

# 13. PRODUCT APPROVAL WORKFLOW

New supplier product:

```text
Supplier creates product
        ↓
Pending Approval
        ↓
Admin reviews
        ↓
Approve / Reject
```

If approved:

```text
Approved
```

Admin can then publish it.

If rejected:

- Rejection reason required
- Supplier can see rejection reason
- Supplier can edit/resubmit

---

# 14. PRODUCT PUBLICATION

Approval and publication are separate concepts.

Do NOT combine:

```text
Approved = Published
```

Instead maintain separate states.

Example:

```text
Approval:
Pending
Approved
Rejected

Publication:
Published
Unpublished

Archive:
Active
Archived
```

---

# 15. PRODUCT UPDATE WORKFLOW

Existing approved product:

```text
Published
   ↓
Supplier edits
   ↓
Update Pending
   ↓
Admin reviews
   ↓
Approve / Reject
```

If approved:

- New product information replaces current information
- Product retains its existing publication state

Example:

### Published product

```text
Published
 ↓
Supplier edits
 ↓
Update Pending
 ↓
Admin approves
 ↓
Published
```

### Unpublished product

```text
Unpublished
 ↓
Supplier edits
 ↓
Update Pending
 ↓
Admin approves
 ↓
Unpublished
```

Admin must separately publish it.

Approval does NOT automatically publish an unpublished product.

---

# 16. PRODUCT VERSION HISTORY

Do NOT build product version history at this stage.

Only current approved product data is required.

Do not create unnecessary version-management UI.

---

# 17. PRODUCT ARCHIVE

Archive is reversible.

When a product is archived:

- It disappears from active storefront
- It cannot be used for new RFQs
- Existing RFQs remain intact
- Existing Orders remain intact
- Admin can restore it

Archive must NOT destroy historical order information.

---

# 18. PRODUCT UNPUBLISH

Unpublish is different from archive.

Unpublished product:

- Remains in system
- Remains associated with supplier
- Supplier can edit it
- Supplier can submit updates
- Approved updates remain unpublished
- Admin must manually publish it

---

# 19. SUPPLIER ARCHIVE

Supplier archive is reversible.

When Admin archives a supplier:

```text
Supplier
 ↓
Archived
 ↓
Supplier products also become archived
```

Existing:

- RFQs
- Orders

must remain intact.

They must not break because the supplier was archived.

---

# 20. SUPPLIER RESTORE

When Admin restores a supplier:

Do NOT automatically restore every product without confirmation.

Instead:

```text
Restore Supplier
       ↓
Show archived supplier products
       ↓
Admin selects products
       ↓
Restore selected
```

Provide:

**Restore All**

as a bulk action.

Products should return to their previous publication state.

Example:

If product was:

```text
Published
```

before supplier archive, restoring it can restore it as Published.

If it was:

```text
Unpublished
```

before archive, restoring it should remain Unpublished.

---

# 21. ADMIN PRODUCT MANAGEMENT

Admin has full access to configure products.

Admin can edit:

- Product Name
- Supplier
- Supplier Price
- MOQ
- Description
- Specifications
- Images
- Category
- Profit
- Selling Price
- GST
- Discount
- Ribbon Label
- Publish/Unpublish
- Archive/Restore

Admin edits do not require supplier approval.

---

# 22. ADMIN PRODUCT FILTERING

Admin Products page supports:

### Search

- Product name

### Filters

- Category
- Supplier
- Status
  - Published
  - Unpublished
  - Archived
- Approval status

### Sorting

- Newest
- Oldest

Do not add unnecessary filters.

---

# 23. PRICING ARCHITECTURE

This is one of the most important parts of MITFAST.

Supplier has one:

**Supplier/Base Price**

Example:

```text
Supplier Price = ₹10,000
```

Supplier price is confidential.

Customer must never see it.

---

# 24. ADMIN PROFIT

Admin can configure profit using either:

### Percentage

Example:

```text
Supplier Price = ₹10,000
Profit = 20%
Profit Amount = ₹2,000
Selling Price = ₹12,000
```

OR:

### Fixed Amount

```text
Supplier Price = ₹10,000
Profit = ₹2,000
Selling Price = ₹12,000
```

Admin can choose:

```text
Profit Type:
[ Percentage ]
[ Fixed Amount ]
```

---

# 25. DISCOUNT

Admin can apply a discount.

Example:

```text
Selling Price = ₹12,000
Discount = ₹500
Final Display Price = ₹11,500
```

Storefront should display:

```text
₹12,000   crossed out

₹11,500
```

Supplier price is never displayed.

Admin profit is never displayed.

---

# 26. GST

GST is controlled by Admin.

GST can be different for each product.

Examples:

```text
Product A → 18%
Product B → 5%
Product C → 0%
```

Admin can set:

- GST percentage
- GST Included
- GST Excluded

---

# 27. GST INCLUDED

If GST is included:

```text
Selling Price = ₹11,500
GST = Included
Customer total = ₹11,500
```

---

# 28. GST EXCLUDED

If GST is excluded:

```text
Selling Price = ₹11,500
GST = 18%
GST = ₹2,070

Total = ₹13,570
```

---

# 29. RIBBON LABEL

Admin can optionally configure a product ribbon.

Examples:

```text
New
Popular
Featured
Limited
Best Seller
```

Do not hard-code these labels.

Admin should be able to enter/configure the required ribbon label.

---

# 30. CUSTOMER STOREFRONT

Customer-facing storefront behaves like a normal B2B product marketplace.

Customer can:

- Browse products
- Search products
- View product
- Select quantity
- Add to cart
- Review cart
- Checkout
- Submit RFQ

There is no normal immediate payment checkout.

---

# 31. CUSTOMER PRODUCT VISIBILITY

Customer sees:

- Product name
- Product images
- Product description
- Key specifications
- Category
- MOQ
- Selling price
- Discount
- GST behavior
- Ribbon

Customer does NOT see:

- Supplier name
- Supplier company
- Supplier price
- Admin profit
- Internal supplier information

---

# 32. ENQUIRY

An Enquiry means:

> “I want information about this product.”

Enquiry can be submitted by:

- Guest
- Logged-in Customer

Required:

- Name
- Phone
- Email
- Product, if applicable
- Message/question

---

# 33. GUEST ENQUIRY

Guest:

```text
Browse
 ↓
Product
 ↓
Enquiry
 ↓
Name + Phone + Email + Message
 ↓
Submit
```

After submission:

Show option to create an account.

Example:

```text
Create an account to track your enquiry.
```

If the guest later creates an account using matching email/phone:

Existing guest enquiry should be associated with the customer account.

---

# 34. ENQUIRY WORKFLOW

Enquiry statuses:

```text
New
 ↓
Contacted
 ↓
Converted to Order
```

Or:

```text
New
 ↓
Contacted
 ↓
Closed
```

Admin can delete an enquiry.

Delete is a hard delete.

---

# 35. ENQUIRY → ORDER

An enquiry does not have to remain tied to its original product.

Admin can:

- Contact customer manually
- Change product
- Change quantity
- Change price
- Calculate profit
- Create Order

Example:

```text
Customer enquires about Product A

Admin contacts customer

Customer actually wants Product B

Admin:
Product A → Product B
Quantity → 25
Price → negotiated value

System:
Supplier price
→ Admin profit
→ Selling price
→ Discount
→ GST
→ Final total

Create Order
```

---

# 36. MANUAL ORDER FROM ENQUIRY

Admin can also create an order manually without converting directly from the original enquiry structure.

Admin selects:

- Customer
- Product
- Quantity
- Final Price
- GST
- Discount
- Delivery Address

Same pricing/profit calculation applies.

---

# 37. RFQ

RFQ means:

> “I want to buy this product with this quantity and delivery location.”

RFQ is only available to logged-in customers.

Guest users cannot submit RFQs.

---

# 38. RFQ CART MODEL

Customer can add multiple products to one cart.

Example:

```text
Product A × 20
Product B × 10
Product C × 5
```

This becomes:

**ONE RFQ**

not three separate RFQs.

---

# 39. RFQ CHECKOUT

Flow:

```text
Customer Login
 ↓
Browse
 ↓
Add Product A
 ↓
Add Product B
 ↓
Add Product C
 ↓
Cart
 ↓
Checkout
 ↓
Delivery Location
 ↓
Submit RFQ
```

No payment occurs during RFQ submission.

---

# 40. RFQ INFORMATION

RFQ contains:

- Customer
- Products
- Quantity for each product
- Current selling price snapshot
- Product subtotal
- RFQ total
- Delivery address
- Customer requirements/message if required

---

# 41. RFQ PRICE SNAPSHOT

At the moment of RFQ submission, capture the current storefront price.

Example:

```text
Current selling price = ₹12,000
Quantity = 50
```

RFQ stores:

```text
Requested Price = ₹12,000
Requested Quantity = 50
```

Later product price changes must NOT automatically change the submitted RFQ.

---

# 42. RFQ MINIMUM VALUE

Admin Settings contains:

**Minimum RFQ Value**

Example:

```text
₹5,00,000
```

This is configurable.

Admin can change it to:

```text
₹2,00,000
₹5,00,000
₹10,00,000
```

etc.

---

# 43. RFQ VALUE VALIDATION

Customer cannot submit an RFQ below the configured minimum.

Example:

```text
Minimum RFQ = ₹5,00,000

Cart Total = ₹3,80,000

Submit RFQ = Disabled
```

Show a clear message explaining the minimum required RFQ value.

---

# 44. MOQ BEHAVIOR

MOQ is NOT a hard customer-side blocker.

Example:

```text
Product MOQ = 50
Customer requests = 30
```

Customer can still submit the RFQ if the RFQ meets the minimum RFQ value rule.

Admin can negotiate and change the quantity.

---

# 45. RFQ ADMIN NEGOTIATION

Admin can change:

- Product
- Quantity
- Price

before accepting/converting.

Preserve the distinction between:

### Original customer request

```text
Quantity = 100
Price = ₹10,000
```

### Final negotiated values

```text
Quantity = 80
Price = ₹9,500
```

The final values are used for the Order.

---

# 46. RFQ STATUS

RFQ workflow:

```text
Submitted
 ↓
Under Review
 ↓
Accepted
 ↓
Converted to Order
```

Alternative:

```text
Submitted
 ↓
Under Review
 ↓
Rejected
```

Rejected RFQ requires a reason.

Customer can see the rejection reason in My RFQs.

Admin can delete RFQs.

RFQ deletion is a hard delete.

---

# 47. ARCHIVED PRODUCT + EXISTING RFQ

If product is archived after RFQ submission:

The RFQ remains intact.

Admin can:

- Process it
- Reject it
- Delete it
- Convert it to Order if still fulfillable

Archiving a product must NOT automatically delete the RFQ.

---

# 48. RFQ → ORDER

When Admin accepts an RFQ:

Show:

**Convert to Order?**

If Admin confirms:

```text
RFQ
 ↓
Order Created
```

The Order uses the final negotiated values.

---

# 49. ORDER OWNERSHIP

Order is controlled by Admin.

Supplier does NOT manage the order.

After order creation:

```text
Order created
 ↓
Admin manually contacts supplier
```

Supplier only receives read-only product demand/activity information.

---

# 50. ORDER DATA

Every Order permanently stores:

- Order ID
- Customer
- Product
- Supplier
- Quantity
- Final agreed price
- GST
- Discount
- Total
- Delivery address
- Order date
- Order status
- Payment status

Supplier information exists internally but is hidden from customers.

---

# 51. ORDER DATA IMMUTABILITY PRINCIPLE

Orders must use their own stored values.

Do NOT calculate historical orders dynamically from current product data.

If:

```text
Product price today = ₹12,000
```

and tomorrow Admin changes it to:

```text
₹13,000
```

Existing order should remain:

```text
Original order price = ₹12,000
```

Similarly:

- GST
- Discount
- Quantity
- Delivery address
- Supplier reference

must not unexpectedly change because the product changes later.

---

# 52. ADMIN ORDER EDITING

Admin can edit existing orders.

Admin can change:

- Product
- Supplier follows selected product
- Quantity
- Final price
- GST
- Discount
- Delivery address
- Order status
- Payment status

Order ID remains the same.

---

# 53. PRODUCT CHANGE IN ORDER

Admin may change an existing order's product if necessary.

Example:

```text
Product A
Supplier A

↓ Admin changes

Product B
Supplier B
```

The order's stored supplier reference should update internally.

Customer still never sees supplier information.

---

# 54. ORDER STATUS

Primary statuses:

```text
Accepted
Packing
Dispatched
Cancelled
```

Customer-friendly presentation:

```text
Order Confirmed
Packing
Dispatched
Cancelled
```

Admin controls status.

---

# 55. ORDER STATUS IS NOT STRICTLY LINEAR

Admin can move order status backward if required.

Example:

```text
Packing → Accepted
```

or:

```text
Dispatched → Packing
```

This is intentionally allowed for operational correction.

---

# 56. ORDER CANCELLATION

Admin can cancel an order when necessary.

Cancellation reason is NOT mandatory.

Cancelled orders remain in the database.

Do not delete cancelled orders.

---

# 57. PAYMENT

Payment is entirely manual.

When order is created:

```text
Payment Required
```

Customer pays externally/manual process.

Admin verifies payment.

Admin manually changes:

```text
Payment Required
        ↓
Payment Done
```

No automatic payment gateway confirmation is required at this stage.

Zoho invoice/payment integration is intentionally OUT OF CURRENT SCOPE.

---

# 58. CUSTOMER ORDER VIEW

Customer sees:

- Order ID
- Product
- Quantity
- Order Date
- Order Status
- Payment Status

Example:

```text
ORD-1024

Flight Controller X
Quantity: 50

Order Status:
Order Confirmed

Payment:
Payment Required
```

Customer does NOT see:

- Supplier
- Supplier price
- Supplier company
- Admin profit
- Internal supplier information

---

# 59. CUSTOMER ORDER TRACKING

Customer has:

**Order Tracking**

Order status:

```text
Order Confirmed
 ↓
Packing
 ↓
Dispatched
```

or:

```text
Cancelled
```

Payment:

```text
Payment Required
```

or:

```text
Payment Done
```

---

# 60. SUPPLIER ORDER VISIBILITY

Supplier does NOT receive order details.

Supplier only sees aggregate activity:

```text
Product X

Views: 120
Enquiries: 15
RFQs: 7
Orders: 3
```

Supplier cannot see:

- Customer
- Quantity
- Final price
- Delivery address
- Payment
- Order ID
- Customer identity

---

# 61. ADMIN ORDER FILTERING

Admin → Orders:

### Search

- Order ID
- Product
- Customer

### Filters

- Order Status
- Payment Status
- Supplier

### Sorting

- Newest
- Oldest

---

# 62. ADMIN DASHBOARD

Dashboard must be:

**Simple + clearly defined + information-dense without being complicated.**

Do not overload it with charts.

Summary cards:

- Products
- Suppliers
- New Enquiries
- Pending RFQs
- Active Orders
- Products Awaiting Approval

---

# 63. ADMIN RECENT ACTIVITY

Recent Activity can contain:

- Supplier registered
- Product submitted
- Product update submitted
- New enquiry
- New RFQ
- RFQ accepted
- Order created

Keep terminology simple.

---

# 64. ADMIN APPROVAL CENTER

One unified Approval Center.

Tabs/filters:

### Suppliers

New supplier registrations.

### New Products

New supplier products waiting for approval.

### Product Updates

Existing product modifications waiting for approval.

Each item supports:

- View
- Approve
- Reject
- Rejection reason where required

---

# 65. SUPPLIER MANAGEMENT

Admin → Suppliers supports 1,000+ suppliers.

Search:

- Company Name
- Contact Person

Filters:

- Country
- Status

Statuses:

- Active
- Pending Approval
- Rejected
- Archived

Sorting:

- A–Z
- Z–A
- Newest
- Oldest

---

# 66. ADMIN SUPPLIER DETAILS

Opening a supplier should allow Admin to see relevant supplier information and activity.

Supplier-related information can include:

- Company Name
- Contact Person
- Email
- Phone
- Address
- Country
- Website
- Products
- Product counts
- Enquiry count
- RFQ count
- Order count

Customer does not see these supplier details.

---

# 67. CATEGORY MANAGEMENT

Admin has:

**Manage Categories**

Actions:

- Add Category
- Delete Category

No subcategory hierarchy.

---

# 68. ADMIN SETTINGS

Settings should feel like a real B2B platform but remain understandable.

Do not create unnecessary enterprise configuration.

Suggested sections:

## Business

- Company name
- Logo
- Business email
- Phone
- Address
- Website
- Basic business information

## RFQ & Orders

- Minimum RFQ value
- RFQ rules
- Order rules

## Pricing & Tax

- Default GST
- Default discount
- Currency
- GST display behavior

Important:

Default values do NOT override explicit product configuration.

---

## Catalog

- Product defaults
- Product publication rules
- Image limit

Image limit currently:

```text
8
```

---

## Customer

- Customer registration settings
- Guest enquiry behavior
- Required customer profile fields

---

## Supplier

- Supplier registration
- Supplier approval requirement
- Supplier product approval requirement

---

## Storefront

- Branding
- Logo
- Basic contact details
- Product display rules
- Price display behavior

---

## Account & Security

- Email verification
- Password rules
- Google login
- Authentication-related settings

Do not create unnecessary security controls unless required later.

---

# 69. EMAIL / NOTIFICATIONS

Currently OUT OF SCOPE.

Do not build:

- Email notification engine
- Notification center
- Push notifications
- Automated supplier emails
- Automated customer emails

These can be added later.

---

# 70. CUSTOMER MANAGEMENT

There is intentionally:

**NO dedicated Customer Management page.**

Customer information is accessed contextually through:

- Enquiries
- RFQs
- Orders

This keeps the Admin panel smaller.

---

# 71. ADMIN NAVIGATION — FINAL

```text
ADMIN
│
├── Dashboard
│
├── Enquiries & RFQs
│
├── Orders
│
├── Products
│
├── Manage Categories
│
├── Suppliers
│
├── Approval Center
│   ├── Suppliers
│   ├── New Products
│   └── Product Updates
│
└── Settings
```

---

# 72. SUPPLIER NAVIGATION — FINAL

```text
SUPPLIER
│
├── Dashboard
│
├── My Products
│
├── Orders / Activity
│
├── Profile
│
└── Settings
```

Orders/Activity is read-only product demand information.

---

# 73. CUSTOMER NAVIGATION — FINAL

```text
CUSTOMER
│
├── Dashboard
├── My Enquiries
├── My RFQs
├── My Orders
├── Order Tracking
├── Profile
└── Settings
```

---

# 74. GUEST NAVIGATION

Guest can:

```text
Storefront
 ↓
Products
 ↓
Product Details
 ↓
Enquiry
```

Guest cannot create RFQ.

---

# 75. RECOMMENDED TECHNICAL ARCHITECTURE

For an implementation using the existing MITFAST-style stack, a suitable architecture is:

```text
Frontend
    ↓
Next.js App Router
    ↓
Server Components / Server Actions
    ↓
Supabase
    ├── PostgreSQL
    ├── Authentication
    ├── Storage
    └── Row Level Security
```

Optional infrastructure:

```text
Redis
 ↓
Caching / rate limiting / controlled high-volume operations
```

Deployment can use:

```text
Vercel
```

or another production hosting platform.

Do not introduce additional infrastructure unless the actual requirement justifies it.

---

# 76. RECOMMENDED PROJECT STRUCTURE

A clean Next.js structure:

```text
mitfast/
│
├── app/
│   │
│   ├── (storefront)/
│   │   ├── page.tsx
│   │   ├── products/
│   │   │   ├── page.tsx
│   │   │   └── [slug]/
│   │   │       └── page.tsx
│   │   │
│   │   ├── cart/
│   │   │   └── page.tsx
│   │   │
│   │   ├── checkout/
│   │   │   └── page.tsx
│   │   │
│   │   └── enquiry/
│   │       └── page.tsx
│   │
│   ├── auth/
│   │   ├── login/
│   │   ├── register/
│   │   ├── verify/
│   │   └── forgot-password/
│   │
│   ├── customer/
│   │   ├── dashboard/
│   │   ├── enquiries/
│   │   ├── rfqs/
│   │   ├── orders/
│   │   ├── tracking/
│   │   ├── profile/
│   │   └── settings/
│   │
│   ├── supplier/
│   │   ├── dashboard/
│   │   ├── products/
│   │   ├── orders/
│   │   ├── profile/
│   │   └── settings/
│   │
│   ├── admin/
│   │   ├── dashboard/
│   │   ├── enquiries-rfqs/
│   │   ├── orders/
│   │   ├── products/
│   │   ├── categories/
│   │   ├── suppliers/
│   │   ├── approvals/
│   │   └── settings/
│   │
│   └── api/
│
├── components/
│   ├── storefront/
│   ├── customer/
│   ├── supplier/
│   ├── admin/
│   ├── products/
│   ├── rfq/
│   ├── orders/
│   ├── enquiries/
│   ├── approvals/
│   └── shared/
│
├── lib/
│   ├── auth/
│   ├── pricing/
│   ├── rfq/
│   ├── orders/
│   ├── products/
│   ├── suppliers/
│   ├── enquiries/
│   ├── validation/
│   └── supabase/
│
├── types/
│   ├── product.ts
│   ├── supplier.ts
│   ├── customer.ts
│   ├── enquiry.ts
│   ├── rfq.ts
│   ├── order.ts
│   └── settings.ts
│
├── supabase/
│   ├── migrations/
│   └── seed/
│
└── public/
```

---

# 77. RECOMMENDED DATABASE DOMAIN MODEL

Do not make one giant table.

Separate business domains.

Core tables should conceptually include:

```text
profiles
user_roles

suppliers
supplier_approvals

categories

products
product_images
product_specifications

product_approval_requests

enquiries

rfqs
rfq_items

orders
order_items

customer_addresses

cart / cart_items

business_settings
```

Additional audit/security tables can be introduced where actually needed.

---

# 78. USERS / PROFILES

Authentication identity should be separate from business profile.

Conceptually:

```text
auth.users
    ↓
profiles
```

Profile fields can include:

```text
id
user_id
role
name
email
phone
address
country
created_at
updated_at
```

Role:

```text
admin
supplier
customer
```

Guest has no account.

Do not treat Guest as a database user role.

---

# 79. SUPPLIER MODEL

Supplier table should contain business information.

Conceptually:

```text
suppliers

id
user_id
company_name
contact_person
email
phone
address
country
website
status
created_at
updated_at
```

Supplier status:

```text
pending
active
rejected
archived
```

Rejected supplier can resubmit.

---

# 80. PRODUCT MODEL

Product conceptually contains:

```text
products

id
supplier_id
category_id
name
supplier_price
moq
description
approval_status
publication_status
archive_status
profit_type
profit_value
selling_price
discount
gst_rate
gst_included
ribbon_label
created_at
updated_at
```

Do not expose supplier_price to customers.

---

# 81. PRODUCT IMAGE MODEL

Separate product images:

```text
product_images

id
product_id
image_url
sort_order
is_primary
created_at
```

Constraints:

```text
Maximum 8 active images per product
```

Admin controls ordering and primary image.

---

# 82. PRODUCT SPECIFICATION MODEL

Use:

```text
product_specifications

id
product_id
name
value
sort_order
```

This supports:

```text
Name | Value
```

rows.

---

# 83. RFQ MODEL

RFQ header:

```text
rfqs

id
customer_id
status
delivery_address_snapshot
original_total
final_total
created_at
updated_at
```

RFQ items:

```text
rfq_items

id
rfq_id
product_id
original_quantity
original_unit_price
final_quantity
final_unit_price
```

This preserves the customer's initial request separately from Admin's negotiated result.

---

# 84. ORDER MODEL

Order header:

```text
orders

id
order_number
customer_id
status
payment_status
delivery_address_snapshot
total
created_at
updated_at
```

Order items:

```text
order_items

id
order_id
product_id
supplier_id
product_name_snapshot
quantity
unit_price
gst_rate
discount
subtotal
total
```

Use snapshots for historical integrity.

---

# 85. WHY SNAPSHOTS ARE IMPORTANT

Do not rely on:

```text
order → product → current price
```

for historical order calculations.

Instead:

```text
Order
 ↓
Order Item
 ↓
Stored historical product/price values
```

This ensures:

Product archive

or:

Product price change

or:

Supplier archive

does not corrupt old orders.

---

# 86. DELIVERY ADDRESS SNAPSHOT

Customer can edit their current address later.

Existing order must retain the address used at the time of order.

Therefore:

```text
Customer Address
```

and:

```text
Order Delivery Address Snapshot
```

must be treated separately.

Otherwise customer editing their profile later could accidentally change an old order's delivery address.

---

# 87. PRICING ENGINE

Create one centralized pricing calculation module.

Do not duplicate pricing calculations throughout:

- Product page
- Cart
- RFQ
- Admin
- Order creation

Conceptually:

```text
Supplier Price
      ↓
Profit Calculation
      ↓
Selling Price
      ↓
Discount
      ↓
GST
      ↓
Final Customer Total
```

The pricing engine should support:

```text
profit_type = percentage
profit_type = fixed
```

and:

```text
gst_included = true
gst_included = false
```

---

# 88. DO NOT TRUST CLIENT-SIDE PRICING

Customer browser values must never be trusted for final RFQ/order creation.

The server must recalculate/validate:

- Product status
- Product availability
- Supplier price
- Profit
- Selling price
- Discount
- GST
- Quantity
- RFQ minimum
- Final totals

This is critical.

---

# 89. RFQ VALIDATION

Before RFQ creation, server verifies:

```text
Customer authenticated?
        ↓
Yes
        ↓
Products valid?
        ↓
Published and active?
        ↓
Quantities valid?
        ↓
Minimum RFQ value satisfied?
        ↓
Create RFQ
```

MOQ should not hard-block the customer.

---

# 90. ORDER CONVERSION VALIDATION

Before converting RFQ → Order:

Verify:

- RFQ exists
- Customer exists
- Product references exist
- Supplier references exist
- Final quantity is valid
- Final price is valid
- Admin has permission
- Delivery address exists
- Order totals calculate correctly

If product/supplier is archived, Admin should explicitly decide whether the order can still be fulfilled.

Do not allow archival to silently corrupt conversion.

---

# 91. ROLE SECURITY

Use server-side authorization.

Never rely only on hiding UI buttons.

Example:

```text
Admin
→ full product editing

Supplier
→ own products only

Customer
→ own RFQs/orders/enquiries only
```

A supplier must never be able to query another supplier's products by manipulating an ID.

A customer must never be able to query another customer's order by changing an order ID.

Use database-level Row Level Security where appropriate.

---

# 92. SUPPLIER PRODUCT OWNERSHIP

Supplier can only:

- Create their own products
- Edit their own products
- View their own products
- View their own product statistics

Supplier cannot:

- Edit another supplier's product
- See another supplier's confidential price
- Access customer information
- Change order status

---

# 93. CUSTOMER DATA SECURITY

Customer can only access:

```text
their own
```

- Enquiries
- RFQs
- Orders
- Profile
- Address

Never expose supplier information in customer API responses.

Do not merely hide supplier fields in UI.

Prefer server/database-level exclusion.

---

# 94. ADMIN SECURITY

Admin can access all operational data.

Admin actions:

- Approve supplier
- Reject supplier
- Approve product
- Reject product
- Approve product update
- Reject product update
- Edit products
- Publish/unpublish
- Archive/restore
- Manage categories
- Manage suppliers
- Modify RFQs
- Create orders
- Edit orders
- Cancel orders
- Modify payment state
- Configure settings

---

# 95. PERFORMANCE REQUIREMENTS

The platform may contain:

- 1,000+ suppliers
- Large product catalog
- Many enquiries
- Many RFQs
- Many orders

Therefore:

DO NOT load entire tables into the browser.

Use:

- Server-side pagination
- Indexed database searches
- Filtered queries
- Selective columns
- Lazy loading where useful
- Server-side aggregation for counts
- Proper database indexes

Avoid:

```text
SELECT *
FROM products
```

for huge datasets.

---

# 96. PAGINATION

Admin lists should be paginated:

- Products
- Suppliers
- Enquiries
- RFQs
- Orders
- Approval Center

Do not render thousands of rows simultaneously.

---

# 97. DATABASE INDEXING

Likely important indexes include:

```text
products.supplier_id
products.category_id
products.approval_status
products.publication_status
products.archive_status

suppliers.status
suppliers.country
suppliers.company_name

orders.customer_id
orders.supplier_id
orders.status
orders.payment_status
orders.created_at

rfqs.customer_id
rfqs.status
rfqs.created_at

enquiries.customer_id
enquiries.status
enquiries.created_at
```

Exact indexes should be confirmed from actual query patterns.

---

# 98. SEARCH

Search should be server-side.

Examples:

```text
Products:
product name

Suppliers:
company name
contact person

Orders:
order ID
product
customer
```

Do not download all records and filter them in JavaScript.

---

# 99. UI/UX PRINCIPLES

The system should feel like a serious B2B platform.

Primary principles:

- Clear terminology
- Simple navigation
- Dense but readable information
- Strong hierarchy
- Minimal unnecessary decoration
- Clear status badges
- Clear action buttons
- Predictable forms
- Fast search
- Fast filtering
- Consistent tables
- Consistent confirmation dialogs

Avoid:

- Overloaded dashboards
- Too many charts
- Complicated terminology
- Excessive animations
- Unnecessary modal chains
- Hidden actions
- Giant forms without sections

---

# 100. STATUS TERMINOLOGY

Use consistent terminology.

### Supplier

```text
Pending Approval
Active
Rejected
Archived
```

### Product Approval

```text
Pending
Approved
Rejected
Update Pending
```

### Publication

```text
Published
Unpublished
```

### RFQ

```text
Submitted
Under Review
Accepted
Rejected
Converted to Order
```

### Enquiry

```text
New
Contacted
Converted to Order
Closed
```

### Order

```text
Accepted
Packing
Dispatched
Cancelled
```

### Payment

```text
Payment Required
Payment Done
```

---

# 101. CRITICAL BUSINESS RULES CHECKLIST

## Users

- [ ] Guest can browse
- [ ] Guest can submit enquiry
- [ ] Guest cannot submit RFQ
- [ ] Customer can submit enquiry
- [ ] Customer can submit RFQ
- [ ] Supplier requires account
- [ ] Admin has full access
- [ ] No additional staff roles

## Supplier

- [ ] Admin can manually create supplier
- [ ] Supplier can self-register
- [ ] Supplier email verification required
- [ ] Supplier account starts Pending Approval
- [ ] Pending supplier can login
- [ ] Pending supplier sees Pending Approval
- [ ] Pending supplier cannot access full dashboard
- [ ] Admin can approve supplier
- [ ] Admin rejection requires reason
- [ ] Supplier can see rejection reason
- [ ] Supplier can edit rejected registration
- [ ] Supplier can resubmit
- [ ] Admin-created supplier and approved self-registered supplier behave identically

## Supplier Products

- [ ] Supplier can create product
- [ ] Supplier price exists
- [ ] MOQ exists
- [ ] Description exists
- [ ] Key specifications exist
- [ ] Category exists
- [ ] Maximum 8 images
- [ ] Supplier submits product for approval
- [ ] Admin approves/rejects
- [ ] Rejection reason required
- [ ] Supplier can update product
- [ ] Update requires approval
- [ ] Approved update replaces current data
- [ ] Existing publication state remains
- [ ] No version history
- [ ] Admin can directly edit everything

## Products

- [ ] Product belongs to one supplier
- [ ] Product belongs to one category
- [ ] No subcategories
- [ ] Admin manages categories
- [ ] Admin controls images
- [ ] Admin controls main image
- [ ] Admin controls ordering
- [ ] Admin controls price
- [ ] Admin controls GST
- [ ] Admin controls discount
- [ ] Admin controls profit
- [ ] Admin controls ribbon
- [ ] Admin controls publish/unpublish
- [ ] Admin controls archive/restore

## Supplier Archive

- [ ] Supplier archive is reversible
- [ ] Supplier archive archives supplier products
- [ ] Existing RFQs survive
- [ ] Existing orders survive
- [ ] Supplier restore is possible
- [ ] Product restore requires Admin selection
- [ ] Restore All exists
- [ ] Product publication state is preserved

## Enquiries

- [ ] Guest can submit
- [ ] Customer can submit
- [ ] Name required
- [ ] Phone required
- [ ] Email required
- [ ] Product can be included
- [ ] Message exists
- [ ] Guest can later create account
- [ ] Existing enquiry can be linked to customer
- [ ] New
- [ ] Contacted
- [ ] Converted
- [ ] Closed
- [ ] Admin can delete
- [ ] Delete is hard delete
- [ ] Enquiry can become order
- [ ] Admin can change product
- [ ] Admin can change quantity
- [ ] Admin can change price
- [ ] Profit is calculated

## RFQ

- [ ] Login required
- [ ] Multiple products allowed
- [ ] One cart creates one RFQ
- [ ] Quantity captured
- [ ] Delivery address captured
- [ ] Current selling price captured
- [ ] Customer contact captured through account
- [ ] Minimum RFQ value configurable
- [ ] Customer blocked below minimum
- [ ] MOQ does not hard-block RFQ
- [ ] Admin can negotiate quantity
- [ ] Admin can negotiate price
- [ ] Admin can change product
- [ ] Original request preserved
- [ ] Final negotiated values preserved
- [ ] Product archive does not destroy RFQ
- [ ] Admin can accept
- [ ] Admin can reject
- [ ] Rejection reason required
- [ ] Customer sees rejection reason
- [ ] Admin can delete
- [ ] Delete is hard delete
- [ ] RFQ can convert to order

## Orders

- [ ] Order can come from RFQ
- [ ] Order can come from Enquiry
- [ ] Admin can manually create order
- [ ] Customer stored
- [ ] Product stored
- [ ] Supplier stored internally
- [ ] Supplier hidden from customer
- [ ] Quantity stored
- [ ] Final price stored
- [ ] GST stored
- [ ] Discount stored
- [ ] Total stored
- [ ] Delivery address snapshot stored
- [ ] Order date stored
- [ ] Order status stored
- [ ] Payment status stored
- [ ] Admin can edit
- [ ] Admin can change product
- [ ] Admin can change quantity
- [ ] Admin can change price
- [ ] Admin can change GST
- [ ] Admin can change discount
- [ ] Admin can change address
- [ ] Admin can change status
- [ ] Status can move backward
- [ ] Admin can cancel
- [ ] Cancellation reason not required
- [ ] Cancelled orders remain stored
- [ ] Payment is manual
- [ ] Admin marks payment done
- [ ] No automatic payment gateway logic yet

## Customer

- [ ] Customer dashboard
- [ ] My Enquiries
- [ ] My RFQs
- [ ] My Orders
- [ ] Order Tracking
- [ ] Profile
- [ ] Settings
- [ ] Name editable
- [ ] Phone editable
- [ ] Email editable
- [ ] One delivery address
- [ ] Address editable
- [ ] Supplier hidden everywhere

## Admin

- [ ] Dashboard
- [ ] Enquiries & RFQs
- [ ] Orders
- [ ] Products
- [ ] Categories
- [ ] Suppliers
- [ ] Approval Center
- [ ] Settings
- [ ] No dedicated customer management
- [ ] Recent Activity
- [ ] Summary cards
- [ ] Simple terminology

---

# 102. ADMIN DASHBOARD CHECKLIST

- [ ] Products card
- [ ] Suppliers card
- [ ] New Enquiries card
- [ ] Pending RFQs card
- [ ] Active Orders card
- [ ] Products Awaiting Approval card
- [ ] Recent Activity
- [ ] Supplier registered activity
- [ ] Product submitted activity
- [ ] Product update activity
- [ ] New enquiry activity
- [ ] New RFQ activity
- [ ] RFQ accepted activity
- [ ] Order created activity
- [ ] No unnecessary analytics overload

---

# 103. APPROVAL CENTER CHECKLIST

- [ ] Supplier tab
- [ ] New Product tab
- [ ] Product Update tab
- [ ] Search
- [ ] Filter
- [ ] View
- [ ] Approve
- [ ] Reject
- [ ] Rejection reason
- [ ] Clear status
- [ ] Pagination

---

# 104. PRODUCT MANAGEMENT CHECKLIST

- [ ] Search product name
- [ ] Category filter
- [ ] Supplier filter
- [ ] Published filter
- [ ] Unpublished filter
- [ ] Archived filter
- [ ] Approval filter
- [ ] Newest sorting
- [ ] Oldest sorting
- [ ] Product details
- [ ] Product editing
- [ ] Image management
- [ ] Pricing management
- [ ] GST
- [ ] Discount
- [ ] Profit
- [ ] Ribbon
- [ ] Publish
- [ ] Unpublish
- [ ] Archive
- [ ] Restore

---

# 105. SUPPLIER MANAGEMENT CHECKLIST

- [ ] Company name search
- [ ] Contact person search
- [ ] Country filter
- [ ] Active filter
- [ ] Pending filter
- [ ] Rejected filter
- [ ] Archived filter
- [ ] A-Z sorting
- [ ] Z-A sorting
- [ ] Newest sorting
- [ ] Oldest sorting
- [ ] Supplier details
- [ ] Supplier products
- [ ] Supplier activity
- [ ] Archive
- [ ] Restore
- [ ] Restore selected products
- [ ] Restore all products

---

# 106. ORDER MANAGEMENT CHECKLIST

- [ ] Search Order ID
- [ ] Search Product
- [ ] Search Customer
- [ ] Filter Order Status
- [ ] Filter Payment Status
- [ ] Filter Supplier
- [ ] Newest
- [ ] Oldest
- [ ] View order
- [ ] Edit order
- [ ] Change product
- [ ] Change quantity
- [ ] Change price
- [ ] Change GST
- [ ] Change discount
- [ ] Change address
- [ ] Change status
- [ ] Move status backward
- [ ] Cancel order
- [ ] Change payment status

---

# 107. PERFORMANCE CHECKLIST

- [ ] Server-side pagination
- [ ] Indexed searches
- [ ] Indexed filters
- [ ] No full-table browser downloads
- [ ] No SELECT * for huge tables
- [ ] Only required fields selected
- [ ] Server-side aggregation for supplier statistics
- [ ] Product counts optimized
- [ ] Order counts optimized
- [ ] RFQ counts optimized
- [ ] Enquiry counts optimized
- [ ] Avoid unnecessary realtime subscriptions
- [ ] Avoid unnecessary client components
- [ ] Keep dashboard queries small
- [ ] Cache only where useful
- [ ] Avoid duplicate database queries

---

# 108. SECURITY CHECKLIST

- [ ] Server-side authorization
- [ ] Database RLS
- [ ] Supplier can only access own products
- [ ] Customer can only access own RFQs
- [ ] Customer can only access own orders
- [ ] Customer cannot see supplier
- [ ] Customer cannot see supplier price
- [ ] Customer cannot see admin profit
- [ ] Supplier cannot see customers
- [ ] Supplier cannot see order details
- [ ] Supplier cannot change order status
- [ ] Client cannot manipulate final price
- [ ] Server recalculates totals
- [ ] Server validates product status
- [ ] Server validates RFQ minimum
- [ ] Server validates permissions
- [ ] Authentication protected
- [ ] Sensitive fields excluded from customer responses

---

# 109. DATA INTEGRITY CHECKLIST

Critical rule:

## Archive must never equal Delete.

Supplier archive:

```text
Supplier remains
```

Product archive:

```text
Product remains
```

Order:

```text
Order remains
```

RFQ:

```text
RFQ remains unless Admin explicitly deletes it
```

Enquiry:

```text
Enquiry remains unless Admin explicitly deletes it
```

Hard deletion only applies to explicitly deleted:

- Enquiries
- RFQs

Do not cascade-delete orders.

---

# 110. HISTORICAL DATA CHECKLIST

Order must survive:

- Supplier archive
- Product archive
- Product price change
- Product GST change
- Product discount change
- Product image change
- Product description change
- Supplier profile change

Order must retain:

- Historical product information
- Historical supplier reference
- Historical quantity
- Historical price
- Historical GST
- Historical discount
- Historical total
- Historical delivery address

---

# 111. IMPLEMENTATION ORDER FOR AI / IDE AGENT

The AI coding agent should NOT attempt to build everything simultaneously.

Build in this order:

## Phase 1 — Foundation

- [ ] Project structure
- [ ] Database connection
- [ ] Authentication
- [ ] Roles
- [ ] RLS
- [ ] Basic layout
- [ ] Admin layout
- [ ] Supplier layout
- [ ] Customer layout

## Phase 2 — Catalog

- [ ] Categories
- [ ] Products
- [ ] Product specifications
- [ ] Product images
- [ ] Supplier ownership
- [ ] Product approval
- [ ] Product update approval
- [ ] Publish/unpublish
- [ ] Archive/restore

## Phase 3 — Pricing

- [ ] Supplier price
- [ ] Profit percentage
- [ ] Fixed profit
- [ ] Selling price
- [ ] Discount
- [ ] GST
- [ ] GST included/excluded
- [ ] Final price calculation

## Phase 4 — Storefront

- [ ] Product listing
- [ ] Product details
- [ ] Search
- [ ] Category filtering
- [ ] Cart
- [Product quantity]
- [ ] Guest enquiry
- [ ] Customer enquiry

## Phase 5 — Customer

- [ ] Customer registration
- [ ] OTP
- [ ] Google login
- [ ] Profile
- [ ] Address
- [ ] Dashboard
- [ ] Enquiries
- [ ] RFQs
- [ ] Orders
- [ ] Tracking

## Phase 6 — RFQ

- [ ] Multi-product cart
- [ ] RFQ checkout
- [ ] Minimum RFQ value
- [ ] Price snapshot
- [ ] Quantity
- [ ] Delivery address
- [ ] Admin review
- [ ] Admin negotiation
- [ ] Accept/reject
- [ ] Convert to order

## Phase 7 — Enquiries

- [ ] Guest enquiry
- [ ] Customer enquiry
- [ ] Guest-to-account linking
- [ ] Admin enquiry management
- [ ] Contacted state
- [ ] Convert to order
- [ ] Manual order creation

## Phase 8 — Orders

- [ ] Order creation
- [ ] Order items
- [ ] Historical snapshots
- [ ] Order editing
- [ ] Status
- [ ] Backward status movement
- [ ] Cancellation
- [ ] Payment Required
- [ ] Payment Done
- [ ] Customer tracking

## Phase 9 — Supplier

- [ ] Supplier registration
- [ ] OTP verification
- [ ] Pending approval
- [ ] Rejection
- [ ] Resubmission
- [ ] Supplier dashboard
- [ ] Supplier products
- [ ] Supplier statistics
- [ ] Supplier archive
- [ ] Supplier restore

## Phase 10 — Admin

- [ ] Dashboard
- [ ] Approval Center
- [ ] Products
- [ ] Suppliers
- [ ] Enquiries/RFQs
- [ ] Orders
- [ ] Categories
- [ ] Settings

## Phase 11 — Performance

- [ ] Database indexes
- [ ] Pagination
- [ ] Query optimization
- [ ] Server-side filtering
- [ ] Server-side search
- [ ] Dashboard optimization
- [ ] Supplier statistics optimization

## Phase 12 — Security

- [ ] RLS
- [ ] Role authorization
- [ ] Ownership checks
- [ ] Input validation
- [ ] Server-side pricing validation
- [ ] Customer data protection
- [ ] Supplier privacy

---

# 112. AI / IDE AGENT DEVELOPMENT RULES

The coding agent must follow these rules.

## Rule 1 — Do not invent business features

Do not add:

- Marketplace commissions
- Supplier subscriptions
- Customer memberships
- Seller plans
- Auctions
- Chat
- Automated negotiation
- Payment gateway
- Invoice system
- Shipping integration
- Supplier ratings
- Reviews
- Wishlists
- Coupons
- Loyalty systems
- AI recommendations
- KYC workflows
- Multi-level categories

unless explicitly requested later.

---

## Rule 2 — Do not change business logic silently

If a requested implementation conflicts with this specification:

STOP and identify the conflict.

Do not silently redesign the workflow.

---

## Rule 3 — Preserve separation of states

Never merge:

```text
Approval
Publication
Archive
```

They are separate concepts.

---

## Rule 4 — Preserve historical orders

Never allow:

```text
Product update
```

to automatically modify:

```text
Existing Order
```

---

## Rule 5 — Never expose supplier information

Customer API/UI must never expose:

- supplier name
- supplier company
- supplier price
- supplier internal information

---

## Rule 6 — Never expose customers to suppliers

Supplier must never receive:

- customer name
- phone
- email
- address
- order identity
- final customer pricing
- payment information

Supplier gets aggregate activity only.

---

## Rule 7 — Pricing must be server-controlled

Never trust:

```text
client submitted price
```

for final order creation.

Always validate server-side.

---

## Rule 8 — Build reusable business logic

Pricing calculation should exist in one central module.

RFQ validation should exist in one central module.

Order conversion should exist in one central module.

Do not duplicate complex calculations across pages.

---

## Rule 9 — Keep UI terminology simple

Use:

```text
Orders
Products
Suppliers
Enquiries
RFQs
Approvals
Settings
```

Avoid unnecessary technical terminology in the UI.

---

## Rule 10 — Optimize for scale

Design for:

```text
1,000+ suppliers
```

and potentially thousands of products.

Do not assume the dataset is small.

---

# 113. FINAL HIGH-LEVEL SYSTEM FLOW

## Supplier

```text
Register
 ↓
Verify Email
 ↓
Pending Approval
 ↓
Admin Approves
 ↓
Supplier Dashboard
 ↓
Create Product
 ↓
Product Approval
 ↓
Admin Approves
 ↓
Admin Publishes
 ↓
Product Appears Storefront
```

Product update:

```text
Supplier Edits
 ↓
Update Pending
 ↓
Admin Approves
 ↓
Current Product Updated
 ↓
Publication State Preserved
```

---

# 114. CUSTOMER ENQUIRY FLOW

```text
Guest / Customer
 ↓
Product
 ↓
Enquiry
 ↓
Name + Phone + Email
 ↓
Admin
 ↓
Contacted
 ↓
Admin changes product/quantity/price if needed
 ↓
Order
```

Guest:

```text
Enquiry
 ↓
Create Account
 ↓
Existing Enquiry Linked
```

---

# 115. CUSTOMER RFQ FLOW

```text
Customer Login
 ↓
Browse
 ↓
Add Multiple Products
 ↓
Cart
 ↓
Checkout
 ↓
Delivery Address
 ↓
RFQ Value Validation
 ↓
Submit RFQ
 ↓
Admin Review
 ↓
Admin Negotiates
 ↓
Quantity / Price / Product can change
 ↓
Accept
 ↓
Convert to Order
```

---

# 116. ORDER FLOW

```text
RFQ / Enquiry / Manual Admin Order
 ↓
Order Created
 ↓
Payment Required
 ↓
Customer pays manually
 ↓
Admin verifies
 ↓
Payment Done
 ↓
Order Confirmed
 ↓
Packing
 ↓
Dispatched
```

Admin can correct status backward.

Admin can cancel whenever required.

---

# 117. SUPPLIER ARCHIVE FLOW

```text
Active Supplier
 ↓
Admin Archives
 ↓
Supplier Archived
 ↓
Supplier Products Archived
 ↓
Existing RFQs remain
 ↓
Existing Orders remain
```

Restore:

```text
Restore Supplier
 ↓
Show archived products
 ↓
Select products
OR
Restore All
 ↓
Products restored
 ↓
Previous publication state preserved
```

---

# 118. FINAL MVP SCOPE

The first production version should contain:

### Storefront

- [ ] Product listing
- [ ] Product details
- [ ] Search
- [ ] Categories
- [ ] Cart
- [ ] Enquiry
- [ ] RFQ checkout
- [ ] Customer login
- [ ] Customer registration

### Customer

- [ ] Dashboard
- [ ] Enquiries
- [ ] RFQs
- [ ] Orders
- [ ] Tracking
- [ ] Profile
- [ ] Settings

### Supplier

- [ ] Registration
- [ ] Email verification
- [ ] Approval
- [ ] Dashboard
- [ ] Products
- [ ] Product creation
- [ ] Product update
- [ ] Activity counts
- [ ] Profile
- [ ] Settings

### Admin

- [ ] Dashboard
- [ ] Enquiries
- [ ] RFQs
- [ ] Orders
- [ ] Products
- [ ] Categories
- [ ] Suppliers
- [ ] Approval Center
- [ ] Settings

### Core Business Engine

- [ ] Product approval
- [ ] Product update approval
- [ ] Supplier approval
- [ ] Supplier archive
- [ ] Supplier restore
- [ ] Product archive
- [ ] Product restore
- [ ] Profit calculation
- [ ] Discount
- [ ] GST
- [ ] RFQ minimum value
- [ ] RFQ negotiation
- [ ] Order conversion
- [ ] Manual payment state
- [ ] Order status management

---

# 119. CURRENTLY OUT OF SCOPE

Explicitly DO NOT implement yet:

- [ ] Zoho invoice integration
- [ ] Automatic payment gateway
- [ ] Automatic payment verification
- [ ] Shipping integration
- [ ] Courier API
- [ ] Email notification engine
- [ ] Push notifications
- [ ] Supplier/customer chat
- [ ] Online negotiation/counter-offer system
- [ ] Customer management module
- [ ] Product version history
- [ ] Supplier documents
- [ ] Supplier company description
- [ ] Subcategories
- [ ] Additional staff roles
- [ ] Supplier order management
- [ ] Customer-visible supplier information

---

# 120. FINAL ACCEPTANCE CRITERIA

The platform should not be considered complete until these scenarios work correctly.

## Scenario 1

Guest submits enquiry.

Expected:

```text
Enquiry created
Admin can see it
Guest is offered account creation
```

---

## Scenario 2

Guest creates account afterward.

Expected:

```text
Existing enquiry automatically associated
with customer account
```

---

## Scenario 3

Customer creates RFQ with 3 products.

Expected:

```text
One RFQ
3 RFQ items
One delivery address
One customer
```

---

## Scenario 4

RFQ below configured minimum.

Expected:

```text
RFQ submission blocked
```

---

## Scenario 5

Product MOQ is 50, customer requests 30.

Expected:

```text
RFQ can still be submitted
if minimum RFQ value is satisfied
```

---

## Scenario 6

Admin negotiates RFQ.

Expected:

```text
Original quantity preserved
Original price preserved

Final quantity stored
Final price stored
```

---

## Scenario 7

Admin converts RFQ to order.

Expected:

```text
Order uses final negotiated values
```

---

## Scenario 8

Admin changes product price after order creation.

Expected:

```text
Existing order unchanged
```

---

## Scenario 9

Admin archives supplier.

Expected:

```text
Supplier archived
Supplier products archived
Existing orders unchanged
Existing RFQs unchanged
```

---

## Scenario 10

Admin restores supplier.

Expected:

```text
Admin chooses products
OR
Restore All
```

---

## Scenario 11

Customer opens order.

Expected:

```text
Order ID
Product
Quantity
Order date
Order status
Payment status
```

No supplier information.

---

## Scenario 12

Supplier opens activity.

Expected:

```text
Views
Enquiries
RFQs
Orders
```

No customer information.

---

## Scenario 13

Supplier edits published product.

Expected:

```text
Update Pending
 ↓
Admin approves
 ↓
Product updated
 ↓
Publication state preserved
```

---

## Scenario 14

Admin unpublishes product.

Supplier edits it.

Expected:

```text
Update Pending
 ↓
Admin approves
 ↓
Product remains Unpublished
```

---

## Scenario 15

Admin manually creates order.

Expected:

```text
Customer
Product
Quantity
Price
GST
Discount
Delivery Address
 ↓
Profit calculation
 ↓
Order Created
```

---

# 121. MOST IMPORTANT ARCHITECTURAL PRINCIPLE

The system should be built around these independent domains:

```text
AUTHENTICATION
      │
      ├── Admin
      ├── Supplier
      └── Customer
             │
             ↓
        STOREFRONT
             │
       ┌─────┴─────┐
       ↓           ↓
    ENQUIRY       RFQ
       │           │
       └─────┬─────┘
             ↓
          ADMIN
             ↓
          ORDER
             ↓
      PAYMENT STATUS
             ↓
      ORDER STATUS
```

Products and suppliers are supporting domains:

```text
SUPPLIER
   ↓
PRODUCT
   ↓
STOREFRONT
```

But:

```text
SUPPLIER ARCHIVE
```

must never destroy:

```text
ORDER
```

And:

```text
PRODUCT PRICE CHANGE
```

must never rewrite:

```text
HISTORICAL ORDER
```

This separation is the foundation of the MITFAST architecture.

---

# 122. AI / IDE AGENT FINAL INSTRUCTION

Before implementing any feature:

1. Read this specification.
2. Identify the relevant domain.
3. Check existing database schema.
4. Check existing authentication/authorization.
5. Check existing components before creating duplicates.
6. Reuse existing business logic where possible.
7. Do not invent new business rules.
8. Do not silently change existing workflows.
9. Protect supplier/customer privacy at database level.
10. Preserve historical order integrity.
11. Use server-side validation.
12. Use pagination for large datasets.
13. Keep terminology simple.
14. Keep UI clear and professional.
15. Do not add out-of-scope features.
16. Test edge cases before marking the feature complete.
17. Check both UI behavior and database behavior.
18. Check authorization, not just visual access.
19. Check loading/error/empty states.
20. Check archived/unpublished/approved state combinations.
21. Never consider a feature complete merely because the UI works.
22. Verify the complete data flow from UI → server → database → UI.

The agent should implement the platform **incrementally**, validate each domain, and only proceed after the previous domain is stable.

# END OF MITFAST SPECIFICATION