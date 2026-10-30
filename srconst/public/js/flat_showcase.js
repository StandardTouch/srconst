// Flat form: open the flat on the Site Showcase page (where its images, plan position and 3D view are shown to clients)
frappe.ui.form.on("Flat", {
	refresh(frm) {
		if (frm.is_new() || !frappe.user.has_role(["System Manager", "SRC MD", "SRC Admin", "SRC Booking Executive", "SRC Finance Head", "SRC Finance Staff", "SRC Site Manager", "Sales User", "Sales Manager"])) return;
		frm.add_custom_button(__("View on Showcase"), () => {
			frappe.call({ method: "srconst.showcase_api.site_of_flat", args: { flat: frm.doc.name } }).then((r) => {
				if (!r.message) return frappe.msgprint(__("This flat is not part of a showcase site yet."));
				frappe.route_options = { site: r.message, flat: frm.doc.name };
				frappe.set_route("site-showcase");
			});
		});
	},
});
