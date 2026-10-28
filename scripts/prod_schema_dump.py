# Paste into System Console (type: Python) on the PRODUCTION site and press Execute.
# Read-only: no imports, no writes, no commit. Prints JSON sections; copy ALL the output back.
#
# What it collects: structure only (fields, rules, permissions, workflows, scripts, hooks, link targets,
# status counts). Sample documents are included with personal values masked: only Select / Check /
# numeric / date fields show real values, everything else shows "<set>" or "".
#
# Output too long for the console? Set SECTIONS to one name at a time, e.g. ["schema"], then ["logic"], ["samples"].

SEED = ["Flat Booking"]            # the booking doctype (add the cancellation doctype here if it has its own)
SECTIONS = ["overview", "schema", "logic", "samples"]
KEYWORDS = ["flat", "booking", "cancel", "unit", "plot", "property", "site", "block", "tower", "allot", "payment plan", "demand", "token"]
CORE_MODULES = ["Accounts", "Assets", "Automation", "Bulk Transaction", "Buying", "Communication", "Contacts", "Core", "CRM", "Custom",
                "Desk", "Email", "ERPNext Integrations", "Geo", "Integrations", "Maintenance", "Manufacturing", "Portal", "Printing",
                "Projects", "Quality Management", "Regional", "Selling", "Setup", "Social", "Stock", "Subcontracting", "Support",
                "Telephony", "Utilities", "Website", "Workflow", "Payments", "Payment Gateways", "Event Streaming", "Data Migration"]

FIELD_KEYS = ["fieldname", "label", "fieldtype", "options", "reqd", "default", "depends_on", "mandatory_depends_on",
              "read_only", "read_only_depends_on", "hidden", "fetch_from", "fetch_if_empty", "unique", "in_list_view",
              "set_only_once", "allow_on_submit", "no_copy", "precision", "length"]
SHOW_VALUE_TYPES = ["Select", "Check", "Int", "Float", "Currency", "Percent", "Date", "Datetime", "Time", "Duration", "Rating"]
SKIP_LAYOUT = ["Section Break", "Column Break", "Tab Break", "HTML", "Button", "Heading", "Image", "Fold"]


def dump(title, obj):
    print("### " + title)
    print(as_json(obj, indent=None, separators=(",", ":")))


def fields_of(dt):
    m = frappe.get_meta(dt)
    rows = []
    for f in m.get("fields"):
        row = {}
        for k in FIELD_KEYS:
            v = f.get(k)
            if v not in (None, "", 0):
                row[k] = v
        if f.get("fieldtype") in SKIP_LAYOUT:
            row = {"fieldtype": f.get("fieldtype"), "label": f.get("label"), "fieldname": f.get("fieldname")}
        rows.append(row)
    return [m, rows]


def doctype_summary(dt):
    res = fields_of(dt)
    m = res[0]
    rows = res[1]
    info = {}
    for k in ["name", "module", "custom", "istable", "issingle", "is_submittable", "autoname", "naming_rule", "title_field",
              "search_fields", "sort_field", "sort_order", "track_changes", "allow_rename", "quick_entry", "image_field"]:
        if m.get(k) not in (None, "", 0):
            info[k] = m.get(k)
    perms = []
    for p in (m.get("permissions") or []):
        perms.append({k: p.get(k) for k in ["role", "permlevel", "read", "write", "create", "submit", "cancel", "amend", "delete"] if p.get(k)})
    info["permissions"] = perms
    info["fields"] = rows
    return info


def targets_of(dt, kinds):
    out = []
    m = frappe.get_meta(dt)
    for f in m.get("fields"):
        if f.get("fieldtype") in kinds and f.get("options") and f.get("options") not in out:
            out.append(f.get("options"))
    return out


def count_of(dt):
    try:
        return frappe.db.count(dt)
    except:
        return None


# ---------------------------------------------------------------- overview
if "overview" in SECTIONS:
    apps = frappe.db.sql("select app_name, app_version, git_branch from `tabInstalled Application`", as_dict=1)
    mods = frappe.db.sql("select module, count(*) c from tabDocType group by module", as_dict=1)
    custom_modules = [x for x in mods if x.module not in CORE_MODULES]
    hits = []
    for r in frappe.db.sql("select name, module, custom, istable, issingle, is_submittable, autoname from tabDocType", as_dict=1):
        low = r.name.lower()
        if any(k in low for k in ["flat", "booking", "cancel", "allot", "plot", "demand"]) or r.module not in CORE_MODULES:
            r["records"] = count_of(r.name) if not r.issingle else None
            hits.append(r)
    companies = []
    try:
        companies = frappe.get_all("Company", fields=["name", "abbr", "default_currency", "country", "default_receivable_account"])
    except:
        pass
    defaults = {}
    for pair in [["Global Defaults", "default_company"], ["Global Defaults", "default_currency"], ["Selling Settings", "customer_group"],
                 ["Selling Settings", "territory"], ["Selling Settings", "cust_master_name"]]:
        try:
            defaults[pair[1]] = frappe.db.get_single_value(pair[0], pair[1])
        except:
            defaults[pair[1]] = None
    dump("OVERVIEW", {"installed_apps": apps, "custom_modules": custom_modules, "keyword_or_custom_doctypes": hits,
                      "companies": companies, "defaults": defaults,
                      "seed_exists": {d: bool(frappe.db.exists("DocType", d)) for d in SEED}})

# ---------------------------------------------------------------- schema
targets = []
for d in SEED:
    if frappe.db.exists("DocType", d) and d not in targets:
        targets.append(d)

# pull in child tables and custom-module link targets (one level at a time, bounded)
i = 0
for round_no in range(60):
    if i >= sum(1 for x in targets):
        break
    dt = targets[i]
    i += 1
    for t in targets_of(dt, ["Table", "Table MultiSelect"]):
        if t not in targets:
            targets.append(t)
    for t in targets_of(dt, ["Link"]):
        mod = frappe.db.get_value("DocType", t, "module")
        if t not in targets and mod and mod not in CORE_MODULES and sum(1 for x in targets) < 40:
            targets.append(t)

if "schema" in SECTIONS:
    for dt in targets:
        dump("SCHEMA " + dt, doctype_summary(dt))

    # standard ERPNext targets: only the mandatory fields + counts, so I know what a new record needs
    std = []
    for dt in targets:
        for t in targets_of(dt, ["Link"]):
            if t not in targets and t not in std:
                std.append(t)
    brief = []
    for t in std:
        if not frappe.db.exists("DocType", t):
            continue
        m = frappe.get_meta(t)
        brief.append({"doctype": t, "module": m.get("module"), "autoname": m.get("autoname"), "title_field": m.get("title_field"),
                      "records": count_of(t),
                      "required": [{"fieldname": f.get("fieldname"), "fieldtype": f.get("fieldtype"), "options": f.get("options"),
                                    "default": f.get("default")} for f in m.get("fields") if f.get("reqd")]})
    dump("LINK_TARGETS_STANDARD", brief)

    refs = frappe.db.sql(
        "select parent, fieldname, fieldtype from tabDocField where options in %s and fieldtype in ('Link','Dynamic Link','Table') "
        "union select dt, fieldname, fieldtype from `tabCustom Field` where options in %s and fieldtype in ('Link','Table')",
        (tuple(targets) or ("",), tuple(targets) or ("",)), as_dict=1)
    dump("DOCTYPES_THAT_REFERENCE_THE_TARGETS", refs)

# ---------------------------------------------------------------- logic (what runs on save/submit)
if "logic" in SECTIONS:
    hooks = frappe.get_hooks("doc_events")
    found = {}
    for dt in targets + ["*"]:
        if hooks.get(dt):
            found[dt] = hooks.get(dt)
    dump("DOC_EVENT_HOOKS (python methods wired in apps; I cannot see their code, send the files if they matter)", found)
    dump("OTHER_HOOKS", {"override_doctype_class": {k: v for k, v in (frappe.get_hooks("override_doctype_class") or {}).items() if k in targets},
                         "override_whitelisted_methods": {k: v for k, v in (frappe.get_hooks("override_whitelisted_methods") or {}).items()
                                                          if any(w in k.lower() for w in KEYWORDS)},
                         "permission_query_conditions": {k: v for k, v in (frappe.get_hooks("permission_query_conditions") or {}).items() if k in targets},
                         "has_permission": {k: v for k, v in (frappe.get_hooks("has_permission") or {}).items() if k in targets}})
    for dt in targets:
        wf = frappe.db.sql("select name, is_active, workflow_state_field, send_email_alert from tabWorkflow where document_type=%s", (dt,), as_dict=1)
        for w in wf:
            w["states"] = frappe.db.sql("select state, doc_status, allow_edit, update_field, update_value from `tabWorkflow Document State` where parent=%s order by idx", (w.name,), as_dict=1)
            w["transitions"] = frappe.db.sql("select state, action, next_state, allowed, allow_self_approval, `condition` from `tabWorkflow Transition` where parent=%s order by idx", (w.name,), as_dict=1)
        ss = frappe.db.sql("select name, script_type, doctype_event, api_method, disabled, script from `tabServer Script` where reference_doctype=%s", (dt,), as_dict=1)
        for s in ss:
            s["script"] = (s.script or "")[:8000]
        cs = frappe.db.sql("select name, view, enabled, script from `tabClient Script` where dt=%s", (dt,), as_dict=1)
        for s in cs:
            s["script"] = (s.script or "")[:8000]
        nt = frappe.db.sql("select name, event, enabled, `condition`, channel from tabNotification where document_type=%s", (dt,), as_dict=1)
        dump("LOGIC " + dt, {"workflows": wf, "server_scripts": ss, "client_scripts": cs, "notifications": nt})
    api_scripts = frappe.db.sql("select name, api_method, disabled, left(script, 3000) script from `tabServer Script` where script_type='API'", as_dict=1)
    dump("ALL_API_SERVER_SCRIPTS", api_scripts)

# ---------------------------------------------------------------- samples (masked)
if "samples" in SECTIONS:
    for dt in targets:
        m = frappe.get_meta(dt)
        if m.get("istable") or m.get("issingle"):
            continue
        fmap = {f.get("fieldname"): f for f in m.get("fields")}
        stats = {"records": count_of(dt)}
        try:
            stats["docstatus"] = frappe.db.sql("select docstatus, count(*) c from `tab%s` group by docstatus" % dt, as_dict=1)
        except:
            pass
        distributions = {}
        n = 0
        for f in m.get("fields"):
            if f.get("fieldtype") == "Select" and n < 8:
                n += 1
                try:
                    distributions[f.get("fieldname")] = frappe.db.sql(
                        "select `%s` v, count(*) c from `tab%s` group by `%s` order by c desc limit 15" % (f.get("fieldname"), dt, f.get("fieldname")), as_dict=1)
                except:
                    pass
        stats["select_distributions"] = distributions

        def mask(row, fm):
            out = {}
            for k in row:
                if k.startswith("_") or k in ["owner", "modified_by", "creation", "modified", "idx", "doctype", "parent", "parenttype", "parentfield"]:
                    continue
                f = fm.get(k)
                ft = f.get("fieldtype") if f else None
                v = row[k]
                if ft in SHOW_VALUE_TYPES or k in ["docstatus", "naming_series"]:
                    out[k] = v
                elif ft == "Link":
                    out[k] = "<link:%s>" % f.get("options") if v else ""
                else:
                    out[k] = "<set>" if v not in (None, "", 0) else ""
            return out

        samples = []
        for r in frappe.get_all(dt, fields=["*"], order_by="creation desc", limit=2):
            one = mask(r, fmap)
            for f in m.get("fields"):
                if f.get("fieldtype") in ["Table", "Table MultiSelect"]:
                    child = frappe.get_meta(f.get("options"))
                    cfm = {x.get("fieldname"): x for x in child.get("fields")}
                    rows = frappe.get_all(f.get("options"), filters={"parent": r.name, "parenttype": dt}, fields=["*"], order_by="idx", limit=3)
                    one[f.get("fieldname")] = [mask(x, cfm) for x in rows]
            samples.append(one)
        dump("SAMPLES " + dt, {"stats": stats, "latest_masked": samples})

print("### END")
