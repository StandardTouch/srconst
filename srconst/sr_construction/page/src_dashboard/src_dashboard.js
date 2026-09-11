/**
 * SR Construction — Admin Dashboard
 * KPI cards, Flat Status Grid, Instalments, Pending EMIs, Labour, Stock,
 * Purchase, P&L, charts, recent activity. Auto-refreshes every 45s.
 *
 * Theming: built entirely on Frappe's own desk CSS variables (--bg-color,
 * --card-bg, --border-color, --blue-600, the --alert-bg / --alert-text pairs, etc),
 * the same tokens Number Cards / Dashboard Charts use — so it follows the
 * site's light/dark theme automatically, with no separate dark stylesheet.
 * Full-bleed layout + fluid (clamp-based) type scale for wall-mounted displays.
 */

frappe.pages["src-dashboard"].on_page_load = function (wrapper) {
	frappe.ui.make_app_page({
		parent: wrapper,
		title: "Admin Dashboard",
		single_column: true,
	});
	$(wrapper).addClass("src-dashboard-wrapper").find(".layout-main-section").html('<div class="src-dash"></div>');
	const app = new SRCDashboard(wrapper);
	app.init();
	wrapper._src_dashboard = app;
};

frappe.pages["src-dashboard"].on_page_hide = function (wrapper) {
	if (wrapper._src_dashboard) {
		wrapper._src_dashboard.destroy();
	}
};

const ICON = (name) => frappe.utils.icon(name, "sm");

// Validated on both the light (#ffffff) and dark (#171717) desk chart surfaces —
// see dataviz palette validator; same literal Frappe tokens work in both themes.
const CHART_COLORS = {
	blue: "#007be0",
	orange: "#d45a08",
	green: "#30a66d",
};

const FLAT_STATUS = {
	Empty: { color: "var(--gray-400)", label: "Available" },
	"In Process": { color: "var(--blue-600)", label: "In Process" },
	Sold: { color: "var(--green-600)", label: "Sold" },
};

const WORKFLOW_STATE_META = {
	Draft: { label: "Draft", color: "var(--gray-400)" },
	"Details Updated": { label: "Pending Approval", color: "var(--blue-600)" },
	Approved: { label: "Approved", color: "var(--green-600)" },
	Rejected: { label: "Rejected", color: "var(--red-600)" },
};

const AGING_COLOR = {
	"Not Due": "var(--blue-600)",
	"1-30 Days": "var(--yellow-600)",
	"31-60 Days": "var(--orange-600)",
	"61-90 Days": "var(--red-600)",
	"90+ Days": "var(--red-600)",
};

class SRCDashboard {
	constructor(wrapper) {
		this.$w = $(wrapper);
		this.$main = this.$w.find(".src-dash");
		this._refresh_timer = null;
		this._tick_timer = null;
		this._last_updated = null;
	}

	init() {
		this._inject_styles();
		this._render_shell();
		this.refresh();
		this._refresh_timer = setInterval(() => this.refresh(), 45000);
		this._tick_timer = setInterval(() => this._render_clock(), 1000);
	}

	destroy() {
		clearInterval(this._refresh_timer);
		clearInterval(this._tick_timer);
		$(".src-tooltip").remove();
	}

	refresh() {
		frappe.call({
			method: "srconst.sr_construction.page.src_dashboard.src_dashboard.get_dashboard_data",
			callback: (r) => {
				if (!r.message) return;
				this.$main.removeClass("src-loading");
				this._last_updated = new Date();
				this._render_clock();
				this._render_kpis(r.message.flat_kpis);
				this._render_flat_grid(r.message.flat_grid);
				this._render_instalments(r.message.instalments_today, r.message.instalments_month);
				this._render_pending_emis(r.message.pending_emis);
				this._render_labour_summary(r.message.labour_summary);
				this._render_stock_levels(r.message.stock_levels);
				this._render_purchase_summary(r.message.purchase_summary);
				this._render_pl_summary(r.message.pl_summary);
				this._render_site_wise_chart(r.message.site_wise_collection);
				this._render_aging(r.message.receivables_aging);
			},
		});
	}

	_chart_height() {
		return Math.round(Math.min(420, Math.max(260, window.innerWidth * 0.16)));
	}

	// ── Shell ────────────────────────────────────────────────────────────

	_panel(cls, icon, title, meta = "") {
		return `
			<div class="src-panel">
				<div class="src-panel-head">
					<span class="src-panel-icon">${ICON(icon)}</span>
					<span class="src-panel-title">${title}</span>
					<span class="src-panel-meta">${meta}</span>
				</div>
				<div class="${cls}"><div class="src-skel"></div></div>
			</div>`;
	}

	_render_shell() {
		this.$main.addClass("src-loading").html(`
			<div class="src-header">
				<div class="src-clock-block">
					<span class="src-clock"></span>
					<span class="src-brand-sub">SR Construction · Admin Dashboard</span>
				</div>
				<div class="src-live">
					<span class="src-live-dot"></span>
					<span class="src-updated">Loading…</span>
				</div>
			</div>

			<div class="src-kpi-row"></div>

			${this._panel("src-flat-grid", "table", "Flat Status Grid")}

			<div class="src-two-col">
				${this._panel("src-instalment-today", "today", "Instalments Today")}
				${this._panel("src-instalment-month", "calendar", "Instalments This Month")}
			</div>

			${this._panel("src-pending-emis", "solid-warning", "Pending EMIs")}

			<div class="src-two-col">
				${this._panel("src-chart-site", "chart", "Site-wise Collection")}
				${this._panel("src-aging", "chart", "Receivables Aging")}
			</div>

			${this._panel("src-labour-summary", "users", "Labour Payment Summary")}

			<div class="src-two-col">
				${this._panel("src-stock-levels", "stock", "Stock Levels")}
				${this._panel("src-purchase-summary", "buying", "Purchase Orders")}
			</div>

			${this._panel("src-pl-summary", "accounting", "Profit &amp; Loss · This Month")}
		`);
		this._render_clock();
	}

	_render_clock() {
		const now = new Date();
		this.$main.find(".src-clock").text(
			now.toLocaleString(undefined, {
				weekday: "short",
				day: "numeric",
				month: "short",
				hour: "2-digit",
				minute: "2-digit",
				second: "2-digit",
			})
		);
		if (!this._last_updated) return;
		const secs = Math.max(0, Math.round((new Date() - this._last_updated) / 1000));
		this.$main.find(".src-updated").text(`Updated ${secs}s ago`);
	}

	// ── KPI row ──────────────────────────────────────────────────────────

	_render_kpis(k) {
		if (!k) return;
		const cards = [
			{ icon: "assets", label: "Total Flats", value: k.total_flats, color: "var(--blue-600)" },
			{ icon: "check", label: "Available", value: k.available_flats, color: "var(--gray-400)" },
			{ icon: "workflow", label: "In Process", value: k.in_process_flats, color: "var(--blue-600)" },
			{ icon: "tag", label: "Sold", value: k.sold_flats, color: "var(--green-600)" },
			{
				icon: "close-alt",
				label: "Cancelled Bookings",
				value: k.cancelled_bookings,
				color: "var(--red-600)",
			},
		];
		this.$main.find(".src-kpi-row").html(
			cards
				.map(
					(c) => `
				<div class="src-kpi-card" style="--kpi-accent:${c.color}">
					<span class="src-kpi-icon">${ICON(c.icon)}</span>
					<div class="src-kpi-value">${frappe.utils.escape_html(c.value)}</div>
					<div class="src-kpi-label">${frappe.utils.escape_html(c.label)}</div>
				</div>`
				)
				.join("")
		);
	}

	// ── Flat Status Grid ─────────────────────────────────────────────────

	_render_flat_grid(rows) {
		if (!rows) return;
		const $target = this.$main.find(".src-flat-grid");
		if (!rows.length) {
			$target.html(`<div class="src-empty">No flats found.</div>`);
			return;
		}

		const buildings = {};
		rows.forEach((r) => {
			const key = r.building_name || r.building || "Unassigned";
			(buildings[key] = buildings[key] || []).push(r);
		});

		const legend = Object.keys(FLAT_STATUS)
			.map(
				(status) => `
			<span class="src-legend-item">
				<span class="src-dot" style="background:${FLAT_STATUS[status].color}"></span>${FLAT_STATUS[status].label}
			</span>`
			)
			.join("");

		let html = `<div class="src-legend">${legend}</div>`;
		Object.keys(buildings)
			.sort()
			.forEach((building) => {
				html += `<div class="src-building-name">${frappe.utils.escape_html(building)} <span class="src-building-count">${
					buildings[building].length
				} units</span></div>`;
				html += `<div class="src-flat-squares">`;
				buildings[building].forEach((f) => {
					const meta = FLAT_STATUS[f.status] || FLAT_STATUS.Empty;
					html += `<div class="src-flat-square" style="background:${meta.color}" data-tip='${this._flat_tooltip_json(
						f
					)}'></div>`;
				});
				html += `</div>`;
			});

		$target.html(html);
		this._wire_flat_tooltips($target);
	}

	_flat_tooltip_json(f) {
		return frappe.utils
			.escape_html(
				JSON.stringify({
					flat: f.flat_number || f.flat,
					status: f.status,
					customer: f.customer || "",
					received: f.total_received || 0,
					total: f.total_sale_value || 0,
				})
			)
			.replace(/'/g, "&#39;");
	}

	_wire_flat_tooltips($target) {
		if (!this.$tooltip) {
			this.$tooltip = $('<div class="src-tooltip"></div>').appendTo(document.body);
		}
		const $tooltip = this.$tooltip;
		$target.find(".src-flat-square").each((_, el) => {
			const $el = $(el);
			const data = JSON.parse($el.attr("data-tip"));
			$el.on("mouseenter", () => {
				const body = data.customer
					? `<b>${frappe.utils.escape_html(data.flat)}</b> · ${frappe.utils.escape_html(data.status)}<br>
						${frappe.utils.escape_html(data.customer)}<br>
						${format_currency(data.received)} / ${format_currency(data.total)}`
					: `<b>${frappe.utils.escape_html(data.flat)}</b> · ${frappe.utils.escape_html(data.status)}`;
				$tooltip.html(body).css({ opacity: 1 });
			})
				.on("mousemove", (e) => {
					$tooltip.css({ left: e.pageX + 14 + "px", top: e.pageY + 14 + "px" });
				})
				.on("mouseleave", () => $tooltip.css({ opacity: 0 }));
		});
	}

	// ── Instalments ──────────────────────────────────────────────────────

	_render_instalments(today_data, month_data) {
		this.$main.find(".src-instalment-today").html(this._instalment_panel_html(today_data));
		this.$main.find(".src-instalment-month").html(this._instalment_panel_html(month_data));
	}

	_instalment_panel_html(data) {
		if (!data) return "";
		const pct = data.due ? Math.min(100, Math.round((data.received / data.due) * 100)) : 0;
		const color = pct >= 80 ? "var(--green-600)" : pct >= 50 ? "var(--yellow-600)" : "var(--red-600)";
		return `
			<div class="src-figures">
				<div><span class="src-label">Due</span><span class="src-value">${format_currency(data.due)}</span></div>
				<div><span class="src-label">Received</span><span class="src-value" style="color:var(--alert-text-success)">${format_currency(
					data.received
				)}</span></div>
				<div><span class="src-label">Pending</span><span class="src-value" style="color:var(--alert-text-warning)">${format_currency(
					data.pending
				)}</span></div>
			</div>
			<div class="src-progress-row">
				<div class="src-progress-track"><div class="src-progress-fill" style="width:${pct}%;background:${color}"></div></div>
				<span class="src-progress-pill">${pct}%</span>
			</div>
		`;
	}

	// ── Pending EMIs ─────────────────────────────────────────────────────

	_render_pending_emis(rows) {
		if (!rows) return;
		const $target = this.$main.find(".src-pending-emis");
		if (!rows.length) {
			$target.html(`<div class="src-empty">No pending EMIs. Everything is collected.</div>`);
			return;
		}
		const body = rows
			.map((r) => {
				const badge = this._overdue_badge(r.days_overdue);
				return `
				<tr>
					<td>${frappe.utils.escape_html(r.building || "")}</td>
					<td>${frappe.utils.escape_html(r.flat || "")}</td>
					<td>${frappe.utils.escape_html(r.customer || "")}</td>
					<td class="src-num">${frappe.utils.escape_html(r.installment_no)}</td>
					<td>${frappe.datetime.str_to_user(r.due_date)}</td>
					<td class="src-num">${format_currency(r.pending_amount)}</td>
					<td>${badge}</td>
				</tr>`;
			})
			.join("");

		$target.html(`
			<div class="src-table-scroll">
				<table class="src-table">
					<thead>
						<tr>
							<th>Building</th><th>Flat</th><th>Customer</th><th>Inst. #</th>
							<th>Due Date</th><th>Pending</th><th>Overdue</th>
						</tr>
					</thead>
					<tbody>${body}</tbody>
				</table>
			</div>
		`);
	}

	_overdue_badge(days) {
		const cls = days >= 60 ? "src-badge--danger" : days >= 30 ? "src-badge--warning" : "src-badge--info";
		const weeks = Math.floor((days || 0) / 7);
		const rem_days = (days || 0) % 7;
		const label = weeks > 0 ? `${weeks}w${rem_days ? " " + rem_days + "d" : ""}` : `${days || 0}d`;
		return `<span class="src-badge ${cls}">${frappe.utils.escape_html(label)}</span>`;
	}

	// ── Labour summary ───────────────────────────────────────────────────

	_render_labour_summary(data) {
		if (!data) return;
		const counts = { Draft: 0, "Details Updated": 0, Approved: 0, Rejected: 0 };
		const amounts = { Draft: 0, "Details Updated": 0, Approved: 0, Rejected: 0 };
		(data.workflow_counts || []).forEach((row) => {
			if (row.workflow_state in counts) {
				counts[row.workflow_state] = row.count;
				amounts[row.workflow_state] = row.amount || 0;
			}
		});

		const cards = Object.keys(counts)
			.map((state) => {
				const meta = WORKFLOW_STATE_META[state];
				return `
			<div class="src-kpi-card src-kpi-card--sub" style="--kpi-accent:${meta.color}">
				<div class="src-kpi-value">${counts[state]}</div>
				<div class="src-kpi-label">${frappe.utils.escape_html(meta.label)}</div>
				<div class="src-kpi-sub">${format_currency(amounts[state])}</div>
			</div>`;
			})
			.join("");

		const site_rows = (data.site_wise || [])
			.map(
				(row) => `
			<tr>
				<td>${frappe.utils.escape_html(row.project_cost_center || "")}</td>
				<td class="src-num">${frappe.utils.escape_html(row.entries)}</td>
				<td class="src-num">${format_currency(row.amount)}</td>
			</tr>`
			)
			.join("");

		this.$main.find(".src-labour-summary").html(`
			<div class="src-subhead">Entries by Approval Status</div>
			<div class="src-kpi-row src-kpi-row--sub">${cards}</div>
			<table class="src-table">
				<thead><tr><th>Cost Center</th><th>Approved Entries (This Month)</th><th>Amount</th></tr></thead>
				<tbody>${site_rows || `<tr><td colspan="3" class="src-empty">No approved entries this month.</td></tr>`}</tbody>
			</table>
		`);
	}

	// ── Stock levels ─────────────────────────────────────────────────────

	_render_stock_levels(rows) {
		if (!rows) return;
		this._stock_rows = rows;
		const $target = this.$main.find(".src-stock-levels");
		if (!rows.length) {
			$target.html(`<div class="src-empty">No stock on hand.</div>`);
			return;
		}
		const search_term = this._stock_search_term || "";
		$target.html(`
			<div class="src-search-row">
				${ICON("search")}
				<input type="text" class="src-search-input" placeholder="Search site / warehouse…" value="${frappe.utils.escape_html(
					search_term
				)}">
			</div>
			<div class="src-stock-groups"></div>
		`);
		$target.find(".src-search-input").on("input", (e) => {
			this._stock_search_term = $(e.target).val() || "";
			this._filter_stock_groups(this._stock_search_term);
		});
		this._filter_stock_groups(search_term);
	}

	_filter_stock_groups(term) {
		const $target = this.$main.find(".src-stock-levels .src-stock-groups");
		const rows = this._stock_rows || [];
		const needle = term.trim().toLowerCase();

		const groups = {};
		rows.forEach((r) => {
			const site = r.warehouse || "Unassigned";
			(groups[site] = groups[site] || []).push(r);
		});

		const sites = Object.keys(groups)
			.filter((site) => !needle || site.toLowerCase().includes(needle))
			.sort();

		if (!sites.length) {
			$target.html(`<div class="src-empty">No matching site.</div>`);
			return;
		}

		const html = sites
			.map((site) => {
				const site_rows = groups[site];
				const max_qty = Math.max(...site_rows.map((r) => r.actual_qty || 0), 1);
				const bars = site_rows
					.map((r) => {
						const pct = Math.max(4, Math.round(((r.actual_qty || 0) / max_qty) * 100));
						return `
						<div class="src-bar-row">
							<div class="src-bar-info">
								<span class="src-bar-label">${frappe.utils.escape_html(r.item_name || r.item_code)}</span>
							</div>
							<div class="src-progress-track src-progress-track--thin">
								<div class="src-progress-fill" style="width:${pct}%;background:var(--blue-600)"></div>
							</div>
							<span class="src-bar-value">${frappe.utils.escape_html(r.actual_qty)} ${frappe.utils.escape_html(
							r.stock_uom || ""
						)}</span>
						</div>`;
					})
					.join("");
				return `
				<div class="src-stock-site">
					<div class="src-building-name">${frappe.utils.escape_html(site)} <span class="src-building-count">${
					site_rows.length
				} items</span></div>
					${bars}
				</div>`;
			})
			.join("");
		$target.html(html);
	}

	// ── Purchase summary ─────────────────────────────────────────────────

	_render_purchase_summary(data) {
		if (!data) return;
		const status_cards = (data.statuses || [])
			.map(
				(s) => `
			<div class="src-kpi-card src-kpi-card--sub" style="--kpi-accent:var(--blue-600)">
				<div class="src-kpi-value">${s.count}</div>
				<div class="src-kpi-label">${frappe.utils.escape_html(s.status || "")}</div>
				<div class="src-kpi-sub">${format_currency(s.amount)}</div>
			</div>`
			)
			.join("");

		const max_spend = Math.max(...(data.item_group_spend || []).map((g) => g.amount || 0), 1);
		const group_rows = (data.item_group_spend || [])
			.map((g) => {
				const pct = Math.max(4, Math.round(((g.amount || 0) / max_spend) * 100));
				return `
				<div class="src-bar-row">
					<div class="src-bar-info"><span class="src-bar-label">${frappe.utils.escape_html(g.item_group || "")}</span></div>
					<div class="src-progress-track src-progress-track--thin">
						<div class="src-progress-fill" style="width:${pct}%;background:var(--orange-600)"></div>
					</div>
					<span class="src-bar-value">${format_currency(g.amount)}</span>
				</div>`;
			})
			.join("");

		this.$main.find(".src-purchase-summary").html(`
			<div class="src-kpi-row src-kpi-row--sub">${status_cards || `<div class="src-empty">No purchase orders.</div>`}</div>
			<div class="src-subhead">Item Group Spend · This Month</div>
			${group_rows || `<div class="src-empty">No spend this month.</div>`}
		`);
	}

	// ── P&L summary ──────────────────────────────────────────────────────

	_render_pl_summary(data) {
		if (!data) return;
		const profit_cls = data.net_profit >= 0 ? "src-badge--success" : "src-badge--danger";
		const profit_color = data.net_profit >= 0 ? "var(--alert-text-success)" : "var(--alert-text-danger)";
		this.$main.find(".src-pl-summary").html(`
			<div class="src-figures src-figures--pl">
				<div><span class="src-label">Revenue</span><span class="src-value src-value--hero">${format_currency(
					data.revenue
				)}</span></div>
				<div><span class="src-label">Expenses</span><span class="src-value">${format_currency(
					data.expenses
				)}</span></div>
				<div><span class="src-label">Net Profit</span><span class="src-value" style="color:${profit_color}">${format_currency(
					data.net_profit
				)}</span></div>
				<div><span class="src-label">Margin</span><span class="src-badge ${profit_cls}">${frappe.utils.escape_html(
					data.margin_pct
				)}%</span></div>
			</div>
		`);
	}

	// ── Charts ───────────────────────────────────────────────────────────

	_render_site_wise_chart(rows) {
		const $el = this.$main.find(".src-chart-site");
		if (!rows || !rows.length) {
			$el.html(`<div class="src-empty">No submitted bookings yet.</div>`);
			return;
		}
		$el.empty();
		new frappe.Chart($el[0], {
			data: {
				labels: rows.map((r) => r.building_name || r.building),
				datasets: [
					{ name: "Booked", values: rows.map((r) => r.total_booked || 0) },
					{ name: "Received", values: rows.map((r) => r.total_received || 0) },
					{ name: "Pending", values: rows.map((r) => r.total_pending || 0) },
				],
			},
			type: "bar",
			height: this._chart_height(),
			colors: [CHART_COLORS.blue, CHART_COLORS.green, CHART_COLORS.orange],
			axisOptions: { xAxisMode: "tick", shortenYAxisNumbers: 1 },
			barOptions: { spaceRatio: 0.4 },
			tooltipOptions: { formatTooltipY: (d) => this._format_number(d) },
		});
	}

	_format_number(v) {
		return (v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
	}

	_render_aging(rows) {
		const $target = this.$main.find(".src-aging");
		if (!rows || !rows.length || !rows.some((r) => r.pending_amount)) {
			$target.html(`<div class="src-empty">Nothing outstanding — all instalments collected.</div>`);
			return;
		}
		const max_amount = Math.max(...rows.map((r) => r.pending_amount || 0), 1);
		const body = rows
			.map((r) => {
				const pct = Math.max(4, Math.round(((r.pending_amount || 0) / max_amount) * 100));
				return `
				<div class="src-bar-row">
					<div class="src-bar-info"><span class="src-bar-label">${frappe.utils.escape_html(r.bucket)}</span></div>
					<div class="src-progress-track src-progress-track--thin">
						<div class="src-progress-fill" style="width:${pct}%;background:${AGING_COLOR[r.bucket]}"></div>
					</div>
					<span class="src-bar-value">${format_currency(r.pending_amount)}</span>
				</div>`;
			})
			.join("");
		$target.html(body);
	}

	// ── Styles ───────────────────────────────────────────────────────────

	_inject_styles() {
		if (document.getElementById("src-dashboard-style")) return;
		const style = document.createElement("style");
		style.id = "src-dashboard-style";
		style.textContent = `
			/* Full-bleed: this page only (scoped to its own wrapper, never touches other pages) */
			.src-dashboard-wrapper .container { max-width: 100% !important; }
			.src-dashboard-wrapper .page-body { padding: 0; }

			.src-dash {
				font-family: inherit;
				background: var(--bg-color);
				color: var(--text-color);
				padding: clamp(20px, 2vw, 40px);
			}
			.src-dash * { box-sizing: border-box; }
			.src-dash .icon { color: inherit; }

			/* Header */
			.src-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: clamp(18px, 1.6vw, 28px); }
			.src-clock { font-size: clamp(1.3rem, 1.6vw, 2rem); font-weight: 700; letter-spacing: -0.01em; font-variant-numeric: tabular-nums; display: block; }
			.src-brand-sub { font-size: clamp(0.8rem, 0.6vw, 0.95rem); color: var(--text-muted); }
			.src-live { display: flex; align-items: center; gap: 8px; background: var(--card-bg); border: 1px solid var(--border-color); padding: 8px 14px; border-radius: 999px; }
			.src-live-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--green-600); animation: src-pulse 2s infinite; }
			.src-updated { font-size: clamp(0.78rem, 0.55vw, 0.9rem); color: var(--text-muted); font-variant-numeric: tabular-nums; }
			@keyframes src-pulse {
				0% { box-shadow: 0 0 0 0 rgba(48,166,109,0.55); }
				70% { box-shadow: 0 0 0 7px rgba(48,166,109,0); }
				100% { box-shadow: 0 0 0 0 rgba(48,166,109,0); }
			}

			/* KPI cards */
			.src-kpi-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: clamp(12px, 1vw, 20px); margin-bottom: clamp(16px, 1.6vw, 28px); }
			.src-kpi-row--sub { margin-bottom: 18px; }
			.src-kpi-card {
				position: relative;
				background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 10px;
				padding: clamp(16px, 1.2vw, 24px) clamp(16px, 1.2vw, 22px);
				box-shadow: var(--card-shadow);
			}
			.src-kpi-card::before {
				content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: var(--kpi-accent, var(--blue-600));
				border-radius: 10px 0 0 10px;
			}
			.src-kpi-card--sub { padding: 14px 16px; }
			.src-kpi-icon { display: inline-flex; color: var(--kpi-accent, var(--blue-600)); margin-bottom: 10px; }
			.src-kpi-value { font-size: clamp(2rem, 2.4vw, 3.1rem); font-weight: 700; line-height: 1.1; font-variant-numeric: tabular-nums; }
			.src-kpi-label { font-size: clamp(0.72rem, 0.55vw, 0.85rem); letter-spacing: 0.05em; text-transform: uppercase; color: var(--text-muted); margin-top: 6px; }
			.src-kpi-sub { font-size: clamp(0.75rem, 0.55vw, 0.85rem); color: var(--text-color); margin-top: 4px; font-variant-numeric: tabular-nums; }

			/* Panels */
			.src-panel { background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 12px; padding: clamp(18px, 1.4vw, 26px); margin-bottom: clamp(16px, 1.4vw, 24px); box-shadow: var(--card-shadow); }
			.src-panel-head { display: flex; align-items: center; gap: 10px; margin-bottom: clamp(14px, 1.1vw, 20px); }
			.src-panel-icon { display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; border-radius: 7px; background: var(--control-bg); color: var(--text-muted); }
			.src-panel-title { font-size: clamp(0.9rem, 0.75vw, 1.05rem); font-weight: 600; letter-spacing: 0.01em; color: var(--text-color); }
			.src-panel-meta { margin-left: auto; font-size: 0.8rem; color: var(--text-muted); }
			.src-two-col { display: grid; grid-template-columns: 1fr 1fr; gap: clamp(16px, 1.4vw, 24px); }
			.src-subhead { font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted); margin: 4px 0 12px; }

			/* Loading skeleton (shown until first payload arrives) */
			.src-skel { display: none; height: 64px; border-radius: 6px; background: linear-gradient(90deg, var(--control-bg) 25%, var(--fg-hover-color) 37%, var(--control-bg) 63%); background-size: 400% 100%; animation: src-shimmer 1.4s ease infinite; }
			.src-loading .src-skel { display: block; }
			@keyframes src-shimmer { 0% { background-position: 100% 50%; } 100% { background-position: 0 50%; } }

			/* Flat grid */
			.src-legend { display: flex; gap: 18px; margin-bottom: 14px; flex-wrap: wrap; }
			.src-legend-item { display: flex; align-items: center; gap: 7px; font-size: 0.85rem; color: var(--text-muted); }
			.src-dot { width: 9px; height: 9px; border-radius: 50%; display: inline-block; flex: none; }
			.src-building-name { font-size: clamp(0.95rem, 0.8vw, 1.1rem); font-weight: 600; margin: 16px 0 8px; display: flex; align-items: baseline; gap: 10px; }
			.src-building-name:first-of-type { margin-top: 0; }
			.src-building-count { font-size: 0.78rem; font-weight: 400; color: var(--text-muted); }
			.src-flat-squares { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 4px; }
			.src-flat-square { width: clamp(20px, 1.5vw, 30px); height: clamp(20px, 1.5vw, 30px); border-radius: 6px; border: 1px solid var(--border-color); cursor: pointer; transition: transform .1s ease; }
			.src-flat-square:hover { transform: scale(1.15); box-shadow: var(--modal-shadow); }
			.src-tooltip {
				position: fixed; z-index: 9999; pointer-events: none; opacity: 0; transition: opacity .08s ease;
				background: var(--gray-900); color: var(--gray-50); border: 1px solid var(--border-color); border-radius: 8px; padding: 9px 12px;
				font-size: 0.82rem; line-height: 1.5; box-shadow: var(--modal-shadow); max-width: 260px;
			}

			/* Figures / progress */
			.src-figures { display: flex; justify-content: space-between; gap: 14px; margin-bottom: 16px; flex-wrap: wrap; }
			.src-figures > div { display: flex; flex-direction: column; gap: 3px; }
			.src-figures--pl > div:first-child { flex: 1 1 100%; }
			.src-label { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted); }
			.src-value { font-size: clamp(1.05rem, 1vw, 1.35rem); font-weight: 600; font-variant-numeric: tabular-nums; }
			.src-value--hero { font-size: clamp(1.8rem, 2vw, 2.6rem); }
			.src-progress-row { display: flex; align-items: center; gap: 12px; }
			.src-progress-track { flex: 1; background: var(--control-bg); border-radius: 5px; height: 10px; overflow: hidden; }
			.src-progress-track--thin { height: 7px; margin: 5px 0; }
			.src-progress-fill { height: 100%; border-radius: 5px; }
			.src-progress-pill { font-size: 0.85rem; font-weight: 600; padding: 3px 10px; border-radius: 999px; font-variant-numeric: tabular-nums; background: var(--control-bg); }

			/* Status badges — Frappe's own alert bg/text pairs, theme-matched */
			.src-badge { font-size: 0.8rem; font-weight: 600; padding: 3px 10px; border-radius: 999px; font-variant-numeric: tabular-nums; white-space: nowrap; }
			.src-badge--info { background: var(--alert-bg-info); color: var(--alert-text-info); }
			.src-badge--warning { background: var(--alert-bg-warning); color: var(--alert-text-warning); }
			.src-badge--danger { background: var(--alert-bg-danger); color: var(--alert-text-danger); }
			.src-badge--success { background: var(--alert-bg-success); color: var(--alert-text-success); }

			/* Tables */
			.src-table-scroll { max-height: 420px; overflow-y: auto; border-radius: 6px; }
			.src-table { width: 100%; border-collapse: collapse; font-size: clamp(0.85rem, 0.7vw, 1rem); }
			.src-table th { position: sticky; top: 0; background: var(--card-bg); text-align: left; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted); border-bottom: 1px solid var(--border-color); padding: 10px 12px; z-index: 1; }
			.src-table td { padding: 9px 12px; border-bottom: 1px solid var(--border-color); }
			.src-table tbody tr:hover { background: var(--fg-hover-color); }
			.src-table tbody tr:nth-child(even) { background: var(--subtle-fg); }
			.src-num { text-align: right; font-variant-numeric: tabular-nums; }
			.src-empty { color: var(--text-muted); font-size: 0.9rem; padding: 8px 0; }

			/* Stock search + site groups */
			.src-search-row { display: flex; align-items: center; gap: 8px; border: 1px solid var(--border-color); border-radius: 8px; padding: 6px 12px; margin-bottom: 14px; background: var(--control-bg); color: var(--text-muted); }
			.src-search-row .icon { flex: none; }
			.src-search-input { flex: 1; border: none; background: transparent; outline: none; font-size: 0.9rem; color: var(--text-color); }
			.src-stock-site { margin-bottom: 14px; }
			.src-stock-site:last-child { margin-bottom: 0; }

			/* Bar rows (stock / spend) */
			.src-bar-row { display: grid; grid-template-columns: 1fr; gap: 5px; padding: 10px 0; border-bottom: 1px solid var(--border-color); }
			.src-bar-row:last-child { border-bottom: none; }
			.src-bar-info { display: flex; justify-content: space-between; font-size: 0.9rem; }
			.src-bar-label { font-weight: 500; }
			.src-bar-sub { color: var(--text-muted); font-size: 0.78rem; }
			.src-bar-value { font-size: 0.78rem; color: var(--text-muted); font-variant-numeric: tabular-nums; }

			@media (max-width: 900px) {
				.src-two-col { grid-template-columns: 1fr; }
				.src-header { flex-direction: column; align-items: flex-start; gap: 10px; }
			}
		`;
		document.head.appendChild(style);
	}
}
