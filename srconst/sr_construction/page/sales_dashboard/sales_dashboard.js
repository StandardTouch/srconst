frappe.pages['sales-dashboard'].on_page_load = function(wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        single_column: true
    });

    // Strip Frappe Desk outer container margins & padding
    $(wrapper).find('.page-head').hide();
    $(wrapper).find('.page-body').css({
        'padding': '0',
        'margin': '0',
        'background': '#fafafa'
    });
    $(wrapper).find('.layout-main-section').css({
        'padding': '0',
        'margin': '0',
        'max-width': '100%',
        'border': 'none'
    });
    $(wrapper).find('.page-container').css({
        'padding': '0',
        'margin': '0',
        'max-width': '100%'
    });

    // Mount container flush with top
    $(page.main).css({
        'padding': '0',
        'margin': '0'
    }).html('<div id="react-sales-dashboard" style="width: 100%; min-height: 100vh; background: #fafafa;"></div>');

    // Require the stylesheet with cache-buster
    frappe.require('/assets/srconst/frontend/assets/index.css?v=' + Date.now());

    // Clean up previous script if present
    var oldScript = document.getElementById('srconst-sales-dashboard-script');
    if (oldScript) {
        oldScript.remove();
    }

    // Unmount existing react root if previously active
    if (window.__srconstReactRoot) {
        try {
            window.__srconstReactRoot.unmount();
        } catch(e) {}
        window.__srconstReactRoot = null;
    }

    // Load bundle with fresh cachebuster
    var script = document.createElement('script');
    script.id = 'srconst-sales-dashboard-script';
    script.type = 'module';
    script.crossOrigin = 'anonymous';
    script.src = '/assets/srconst/frontend/assets/index.js?v=' + Date.now();
    document.body.appendChild(script);
};

frappe.pages['sales-dashboard'].on_page_show = function(wrapper) {
    $(wrapper).find('.page-head').hide();
    $(wrapper).find('.page-body').css({ 'padding': '0', 'margin': '0', 'background': '#fafafa' });
    $(wrapper).find('.layout-main-section').css({ 'padding': '0', 'margin': '0', 'max-width': '100%' });
    $(wrapper).find('.page-container').css({ 'padding': '0', 'margin': '0', 'max-width': '100%' });
};

