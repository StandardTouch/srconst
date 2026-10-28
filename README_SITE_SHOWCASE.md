# Site Showcase

A client-facing, projector-friendly page at `/app/site-showcase`: pick a project, spin the tower, tap a floor, tap a
flat on the plan, and book or cancel it without leaving the page.

## What it reads and writes

| Thing | Where it comes from |
| --- | --- |
| Sites, blocks, floors, flats, prices, areas, status | ERPNext, read live, nothing is copied. A **site is a leaf Cost Center**; its Buildings are the blocks and their `Flat` records are the flats. Sites with no Buildings yet are listed too. |
| Building photo, floor plan, flat areas on the plan | `Building Showcase` (one record per Building), edited from the page (Setup, Map flats). |
| Booking | Creates and **submits** a real `Flat Booking` as the logged-in user. |
| Cancellation | Creates and **submits** a real `Flat Booking Cancellation` as the logged-in user. |

Booking and cancellation run through the normal documents, so every existing Server Script, hook, notification and
permission rule still applies (naming series, flat status, draft sales invoice, WhatsApp PDF, payment reversal...).
The page re-implements none of that. Only the form's own arithmetic (GST on the sale value, balance split over the
months) is mirrored in `build_booking_values` and covered by tests.

## Which cost centers count as sites

Every enabled leaf Cost Center, except overhead ones (Main, Admin and Overhead, Head Office, Project Alpha/Beta/Gamma).
A cost center that has Buildings is always shown. Change the hidden list with `showcase_hidden_cost_centers: ["main", ...]`
(lower-case names) in `site_config.json`.

## Adding a site

**+ Add site** can use an existing site or create a **new site**: choosing "New site" asks for its name and the cost center group it
belongs under, and creates the Cost Center together with the Buildings and Flats, all in one transaction. Building names are unique
across ERPNext; if the typed name is taken, the site name is added after it ("Block A - Gulbarga") and the page still shows "Block A".
(`System Manager` and `SRC MD`; the records are created after that role check, because System Manager has no create right on the custom Building / Flat doctypes) asks for the cost center, a project name and one row per
block (building name, floors, flats per floor, type, area, facing, base price). It creates real `Building` and `Flat`
records (status Empty, company and cost center from the site). Flat numbers follow the existing pattern
(`<block letter><floor code><n>`, e.g. BGF1). Building names must be unique across all sites. Everything is created in one
transaction and rolled back if any record fails. Every flat in a block starts with the same type, area and price; edit
single flats in ERPNext afterwards.

## Staying in sync with ERPNext

The page reads Building, Flat and the bookings live, and open pages are told when anything changes: flats or buildings created,
edited or deleted from the page, the desk, an import or a script, and bookings or cancellations (which change a flat's status
without saving the flat). `showcase_sync.py` publishes one realtime event per site per change (only ids travel; the page then
reads the data with the user's own permissions). The page refreshes quietly, keeps the selected floor, and if the user is in the
middle of a booking, a flat sheet or the plan editor it waits and applies the change when they finish. It also re-reads after the
browser tab was in the background for a while. Realtime needs the normal Frappe socketio process.

## The Showcase section on the Flat form

`flat_showcase.py` adds a collapsible **Showcase (web view)** section to the Flat form (Custom Fields, created and kept by
`after_migrate`, safe to repeat):

* **Plan position**: which box of the floor plan this flat uses (1, 2, 3...), unique per building and floor. Left empty, the next
  free number is used when the flat is saved (a freed number is reused first), so flats added in ERPNext never shift the others.
  To swap two flats' boxes use a spare number in between. Existing flats get positions in flat-number order, which is exactly
  the order the page used before, so existing mappings do not change.
* **Inside / 3D view image**: shown as the flat's 3D view instead of the view cut from the floor plan.
* **Description** and **Highlights** (one per line): shown on the flat sheet.
* **Photos**: a gallery (Photos tab on the flat sheet).
* The **View on Showcase** button on the Flat form opens the flat on the page.

Fields are saved with the Flat, so they follow the permissions you already have on Flat. A site that has not run migrate yet
simply shows no extra data.

## Brochure as the floor plan, cropping, mapping

If a building has a brochure but no separate floor plan, the brochure itself (an image, or the largest picture in a PDF)
is shown as the plan beside the tower. Managers then:

1. **Crop plan** - drag a box over just the floor plan on the page; the cut-out (made from the original file) becomes the plan.
2. **Map flats** - drag one box onto each flat. Until a plan is mapped, flats are not clickable on it (a guessed layout would
   mislead clients), and the flat cards show their type instead of a picture.
3. Each flat's view is cut from the plan by its box. A low-resolution brochure gives small, soft flat views: upload the
   highest-resolution plan you have in Setup.

## Editing the plan

Crop plan and Map flats open the plan full screen so the boxes can be placed precisely. Replacing a building's brochure also
replaces any plan that was cut or extracted from the old brochure (and the flat mapping drawn on it); a floor plan that was uploaded
as such is kept. A PDF brochure is converted to a plan when it is saved, so nobody waits for it later.

## Phones and tablets

Below 900 px wide the page is one scrolling column (solid top bar, tower, level, plan, flats), forms open as full-width
bottom sheets, the flat sheet is full screen with its buttons pinned, and the tower is rotated with a sideways drag
(vertical swipes still scroll). Hover popups are replaced by taps.

## Payment modes

A booking is either **installments (EMI)** or a **one-time payment**. One-time still creates a normal Flat Booking: it has
a single installment row for the whole balance (GST included) due on the date chosen, so ERPNext's payment collection
works exactly as for any booking.

## Floor plans and mapping

A floor plan is the top-down drawing of one floor with all its flats; each flat's view is cut out of it after you map the
flats. Floors can be laid out differently, so a plan (and its mapping) can apply to every floor or only to chosen floors:

* **Setup** takes the display image, the brochure and a floor plan with the floors it applies to. The display image and
  brochure can be applied to every building of the site. The **Brochure** button in the bar opens the current brochure.
* **Map flats** asks whether the mapping applies to every floor that shares this plan or to this floor only.
* Floors without their own plan use the building's default plan (stored on `Building Showcase`; floor-specific plans are
  rows in its `Floor-specific plans` table).

## Local copies of production data

A copy of the production database also carries the WhatsApp tokens and the "WhatsApp PDF" server scripts. They need `wkhtmltopdf`
and, once it is installed, would message real customers. Disable them on development copies (Server Script list, tick Disabled).
Those scripts also run before the booking / cancellation steps, so a failure in them can leave a booking half-processed: wrap their
bodies in try/except on production so a notification problem can never block the business steps.

## If a follow-up script fails

ERPNext commits part-way through a submit (printing a PDF writes an access log and commits), so a script that runs after
the booking is saved (WhatsApp, PDF) can fail while the booking itself is already saved. The page then says so ("saved,
but a follow-up step reported ...") instead of showing a bare error, and the failure is written to the Error Log. If the
booking was saved but ERPNext did not finish it (flat not held), the page says that too.

## Permissions

* Opening the page: roles in `showcase_setup.ROLES` (re-applied after every migrate).
* Seeing inventory: normal read permission on `Building` / `Flat`.
* Book: create permission on `Flat Booking` (and `Customer` if a new customer is entered). A GST template is required. The sale value is fixed at the flat's base price unless the user has `SRC Finance Head` or `SRC MD` (`PRICE_ROLES`).
* Cancel: create permission on `Flat Booking Cancellation`.
* Setup / Map flats / Add site: `System Manager`, `SRC MD`, `SRC Admin` (`MANAGE_ROLES`); Add site is limited to `System Manager` and `SRC MD` (`CREATE_SITE_ROLES`).
* Write endpoints are POST-only and check permissions server side; the buttons are only hints.

## Deploy

```bash
cd apps/srconst && git pull          # or however the app is shipped
bench --site <site> migrate          # creates "Building Showcase", registers the page, re-applies page roles
bench --site <site> clear-cache
bench restart                        # reload the Python workers
```

No `bench build` is needed (plain static files under `public/showcase`).

## First-time setup per project

1. Open the page, choose the project, press **Explore**, then **Setup** (managers only).
2. For each Building add the real building photo and the typical floor plan (highest resolution you have: flat views
   are cut from it, so a low-resolution plan gives soft flat views).
3. Press **Map flats** and drag one box onto each flat of the plan. It applies to every floor of that Building.
   Flats are matched to boxes by their position on the floor (sorted by flat number: 1st flat = box 1, ...).

## Generated images

Resized copies and per-flat cut-outs are written to `sites/<site>/public/files/showcase_cache` and reused. They can be
deleted at any time; they are rebuilt on demand.

## Tests

```bash
bench --site <site> run-tests --module srconst.tests.test_showcase_api
```

The booking tests run on a site that has the `Flat Booking` doctype, book and cancel a real flat inside a transaction
that is rolled back, and switch off the two WhatsApp server scripts for the duration so nothing is sent. They skip
themselves elsewhere. Do not run them on production.


## Repairing role permissions (data, not code)

Custom DocPerm rows replace a doctype's standard permission rules completely. If rows were created for some roles on standard
doctypes without rows for the others, those other roles silently lose access. This is data in the database: deploying code or
running `bench migrate` does not repair it, and copying a repaired development database to production must not be done.
Run the console script on each site instead:

`scripts/fix_standard_role_permissions_console.py` repairs every standard role, System Manager included. It only adds
what is missing or too low, never touches the `SRC *` roles or custom roles, and works in capped batches.

1. Take a backup of the production site.
2. Paste the script into System Console (Python) and press Execute. It is a dry run: it prints, per role, the rows it would add
   and how many enabled users hold the role (those users' access changes).
3. Optionally list roles in `ONLY_ROLES` to repair a few at a time (start with the ones people actually use).
4. Change `DRY_RUN` to `False`, tick **Commit**, Execute. Repeat until the plan says `total: 0` (each run writes at most `LIMIT` rows).
5. Clear the cache (`bench --site <site> clear-cache`), reload, and check with a user who holds only a standard role.
6. Keep the output: it lists every created row and raised value so any change can be undone by hand.
