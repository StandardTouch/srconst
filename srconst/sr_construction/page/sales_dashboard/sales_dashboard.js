frappe.pages['sales-dashboard'].on_page_load = function(wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Sales Dashboard',
        single_column: true
    });

    // Create the mount point dynamically inside the page main container
    $(page.main).html('<div id="react-sales-dashboard"></div>');

    // Require the CSS
    frappe.require('/assets/srconst/frontend/assets/index.css');

    // Since Vite builds JS as an ES Module, we must insert a script tag
    // with type="module" to prevent syntax errors instead of using frappe.require() for JS
    let script = document.createElement('script');
    script.type = 'module';
    script.crossOrigin = 'anonymous';
    script.src = '/assets/srconst/frontend/assets/index.js';
    document.body.appendChild(script);
}
