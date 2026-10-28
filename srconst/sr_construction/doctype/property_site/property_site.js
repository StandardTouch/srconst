frappe.ui.form.on('Property Site', {
    refresh: function(frm) {
        if (!frm.is_new()) {
            frm.add_custom_button(__('🚀 Process Brochure & Auto-Generate Project'), function() {
                frappe.show_alert({
                    message: __('Analyzing Brochure & Generating Real Estate Assets...'),
                    indicator: 'blue'
                });
                frappe.call({
                    method: 'srconst.api.create_site_from_brochure',
                    args: {
                        site_name: frm.doc.site_name,
                        location: frm.doc.location || '',
                        developer: frm.doc.developer || '',
                        total_towers: frm.doc.total_blocks || 2,
                        floors_per_tower: 14,
                        units_per_floor: 8,
                        brochure_file_url: frm.doc.brochure_pdf || frm.doc.master_plan_image || ''
                    },
                    freeze: true,
                    freeze_message: __('Processing PDF Brochure, Extracting Floor Plans & Building Towers...'),
                    callback: function(r) {
                        if (r.message && r.message.success) {
                            frappe.msgprint({
                                title: __('Project Ready!'),
                                indicator: 'green',
                                message: __('Brochure processed successfully! Towers, floor plans, and cutaways have been auto-generated. View the interactive dashboard at /app/sales-dashboard.')
                            });
                            frm.reload_doc();
                        } else {
                            frappe.msgprint({
                                title: __('Error'),
                                indicator: 'red',
                                message: r.message ? r.message.error : __('Failed to process brochure.')
                            });
                        }
                    }
                });
            }).addClass('btn-primary');

            frm.add_custom_button(__('🌐 Open Sales & Inventory Dashboard'), function() {
                frappe.set_route('sales-dashboard');
            });
        }
    }
});
