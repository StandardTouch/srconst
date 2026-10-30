/* Site Showcase — client presentation page. Vanilla JS + GSAP (no three.js).
 * Data: srconst.showcase_api (list of site summaries, one full site on demand). */
(function () {
	const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
	const slug = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-");
	const money = (v) => {
		if (v == null || v === "") return __("Price on request");
		try { if (window.format_currency) return format_currency(v); } catch (e) { /* fall through */ }
		return Number(v).toLocaleString();
	};
	const SLAB_W = 230, SLAB_D = 150;
	const call = (method, args) => frappe.call({ method: "srconst.showcase_api." + method, args }).then((r) => r.message);

	class SiteShowcase {
		constructor(root) {
			this.root = root;
			this.summaries = [];
			this.cache = {};
			this.ratios = {};
			this.site = null;
			this.block = null;
			this.level = null;
			this.unit = null;
			this.rot = -30;
			this.auto = true;
			this.drag = null;
			this.mode = "tower";
			this.filter = null;
			this.perms = {};
			this.hoverSlab = null;
			this.dwell = null;
			this.keyFn = (e) => this.onKey(e);
			this.lastLoad = Date.now();
			this.rtFn = (m) => this.onInventoryChanged(m);
			this.resizeFn = () => { clearTimeout(this.rzT); this.rzT = setTimeout(() => this.onResize(), 220); };
						this.build();
			this.ready = this.load().then(() => this.routeOpen());
			this.enter();
		}

		enter() {
			document.addEventListener("keydown", this.keyFn);
			window.addEventListener("resize", this.resizeFn);
			try { frappe.realtime.on("showcase_inventory_changed", this.rtFn); } catch (e) { /* live updates are optional */ }
			if (this.site && Date.now() - this.lastLoad > 45000) this.onInventoryChanged({ site: this.site.id }); // came back to the tab after a while
		}
		leave() { document.removeEventListener("keydown", this.keyFn); window.removeEventListener("resize", this.resizeFn); try { frappe.realtime.off("showcase_inventory_changed", this.rtFn); } catch (e) { /* ignore */ } if (this.el.classList.contains("present")) this.present(false); }

		/* ---------- shell ---------- */
		build() {
			this.root.innerHTML = `
			<div class="srs">
				<div class="srs-bar">
					<div class="srs-brand"><img class="logo" alt="" hidden><span class="nm">${__("Site Showcase")}</span></div>
					<div class="srs-tools">
						<button class="srs-ghost" data-act="gallery">${__("All sites")}</button>
						<button class="srs-ghost" data-act="home">${__("Overview")}</button>
						<button class="srs-ghost" data-act="brochure" hidden>${__("Brochure")}</button>
						<button class="srs-ghost" data-act="addsite" hidden>${__("+ Add site")}</button>
						<button class="srs-ghost" data-act="setup" hidden>${__("Setup")}</button>
						<button class="srs-ghost" data-act="present">${__("Present")}</button>
					</div>
				</div>
				<div class="srs-loading">${__("Loading sites…")}</div>

				<div class="srs-view srs-gallery">
					<div class="srs-gal-head">
						<div><div class="srs-kicker">${__("Portfolio")}</div><h1>${__("Choose a")} <em>${__("site")}</em></h1></div>
						<input class="srs-search" type="search" placeholder="${__("Search sites or locations")}">
					</div>
					<div class="srs-cards"></div>
				</div>

				<div class="srs-view srs-hero">
					<div class="srs-hero-bg"></div>
					<div class="srs-hero-fg"></div>
					<div class="srs-hero-copy">
						<div class="srs-kicker"></div>
						<h1></h1>
						<p class="srs-sub"></p>
						<button class="srs-cta" data-act="explore">${__("Explore residences")} →</button>
					</div>
					<div class="srs-hero-stats"></div>
				</div>

				<div class="srs-view srs-explore">
					<div class="srs-left">
						<div class="srs-ctrl">
							<div class="srs-modes">
								<button class="srs-pill on" data-mode="tower">${__("3D Tower")}</button>
								<button class="srs-pill" data-mode="elev">${__("Elevation")}</button>
							</div>
							<div class="srs-blocks"></div>
						</div>
						<div class="srs-scene-wrap"><div class="srs-scene"><div class="srs-ground"></div><div class="srs-tower"></div></div></div>
						<div class="srs-elev"><img alt=""><div class="srs-noimg">${__("No building image yet. A manager can add one with Setup.")}</div></div>
						<div class="srs-hint">${__("Drag to rotate · Hover a floor to preview")}</div>
					</div>
					<div class="srs-right">
						<div class="srs-lvl-head">
							<div><h2></h2><small></small></div>
							<div class="srs-steps"><button class="srs-step" data-step="1" title="${__("Up")}">↑</button><button class="srs-step" data-step="-1" title="${__("Down")}">↓</button></div>
						</div>
						<div class="srs-counts"></div>
						<div class="srs-split"><div class="srs-planwrap"></div><div class="srs-units"></div></div>
					</div>
				</div>
				<div class="srs-tip"></div>
				<div class="srs-modal-wrap"></div>
				<div class="srs-sheet-wrap"><div class="srs-sheet"></div></div>
			</div>`;
			const q = (s) => this.root.querySelector(s);
			this.el = q(".srs");
			this.q = q;
			this.el.addEventListener("click", (e) => this.onClick(e));
			this.el.addEventListener("pointerover", (e) => this.onHover(e, true));
			this.el.addEventListener("pointerout", (e) => this.onHover(e, false));
			if (window.ResizeObserver) new ResizeObserver(() => this.fitPlan()).observe(q(".srs-split"));
			q(".srs-search").addEventListener("input", (e) => this.filterCards(e.target.value));

			const wrap = q(".srs-scene-wrap");
			wrap.addEventListener("pointerdown", (e) => { this.drag = { x: e.clientX, rot: this.rot, moved: 0 }; this.pauseSpin(true); });
			wrap.addEventListener("pointermove", (e) => {
				if (!this.drag) return;
				const dx = e.clientX - this.drag.x;
				this.drag.moved = Math.max(this.drag.moved, Math.abs(dx));
				this.rot = this.drag.rot + dx * 0.4;
				this.applyRot();
			});
			const end = () => { setTimeout(() => { this.drag = null; if (!this.hoverSlab) this.pauseSpin(false); }, 0); };
			wrap.addEventListener("pointerup", end);
			wrap.addEventListener("pointercancel", end);
			wrap.addEventListener("pointermove", () => this.armDwell());
			this.el.addEventListener("pointermove", (e) => this.moveTip(e));
			wrap.addEventListener("wheel", (e) => { e.preventDefault(); this.step(e.deltaY < 0 ? 1 : -1); }, { passive: false });
		}

		async routeOpen() {
			const o = frappe.route_options;
			if (!o || !o.site) return;
			frappe.route_options = null;
			await this.ready;
			await this.selectSite(o.site);
			if (!this.site || this.site.id !== o.site) return;
			this.explore();
			if (!o.flat) return;
			for (const blk of this.site.blocks) {
				for (const lv of blk.levels) {
					const i = lv.units.findIndex((u) => u.id === o.flat);
					if (i < 0) continue;
					this.block = blk;
					this.el.style.setProperty("--acc", blk.color || "#c9b79c");
					this.renderBlocks();
					this.buildTower();
					this.setLevel(lv.level, true);
					return this.openUnit(i);
				}
			}
		}

		async load(selectId) {
			const r = await call("get_showcase_sites").catch(() => null);
			this.summaries = (r && r.data) || [];
			this.lastLoad = Date.now();
			this.perms = (r && r.perms) || {};
			const ld = this.q(".srs-loading");
			if (ld) ld.remove();
			this.renderCards();
			if (selectId) return this.selectSite(selectId);
			this.showGallery();
		}

		/* ---------- gallery (all sites) ---------- */
		renderCards() {
			const list = this.summaries;
			const add = this.perms.create_site ? `<button class="srs-card add" data-act="addsite"><div class="plus">+</div><h3>${__("Add a site")}</h3><div class="loc">${__("Blocks, floors and flats")}</div></button>` : "";
			this.q(".srs-cards").innerHTML = (list.length ? list.map((s) => `
				<button class="srs-card ${s.empty ? "empty" : ""}" data-site="${esc(s.id)}" data-key="${esc((s.name + " " + (s.location || "")).toLowerCase())}">
					${this.perms.create_site && s.cost_center ? `<span class="del" role="button" title="${__("Delete site")}" data-act="delsite" data-cc="${esc(s.cost_center)}" data-name="${esc(s.name)}">🗑</span>` : ""}
					<div class="img" style="${s.image ? `background-image:url('${esc(s.image)}')` : ""}"></div>
					<div class="shade"></div>
					<div class="meta">
						<div class="loc">${esc(s.location || s.developer || "")}</div>
						<h3>${esc(s.name)}</h3>
						${s.empty
							? `<div class="nums"><span>${this.perms.create_site ? __("No flats yet · tap to set up") : __("No flats yet")}</span></div>`
							: `<div class="nums"><span><b>${s.stats.blocks}</b>${s.stats.blocks === 1 ? __("block") : __("blocks")}</span><span><b>${s.stats.total}</b>${__("residences")}</span><span><b>${s.stats.available}</b>${__("available")}</span></div>`}
					</div>
				</button>`).join("") : `<div class="srs-empty" style="grid-column:1/-1;padding:80px 0">${__("No sites found.")}</div>`) + add;
		}

		deleteSite(cc, name) {
			frappe.confirm(__("Delete {0}? This permanently removes its cost center, buildings and flats. It is refused if any flat has a booking.", [name]), async () => {
				try {
					await call("delete_site", { cost_center: cc });
					frappe.show_alert({ message: __("{0} deleted", [name]), indicator: "green" });
					delete this.cache[cc];
					await this.load();
				} catch (e) { /* Frappe has shown the server's message */ }
			});
		}

		filterCards(text) {
			const t = text.trim().toLowerCase();
			this.root.querySelectorAll(".srs-card[data-key]").forEach((c) => { c.style.display = !t || c.dataset.key.includes(t) ? "" : "none"; });
		}

		showGallery() {
			this.showView("srs-gallery");
			this.q(".nm").textContent = __("Site Showcase");
			this.q(".logo").hidden = true;
			gsap.fromTo(".srs-gal-head > *, .srs-card", { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, stagger: 0.07, ease: "power3.out" });
		}

		async selectSite(id) {
			if (!this.cache[id]) {
				const card = this.root.querySelector(`.srs-card[data-site="${CSS.escape(id)}"]`);
				if (card) card.classList.add("busy");
				const r = await call("get_showcase_site", { site_id: id }).catch(() => null);
				if (card) card.classList.remove("busy");
				if (!r || !r.data) { frappe.show_alert({ message: __("Could not load the site"), indicator: "red" }); return; }
				this.perms = r.perms || this.perms;
				if (!r.data.blocks.length) {
					if (this.perms.create_site) return this.openAddSite(id);
					return frappe.show_alert({ message: __("{0} has no flats set up yet. Only System Manager or SRC MD can add them.", [r.data.name]), indicator: "orange" });
				}
				this.cache[id] = r.data;
			}
			this.setSite(this.cache[id]);
		}

		/* ---------- hero ---------- */
		setSite(s) {
			this.site = s;
			this.block = s.blocks[0] || null;
			const logo = this.q(".logo");
			if (s.logo) { logo.src = s.logo; logo.hidden = false; } else logo.hidden = true;
			this.q(".nm").textContent = s.name;
			this.el.style.setProperty("--acc", (this.block && this.block.color) || "#c9b79c");
			this.showHero();
		}

		stats(s) {
			let total = 0, avail = 0, floors = 0;
			s.blocks.forEach((b) => { floors = Math.max(floors, b.levels.length); b.levels.forEach((l) => l.units.forEach((u) => { total++; if (/avail/i.test(u.status)) avail++; })); });
			return { total, avail, floors, blocks: s.blocks.length };
		}

		syncBar() {
			const btn = this.q('[data-act="setup"]');
			if (btn) btn.hidden = !(this.perms.manage && this.site && this.site.kind === "erp" && this.q(".srs-explore").classList.contains("on"));
			const bro = this.q('[data-act="brochure"]');
			if (bro) bro.hidden = !(this.site && this.site.kind === "erp" && (this.block && this.block.brochure || this.site.brochure) && !this.q(".srs-gallery").classList.contains("on"));
			const add = this.q('[data-act="addsite"]');
			if (add) add.hidden = !(this.perms.create_site && this.q(".srs-gallery").classList.contains("on"));
		}

		showView(cls) {
			if (cls !== "srs-hero" && this.kb) { this.kb.kill(); this.kb = null; }
			this.root.querySelectorAll(".srs-view").forEach((v) => v.classList.toggle("on", v.classList.contains(cls)));
			this.syncBar();
		}

		showHero() {
			const s = this.site, st = this.stats(s);
			this.showView("srs-hero");
			const bg = this.q(".srs-hero-bg"), fg = this.q(".srs-hero-fg"), img = s.hero || s.image;
			bg.classList.remove("blur");
			fg.style.backgroundImage = "none";
			bg.style.background = img ? "" : "radial-gradient(circle at 30% 30%, #26303d, #090c10)";
			bg.style.backgroundImage = img ? `url("${img}")` : "none";
			// a photo that matches the screen fills it; anything else (brochure pages, portraits) is shown whole over a blurred copy
			if (img) {
				this.ratio(img).then((r) => {
					if (this.site !== s) return;
					const box = this.q(".srs-hero");
					const fits = Math.abs(r / (box.clientWidth / box.clientHeight) - 1) < 0.3;
					bg.classList.toggle("blur", !fits);
					if (!fits) { fg.style.backgroundImage = `url("${img}")`; gsap.fromTo(fg, { opacity: 0, scale: 0.96 }, { opacity: 1, scale: 1, duration: 1.2, ease: "power2.out" }); }
				});
			}
			this.q(".srs-hero .srs-kicker").textContent = [s.developer, s.location].filter(Boolean).join(" · ");
			this.q(".srs-hero h1").innerHTML = String(s.name).split(" ").map((w) => `<span><i>${esc(w)}</i></span>`).join(" ");
			this.q(".srs-sub").textContent = s.description || "";
			this.q(".srs-hero-stats").innerHTML = [
				[st.blocks, st.blocks > 1 ? __("Towers") : __("Tower")],
				[st.floors, __("Levels")],
				[st.total, __("Residences")],
				[st.avail, __("Available")],
			].map(([n, l]) => `<div class="srs-stat"><b data-n="${n}">0</b><span>${l}</span></div>`).join("");

			gsap.killTweensOf(bg);
			gsap.timeline()
				.fromTo(bg, { scale: 1.05, opacity: 0 }, { scale: 1, opacity: 1, duration: 1.8, ease: "power2.out" }, 0)
				.fromTo(".srs-hero .srs-kicker", { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8 }, 0.3)
				.fromTo(".srs-hero h1 i", { yPercent: 110 }, { yPercent: 0, duration: 1, stagger: 0.12, ease: "power4.out" }, 0.4)
				.fromTo(".srs-sub, .srs-cta", { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, stagger: 0.12 }, 0.9)
				.fromTo(".srs-stat", { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, stagger: 0.1 }, 1.0);
			this.q(".srs-hero-stats").querySelectorAll("b").forEach((b) => {
				const o = { v: 0 };
				gsap.to(o, { v: +b.dataset.n, duration: 1.6, delay: 1.1, ease: "power2.out", onUpdate: () => (b.textContent = Math.round(o.v)) });
			});
			if (this.kb) this.kb.kill();
			this.kb = gsap.to(bg, { scale: 1.03, duration: 22, ease: "none", yoyo: true, repeat: -1, delay: 1.8 });
		}

		/* ---------- explorer ---------- */
		explore() {
			if (!this.block) return;
			this.showView("srs-explore");
			this.renderBlocks();
			this.buildTower();
			const lv = this.block.levels;
			const first = lv.find((l) => l.units.length) || lv[0];
			this.setLevel(first ? first.level : null, true);
			// clearProps: a leftover transform would trap the full-screen plan editor inside this column
			gsap.fromTo(".srs-left", { opacity: 0, x: -40 }, { opacity: 1, x: 0, duration: 0.9, ease: "power3.out", clearProps: "transform,opacity" });
			gsap.fromTo(".srs-right", { opacity: 0, x: 40 }, { opacity: 1, x: 0, duration: 0.9, ease: "power3.out", clearProps: "transform,opacity" });
		}

		renderBlocks() {
			this.q(".srs-blocks").innerHTML = this.site.blocks.length > 1
				? this.site.blocks.map((b) => `<button class="srs-pill sm ${b === this.block ? "on" : ""}" data-block="${esc(b.id)}">${esc(b.name)}</button>`).join("")
				: "";
			this.setElevation();
		}

		setElevation() {
			const src = this.block.elevation || this.site.hero || "";
			const img = this.q(".srs-elev img");
			img.style.display = src ? "" : "none";
			if (src) img.src = src;
			this.q(".srs-noimg").style.display = src ? "none" : "";
		}

		levelStats(l) {
			const s = { a: 0, p: 0, s: 0, total: l.units.length };
			l.units.forEach((u) => { if (/sold/i.test(u.status)) s.s++; else if (/avail/i.test(u.status)) s.a++; else s.p++; });
			return s;
		}

		barGradient(st) {
			if (!st.total) return "rgba(246,244,241,.18)";
			const a = (st.a / st.total) * 100, p = a + (st.p / st.total) * 100;
			return `linear-gradient(90deg,#7fd1a0 0 ${a}%,#e8b85c ${a}% ${p}%,#e07a6f ${p}% 100%)`;
		}

		buildTower() {
			const levels = this.block.levels, n = levels.length;
			const stageH = this.q(".srs-scene-wrap").clientHeight || 500;
			const sw = this.q(".srs-scene-wrap");
			this.lastW = sw.clientWidth;
			this.lastH = sw.clientHeight;
			this.sceneScale = Math.max(0.68, Math.min(1.5, (sw.clientWidth || 520) / 520)); // bigger stage, bigger model; smaller on a phone
			this.H = Math.max(9, Math.min(30, Math.floor((stageH * 0.62) / Math.max(n, 1)) - 3));
			this.GAP = 3;
			const W = SLAB_W, D = SLAB_D, H = this.H, step = H + this.GAP, lift = H * 2.2;
			const tower = this.q(".srs-tower");
			tower.style.cssText = `left:${-W / 2}px;top:0;width:${W}px;height:${H}px`;
			const ph = Math.max(10, Math.round(H * 0.5)), pw = W * 1.1, pd = D * 1.14; // a low stone podium, just wider than the tower
			const G = W * 2.9, cx = G / 2, cy = G / 2;
			const ground = this.q(".srs-ground");
			ground.style.cssText = `width:${G}px;height:${G}px;left:${-G / 2}px;top:${-G / 2 + H + this.GAP + ph}px;transform:rotateX(90deg)`;
			// landscaping on the ground plane: a path from the entrance and soft tree canopies around the plinth
			const trees = [[-0.7, 0.6, 15], [0.72, 0.58, 14], [-0.88, 0.05, 13], [0.9, 0.0, 14], [-0.62, -0.62, 12], [0.64, -0.66, 12], [0, -0.9, 15], [-0.45, 0.88, 10], [0.47, 0.9, 10]];
			ground.innerHTML = `<i class="srs-path" style="left:${cx - 13}px;top:${cy + pd / 2 + 8}px;width:26px;height:${G / 2 - pd / 2 - 40}px"></i>`
				+ trees.map(([fx, fy, r]) => `<i class="srs-tree" style="left:${cx + fx * G * 0.4 - r}px;top:${cy + fy * G * 0.4 - r}px;width:${r * 2}px;height:${r * 2}px"></i>`).join("");

			// five faces of a box centred on the tower axis; oy shifts it down
			const box = (w, d, h, o = {}) => {
				const L = (W - w) / 2, oy = o.oy || 0, c = o.cls || "";
				const face = (k, fw, fh, left, top, tf, inner, bg) =>
					`<div class="srs-face ${c} ${k}" style="width:${fw}px;height:${fh}px;left:${left}px;top:${top + oy}px;${bg || ""}transform:${tf}">${inner || ""}</div>`;
				return face("fr", w, h, L, 0, `translateZ(${d / 2}px)`, o.front, o.bgF)
					+ face("bk", w, h, L, 0, `rotateY(180deg) translateZ(${d / 2}px)`, o.back, o.bgF)
					+ face("sl", d, h, L + (w - d) / 2, 0, `rotateY(-90deg) translateZ(${w / 2}px)`, o.side, o.bgS)
					+ face("sr", d, h, L + (w - d) / 2, 0, `rotateY(90deg) translateZ(${w / 2}px)`, o.side, o.bgS)
					+ face("tp", w, d, L, (h - d) / 2, `rotateX(90deg) translateZ(${h / 2}px)`, "", "");
			};
			// window grid as an SVG background (seeded, so a floor always looks the same)
			const win = (w, h, cols, seed, lit) => {
				let t = seed * 2654435761 >>> 0;
				const rnd = () => ((t = (t + 0x6d2b79f5) >>> 0), ((Math.imul(t ^ (t >>> 15), 1 | t) >>> 0) / 4294967296));
				const cw = w / cols;
				let r = "";
				for (let i = 0; i < cols; i++) {
					const on = rnd() < lit;
					r += `<rect x='${(i * cw + cw * 0.19).toFixed(1)}' y='${(h * 0.2).toFixed(1)}' width='${(cw * 0.62).toFixed(1)}' height='${(h * 0.6).toFixed(1)}' rx='1' fill='${on ? "rgba(255,214,140,.9)" : "rgba(160,200,235,.2)"}'/>`;
				}
				const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${w} ${h}' preserveAspectRatio='none'>${r}</svg>`;
				return `background-image:linear-gradient(115deg,rgba(255,255,255,.17) 0%,rgba(255,255,255,0) 40%,rgba(255,255,255,.07) 72%,rgba(255,255,255,0) 100%),url('data:image/svg+xml,${encodeURIComponent(svg).replace(/'/g, "%27")}');background-size:100% 100%,100% 100%;`;
			};
			const ledge = `<div class="srs-led" style="width:${W}px;height:3px;top:${H - 3}px;transform:translateZ(${D / 2 + 8}px)"></div>`;

			const rh = Math.round(H * 1.1), ah = Math.round(H * 3), pt = Math.max(5, Math.round(H * 0.22));
			const part = (top, h, inner, tf) => `<div class="srs-part" style="top:${top}px;width:${W}px;height:${h}px${tf ? `;transform:${tf}` : ""}">${inner}</div>`;
			const roof = part(-pt, pt, box(W * 1.04, D * 1.04, pt, { cls: "parapet" }))
				+ part(-(pt + rh), rh, box(W * 0.46, D * 0.5, rh, { cls: "roofbox" }) + part(-ah, ah, box(5, 5, ah, { cls: "mast" }) + part(-6, 6, box(8, 8, 6, { cls: "beacon" }))), `translate3d(${-W * 0.12}px,0,${D * 0.06}px)`)
				+ part(-(pt + rh * 0.8), rh * 0.8, box(W * 0.18, D * 0.26, rh * 0.8, { cls: "tank" }), `translate3d(${W * 0.27}px,0,${-D * 0.14}px)`);

			const base = `<div class="srs-part base" style="top:${H + this.GAP}px;width:${W}px;height:${ph}px">${box(pw, pd, ph, { cls: "podium plinth", front: '<i class="door"></i>', back: '<i class="door"></i>' })}</div>`;
			// two entrance steps in front of the door
			const steps = [[W * 0.3, 20, 0.34], [W * 0.24, 36, 0.17]].map(([sw, sd, k]) =>
				`<div class="srs-part base" style="top:${H + this.GAP + ph * (1 - k)}px;width:${W}px;height:${ph * k}px;transform:translateZ(${pd / 2 + sd / 2 - 2}px)">${box(sw, sd, ph * k, { cls: "step" })}</div>`).join("");
			const canopy = `<div class="srs-part base" style="top:${H + this.GAP - 2}px;width:${W}px;height:5px;transform:translateZ(${pd / 2 + 6}px)">${box(W * 0.3, 34, 5, { cls: "canopy" })}</div>`;
			const coreH = (n - 1) * step + H + lift;
			const core = `<div class="srs-part core" style="top:${-((n - 1) * step + lift)}px;width:${W}px;height:${coreH}px">${box(W * 0.2, D * 0.32, coreH, { cls: "corebox" })}</div>`;
			// four corner columns: they stay put when floors lift apart, like the structural frame
			const pillars = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) =>
				`<div class="srs-part pillar" style="top:${-((n - 1) * step + lift)}px;width:${W}px;height:${coreH}px;transform:translate3d(${sx * (W / 2 - 3)}px,0,${sz * (D / 2 - 3)}px)">${box(6, 6, coreH, { cls: "pillar" })}</div>`).join("");

			const slabs = levels.map((l, i) => {
				const st = this.levelStats(l);
				const bar = `<i class="bar" style="background:${this.barGradient(st)}"></i>`;
				const num = `<span class="num" style="font-size:${Math.max(12, Math.min(20, H * 0.9))}px">${esc(l.short != null ? l.short : String(l.level).padStart(2, "0"))}</span>`;
				return `<div class="srs-slab" data-level="${l.level}" style="width:${W}px;height:${H}px">
					${box(W, D, H, { front: num, back: num, side: bar, bgF: win(W, H, 12, l.level * 7 + 1, 0.3), bgS: win(D, H, 8, l.level * 7 + 2, 0.22) })}
					${ledge}<div class="srs-part flip" style="width:${W}px;height:${H}px;transform:rotateY(180deg)">${ledge}</div>
					${i === n - 1 ? roof : ""}
				</div>`;
			}).join("");

			tower.innerHTML = `<div class="srs-spin">${core + pillars + base + steps + canopy + slabs}</div>`;
			this.slabs = [...tower.querySelectorAll(".srs-slab[data-level]")];
			this.layoutSlabs(null);
			if (!this.noIntro) gsap.from(this.slabs, { y: -420, opacity: 0, duration: 1.1, stagger: { each: 0.045, from: "start" }, ease: "bounce.out", delay: 0.2 });
			if (!this.noIntro) gsap.from(tower.querySelectorAll(".base,.core,.pillar"), { opacity: 0, duration: 1.2, delay: 0.4 });
			this.applyRot();
			this.applyFilter();
		}

		layoutSlabs(selIdx, animate) {
			const step = this.H + this.GAP, lift = this.H * 2.2;
			this.slabs.forEach((s, i) => {
				const y = -(i * step) - (selIdx != null && i > selIdx ? lift : 0);
				if (animate) gsap.to(s, { y, duration: 0.7, ease: "power3.out", overwrite: "auto" });
				else gsap.set(s, { y });
			});
			// centre the tower vertically in the stage
			gsap.set(this.q(".srs-scene"), { y: ((this.slabs.length * step) / 2) * (this.sceneScale || 1), scale: this.sceneScale || 1 });
		}

		/* Spin around the vertical axis only: the camera pitch comes from perspective-origin, so the tower never leans. */
		applyRot() { gsap.set(this.q(".srs-tower"), { rotationY: this.rot, transformOrigin: `${SLAB_W / 2}px 0px 0px` }); }

		// auto-spin is a CSS animation (compositor-driven); it only pauses while the user is interacting
		pauseSpin(on) { this.el.classList.toggle("paused", !!on); }

		setLevel(n, silent) {
			if (n == null) return;
			const lv = this.block.levels.find((l) => l.level === n);
			if (!lv) return;
			this.level = lv;
			const idx = this.block.levels.indexOf(lv);
			this.slabs.forEach((s, i) => s.classList.toggle("on", i === idx));
			this.layoutSlabs(idx, !silent);
			this.renderLevel(lv);
		}

		step(d) {
			if (!this.level || !this.block) return;
			const arr = this.block.levels, i = arr.indexOf(this.level) + d;
			if (i >= 0 && i < arr.length) this.setLevel(arr[i].level);
		}

		ratio(src) {
			if (this.ratios[src]) return Promise.resolve(this.ratios[src]);
			return new Promise((res) => {
				const im = new Image();
				im.onload = () => res((this.ratios[src] = im.naturalWidth / im.naturalHeight));
				im.onerror = () => res(1);
				im.src = src;
			});
		}

		// rotating the phone or resizing the window: rebuild the tower for the new stage and refit the plan
		onResize() {
			if (!this.block || !this.q(".srs-explore").classList.contains("on")) return;
			const wrap = this.q(".srs-scene-wrap");
			if (Math.abs(wrap.clientWidth - (this.lastW || 0)) > 4 || Math.abs(wrap.clientHeight - (this.lastH || 0)) > 4) {
				const lvl = this.level && this.level.level;
				this.buildTower();
				this.setLevel(lvl, true);
			}
			this.fitPlan();
		}

		fitPlan() {
			const box = this.q(".srs-planbox"), wrap = this.q(".srs-planwrap"), split = this.q(".srs-split");
			if (!box || !this.level || !this.level.floorplate) return;
			const ratio = this.ratios[this.level.floorplate];
			if (!ratio) return;
			const pad = 20, zoom = wrap.classList.contains("zoom"), wide = split.classList.contains("wide");
			const barEl = wrap.querySelector(".srs-edbar"), bar = barEl ? barEl.offsetHeight + 16 : 0; // room for the edit toolbar, whatever height it wraps to
			box.style.marginTop = bar ? bar + "px" : "";
			let w, h;
			if (zoom) { w = window.innerWidth * 0.92 - pad; h = window.innerHeight * 0.92 - pad - bar; if (w / h > ratio) w = h * ratio; else h = w / ratio; }
			else if (window.innerWidth <= 900) { // phones and tablets: the plan sits in the column, full width, height follows the picture
				w = Math.min(split.clientWidth - pad, 640);
				h = w / ratio;
				if (h > window.innerHeight * 0.8) { h = window.innerHeight * 0.8; w = h * ratio; }
			}
			else {
				const sw = split.clientWidth, sh = split.clientHeight;
				if (!sw || !sh) return;
				if (!wide) { h = sh - pad - bar; w = h * ratio; const mw = sw * 0.48 - pad; if (w > mw) { w = mw; h = w / ratio; } }
				else { w = sw - pad; h = w / ratio; const mh = sh * 0.52 - pad - bar; if (h > mh) { h = mh; w = h * ratio; } }
			}
			box.style.width = Math.max(40, w) + "px";
			box.style.height = Math.max(40, h) + "px";
			wrap.style.width = zoom ? "" : Math.max(40, w) + pad + "px";
			wrap.style.height = zoom ? "" : Math.max(40, h) + pad + bar + "px";
		}

		async renderLevel(lv) {
			const q = this.q.bind(this);
			q(".srs-lvl-head h2").innerHTML = /\d/.test(lv.label) ? esc(lv.label).replace(/(\d+)/, "<em>$1</em>") : esc(lv.label).replace(/(\S+)$/, "<em>$1</em>");
			q(".srs-lvl-head small").textContent = lv.group || `${this.block.name} · ${lv.units.length} ${__("residences")}`;
			const st = this.levelStats(lv);
			const chip = (k, color, n, label) => `<button class="srs-chip ${this.filter === k ? "on" : ""}" data-filter="${k}" title="${__("Highlight on plan, cards and tower")}"><i class="srs-dot" style="background:${color}"></i><b>${n}</b>${label}</button>`;
			q(".srs-counts").innerHTML = `<span class="srs-total"><b>${st.total}</b>${__("Residences")}</span>`
				+ chip("available", "var(--ok)", st.a, __("Available")) + chip("process", "var(--warn)", st.p, __("In process")) + chip("sold", "var(--bad)", st.s, __("Sold"));

			const ratio = lv.floorplate ? await this.ratio(lv.floorplate) : 0;
			if (this.level !== lv) return; // user moved on while the plan was loading

			const split = q(".srs-split");
			split.classList.toggle("wide", ratio > 1.25);
			split.classList.toggle("noplan", !ratio && !this.perms.manage);
			q(".srs-planwrap").classList.toggle("empty", !ratio && !!this.perms.manage);
			q(".srs-planwrap").innerHTML = !ratio ? (this.perms.manage && this.site.kind === "erp" ? `<div class="srs-noplan"><b>${__("No floor plan yet")}</b><p>${__("Add the brochure or a floor plan in Setup. It is shown here, and each flat's view is cut from it after you map the flats.")}</p><button data-act="setup">${__("Open Setup")}</button></div>` : "") : `
				<div class="srs-planbox">
					<img src="${esc(lv.floorplate)}" alt="">
					${lv.units.map((u, i) => (u.hotspot ? `<button class="srs-hot st-${slug(u.status)}" data-unit="${i}" title="${esc(u.name)}" style="left:${u.hotspot[0]}%;top:${u.hotspot[1]}%;width:${u.hotspot[2]}%;height:${u.hotspot[3]}%"><span>${esc(u.name)}</span></button>` : "")).join("")}
				</div>
				<div class="srs-plantools">${this.canMap() ? `<button class="srs-mapbtn crop" data-act="cropplan" title="${__("Crop plan")}" aria-label="${__("Crop plan")}"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2v14a2 2 0 0 0 2 2h14M2 6h14a2 2 0 0 1 2 2v14"/></svg></button><button class="srs-mapbtn" data-act="map" title="${__("Map flats")}" aria-label="${__("Map flats")}"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M17.5 14v7M14 17.5h7"/></svg></button>` : ""}<button class="srs-zoom" data-act="zoom" title="${__("Expand plan")}">⤢</button></div>
				${(() => { const h = lv.mapped ? __("Tap a flat on the plan") : this.perms.manage ? (lv.fromBrochure ? __("Plan taken from the brochure · Crop plan, then Map flats") : __("Flats not mapped to this plan yet · use Map flats")) : ""; return h ? `<div class="srs-planhint">${h}</div>` : ""; })()}`;

			this.fitPlan();
			q(".srs-units").innerHTML = lv.units.length
				? lv.units.map((u, i) => `
				<button class="srs-unit" data-unit="${i}">
					<div class="th ${u.thumb || u.render3d ? "" : "noimg"}" style="background-image:url('${esc(u.thumb || u.render3d || "")}')">${u.thumb || u.render3d ? "" : `<span class="ty">${esc(u.type || "")}</span>`}<span class="badge st-${slug(u.status)}">${esc(u.status)}</span></div>
					<div class="tx"><b>${esc(u.name)}</b><span>${esc([u.type !== u.name ? u.type : null, u.area ? u.area + " sq ft" : null, u.facing].filter(Boolean).join(" · ") || money(u.price))}</span></div>
				</button>`).join("")
				: `<div class="srs-empty">${__("No residences on this level yet.")}</div>`;

			gsap.fromTo([".srs-lvl-head h2", ".srs-counts", ".srs-planwrap", ".srs-unit"].flatMap((s) => [...this.root.querySelectorAll(s)]),
				{ y: 22, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, stagger: 0.05, ease: "power3.out", overwrite: "auto" });
			q(".srs-units").scrollTop = 0;
			this.applyFilter();
		}

		/* ---------- status filter, tooltips, hover preview ---------- */
		statusKey(u) { return /sold/i.test(u.status) ? "sold" : /avail/i.test(u.status) ? "available" : "process"; }

		applyFilter() {
			const f = this.filter;
			this.root.querySelectorAll(".srs-chip").forEach((c) => c.classList.toggle("on", c.dataset.filter === f));
			if (this.slabs && this.block) {
				this.slabs.forEach((s, i) => s.classList.toggle("dim", !!f && !this.block.levels[i].units.some((u) => this.statusKey(u) === f)));
			}
			if (this.level) {
				this.level.units.forEach((u, i) => {
					const dim = !!f && this.statusKey(u) !== f;
					this.root.querySelectorAll(`.srs-split [data-unit="${i}"]`).forEach((n) => n.classList.toggle("dim", dim));
				});
			}
		}

		levelTip(l) {
			const st = this.levelStats(l), types = {};
			l.units.forEach((u) => { types[u.type] = (types[u.type] || 0) + 1; });
			const list = Object.entries(types).slice(0, 4).map(([k, v]) => `<li><b>${v}×</b> ${esc(k)}</li>`).join("");
			const prices = l.units.map((u) => u.price).filter((p) => typeof p === "number" && p > 0);
			return `<div class="t-h">${esc(l.label)}</div>
				<div class="t-bar" style="background:${this.barGradient(st)}"></div>
				<div class="t-row"><span class="ok">${st.a} ${__("Available")}</span><span class="wn">${st.p} ${__("In process")}</span><span class="bd">${st.s} ${__("Sold")}</span></div>
				<ul>${list}</ul>
				${prices.length ? `<div class="t-p">${money(Math.min(...prices))} – ${money(Math.max(...prices))}</div>` : ""}
				<div class="t-f">${__("Rest here to preview · click to lock")}</div>`;
		}

		unitTip(u) {
			return `<div class="t-h">${esc(u.name)}</div>
				<div class="t-row"><span>${esc(u.type)}</span><span class="st-${slug(u.status)}">${esc(u.status)}</span></div>
				${u.area ? `<div class="t-line">${u.area} sq ft${u.facing ? " · " + esc(u.facing) : ""}</div>` : ""}
				<div class="t-p">${money(u.price)}</div>
				<div class="t-f">${__("Click for the brochure page")}</div>`;
		}

		showTip(html, e) {
			const t = this.q(".srs-tip");
			t.innerHTML = html;
			t.classList.add("on");
			this.moveTip(e);
		}

		hideTip() { this.q(".srs-tip").classList.remove("on"); }

		moveTip(e) {
			const t = this.q(".srs-tip");
			if (!t.classList.contains("on") || !e) return;
			const r = this.el.getBoundingClientRect(), w = t.offsetWidth, h = t.offsetHeight;
			let x = e.clientX - r.left + 18, y = e.clientY - r.top + 16;
			if (x + w > r.width - 10) x = e.clientX - r.left - w - 18;
			if (y + h > r.height - 10) y = r.height - h - 10;
			t.style.transform = `translate(${Math.max(8, x)}px, ${Math.max(8, y)}px)`;
		}

		// resting the pointer on a floor for a moment previews it, with no click needed
		armDwell() {
			clearTimeout(this.dwell);
			const slab = this.hoverSlab;
			if (!slab || this.drag) return;
			const n = +slab.dataset.level;
			if (this.level && this.level.level === n) return;
			this.dwell = setTimeout(() => { if (this.hoverSlab === slab && !this.drag) this.setLevel(n); }, 550);
		}

		onHover(e, on) {
			if (e.pointerType === "touch") return; // taps select; the popup and rest-to-preview are for a mouse
			const tg = e.target.closest ? e.target : null;
			if (!tg) return;
			const slab = tg.closest(".srs-slab[data-level]");
			if (slab) {
				if (on) {
					this.hoverSlab = slab;
					this.pauseSpin(true);
					const lv = this.block.levels.find((l) => l.level === +slab.dataset.level);
					if (lv && !this.drag) this.showTip(this.levelTip(lv), e);
				} else if (!(e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest(".srs-slab[data-level]"))) {
					this.hoverSlab = null;
					if (!this.drag) this.pauseSpin(false);
					clearTimeout(this.dwell);
					this.hideTip();
				}
				return;
			}
			const hot = tg.closest(".srs-hot");
			if (hot) {
				if (on && this.level) this.showTip(this.unitTip(this.level.units[+hot.dataset.unit]), e);
				else this.hideTip();
			}
			const t = tg.closest("[data-unit]");
			if (!t) return;
			this.root.querySelectorAll(`.srs-split [data-unit="${t.dataset.unit}"]`).forEach((n) => n.classList.toggle("hl", on));
		}

		/* ---------- map flats on the plan (one mapping serves every floor) ---------- */
		canMap() {
			return !!(this.site && this.site.kind === "erp" && this.perms.manage && this.block && this.block.hasPlan);
		}

		autoRect(idx, per) {
			const rows = Math.max(1, Math.ceil(per / 2)), h = 87.5 / rows;
			const left = idx <= rows, row = Math.min(left ? rows - idx : idx - rows - 1, rows - 1);
			return [left ? 6.2 : 52.5, +(7.2 + row * h).toFixed(2), left ? 39.8 : 41, +(h - 1.2).toFixed(2)];
		}

		startMap() {
			const box = this.q(".srs-planbox");
			if (!box || !this.level) return;
			const per = Math.max(...this.level.units.map((u) => u.unitIndex || 1));
			this.rects = {};
			this.level.units.forEach((u) => { this.rects[u.unitIndex] = (u.hotspot || this.autoRect(u.unitIndex, per)).slice(); });
			this.mapPer = per;
			box.classList.add("editing");
			box.insertAdjacentHTML("beforeend", Object.keys(this.rects).map((i) => `<div class="srs-ed" data-ed="${i}"><b>${i}</b><i class="rh"></i></div>`).join(""));
			this.paintRects();
			const wrap = this.q(".srs-planwrap");
			this.openEditView(wrap);
			wrap.querySelectorAll(".srs-mapbtn").forEach((b) => (b.style.display = "none"));
			this.fitPlan();
			const same = this.block.levels.filter((l) => l.floorplate === this.level.floorplate);
			this.mapScope = "plan";
			wrap.insertAdjacentHTML("afterbegin", `<div class="srs-edbar"><span>${__("Drag each box onto its flat; resize from the corner.")}
				<label class="scope"><input type="radio" name="mapscope" value="plan" checked> ${__("Every floor with this plan")} (${same.length})</label>
				<label class="scope"><input type="radio" name="mapscope" value="one"> ${__("This floor only")} (${esc(this.level.label)})</label></span>
				<button data-act="ed-auto">${__("Auto layout")}</button><button data-act="ed-cancel">${__("Cancel")}</button><button class="go" data-act="ed-save">${__("Save")}</button></div>`);
			if (!this.edBound) {
				this.edBound = true;
				this.el.addEventListener("pointerdown", (e) => this.edDown(e));
			}
		}

		startCrop() {
			const box = this.q(".srs-planbox");
			if (!box || !this.level) return;
			this.rects = { crop: [8, 6, 84, 88] };
			this.cropMode = true;
			box.classList.add("editing");
			box.insertAdjacentHTML("beforeend", `<div class="srs-ed crop" data-ed="crop"><b>${__("Floor plan")}</b><i class="rh"></i></div>`);
			this.paintRects();
			const wrap = this.q(".srs-planwrap"), same = this.block.levels.filter((l) => l.floorplate === this.level.floorplate);
			this.openEditView(wrap);
			wrap.querySelectorAll(".srs-mapbtn").forEach((b) => (b.style.display = "none"));
			wrap.insertAdjacentHTML("afterbegin", `<div class="srs-edbar"><span>${__("Drag and resize the box so it covers only the floor plan. The page around it is cut away.")}
				<label class="scope"><input type="radio" name="mapscope" value="plan" checked> ${__("Every floor with this plan")} (${same.length})</label>
				<label class="scope"><input type="radio" name="mapscope" value="one"> ${__("This floor only")} (${esc(this.level.label)})</label></span>
				<button data-act="ed-cancel">${__("Cancel")}</button><button class="go" data-act="crop-save">${__("Use this area")}</button></div>`);
			this.fitPlan();
			if (!this.edBound) { this.edBound = true; this.el.addEventListener("pointerdown", (e) => this.edDown(e)); }
		}

		async saveCrop() {
			const one = (this.q('input[name="mapscope"]:checked') || {}).value === "one";
			const floors = one ? [this.level.label] : this.block.levels.filter((l) => l.floorplate === this.level.floorplate).map((l) => l.label);
			try {
				await call("crop_plan", { building: this.block.id, rect: JSON.stringify(this.rects.crop), floors: JSON.stringify(floors) });
			} catch (e) { return; }
			frappe.show_alert({ message: __("Floor plan cut out. Now map the flats on it."), indicator: "green" });
			this.rects = null;
			this.cropMode = false;
			this.closeEditView();
			await this.refreshSite();
		}

		openEditView(wrap) {
			this.autoZoom = !wrap.classList.contains("zoom");
			wrap.classList.add("zoom", "editing-view");
		}

		closeEditView() {
			const wrap = this.q(".srs-planwrap");
			if (wrap) wrap.classList.remove("editing-view", ...(this.autoZoom ? ["zoom"] : []));
			this.autoZoom = false;
		}

		paintRects() {
			this.root.querySelectorAll(".srs-ed").forEach((n) => {
				const r = this.rects[n.dataset.ed];
				n.style.cssText = `left:${r[0]}%;top:${r[1]}%;width:${r[2]}%;height:${r[3]}%`;
			});
		}

		edDown(e) {
			const node = e.target.closest && e.target.closest(".srs-ed");
			if (!node || !this.rects) return;
			e.preventDefault();
			const box = this.q(".srs-planbox").getBoundingClientRect();
			const idx = node.dataset.ed, start = this.rects[idx].slice(), resize = !!e.target.closest(".rh");
			const sx = e.clientX, sy = e.clientY;
			const move = (m) => {
				const dx = ((m.clientX - sx) / box.width) * 100, dy = ((m.clientY - sy) / box.height) * 100;
				const r = start.slice();
				if (resize) { r[2] = Math.max(3, Math.min(100 - r[0], start[2] + dx)); r[3] = Math.max(3, Math.min(100 - r[1], start[3] + dy)); }
				else { r[0] = Math.max(0, Math.min(100 - r[2], start[0] + dx)); r[1] = Math.max(0, Math.min(100 - r[3], start[1] + dy)); }
				this.rects[idx] = r.map((n) => +n.toFixed(2));
				this.paintRects();
			};
			const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
			window.addEventListener("pointermove", move);
			window.addEventListener("pointerup", up);
		}

		endMap() { this.rects = null; this.cropMode = false; this.closeEditView(); this.flushSync(); if (this.level) this.renderLevel(this.level); }

		async saveMap() {
			try {
				const one = (this.q('input[name="mapscope"]:checked') || {}).value === "one";
				const floors = one ? [this.level.label] : this.block.levels.filter((l) => l.floorplate === this.level.floorplate).map((l) => l.label);
				await call("save_plan_hotspots", { building: this.block.id, hotspots: JSON.stringify(this.rects), floors: JSON.stringify(floors) });
			} catch (e) { return; }
			frappe.show_alert({ message: __("Flat areas saved"), indicator: "green" });
			this.rects = null;
			this.closeEditView();
			await this.refreshSite();
		}

		/* ---------- brochure sheet ---------- */
		openUnit(i) {
			const u = this.level && this.level.units[i];
			if (!u) return;
			this.unit = i;
			this.vk = this.defaultView(u);
			this.photoIdx = 0;
			this.renderSheet();
			this.q(".srs-sheet-wrap").classList.add("on");
			this.loadBookingPanel();
			gsap.fromTo(".srs-sheet", { y: 50, scale: 0.96, opacity: 0 }, { y: 0, scale: 1, opacity: 1, duration: 0.55, ease: "power3.out" });
			gsap.fromTo(".srs-sheet .info > *", { x: 24, opacity: 0 }, { x: 0, opacity: 1, duration: 0.5, stagger: 0.05, delay: 0.2 });
		}

		defaultView(u) {
			return u.render3d ? "3d" : u.photos && u.photos.length ? "photos" : "2d";
		}

		sheetImage(u) {
			if (this.vk === "photos" && u.photos && u.photos.length) return (u.photos[Math.min(this.photoIdx || 0, u.photos.length - 1)] || {}).src;
			return this.vk === "3d" ? u.render3d || u.plan2d : u.plan2d || u.render3d;
		}

		sheetMedia(u) {
			if (this.vk === "photos" && u.photos && u.photos.length) {
				const i = Math.min(this.photoIdx || 0, u.photos.length - 1), p = u.photos[i];
				return `<div class="gal"><img src="${esc(p.src)}" alt=""><div class="cap">${esc(p.caption || "")}</div>${u.photos.length > 1 ? `<div class="strip">${u.photos.map((x, k) => `<button data-photo="${k}" class="${k === i ? "on" : ""}" style="background-image:url('${esc(x.thumb || x.src)}')"></button>`).join("")}</div>` : ""}</div>`;
			}
			const src = this.sheetImage(u);
			if (!src) return `<div class="noplan"><div class="ty">${esc(u.type || u.name)}</div>${u.area ? `<div class="ar">${esc(u.area)} sq ft</div>` : ""}<div class="muted">${__("Floor plan to follow")}</div></div>`;
			if (this.vk === "2d" && u.planIsFloor && u.hotspot) {
				const h = u.hotspot;
				return `<div class="hlwrap"><img src="${esc(src)}" alt=""><i style="left:${h[0]}%;top:${h[1]}%;width:${h[2]}%;height:${h[3]}%"></i></div>`;
			}
			return `<img src="${esc(src)}" alt="">`;
		}

		sheetRows(u) {
			const na = __("Not updated");
			return [
				[__("Flat no."), u.name],
				[__("Block"), this.block.name],
				[__("Floor"), this.level.label],
				[__("Type"), u.type || na],
				[__("Total area"), u.area ? u.area + " sq ft" : na],
				[__("Carpet area"), u.carpetArea ? u.carpetArea + " sq ft" : na],
				[__("Facing"), u.facing || na],
				...Object.entries(u.dims || {}).map(([k, v]) => [k.replace(/([A-Z])/g, " $1").replace(/^./, (ch) => ch.toUpperCase()), v]),
			];
		}

		renderSheet() {
			const u = this.level.units[this.unit], s = this.site;
			const rows = this.sheetRows(u);
			const tabs = [["3d", __("3D View"), !!u.render3d], ["2d", __("2D Plan"), !!u.plan2d], ["photos", __("Photos") + (u.photos && u.photos.length > 1 ? ` (${u.photos.length})` : ""), !!(u.photos && u.photos.length)]].filter((x) => x[2]);
			this.q(".srs-sheet").innerHTML = `
				<button class="x" data-act="close">✕</button>
				<div class="media">
					${tabs.length > 1 ? `<div class="tabs">${tabs.map(([k, label]) => `<button data-view="${k}" class="${this.vk === k ? "on" : ""}">${label}</button>`).join("")}</div>` : ""}
					${this.sheetMedia(u)}
					<div class="nav"><button data-nav="-1">←</button><button data-nav="1">→</button></div>
				</div>
				<div class="info">
					<div class="eyebrow">${esc(s.name)} · ${esc(this.block.name !== s.name ? this.block.name + " · " : "")}${esc(this.level.label)}</div>
					<h2>${esc(u.name)}</h2>
					${u.description ? `<p class="desc">${esc(u.description)}</p>` : ""}
					<div class="price">${money(u.price)}</div>
					<span class="badge st-${slug(u.status)}">${esc(u.status)}</span>
					<table>${rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join("")}</table>
					${u.features && u.features.length ? `<div class="feat">${u.features.map((f) => `<span>${esc(f)}</span>`).join("")}</div>` : ""}
					
					<div class="bk-panel"></div>
					<div class="acts">${this.sheetActions(u)}<button class="alt" data-act="print">${__("Print brochure page")}</button><button class="alt" data-act="close">${__("Back to level")}</button></div>
				</div>`;
		}

		sheetActions(u) {
			if (this.site.kind !== "erp") return "";
			if (u.rawStatus === "Empty" && this.perms.book) return `<button class="go" data-act="book">${__("Book this flat")}</button>`;
			return "";
		}

		async loadBookingPanel() {
			this.booking = null;
			const u = this.level.units[this.unit];
			if (this.site.kind !== "erp" || u.rawStatus === "Empty") return;
			const box = this.q(".bk-panel");
			if (!box) return;
			box.innerHTML = `<div class="bk-sum muted">${__("Loading booking…")}</div>`;
			let info = null;
			try { info = (await call("booking_info", { flat: u.id })).booking; } catch (e) { info = null; }
			if (this.unit == null || this.level.units[this.unit] !== u || !this.q(".bk-panel")) return;
			this.booking = info;
			if (!info) { this.q(".bk-panel").innerHTML = ""; return; }
			const paid = info.installments ? `${info.installments_paid}/${info.installments} ${__("installments paid")}` : "";
			this.q(".bk-panel").innerHTML = `<div class="bk-sum">
				<div class="bk-h"><span>${__("Booked by")} <b>${esc(info.customer_name || info.customer)}</b></span><a href="/app/flat-booking/${encodeURIComponent(info.name)}" target="_blank" rel="noopener">${esc(info.name)} ↗</a></div>
				<div class="bk-grid">
					<div><small>${__("Booked on")}</small>${esc(info.booking_date)}</div>
					<div><small>${__("Sale value")}</small>${money(info.total_with_gst || info.total_sale_value)}</div>
					<div><small>${__("Received")}</small>${money(info.total_received)}</div>
					<div><small>${__("Outstanding")}</small>${money(info.total_outstanding)}</div>
				</div>
				<div class="muted">${esc(paid)}${info.sales_invoice ? " · " + __("Invoice") + " " + esc(info.sales_invoice) : ""}</div></div>`;
			const acts = this.q(".srs-sheet .acts");
			if (this.perms.cancel && info.docstatus === 1 && !info.pending_cancellation && acts && !acts.querySelector('[data-act="cancel-booking"]')) {
				acts.insertAdjacentHTML("afterbegin", `<button class="danger" data-act="cancel-booking">${__("Cancel booking")}</button>`);
			}
		}

		closeSheet() {
			const w = this.q(".srs-sheet-wrap");
			gsap.to(".srs-sheet", { y: 30, opacity: 0, duration: 0.25, onComplete: () => { w.classList.remove("on"); this.flushSync(); } });
		}

		navUnit(d) {
			const n = this.level.units.length;
			this.unit = (this.unit + d + n) % n;
			this.vk = this.defaultView(this.level.units[this.unit]);
			this.photoIdx = 0;
			this.renderSheet();
			this.loadBookingPanel();
			gsap.fromTo(".srs-sheet .media img", { opacity: 0, x: d * 40 }, { opacity: 1, x: 0, duration: 0.45, ease: "power2.out" });
		}

		printSheet() {
			const u = this.level.units[this.unit], s = this.site;
			const abs = (p) => (p ? new URL(p, location.origin).href : "");
			const rows = this.sheetRows(u);
			const w = window.open("", "_blank");
			if (!w) { frappe.show_alert({ message: __("Allow pop-ups to print the brochure page"), indicator: "orange" }); return; }
			w.document.write(`<!doctype html><title>${esc(s.name)} — ${esc(u.name)}</title><style>
				@page{size:A4;margin:14mm}body{font-family:Georgia,serif;color:#090c10;margin:0}
				h1{font-weight:400;font-size:30px;margin:4px 0}.e{letter-spacing:.2em;text-transform:uppercase;font-size:11px;color:#8a7a62}
				img{max-width:100%;max-height:105mm;display:block;margin:10px auto}table{width:100%;border-collapse:collapse;font:13px sans-serif;margin-top:12px}
				td{padding:7px 0;border-bottom:1px solid #ddd}td:last-child{text-align:right;font-weight:600}.p{font-size:22px;margin:8px 0}
				.g{display:grid;grid-template-columns:1fr 1fr;gap:10px}.f{font:11px sans-serif;color:#777;margin-top:16px}</style>
				<div class="e">${esc(s.developer || "")} · ${esc(s.location || "")}</div><h1>${esc(s.name)}</h1>
				<div class="e">${esc(this.level.label)} · ${esc(u.name)}</div><div class="p">${money(u.price)}</div>
				<div class="g">${u.plan2d ? `<img src="${abs(u.plan2d)}">` : ""}${u.render3d ? `<img src="${abs(u.render3d)}">` : ""}</div>
				<table>${rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join("")}</table>
				<div class="f">${esc(u.status)} · ${esc(new Date().toLocaleDateString())} · Plans and renders are indicative.</div>`);
			w.document.close();
			setTimeout(() => w.print(), 700);
		}

		/* ---------- setup: building photo, floor plan, brochure (managers) ---------- */
		setup() {
			if (!this.site || this.site.kind !== "erp") return;
			if (this.el.classList.contains("present")) this.present(false);
			const blk = this.block, many = this.site.blocks.length > 1;
			const floors = blk.levels.map((l) => l.label);
			const d = new frappe.ui.Dialog({
				title: __("Showcase media · {0}", [blk.name]),
				fields: [
					{ fieldtype: "HTML", options: `<p class="text-muted" style="margin:0 0 8px">${__("Display image and brochure are what clients see on the site card and in the Brochure button. Upload a new file to replace the current one. A new brochure replaces the plan that was taken from the old one, so crop and map the flats again.")}${blk.brochure ? ` <a href="${esc(blk.brochure)}" target="_blank" rel="noopener">${__("Current brochure")} ↗</a>` : ""}</p>` },
					{ fieldname: "building_image", fieldtype: "Attach", label: __("Display image (photo or PDF)") },
					{ fieldname: "brochure", fieldtype: "Attach", label: __("Brochure (PDF or image)") },
					...(many ? [{ fieldname: "apply_to_site", fieldtype: "Check", label: __("Use this display image and brochure for every building of {0}", [this.site.name]), default: 1 }] : []),
					{ fieldtype: "Section Break", label: __("Floor plan") },
					{ fieldtype: "HTML", options: `<p class="text-muted" style="margin:0 0 8px">${__("A floor plan is the top-down drawing of one floor with all its flats. Flat views are cut from it, after you map the flats with Map flats. If floors are laid out differently (mirrored, rotated, different flats), upload each layout separately and tick only the floors it applies to.")}</p>` },
					{ fieldname: "floor_plan_image", fieldtype: "Attach", label: __("Floor plan (image or PDF, first page is used)") },
					{ fieldname: "floors", fieldtype: "MultiCheck", label: __("This plan applies to"), columns: 2, options: floors.map((f) => ({ label: f, value: f, checked: 1 })), depends_on: "eval:doc.floor_plan_image || (doc.brochure && doc.extract_plan)" },
					{ fieldname: "extract_plan", fieldtype: "Check", label: __("Take the floor plan from the brochure"), depends_on: "eval:doc.brochure && !doc.floor_plan_image" },
				],
				primary_action_label: __("Save"),
				primary_action: async (v) => {
					const picked = (v.floors || []).filter((f) => floors.includes(f));
					if ((v.floor_plan_image || v.extract_plan) && !picked.length) return frappe.show_alert({ message: __("Tick at least one floor for the plan"), indicator: "orange" });
					d.hide();
					try {
						await call("save_building_media", {
							building: blk.id, building_image: v.building_image, floor_plan_image: v.floor_plan_image, brochure: v.brochure, extract_plan: v.extract_plan ? 1 : 0,
							floors: JSON.stringify(picked.length === floors.length ? [] : picked), site_id: this.site.id, apply_to_site: v.apply_to_site ? 1 : 0,
						});
						frappe.show_alert({ message: __("Saved"), indicator: "green" });
						await this.refreshSite(blk.id);
					} catch (e) { /* frappe already showed the server message */ }
				},
			});
			d.show();
		}

		/* ---------- live sync with ERPNext ---------- */
		onInventoryChanged(m) {
			clearTimeout(this.syncT);
			this.syncT = setTimeout(() => this.syncNow(m && m.site), 1500); // one change usually arrives as several events
		}

		busyUi() {
			return this.q(".srs-sheet-wrap").classList.contains("on") || this.q(".srs-modal-wrap").classList.contains("on") || !!this.rects;
		}

		// the user is mid-booking, looking at a flat or editing the plan: remember the change and apply it when they are done
		flushSync() {
			if (!this.pendingSync || this.busyUi()) return;
			const s = this.pendingSync;
			this.pendingSync = null;
			this.syncNow(s === true ? null : s);
		}

		async syncNow(site) {
			if (this.busyUi()) { this.pendingSync = site || true; return; }
			const r = await call("get_showcase_sites").catch(() => null);
			if (r) { this.summaries = r.data; this.perms = r.perms || this.perms; this.renderCards(); }
			this.lastLoad = Date.now();
			if (!this.site || (site && site !== this.site.id)) return;
			if (this.q(".srs-explore").classList.contains("on")) return this.refreshSite(null, true);
			const d = await call("get_showcase_site", { site_id: this.site.id }).catch(() => null); // hero or gallery showing: just refresh the data
			if (d && d.data && d.data.blocks.length) {
				this.cache[this.site.id] = this.site = d.data;
				this.block = this.site.blocks.find((b) => this.block && b.id === this.block.id) || this.site.blocks[0];
				if (this.q(".srs-hero").classList.contains("on")) this.showHero();
			}
		}

		// re-read the open project (after booking, cancelling or changing media) and redraw where the user was
		async refreshSite(blockId, quiet) {
			const id = this.site.id, keepLevel = this.level && this.level.level, keepBlock = blockId || (this.block && this.block.id);
			delete this.cache[id];
			const r = await call("get_showcase_site", { site_id: id }).catch(() => null);
			if (!r || !r.data) return;
			this.perms = r.perms || this.perms;
			this.cache[id] = r.data;
			this.site = r.data;
			this.block = this.site.blocks.find((b) => b.id === keepBlock) || this.site.blocks[0];
			this.unit = null;
			this.q(".srs-sheet-wrap").classList.remove("on");
			this.el.style.setProperty("--acc", (this.block && this.block.color) || "#c9b79c");
			this.renderBlocks();
			this.noIntro = true; // a refresh is not an arrival: no drop-in animation
			this.buildTower();
			this.noIntro = false;
			const lv = this.block.levels.find((l) => l.level === keepLevel) || this.block.levels[0];
			this.setLevel(lv ? lv.level : null, true);
			this.lastLoad = Date.now();
		}

		/* ---------- add a site: real Buildings + Flats ---------- */
		async openAddSite(cc) {
			let o;
			try { o = await call("site_options"); } catch (e) { return; }
			const blank = () => ({ building_name: "", floors: 5, flats_per_floor: 8, flat_type: o.flat_types.includes("2BHK") ? "2BHK" : "", base_price: "", flats: [] });
			this.asBind();
			this.as = { o, cc: cc || (o.cost_centers[0] || {}).name || "__new__", project: "", newName: "", parent: (o.parents.find((p) => p.root) || o.parents[0] || {}).name || "", blocks: [blank()], blank, media: {} };
			this.renderAddSite();
		}

		renderAddSite() {
			const s = this.as, o = s.o, isNew = s.cc === "__new__", cur = o.cost_centers.find((c) => c.name === s.cc) || {};
			const sel = (opts, v, blankLabel) => `${blankLabel != null ? `<option value="">${blankLabel}</option>` : ""}${opts.map((x) => `<option ${x === v ? "selected" : ""}>${esc(x)}</option>`).join("")}`;
			const rows = s.blocks.map((b, i) => {
				const per = Math.max(0, Math.min(20, +b.flats_per_floor || 0)), letter = this.asLetter(b.building_name);
				while (b.flats.length < per) b.flats.push({});
				const cells = b.flats.slice(0, per).map((f, j) => `<div class="as-flat">
					<span class="pos">${esc(letter)}<i>0</i>${j + 1}</span>
					<select class="fld" data-i="${i}" data-j="${j}" data-f="flat_type">${sel(o.flat_types, f.flat_type || "", b.flat_type ? `${b.flat_type} (${__("default")})` : "—")}</select>
					<input class="fld" data-i="${i}" data-j="${j}" data-f="area_sqft" type="number" min="0" step="any" placeholder="${__("total sq ft")}" value="${esc(f.area_sqft ?? "")}">
					<input class="fld" data-i="${i}" data-j="${j}" data-f="carpet_area_sqft" type="number" min="0" step="any" placeholder="${__("carpet sq ft")}" value="${esc(f.carpet_area_sqft ?? "")}">
					<select class="fld" data-i="${i}" data-j="${j}" data-f="facing">${sel(o.facings, f.facing || "", "—")}</select>
					<input class="fld" data-i="${i}" data-j="${j}" data-f="base_price" type="number" min="0" step="any" placeholder="${b.base_price ? esc(b.base_price) : __("price")}" value="${esc(f.base_price ?? "")}"></div>`).join("");
				return `<div class="as-block"><div class="as-row">
				<input class="fld" data-i="${i}" data-k="building_name" placeholder="${__("e.g. BLOCK D")}" value="${esc(b.building_name)}">
				<input class="fld" data-i="${i}" data-k="floors" type="number" min="1" max="${o.floors.length}" value="${esc(b.floors)}">
				<input class="fld" data-i="${i}" data-k="flats_per_floor" type="number" min="1" max="20" value="${esc(b.flats_per_floor)}">
				<select class="fld" data-i="${i}" data-k="flat_type">${sel(o.flat_types, b.flat_type, "—")}</select>
				<input class="fld" data-i="${i}" data-k="base_price" type="number" min="0" step="any" placeholder="${__("price")}" value="${esc(b.base_price)}">
				<button class="x3" data-act="as-delrow" data-i="${i}" title="${__("Remove")}" ${s.blocks.length === 1 ? "disabled" : ""}>✕</button></div>
				<div class="as-flats"><div class="as-fhead"><span>${__("Flat")}</span><span>${__("Type")}</span><span>${__("Total area")}</span><span>${__("Carpet area")}</span><span>${__("Facing")}</span><span>${__("Price")}</span></div>${cells}
				<div class="muted">${__("Flat position on every floor: the same layout repeats on all {0} floors. Leave type or price empty to use the block default.", [b.floors || 0])} <a data-act="as-copyfirst" data-i="${i}">${__("Copy first flat to all")}</a></div></div></div>`;
			}).join("");
			this.modal(`<div class="mh"><h3>${__("Add")} <em>${__("site")}</em></h3><button class="x2" data-act="modal-close">✕</button></div>
				<div class="mb">
					<div class="two">
						<label>${__("Site (cost center)")} *<select class="fld" id="as-cc">${o.cost_centers.map((c) => `<option value="${esc(c.name)}" ${c.name === s.cc ? "selected" : ""}>${esc(c.label)}</option>`).join("")}<option value="__new__" ${isNew ? "selected" : ""}>＋ ${__("New site (creates a cost center)")}</option></select></label>
						<label>${__("Project name")}<input class="fld" id="as-project" placeholder="${esc(isNew ? s.newName : cur.label || "")}" value="${esc(s.project)}"></label>
						${isNew ? `<label>${__("New site name")} *<input class="fld" id="as-newname" placeholder="${__("e.g. SR Heights")}" value="${esc(s.newName)}"></label>
						<label>${__("Cost center group")}<select class="fld" id="as-parent">${o.parents.map((p) => `<option value="${esc(p.name)}" ${p.name === s.parent ? "selected" : ""}>${esc(p.label)}</option>`).join("")}</select></label>` : ""}
					</div>
					${cur.buildings && cur.buildings.length ? `<div class="muted">${__("Already has")}: ${esc(cur.buildings.join(", "))}. ${__("New building names must be different; they are unique across all sites.")}</div>` : ""}
					<div class="as-head"><span>${__("Building")}</span><span>${__("Floors")}</span><span>${__("Flats/floor")}</span><span>${__("Default type")}</span><span>${__("Default price")}</span><span></span></div>
					<div class="as-rows">${rows}</div>
					<div><button class="alt as-add" data-act="as-addrow">+ ${__("Add block")}</button></div>
					<div class="as-media">
						${[["building_image", __("Display image")], ["floor_plan_image", __("Floor plan (all floors)")], ["brochure", __("Brochure")]].map(([k, label]) => `<div class="pick"><span>${label}</span>${s.media[k] ? `<b>${esc(s.media[k + "_name"] || s.media[k])}</b><a data-act="as-clear" data-k="${k}">✕</a>` : `<button class="alt" data-act="as-pick" data-k="${k}">${__("Choose file")}</button>`}</div>`).join("")}
						<div class="muted">${__("Optional now. You can add or replace them later with Setup, and map the flats on the plan.")}</div>
					</div>
					<div class="muted" id="as-sum"></div>
					<div class="muted">${__("Creates real Building and Flat records in ERPNext (status Empty, ready to book)")}${isNew ? ", " + __("plus a new cost center for the site") : ""}. ${__("Fill in each flat position\u2019s own type, areas, facing and price; the layout repeats on every floor. Flat numbers read block, floor (ground = 0), flat, e.g. B02. Building names are unique across sites: if a name is taken, the site name is added after it.")}</div>
				</div>
				<div class="mf"><button class="alt" data-act="as-import" style="margin-right:auto">${__("Import flats from sheet")}</button><button class="alt" data-act="modal-close">${__("Cancel")}</button><button class="go" data-act="as-create">${__("Create site")}</button></div>`, "huge");
			this.asSummary();
		}

		importFlats() {
			const o = this.as.o, cc = this.as.cc !== "__new__" ? this.as.cc : (o.cost_centers[0] || {}).name;
			this.closeModal();
			const d = new frappe.ui.Dialog({
				title: __("Import flats from sheet"),
				fields: [
					{ fieldname: "cost_center", fieldtype: "Select", label: __("Site (cost center)"), reqd: 1, options: o.cost_centers.map((c) => ({ value: c.name, label: c.label })), default: cc },
					{ fieldname: "file", fieldtype: "Attach", label: __("Sheet (.xlsx or .csv)"), reqd: 1 },
					{ fieldname: "default_price", fieldtype: "Currency", label: __("Base price for new flats without a Price column") },
					{ fieldtype: "HTML", options: `<p class="text-muted">${__("One row per flat. Columns: Block, Floor, Flat No., Type, Total Area, Carpet Area, Facing, Price (optional). Existing flats are updated, new ones created.")}</p>` },
				],
				primary_action_label: __("Import"),
				primary_action: async (v) => {
					d.disable_primary_action();
					try {
						const r = await call("import_flats", { cost_center: v.cost_center, file_url: v.file, default_price: v.default_price || 0 });
						d.hide();
						frappe.show_alert({ message: __("{0} flats created, {1} updated", [r.created, r.updated]), indicator: "green" });
						await this.load(v.cost_center);
					} catch (e) { d.enable_primary_action(); }
				},
			});
			d.show();
		}

		asPick(kind) {
			this.asRead();
			new frappe.ui.FileUploader({
				restrictions: { allowed_file_types: [".pdf", "image/*"] },
				make_attachments_public: false,
				on_success: (f) => { this.as.media[kind] = f.file_url; this.as.media[kind + "_name"] = f.file_name; this.renderAddSite(); },
			});
		}

		asBind() {
			if (this.asBound) return;
			this.asBound = true;
			this.el.addEventListener("input", (e) => { if (this.as && e.target.closest && e.target.closest(".as-row, .as-flat")) { this.asRead(); this.asSummary(); } });
			this.el.addEventListener("change", (e) => { if (this.as && (e.target.id === "as-cc" || e.target.dataset.k === "flats_per_floor" || e.target.dataset.k === "building_name" || e.target.dataset.k === "flat_type")) { this.asRead(); this.renderAddSite(); } });
		}

		asRead() {
			const s = this.as;
			if (!s) return;
			const cc = this.q("#as-cc"), pr = this.q("#as-project"), nn = this.q("#as-newname"), pa = this.q("#as-parent");
			if (nn) s.newName = nn.value;
			if (pa) s.parent = pa.value;
			if (cc) s.cc = cc.value;
			if (pr) s.project = pr.value;
			this.root.querySelectorAll(".as-row [data-k]").forEach((n) => { s.blocks[+n.dataset.i][n.dataset.k] = n.value; });
			this.root.querySelectorAll(".as-flat [data-f]").forEach((n) => { (s.blocks[+n.dataset.i].flats[+n.dataset.j] ||= {})[n.dataset.f] = n.value; });
		}

		asLetter(name) {
			const w = (name || "").match(/[A-Za-z0-9]+/g) || [];
			return w.length ? ((w[w.length - 1].length === 1 ? w[w.length - 1] : w[0][0]) || "X").toUpperCase() : "X";
		}

		asSummary() {
			const s = this.as, box = this.q("#as-sum");
			if (!s || !box) return;
			const flats = s.blocks.reduce((t, b) => t + (+b.floors || 0) * (+b.flats_per_floor || 0), 0);
			box.innerHTML = `<b>${s.blocks.length}</b> ${s.blocks.length === 1 ? __("building") : __("buildings")} · <b>${flats}</b> ${__("flats will be created")}`;
		}

		async asCreate(btn) {
			this.asRead();
			const s = this.as, isNew = s.cc === "__new__";
			if (isNew && !s.newName.trim()) return frappe.show_alert({ message: __("Enter the new site name"), indicator: "orange" });
			for (const [i, b] of s.blocks.entries()) {
				if (!b.building_name.trim()) return frappe.show_alert({ message: __("Block {0}: enter a building name", [i + 1]), indicator: "orange" });
				const per = +b.flats_per_floor || 0;
				for (let j = 0; j < per; j++) {
					const f = b.flats[j] || {};
					if (!(+f.area_sqft > 0) || !(+(f.base_price || b.base_price) > 0)) return frappe.show_alert({ message: __("{0}, flat {1}: enter the total area and a price (or a default price)", [b.building_name, j + 1]), indicator: "orange" });
				}
				b.flats = b.flats.slice(0, per);
			}
			this.busy(btn, true);
			try {
				const r = await call("create_site_flats", { cost_center: isNew ? null : s.cc, new_cost_center: isNew ? JSON.stringify({ name: s.newName, parent: s.parent }) : null, project: s.project, blocks: JSON.stringify(s.blocks), building_image: s.media.building_image, floor_plan_image: s.media.floor_plan_image, brochure: s.media.brochure });
				const label = isNew ? s.newName : (s.o.cost_centers.find((c) => c.name === s.cc) || {}).label || s.cc;
				this.modal(`<div class="mh"><h3>${__("Site")} <em>${__("ready")}</em></h3><button class="x2" data-act="modal-close">✕</button></div>
					<div class="mb done"><div class="tick">✓</div><p><b>${esc(label)}</b>: ${r.buildings.length} ${__("buildings")}, ${r.flats} ${__("flats created")}.</p>
					${r.buildings.some((b) => b.renamed) ? `<p class="muted">${__("Saved as")}: ${r.buildings.map((b) => esc(b.building)).join(", ")} (${__("a name was already taken")})</p>` : ""}<p class="muted">${__("Add the building photo, floor plan and flat areas next with Setup and Map flats.")}</p></div>
					<div class="mf"><span></span><button class="go" data-act="as-open">${__("Open site")}</button></div>`);
				this.asDone = r.site;
			} catch (e) {
				this.busy(btn, false);
			}
		}

		/* ---------- in-page modal ---------- */
		modal(html, cls) {
			const w = this.q(".srs-modal-wrap");
			w.innerHTML = `<div class="srs-modal ${cls || ""}">${html}</div>`;
			w.classList.add("on");
			gsap.fromTo(".srs-modal", { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, ease: "power3.out" });
		}
		closeModal() { const w = this.q(".srs-modal-wrap"); w.classList.remove("on"); w.innerHTML = ""; this.bk = null; this.cx = null; this.as = null; this.flushSync(); }
		busy(btn, on) { if (btn) { btn.disabled = !!on; btn.classList.toggle("busy", !!on); } }

		/* ---------- booking: three short steps ---------- */
		async openBooking() {
			const u = this.level.units[this.unit];
			let defs;
			try { defs = await call("booking_defaults", { flat: u.id }); } catch (e) { return; }
			if (defs.flat.status !== "Empty") { frappe.msgprint(__("This flat is {0} now. Only Empty flats can be booked.", [defs.flat.status])); return this.refreshSite(); }
			const tmpl = (defs.templates.find((t) => t.is_default) || {}).name || (defs.templates.length === 1 ? defs.templates[0].name : "");
			this.bk = { unit: u, defs, step: 1, mode: "existing", payMode: "installments", picked: null, nc: { customer_name: "", mobile_number: "", customer_email: "" },
				total: defs.flat.base_price || "", booking_amount: "", months: 12, start: defs.first_installment, date: defs.today, tax: tmpl, preview: null, remarks: "" };
			this.renderBooking();
		}

		bkSteps() { return [__("Customer"), __("Payment"), __("Review")].map((t, i) => `<li class="${this.bk.step === i + 1 ? "on" : this.bk.step > i + 1 ? "done" : ""}"><i>${i + 1}</i>${t}</li>`).join(""); }

		renderBooking() {
			const b = this.bk, f = b.defs.flat;
			let body = "";
			if (b.step === 1) {
				body = `<div class="seg"><button data-act="bk-mode" data-cmode="existing" class="${b.mode === "existing" ? "on" : ""}">${__("Existing customer")}</button><button data-act="bk-mode" data-cmode="new" class="${b.mode === "new" ? "on" : ""}">${__("New customer")}</button></div>`;
				if (b.mode === "existing") {
					body += `<input class="fld" id="bk-q" placeholder="${__("Search by name or mobile")}" autocomplete="off" value="">
						<div class="picked">${b.picked ? `<span class="chip">${esc(b.picked.customer_name)} · ${esc(b.picked.mobile_number || "")} <a data-act="bk-unpick">✕</a></span>` : ""}</div>
						<div class="results" id="bk-results"></div>`;
				} else {
					body += `<label>${__("Full name")}<input class="fld" id="bk-nm" value="${esc(b.nc.customer_name)}"></label>
						<label>${__("Mobile number")}<input class="fld" id="bk-mob" inputmode="tel" value="${esc(b.nc.mobile_number)}"></label>
						<label>${__("Email (optional)")}<input class="fld" id="bk-em" type="email" value="${esc(b.nc.customer_email)}"></label>`;
				}
			} else if (b.step === 2) {
				body = `<div class="seg"><button data-act="bk-paymode" data-pm="installments" class="${b.payMode === "installments" ? "on" : ""}">${__("Pay in installments (EMI)")}</button><button data-act="bk-paymode" data-pm="one_time" class="${b.payMode === "one_time" ? "on" : ""}">${__("One-time payment")}</button></div>
				<div class="two">
					<label>${__("Sale value")}<input class="fld" id="bk-total" type="number" min="0" step="any" value="${esc(b.total)}" ${b.defs.can_edit_price ? "" : "readonly"}>${b.defs.can_edit_price ? "" : `<small class="hint">${__("Fixed at the flat's base price. Finance Head or MD can change it.")}</small>`}</label>
					<label>${__("Booking amount")}<input class="fld" id="bk-amt" type="number" min="0" step="any" value="${esc(b.booking_amount)}"></label>
					${b.payMode === "one_time" ? `<label class="span2">${__("Balance due on")}<input class="fld" id="bk-start" type="date" value="${esc(b.start)}"></label>`
						: `<label>${__("Installments (months)")}<input class="fld" id="bk-months" type="number" min="1" max="240" value="${esc(b.months)}"></label>
					<label>${__("First installment on")}<input class="fld" id="bk-start" type="date" value="${esc(b.start)}"></label>`}
					<label>${__("Booking date")}<input class="fld" id="bk-date" type="date" value="${esc(b.date)}"></label>
					<label>${__("GST template")} *<select class="fld" id="bk-tax"><option value="" disabled ${b.tax ? "" : "selected"}>${__("Select GST template")}</option>${b.defs.templates.map((t) => `<option value="${esc(t.name)}" ${t.name === b.tax ? "selected" : ""}>${esc(t.title || t.name)} (${t.rate}%)</option>`).join("")}</select></label>
				</div><div id="bk-prev" class="prev muted">${__("Fill the amounts to see the schedule")}</div>`;
			} else {
				const p = b.preview, c = b.picked || b.nc;
				body = `<table class="rev">
					<tr><td>${__("Flat")}</td><td>${esc(f.flat_number)} · ${esc(f.building)}${f.floor ? " · " + esc(f.floor) : ""}</td></tr>
					<tr><td>${__("Customer")}</td><td>${esc(c.customer_name)}${c.mobile_number ? " · " + esc(c.mobile_number) : ""}${b.mode === "new" ? ` <small>(${__("new")})</small>` : ""}</td></tr>
					<tr><td>${__("Sale value")}</td><td>${money(b.total)}</td></tr>
					${p && p.gst_amount ? `<tr><td>${__("GST")} (${p.gst_rate}%)</td><td>${money(p.gst_amount)}</td></tr><tr><td>${__("Total with GST")}</td><td>${money(p.total_with_gst)}</td></tr>` : ""}
					<tr><td>${__("Booking amount")}</td><td>${money(b.booking_amount)}</td></tr>
					${b.payMode === "one_time"
						? `<tr><td>${__("Balance (one-time)")}</td><td>${p ? money(p.balance) : ""}</td></tr><tr><td>${__("Balance due on")}</td><td>${esc(b.start)}</td></tr>`
						: `<tr><td>${__("Balance")}</td><td>${p ? money(p.balance) : ""} ${__("in")} ${esc(b.months)} ${__("installments of")} ${p ? money(p.monthly) : ""}</td></tr><tr><td>${__("First installment")}</td><td>${esc(b.start)}</td></tr>`}
				</table>
				<label>${__("Remarks (optional)")}<input class="fld" id="bk-rem" value="${esc(b.remarks)}"></label>
				<div class="muted">${__("Confirming submits the Flat Booking in ERPNext: the flat is held and the sales invoice is drafted. Everything ERPNext normally does on a booking (such as sending the booking PDF) happens as usual.")}</div>`;
			}
			this.modal(`<div class="mh"><h3>${__("Book")} <em>${esc(f.flat_number)}</em></h3><button class="x2" data-act="modal-close">✕</button></div>
				<ol class="steps">${this.bkSteps()}</ol>
				<div class="mb">${body}</div>
				<div class="mf">${b.step > 1 ? `<button class="alt" data-act="bk-back">${__("Back")}</button>` : `<span></span>`}
					${b.step < 3 ? `<button class="go" data-act="bk-next">${__("Continue")}</button>` : `<button class="go" data-act="bk-confirm">${__("Confirm booking")}</button>`}</div>`, "wide");
			if (b.step === 2) this.bkPreview();
			if (b.step === 1 && b.mode === "existing") this.bkSearchBind();
		}

		bkSearchBind() {
			const inp = this.q("#bk-q"), box = this.q("#bk-results");
			let t = null;
			const run = async () => {
				const rows = await call("search_customers", { txt: inp.value }).catch(() => []);
				box.innerHTML = rows.length ? rows.map((r, i) => `<button data-act="bk-pick" data-i="${i}"><b>${esc(r.customer_name)}</b><span>${esc(r.mobile_number || r.name)}</span></button>`).join("") : `<div class="muted">${__("No match. Use New customer.")}</div>`;
				this.bkResults = rows;
			};
			inp.addEventListener("input", () => { clearTimeout(t); t = setTimeout(run, 250); });
			run();
			inp.focus();
		}

		bkRead() {
			const b = this.bk, v = (id) => { const n = this.q(id); return n ? n.value : null; };
			if (b.step === 1 && b.mode === "new") b.nc = { customer_name: v("#bk-nm") || "", mobile_number: v("#bk-mob") || "", customer_email: v("#bk-em") || "" };
			if (b.step === 2) { b.total = v("#bk-total"); b.booking_amount = v("#bk-amt"); if (b.payMode !== "one_time") b.months = v("#bk-months"); b.start = v("#bk-start"); b.date = v("#bk-date"); b.tax = v("#bk-tax"); }
			if (b.step === 3) b.remarks = v("#bk-rem") || "";
		}

		bkPreview() {
			clearTimeout(this.pvT);
			["#bk-total", "#bk-amt", "#bk-months", "#bk-start", "#bk-tax"].forEach((s) => {
				const n = this.q(s);
				if (n && !n.dataset.bound) { n.dataset.bound = 1; n.addEventListener("input", () => { clearTimeout(this.pvT); this.pvT = setTimeout(() => { this.bkRead(); this.bkPreview(); }, 300); }); n.addEventListener("change", () => { this.bkRead(); this.bkPreview(); }); }
			});
			this.bkRead();
			const b = this.bk, box = this.q("#bk-prev");
			if (!b.tax) { b.preview = null; box.className = "prev muted"; box.textContent = __("Select a GST template to see the schedule"); return; }
			if (!(+b.total > 0) || b.booking_amount === "" || (b.payMode !== "one_time" && !(+b.months >= 1)) || !b.start) { b.preview = null; box.className = "prev muted"; box.textContent = __("Fill the amounts to see the schedule"); return; }
			call("preview_schedule", { total_sale_value: b.total, booking_amount: b.booking_amount, installment_months: b.payMode === "one_time" ? 1 : b.months, installment_start_date: b.start, taxes_and_charges: b.tax || null, payment_mode: b.payMode })
				.then((p) => {
					if (!this.bk || this.q("#bk-prev") !== box) return;
					b.preview = p;
					const rows = p.installments, show = rows.length > 4 ? [...rows.slice(0, 2), null, rows[rows.length - 1]] : rows;
					box.className = "prev";
					box.innerHTML = `<div class="pv-top">${p.gst_amount ? `${__("GST")} ${money(p.gst_amount)} · ${__("Total")} ${money(p.total_with_gst)} · ` : ""}${__("Balance")} <b>${money(p.balance)}</b> ${b.payMode === "one_time" ? __("in one payment") : __("over") + " " + rows.length + " " + __("months")}</div>
						<table>${show.map((r) => (r ? `<tr><td>${b.payMode === "one_time" ? __("Balance") : "#" + r.installment_no}</td><td>${esc(r.due_date)}</td><td>${money(r.amount_due)}</td></tr>` : `<tr><td colspan="3" class="muted">…</td></tr>`)).join("")}</table>`;
				})
				.catch(() => { box.className = "prev muted"; box.textContent = __("Check the amounts"); });
		}

		async bkNext() {
			const b = this.bk;
			this.bkRead();
			if (b.step === 1) {
				if (b.mode === "existing" && !b.picked) return frappe.show_alert({ message: __("Pick a customer, or switch to New customer"), indicator: "orange" });
				if (b.mode === "new" && (!b.nc.customer_name.trim() || b.nc.mobile_number.replace(/\D/g, "").length < 8)) return frappe.show_alert({ message: __("Enter the customer's name and a valid mobile number"), indicator: "orange" });
			}
			if (b.step === 2) {
				if (!b.tax) return frappe.show_alert({ message: __("Select a GST template"), indicator: "orange" });
				if (!b.preview) return frappe.show_alert({ message: __("Check the amounts and the first installment date"), indicator: "orange" });
				if (!(b.date)) return frappe.show_alert({ message: __("Booking date is required"), indicator: "orange" });
			}
			b.step++;
			this.renderBooking();
		}

		async bkConfirm(btn) {
			const b = this.bk;
			this.bkRead();
			this.busy(btn, true);
			try {
				const r = await call("book_flat", {
					flat: b.unit.id, booking_date: b.date, total_sale_value: b.total, booking_amount: b.booking_amount, installment_months: b.payMode === "one_time" ? 1 : b.months, payment_mode: b.payMode,
					installment_start_date: b.start, customer: b.mode === "existing" ? b.picked.name : null,
					new_customer: b.mode === "new" ? JSON.stringify(b.nc) : null, taxes_and_charges: b.tax, remarks: b.remarks,
				});
				this.modal(`<div class="mh"><h3>${__("Flat")} <em>${__("booked")}</em></h3><button class="x2" data-act="modal-close">✕</button></div>
					<div class="mb done"><div class="tick">✓</div>
						<p><b>${esc(b.unit.name)}</b> ${__("is now held for")} <b>${esc(b.mode === "existing" ? b.picked.customer_name : b.nc.customer_name)}</b>.</p>
						<p class="muted">${__("Booking")} ${esc(r.booking)}${r.sales_invoice ? " · " + __("Invoice") + " " + esc(r.sales_invoice) + " (" + __("draft") + ")" : ""}</p>
						${r.warning ? `<p class="warnnote">${__("The booking is saved, but a follow-up step in ERPNext reported:")} <i>${esc(r.warning)}</i></p>` : ""}</div>
					<div class="mf"><a class="alt" href="/app/flat-booking/${encodeURIComponent(r.booking)}" target="_blank" rel="noopener">${__("Open booking")} ↗</a><button class="go" data-act="modal-close">${__("Done")}</button></div>`);
				await this.refreshSite();
			} catch (e) {
				this.busy(btn, false); // Frappe has shown the server's message; keep the form so nothing is retyped
			}
		}

		/* ---------- cancel a booking ---------- */
		openCancel() {
			const info = this.booking, u = this.level.units[this.unit];
			if (!info) return;
			this.cx = { info, unit: u };
			this.modal(`<div class="mh"><h3>${__("Cancel booking")} <em>${esc(u.name)}</em></h3><button class="x2" data-act="modal-close">✕</button></div>
				<div class="mb">
					<div class="bk-sum"><div class="bk-h"><span><b>${esc(info.customer_name || info.customer)}</b></span><span>${esc(info.name)}</span></div>
						<div class="bk-grid"><div><small>${__("Received")}</small>${money(info.total_received)}</div><div><small>${__("To refund")}</small>${money(info.total_received)}</div></div></div>
					<label>${__("Reason")} *<textarea class="fld" id="cx-reason" rows="3" placeholder="${__("Why is this booking being cancelled?")}"></textarea></label>
					<label>${__("Cancellation date")}<input class="fld" id="cx-date" type="date" value="${esc(frappe.datetime ? frappe.datetime.get_today() : new Date().toISOString().slice(0, 10))}"></label>
					<label class="chk"><input type="checkbox" id="cx-ok"> ${__("I understand this cancels the sales invoice and every payment entry of this booking, and frees the flat.")}</label>
				</div>
				<div class="mf"><button class="alt" data-act="modal-close">${__("Keep booking")}</button><button class="danger" data-act="cx-confirm">${__("Cancel booking")}</button></div>`);
		}

		async cxConfirm(btn) {
			const reason = this.q("#cx-reason").value.trim(), date = this.q("#cx-date").value;
			if (reason.length < 3) return frappe.show_alert({ message: __("Please give a reason (at least 3 characters)"), indicator: "orange" });
			if (!this.q("#cx-ok").checked) return frappe.show_alert({ message: __("Tick the box to confirm"), indicator: "orange" });
			const info = this.cx.info, u = this.cx.unit;
			this.busy(btn, true);
			try {
				const r = await call("cancel_booking", { booking: info.name, reason, cancellation_date: date });
				this.modal(`<div class="mh"><h3>${__("Booking")} <em>${__("cancelled")}</em></h3><button class="x2" data-act="modal-close">✕</button></div>
					<div class="mb done"><div class="tick">✓</div><p><b>${esc(u.name)}</b> ${__("is available again.")}</p>
					<p class="muted">${__("Cancellation")} ${esc(r.cancellation)}${r.amount_to_refund ? " · " + __("Refund due") + " " + money(r.amount_to_refund) : ""}</p>
					${r.warning ? `<p class="warnnote">${__("The cancellation is saved, but a follow-up step in ERPNext reported:")} <i>${esc(r.warning)}</i></p>` : ""}</div>
					<div class="mf"><a class="alt" href="/app/flat-booking-cancellation/${encodeURIComponent(r.cancellation)}" target="_blank" rel="noopener">${__("Open cancellation")} ↗</a><button class="go" data-act="modal-close">${__("Done")}</button></div>`);
				await this.refreshSite();
			} catch (e) {
				this.busy(btn, false);
			}
		}

		present(on) {
			const want = on === undefined ? !this.el.classList.contains("present") : on;
			this.el.classList.toggle("present", want);
			this.q('[data-act="present"]').textContent = want ? __("Exit") : __("Present");
			try {
				if (want && !document.fullscreenElement) document.documentElement.requestFullscreen();
				if (!want && document.fullscreenElement) document.exitFullscreen();
			} catch (e) { /* fullscreen is optional */ }
			if (this.site && this.q(".srs-explore").classList.contains("on")) {
				setTimeout(() => { this.buildTower(); this.setLevel(this.level && this.level.level, true); }, 150);
			}
		}

		/* ---------- events ---------- */
		onClick(e) {
			const t = e.target.closest("[data-act],[data-site],[data-block],[data-mode],[data-filter],[data-step],[data-unit],[data-view],[data-photo],[data-nav],.srs-slab");
			if (!t) return;
			const act = t.dataset.act;
			if (t.dataset.site) return this.selectSite(t.dataset.site);
			if (t.dataset.block) {
				this.block = this.site.blocks.find((b) => b.id === t.dataset.block);
				this.el.style.setProperty("--acc", this.block.color || "#c9b79c");
				this.renderBlocks();
				this.buildTower();
				return this.setLevel((this.block.levels[0] || {}).level, true);
			}
			if (t.dataset.mode) {
				this.mode = t.dataset.mode;
				this.root.querySelectorAll("[data-mode]").forEach((b) => b.classList.toggle("on", b === t));
				this.q(".srs-scene-wrap").style.visibility = this.mode === "tower" ? "" : "hidden";
				this.q(".srs-elev").classList.toggle("on", this.mode === "elev");
				if (this.mode === "elev") gsap.fromTo(".srs-elev img", { scale: 1.06, opacity: 0 }, { scale: 1, opacity: 1, duration: 1 });
				return;
			}
			if (t.dataset.filter) { this.filter = this.filter === t.dataset.filter ? null : t.dataset.filter; return this.applyFilter(); }
			if (t.dataset.step) return this.step(+t.dataset.step);
			if (t.dataset.unit != null && t.dataset.unit !== "") return this.openUnit(+t.dataset.unit);
			if (t.dataset.photo != null && t.dataset.photo !== "") { this.photoIdx = +t.dataset.photo; this.renderSheet(); this.loadBookingPanel(); return; }
			if (t.dataset.view) { this.vk = t.dataset.view; this.renderSheet(); this.loadBookingPanel(); return; }
			if (t.dataset.nav) return this.navUnit(+t.dataset.nav);
			if (t.classList.contains("srs-slab")) { if (this.drag && this.drag.moved > 5) return; return this.setLevel(+t.dataset.level); }
			if (act === "explore") return this.explore();
			if (act === "gallery") { this.q(".srs-sheet-wrap").classList.remove("on"); return this.showGallery(); }
			if (act === "home") return this.site && (this.q(".srs-sheet-wrap").classList.remove("on"), this.showHero());
			if (act === "present") return this.present();
			if (act === "brochure") { const u = (this.block && this.block.brochure) || this.site.brochure; if (u) window.open(u, "_blank", "noopener"); return; }
			if (act === "addsite") return this.openAddSite();
			if (act === "delsite") return this.deleteSite(t.dataset.cc, t.dataset.name);
			if (act === "as-addrow") { this.asRead(); this.as.blocks.push(this.as.blank()); return this.renderAddSite(); }
			if (act === "as-delrow") { this.asRead(); this.as.blocks.splice(+t.dataset.i, 1); return this.renderAddSite(); }
			if (act === "as-copyfirst") { this.asRead(); const b = this.as.blocks[+t.dataset.i], f = b.flats[0] || {}; b.flats = b.flats.map(() => ({ ...f })); return this.renderAddSite(); }
			if (act === "as-create") return this.asCreate(t);
			if (act === "as-import") return this.importFlats();
			if (act === "as-pick") return this.asPick(t.dataset.k);
			if (act === "as-clear") { this.asRead(); delete this.as.media[t.dataset.k]; return this.renderAddSite(); }
			if (act === "as-open") { const id = this.asDone; this.closeModal(); return this.load(id); }
			if (act === "setup") return this.setup();
			if (act === "book") return this.openBooking();
			if (act === "cancel-booking") return this.openCancel();
			if (act === "modal-close") return this.closeModal();
			if (act === "bk-paymode") { this.bkRead(); this.bk.payMode = t.dataset.pm; this.bk.preview = null; return this.renderBooking(); }
			if (act === "bk-next") return this.bkNext();
			if (act === "bk-back") { this.bkRead(); this.bk.step--; return this.renderBooking(); }
			if (act === "bk-confirm") return this.bkConfirm(t);
			if (act === "bk-mode") { this.bkRead(); this.bk.mode = t.dataset.cmode; return this.renderBooking(); }
			if (act === "bk-pick") { this.bk.picked = this.bkResults[+t.dataset.i]; return this.renderBooking(); }
			if (act === "bk-unpick") { this.bk.picked = null; return this.renderBooking(); }
			if (act === "cx-confirm") return this.cxConfirm(t);
			if (act === "close") return this.closeSheet();
			if (act === "print") return this.printSheet();
			if (act === "map") return this.startMap();
			if (act === "cropplan") return this.startCrop();
			if (act === "crop-save") return this.saveCrop();
			if (act === "ed-cancel") return this.endMap();
			if (act === "ed-save") return this.saveMap();
			if (act === "ed-auto") { Object.keys(this.rects).forEach((i) => { this.rects[i] = this.autoRect(+i, this.mapPer); }); return this.paintRects(); }
			if (act === "zoom") { this.q(".srs-planwrap").classList.toggle("zoom"); return this.fitPlan(); }
		}

		onKey(e) {
			if (/input|textarea|select/i.test((e.target || {}).tagName || "") && !(e.key === "Escape")) return;
			if (document.querySelector(".modal.show")) return;
			if (!this.root.isConnected || !this.root.offsetParent) return;
			const sheet = this.q(".srs-sheet-wrap").classList.contains("on");
			const k = e.key;
			if (k === "Escape" && this.q(".srs-modal-wrap").classList.contains("on")) return this.closeModal();
			if (k === "Escape") {
				if (this.rects) return this.endMap();
				const z = this.q(".srs-planwrap.zoom");
				if (z) { z.classList.remove("zoom"); return this.fitPlan(); }
				if (sheet) return this.closeSheet();
				if (this.el.classList.contains("present")) return this.present(false);
			}
			if (k === "f" || k === "F") return this.present();
			if (sheet) { if (k === "ArrowRight") this.navUnit(1); if (k === "ArrowLeft") this.navUnit(-1); return; }
			if (!this.q(".srs-explore").classList.contains("on")) { if (k === "Enter" && this.site) this.explore(); return; }
			if (k === "ArrowUp") { e.preventDefault(); this.step(1); }
			if (k === "ArrowDown") { e.preventDefault(); this.step(-1); }
		}
	}

	window.SiteShowcase = SiteShowcase;
})();
