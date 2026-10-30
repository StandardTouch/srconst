frappe.pages['site-showcase'].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({
		parent: wrapper,
		title: __('Site Showcase'),
		single_column: true,
	});

	$(page.main).html('<div id="srs-root"></div>');

	const base = '/assets/srconst/showcase/';
	frappe.require(
		[base + 'vendor/gsap.min.js', base + 'showcase.css', base + 'showcase.js'],
		() => {
			wrapper.srs = new window.SiteShowcase(document.getElementById('srs-root'), page);
		}
	);
};

frappe.pages['site-showcase'].on_page_hide = function (wrapper) {
	if (wrapper.srs) wrapper.srs.leave();
};
frappe.pages['site-showcase'].on_page_show = function (wrapper) {
	if (wrapper.srs) {
		wrapper.srs.enter();
		wrapper.srs.routeOpen(); // "View on Showcase" from a Flat form passes {site, flat}
	}
};
