/* ==========================================================================
   ALFA Y OMEGA ASESORES · Interacciones
   ----------------------------------------------------------------------
   Sin dependencias. Un solo bucle requestAnimationFrame lee el scroll,
   le aplica inercia (lerp) y alimenta las "escenas" (secciones altas con
   un escenario sticky) escribiendo variables CSS. No se usa ningún
   listener de scroll: la lectura es por frame, sólo de lo que está cerca.
   Todo se degrada con prefers-reduced-motion.
   ========================================================================== */
(() => {
    'use strict';

    /* ───────── Utilidades ───────── */
    const $  = (s, c = document) => c.querySelector(s);
    const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
    const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
    const lerp = (a, b, t) => a + (b - a) * t;
    const easeOut = (t) => 1 - Math.pow(1 - t, 3);
    const root = document.documentElement;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const mqDesktop = window.matchMedia('(min-width: 960px)');
    const mqTablet = window.matchMedia('(min-width: 760px)');
    const WA_NUMBER = '524271519127';

    const state = { vw: window.innerWidth, vh: window.innerHeight, sy: window.scrollY, ty: window.scrollY, vel: 0, docH: 0 };

    const waLink = (text) => `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(text)}`;

    /* ───────── 1. Enlaces de WhatsApp con mensaje prellenado ───────── */
    $$('[data-wa]').forEach((a) => { a.href = waLink(a.dataset.wa); });
    const yearEl = $('#year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    /* ───────── 2. División de texto en palabras ───────── */
    function splitWords(el) {
        const label = el.textContent.replace(/\s+/g, ' ').trim();
        el.setAttribute('aria-label', label);
        let i = 0;
        const walk = (node) => {
            Array.from(node.childNodes).forEach((ch) => {
                if (ch.nodeType === 3) {
                    const frag = document.createDocumentFragment();
                    ch.textContent.split(/(\s+)/).forEach((tok) => {
                        if (!tok) return;
                        if (/^\s+$/.test(tok)) { frag.appendChild(document.createTextNode(' ')); return; }
                        const w = document.createElement('span');
                        w.className = 'w'; w.setAttribute('aria-hidden', 'true');
                        const wi = document.createElement('span');
                        wi.className = 'wi'; wi.style.setProperty('--i', i++); wi.textContent = tok;
                        w.appendChild(wi); frag.appendChild(w);
                    });
                    ch.replaceWith(frag);
                } else if (ch.nodeType === 1 && ch.tagName !== 'BR') {
                    walk(ch);
                }
            });
        };
        walk(el);
    }
    $$('[data-split]').forEach(splitWords);

    /* Manifiesto: cada palabra se "llena" con el scroll */
    const manifestoWords = (() => {
        const h = $('.manifesto__text');
        if (!h) return [];
        const text = h.textContent.replace(/\s+/g, ' ').trim();
        h.setAttribute('aria-label', text);
        h.textContent = '';
        const highlight = new Set(['pensión', 'trabajo.']);
        return text.split(' ').map((word, idx, arr) => {
            const s = document.createElement('span');
            s.className = 'mw' + (highlight.has(word.toLowerCase()) ? ' hl' : '');
            s.setAttribute('aria-hidden', 'true');
            s.textContent = word;
            h.appendChild(s);
            if (idx < arr.length - 1) h.appendChild(document.createTextNode(' '));
            return s;
        });
    })();

    /* ───────── 3. Reveals por IntersectionObserver ───────── */
    function initReveals() {
        const targets = $$('[data-reveal], [data-split]').filter((el) => !el.classList.contains('hero__title'));
        if (!('IntersectionObserver' in window) || reduce) {
            targets.forEach((el) => el.classList.add('is-in'));
            return;
        }
        const io = new IntersectionObserver((entries) => {
            entries.forEach((e) => {
                if (!e.isIntersecting) return;
                const el = e.target;
                el.classList.add('is-in');
                io.unobserve(el);
                if (el.hasAttribute('data-reveal')) {
                    // Al terminar, se retira el estado de reveal para no arrastrar sus transiciones al hover.
                    const delay = parseFloat(getComputedStyle(el).getPropertyValue('--d')) || 0;
                    setTimeout(() => { el.removeAttribute('data-reveal'); el.classList.remove('is-in'); }, 1500 + delay * 1000);
                }
            });
        }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
        targets.forEach((el) => io.observe(el));
    }

    /* ───────── 4. Pantalla de carga ───────── */
    function initLoader(onDone) {
        const loader = $('#loader');
        const pctEl = $('#loaderPct');
        const bar = $('#loaderBar');
        if (!loader) { onDone(); return; }

        const MIN = reduce ? 450 : 2700;
        const t0 = performance.now();
        let loaded = document.readyState === 'complete';
        let fonts = !document.fonts;
        let finished = false;
        if (!loaded) window.addEventListener('load', () => { loaded = true; }, { once: true });
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { fonts = true; }, () => { fonts = true; });

        let shown = 0;
        const finish = () => {
            if (finished) return;
            finished = true;
            pctEl.textContent = '100';
            bar.style.transform = 'scaleX(1)';
            setTimeout(() => {
                loader.classList.add('is-out');
                document.body.classList.remove('is-loading');
                root.classList.add('is-ready');
                onDone();
                setTimeout(() => loader.remove(), 1500);
            }, 380);
        };

        const step = (now) => {
            if (finished) return;
            const el = now - t0;
            const ready = loaded && fonts && el >= MIN;
            const timeP = clamp(el / MIN);
            const target = ready ? 1 : Math.min(.93, easeOut(timeP) * .93);
            shown = lerp(shown, target, .1);
            if (target === 1 && shown > .996) shown = 1;
            pctEl.textContent = String(Math.round(shown * 100));
            bar.style.transform = `scaleX(${shown.toFixed(4)})`;
            if (shown >= 1 || el > 8000) { finish(); return; }
            requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    }

    /* ───────── 5. Escenas con scroll (sticky + progreso) ───────── */
    const scenes = [];
    const themeSections = [];

    const addScene = (selector, config) => {
        const el = $(selector);
        if (el) scenes.push(Object.assign({ el, top: 0, h: 0, p: -1 }, config));
    };

    function layout() {
        state.vw = window.innerWidth;
        state.vh = window.innerHeight;
        // Primero las alturas definidas por JS, luego las posiciones.
        scenes.forEach((s) => s.onLayout && s.onLayout(s));
        scenes.forEach((s) => {
            s.top = s.el.getBoundingClientRect().top + window.scrollY;
            s.h = s.el.offsetHeight;
            s.p = -1;
        });
        themeSections.length = 0;
        $$('[data-theme]').forEach((el) => {
            if (el.classList.contains('nav')) return;
            const r = el.getBoundingClientRect();
            themeSections.push({ el, top: r.top + window.scrollY, bottom: r.bottom + window.scrollY, theme: el.dataset.theme, id: el.id });
        });
        themeSections.sort((a, b) => a.top - b.top);
        state.docH = document.documentElement.scrollHeight;
    }

    const progressOf = (s) => clamp((state.sy - s.top) / Math.max(1, s.h - state.vh));
    const near = (s, pad = 1.2) => state.sy > s.top - state.vh * pad && state.sy < s.top + s.h + state.vh * .3;

    /* --- Manifiesto --- */
    (() => {
        const cta = $('.manifesto__cta');
        let on = false;
        const stage = $('.manifesto__stage');
        addScene('.manifesto', {
            update(s) {
                const p = progressOf(s);
                if (p === s.p) return; s.p = p;
                stage.style.setProperty('--mp', p.toFixed(4));
                const n = clamp((p - .05) / .62) * manifestoWords.length;
                manifestoWords.forEach((w, i) => {
                    const o = clamp(n - i);
                    if (w._o !== o) { w._o = o; w.style.setProperty('--o', o.toFixed(3)); }
                });
                const next = p > .74;
                if (next !== on) { on = next; cta.classList.toggle('is-on', on); }
            }
        });
    })();

    /* --- La imagen se abre --- */
    const expand = { dark: false, started: false };
    (() => {
        const over = $('.expand__over');
        const stage = $('.expand__stage');
        addScene('#historia', {
            update(s) {
                const p = progressOf(s);
                if (p === s.p) return; s.p = p;
                const u = clamp((p - .03) / .5);
                const e = u * u * (3 - 2 * u);          // smoothstep: apertura lenta y cinematográfica
                const t = clamp((p - .56) / .2);
                stage.style.setProperty('--e', e.toFixed(4));
                stage.style.setProperty('--t', t.toFixed(4));
                over.classList.toggle('is-live', t > .6);
                expand.dark = e > .86;
                if (t > .4 && !expand.started) { expand.started = true; runCounters(); }
            }
        });
    })();

    function runCounters() {
        $$('[data-count]').forEach((el) => {
            const end = parseInt(el.dataset.count, 10);
            if (reduce) { el.textContent = end; return; }
            const t0 = performance.now();
            const dur = 1700;
            const tick = (now) => {
                const p = clamp((now - t0) / dur);
                el.textContent = String(Math.round(easeOut(p) * end));
                if (p < 1) requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
        });
    }

    /* --- De la Alfa a la Omega --- */
    const journey = { idx: -1 };
    (() => {
        const stage = $('.journey__stage');
        if (!stage) return;
        const cards = $('#jCards');
        const steps = $$('.jstep', cards);
        const stations = $$('#jStations button');
        const body = $('.journey__body');

        const initPath = (svg) => {
            const fill = $('.jp__fill', svg);
            const prev = svg.style.display;
            svg.style.display = 'block';
            const L = fill.getTotalLength();
            const nodes = $$('.jp__node', svg).map((g) => {
                const f = parseFloat(g.dataset.f);
                const pt = fill.getPointAtLength(f * L);
                g.setAttribute('transform', `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)})`);
                return { g, f, x: pt.x, y: pt.y };
            });
            svg.style.display = prev;
            return { svg, fill, L, nodes, dot: $('.jp__dot', svg), glow: $('.jp__glow', svg), vbw: svg.viewBox.baseVal.width };
        };
        const paths = [initPath($('#jpH')), initPath($('#jpV'))];
        const markVisible = () => paths.forEach((pt) => { pt.visible = pt.svg.getClientRects().length > 0; });
        markVisible();

        const setCardX = (idx) => {
            if (!mqTablet.matches) { cards.style.setProperty('--cx', '0px'); return; }
            const pth = paths[0];
            const rect = pth.svg.getBoundingClientRect();
            const bodyRect = body.getBoundingClientRect();
            const nodeX = pth.nodes[idx].x * (rect.width / pth.vbw) + (rect.left - bodyRect.left);
            const cardW = cards.offsetWidth;
            const cx = clamp(nodeX - cardW / 2, 0, Math.max(0, bodyRect.width - cardW));
            cards.style.setProperty('--cx', `${cx.toFixed(0)}px`);
        };

        const setStep = (idx) => {
            journey.idx = idx;
            steps.forEach((el, i) => {
                const on = i === idx;
                el.classList.toggle('is-on', on);
                el.setAttribute('aria-hidden', on ? 'false' : 'true');
            });
            stations.forEach((b, i) => b.classList.toggle('is-on', i === idx));
            setCardX(idx);
        };
        setStep(0);

        stations.forEach((b) => b.addEventListener('click', () => {
            const s = scenes.find((x) => x.name === 'journey');
            const idx = parseInt(b.dataset.go, 10);
            const p = Math.min(.88, (idx / 4) * .88 + (idx === 0 ? 0 : .012));
            window.scrollTo({ top: s.top + p * (s.h - state.vh), behavior: reduce ? 'auto' : 'smooth' });
        }));

        addScene('#recorrido', {
            name: 'journey',
            onLayout() { markVisible(); if (journey.idx > -1) setCardX(journey.idx); },
            update(s) {
                const p = progressOf(s);
                if (p === s.p) return; s.p = p;
                const pp = clamp(p / .88);
                stage.style.setProperty('--jp', pp.toFixed(4));
                paths.forEach((pt) => {
                    if (!pt.visible) return;
                    pt.fill.style.strokeDashoffset = String(1 - pp);
                    const pos = pt.fill.getPointAtLength(pp * pt.L);
                    pt.dot.setAttribute('cx', pos.x.toFixed(1)); pt.dot.setAttribute('cy', pos.y.toFixed(1));
                    pt.glow.setAttribute('cx', pos.x.toFixed(1)); pt.glow.setAttribute('cy', pos.y.toFixed(1));
                    pt.nodes.forEach((n) => n.g.classList.toggle('is-lit', pp + .004 >= n.f));
                });
                const idx = Math.min(4, Math.floor(pp * 4 + .02));
                if (idx !== journey.idx) setStep(idx);
            }
        });
    })();

    /* --- Servicios: desplazamiento horizontal --- */
    (() => {
        const track = $('#hpanTrack');
        if (!track) return;
        const stage = $('.hpan__stage');
        const cards = $$('.hcard', track).map((el) => ({ el, left: 0, w: 0 }));
        let dist = 0;
        addScene('#servicios', {
            onLayout(s) {
                if (reduce) { s.el.style.removeProperty('--hh'); return; }
                track.style.transform = 'none';
                dist = Math.max(0, track.scrollWidth - state.vw);
                s.el.style.setProperty('--hh', `${Math.round(dist + state.vh)}px`);
                cards.forEach((c) => { c.left = c.el.offsetLeft; c.w = c.el.offsetWidth; });
            },
            update(s) {
                if (reduce) return;
                const p = progressOf(s);
                if (p === s.p) return; s.p = p;
                const x = -dist * p;
                track.style.transform = `translate3d(${x.toFixed(1)}px,0,0)`;
                stage.style.setProperty('--hp', p.toFixed(4));
                cards.forEach((c) => {
                    const center = c.left + c.w / 2 + x;
                    const hx = clamp((center - state.vw / 2) / (state.vw / 2 + c.w / 2), -1, 1);
                    c.el.style.setProperty('--hx', hx.toFixed(3));
                });
            }
        });
    })();

    /* --- Modalidades: tarjetas apiladas --- */
    (() => {
        const mods = $$('.mod[data-stack]');
        if (mods.length < 2) return;
        addScene('#modalidades', {
            update(s) {
                if (!near(s, 1)) return;
                if (!mqDesktop.matches || reduce) {
                    mods.forEach((m) => m.style.setProperty('--q', '0'));
                    return;
                }
                for (let i = 0; i < mods.length - 1; i++) {
                    const top = mods[i + 1].getBoundingClientRect().top;
                    const start = state.vh * .95;
                    const end = 64 + 36 + 24 * (i + 1);
                    const q = clamp((start - top) / (start - end));
                    mods[i].style.setProperty('--q', q.toFixed(3));
                }
            }
        });
    })();

    /* --- Pie: palabra gigante --- */
    (() => {
        const foot = $('.foot');
        const word = $('.foot__word');
        if (!foot || !word) return;
        addScene('.foot', {
            update(s) {
                const p = clamp((state.sy + state.vh - s.top) / (state.vh * .75));
                if (p === s.p) return; s.p = p;
                word.style.setProperty('--fw', easeOut(p).toFixed(3));
            }
        });
    })();

    /* --- Elementos flotantes del manifiesto (parallax) ya dependen de --mp --- */

    /* ───────── 6. Hero: partículas, palabras rotativas, parallax de cursor ───────── */
    const hero = (() => {
        const el = $('#inicio');
        const visual = $('#heroVisual');
        const canvas = $('#heroCanvas');
        const cursor = $('#heroCursor');
        const out = { el, active: true, draw() {}, resize() {} };
        if (!el) return out;

        /* Palabras rotativas */
        const items = $$('.roll__item');
        let ri = 0, rt = 0;
        out.roll = (dt) => {
            if (reduce || items.length < 2) return;
            rt += dt;
            if (rt < 2400) return;
            rt = 0;
            const cur = items[ri];
            ri = (ri + 1) % items.length;
            const nxt = items[ri];
            cur.classList.remove('is-on'); cur.classList.add('is-off');
            nxt.classList.remove('is-off'); nxt.classList.add('is-on');
            setTimeout(() => { cur.classList.remove('is-off'); }, 900);
        };

        /* Parallax con el cursor */
        const m = { tx: 0, ty: 0, x: 0, y: 0, cx: 0, cy: 0, tcx: 0, tcy: 0 };
        if (finePointer && !reduce) {
            el.addEventListener('pointermove', (e) => {
                const r = el.getBoundingClientRect();
                m.tx = ((e.clientX - r.left) / r.width - .5) * 2;
                m.ty = ((e.clientY - r.top) / r.height - .5) * 2;
                m.tcx = e.clientX - r.left; m.tcy = e.clientY - r.top;
                mouse.x = m.tcx; mouse.y = m.tcy;
                cursor.style.opacity = '1';
            }, { passive: true });
            el.addEventListener('pointerleave', () => {
                m.tx = 0; m.ty = 0; mouse.x = -9999; mouse.y = -9999;
                cursor.style.opacity = '0';
            });
        }
        out.parallax = () => {
            if (!finePointer || reduce) return;
            m.x = lerp(m.x, m.tx, .06); m.y = lerp(m.y, m.ty, .06);
            m.cx = lerp(m.cx, m.tcx, .12); m.cy = lerp(m.cy, m.tcy, .12);
            visual.style.setProperty('--px', m.x.toFixed(3));
            visual.style.setProperty('--py', m.y.toFixed(3));
            cursor.style.setProperty('--cx', `${m.cx.toFixed(0)}px`);
            cursor.style.setProperty('--cy', `${m.cy.toFixed(0)}px`);
        };

        /* Partículas doradas con constelación */
        const mouse = { x: -9999, y: -9999 };
        if (canvas && !reduce) {
            const ctx = canvas.getContext('2d');
            let w = 0, h = 0, dpr = 1, parts = [];
            const make = () => ({
                x: Math.random() * w, y: Math.random() * h,
                vx: (Math.random() - .5) * .22, vy: -(.04 + Math.random() * .22),
                r: .6 + Math.random() * 1.7, a: .3 + Math.random() * .6,
                tw: Math.random() * 6.28, ts: .6 + Math.random() * 1.4
            });
            out.resize = () => {
                const r = canvas.getBoundingClientRect();
                dpr = Math.min(window.devicePixelRatio || 1, 1.75);
                w = r.width; h = r.height;
                canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                const n = clamp(Math.round((w * h) / (state.vw < 760 ? 15000 : 9500)), 26, state.vw < 760 ? 56 : 118);
                parts = Array.from({ length: n }, make);
            };
            out.draw = (dt, t) => {
                const f = dt / 16.67;
                const link = state.vw < 760 ? 92 : 134;
                const l2 = link * link;
                ctx.clearRect(0, 0, w, h);
                const wind = state.vel * .22;
                for (const p of parts) {
                    p.x += p.vx * f; p.y += (p.vy - wind) * f;
                    const dx = p.x - mouse.x, dy = p.y - mouse.y, d2 = dx * dx + dy * dy;
                    if (d2 < 24000) { const d = Math.sqrt(d2) || 1, k = (1 - d / 155) * 1.6 * f; p.x += (dx / d) * k; p.y += (dy / d) * k; }
                    if (p.x < -10) p.x = w + 10; else if (p.x > w + 10) p.x = -10;
                    if (p.y < -10) p.y = h + 10; else if (p.y > h + 10) p.y = -10;
                }
                ctx.lineWidth = .9;
                for (let i = 0; i < parts.length; i++) {
                    const a = parts[i];
                    for (let j = i + 1; j < parts.length; j++) {
                        const b = parts[j];
                        const dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
                        if (d2 < l2) {
                            ctx.strokeStyle = `rgba(227,191,99,${((1 - Math.sqrt(d2) / link) * .4).toFixed(3)})`;
                            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
                        }
                    }
                }
                for (const p of parts) {
                    const tw = .55 + .45 * Math.sin(t * .001 * p.ts + p.tw);
                    ctx.fillStyle = `rgba(247,230,173,${(p.a * tw).toFixed(3)})`;
                    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.2832); ctx.fill();
                }
            };
            out.resize();
        }
        return out;
    })();

    /* ───────── 7. Cinta dorada (velocidad ligada al scroll) ───────── */
    const band = (() => {
        const track = $('#bandTrack');
        const row = $('#bandRow');
        const out = { update() {}, measure() {} };
        if (!track || !row || reduce) return out;
        const clone = row.cloneNode(true);
        clone.removeAttribute('id'); clone.setAttribute('aria-hidden', 'true');
        track.appendChild(clone);
        let x = 0, w = 0, dir = 1;
        out.measure = () => { w = row.offsetWidth; };
        out.update = (dt) => {
            const v = state.vel;
            const dTarget = v < -.6 ? -1 : v > .6 ? 1 : dir;
            dir = lerp(dir, dTarget, .06);
            x -= dir * 70 * (dt / 1000) + v * .55;
            if (w) { if (x <= -w) x += w; if (x > 0) x -= w; }
            const sk = clamp(v * -.35, -7, 7);
            track.style.transform = `translate3d(${x.toFixed(2)}px,0,0) skewX(${sk.toFixed(2)}deg)`;
        };
        return out;
    })();

    /* ───────── 8. Navegación ───────── */
    const nav = (() => {
        const el = $('#nav');
        const burger = $('#navBurger');
        const menu = $('#menu');
        const links = $$('[data-nav]');
        const out = { theme: 'dark', update() {} };

        const setMenu = (open) => {
            menu.classList.toggle('is-open', open);
            menu.setAttribute('aria-hidden', open ? 'false' : 'true');
            burger.setAttribute('aria-expanded', open ? 'true' : 'false');
            burger.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
            document.body.style.overflow = open ? 'hidden' : '';
            if (open) { el.dataset.theme = 'dark'; const first = $('a', menu); first && setTimeout(() => first.focus({ preventScroll: true }), 450); }
        };
        burger.addEventListener('click', () => setMenu(!menu.classList.contains('is-open')));
        $$('a', menu).forEach((a) => a.addEventListener('click', () => setMenu(false)));
        window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu.classList.contains('is-open')) { setMenu(false); burger.focus(); } });
        mqDesktop.addEventListener('change', (e) => { if (e.matches) setMenu(false); });

        out.update = () => {
            const y = state.ty + 44;
            let cur = themeSections[0];
            for (const s of themeSections) { if (s.top <= y) cur = s; else break; }
            if (cur && !menu.classList.contains('is-open')) {
                let theme = cur.theme;
                if (cur.id === 'historia') theme = expand.dark ? 'dark' : 'light';
                if (theme !== out.theme) { out.theme = theme; el.dataset.theme = theme; }
            }
            const probe = state.ty + state.vh * .4;
            links.forEach((a) => {
                const sec = themeSections.find((s) => s.id === a.getAttribute('href').slice(1));
                a.classList.toggle('is-active', !!sec && probe >= sec.top && probe < sec.bottom);
            });
            const max = Math.max(1, state.docH - state.vh);
            el.style.setProperty('--sp', clamp(state.ty / max).toFixed(4));
        };
        return out;
    })();

    /* ───────── 9. Acordeón ───────── */
    (() => {
        const items = $$('.acc__item');
        const set = (item, open) => {
            item.classList.toggle('is-open', open);
            $('.acc__btn', item).setAttribute('aria-expanded', open ? 'true' : 'false');
        };
        items.forEach((item, i) => {
            if (i === 0) set(item, true);
            $('.acc__btn', item).addEventListener('click', () => {
                const open = !item.classList.contains('is-open');
                items.forEach((o) => set(o, false));
                set(item, open);
            });
        });
    })();

    /* ───────── 10. Ley 73 / Ley 97 ───────── */
    (() => {
        const seg = $('#seg');
        if (!seg) return;
        const tabs = $$('.seg__btn', seg);
        const panels = { 73: $('#panel-73'), 97: $('#panel-97') };
        const ghosts = $$('.laws__ghost span');
        const set = (k, focus) => {
            seg.dataset.active = k;
            tabs.forEach((b) => {
                const on = b.dataset.law === k;
                b.classList.toggle('is-on', on);
                b.setAttribute('aria-selected', on ? 'true' : 'false');
                b.tabIndex = on ? 0 : -1;
                if (on && focus) b.focus();
            });
            Object.keys(panels).forEach((key) => {
                const on = key === k;
                panels[key].hidden = !on;
                panels[key].classList.toggle('is-on', on);
            });
            ghosts.forEach((g) => g.classList.toggle('is-on', g.dataset.g === k));
        };
        seg.dataset.active = '73';
        tabs.forEach((b) => b.addEventListener('click', () => set(b.dataset.law)));
        seg.addEventListener('keydown', (e) => {
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') return;
            e.preventDefault();
            set(e.key === 'ArrowLeft' || e.key === 'Home' ? '73' : '97', true);
        });
    })();

    /* ───────── 11. Efectos de puntero (spotlight y botones magnéticos) ───────── */
    (() => {
        if (!finePointer || reduce) return;
        $$('.spot').forEach((el) => {
            el.addEventListener('pointermove', (e) => {
                const r = el.getBoundingClientRect();
                el.style.setProperty('--mx', `${e.clientX - r.left}px`);
                el.style.setProperty('--my', `${e.clientY - r.top}px`);
            }, { passive: true });
        });
        $$('[data-magnetic]').forEach((el) => {
            el.addEventListener('pointermove', (e) => {
                const r = el.getBoundingClientRect();
                const dx = e.clientX - (r.left + r.width / 2);
                const dy = e.clientY - (r.top + r.height / 2);
                el.style.translate = `${(dx * .18).toFixed(1)}px ${(dy * .28).toFixed(1)}px`;
            });
            el.addEventListener('pointerleave', () => { el.style.translate = '0 0'; });
        });
    })();

    /* ───────── 12. Formulario → WhatsApp ───────── */
    (() => {
        const form = $('#contactForm');
        if (!form) return;
        const status = $('#formStatus');
        const field = (id) => $(`#f-${id}`);
        const setErr = (id, msg) => {
            const input = field(id);
            const err = $(`#e-${id}`);
            const wrap = input.closest('.field');
            wrap.classList.toggle('has-error', !!msg);
            err.textContent = msg;
            input.setAttribute('aria-invalid', msg ? 'true' : 'false');
            if (msg) input.setAttribute('aria-describedby', `e-${id}`); else input.removeAttribute('aria-describedby');
            return !msg;
        };
        ['nombre', 'tel', 'interes'].forEach((id) => {
            field(id).addEventListener('input', () => { if (field(id).closest('.field').classList.contains('has-error')) setErr(id, ''); });
        });

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const nombre = field('nombre').value.trim();
            const tel = field('tel').value.trim();
            const interes = field('interes').value;
            const cotiza = field('cotiza').value;
            const msg = field('msg').value.trim();

            const okName = setErr('nombre', nombre.length < 3 ? 'Escribe tu nombre para poder atenderte.' : '');
            const okTel = setErr('tel', tel.replace(/\D/g, '').length < 10 ? 'Escribe un teléfono de al menos 10 dígitos.' : '');
            const okInt = setErr('interes', !interes ? 'Elige qué necesitas para orientarte mejor.' : '');
            if (!(okName && okTel && okInt)) {
                const bad = [['nombre', okName], ['tel', okTel], ['interes', okInt]].find((x) => !x[1]);
                field(bad[0]).focus();
                status.textContent = '';
                return;
            }

            const lines = [`Hola, soy ${nombre}.`, `Necesito asesoría sobre: ${interes}.`];
            if (cotiza) lines.push(`Empecé a cotizar en el IMSS: ${cotiza}.`);
            if (msg) lines.push(`Mi caso: ${msg}`);
            lines.push(`Mi contacto: ${tel}`);
            const url = waLink(lines.join('\n'));

            status.textContent = 'Abriendo WhatsApp con tu mensaje listo. Si no se abre, ';
            const a = document.createElement('a');
            a.href = url; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'haz clic aquí';
            status.appendChild(a);
            status.appendChild(document.createTextNode('.'));
            window.open(url, '_blank', 'noopener');
        });
    })();

    /* ───────── 13. Botón flotante de WhatsApp ───────── */
    (() => {
        const tip = $('#waTip');
        const close = $('#waClose');
        if (!tip) return;
        let dismissed = false;
        try { dismissed = sessionStorage.getItem('ayo-tip') === '1'; } catch (err) { /* sin almacenamiento */ }
        const hide = (remember) => {
            tip.classList.remove('is-on');
            if (remember) { try { sessionStorage.setItem('ayo-tip', '1'); } catch (err) { /* noop */ } }
        };
        close.addEventListener('click', () => hide(true));
        if (!dismissed) {
            setTimeout(() => tip.classList.add('is-on'), 9000);
            setTimeout(() => hide(false), 22000);
        }
        const top = $('#toTop');
        if (top) top.addEventListener('click', () => window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }));
    })();

    /* ───────── 14. Bucle maestro ───────── */
    let last = performance.now();
    let heroT = 0;
    function frame(now) {
        const dt = Math.min(64, now - last);
        last = now;

        state.ty = window.scrollY;
        const k = reduce ? 1 : 1 - Math.pow(1 - .13, dt / 16.67);
        const prev = state.sy;
        state.sy = lerp(state.sy, state.ty, k);
        if (Math.abs(state.ty - state.sy) < .08) state.sy = state.ty;
        state.vel = state.sy - prev;

        // Hero
        if (hero.el) {
            const heroH = hero.h || hero.el.offsetHeight;
            const visible = state.sy < heroH + 40;
            if (visible) {
                heroT += dt;
                const hp = clamp(state.sy / (heroH * .85));
                hero.el.style.setProperty('--hp', hp.toFixed(4));
                hero.parallax();
                hero.draw(dt, heroT);
                if (root.classList.contains('is-ready')) hero.roll(dt);
            }
        }

        band.update(dt);

        for (const s of scenes) { if (s.p < 0 || near(s)) s.update(s); }
        nav.update();
        requestAnimationFrame(frame);
    }

    /* ───────── 15. Arranque ───────── */
    let resizeT;
    const relayout = () => {
        layout();
        band.measure();
        if (hero.el) hero.h = hero.el.offsetHeight;
        hero.resize();
        state.sy = state.ty = window.scrollY;
    };
    window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(relayout, 150); });
    window.addEventListener('load', () => setTimeout(relayout, 60));
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => setTimeout(relayout, 60));
    if ('ResizeObserver' in window) {
        let h = 0, ro;
        ro = new ResizeObserver(() => {
            const nh = document.documentElement.scrollHeight;
            if (Math.abs(nh - h) > 4) { h = nh; clearTimeout(resizeT); resizeT = setTimeout(relayout, 200); }
        });
        ro.observe(document.body);
    }

    layout();
    band.measure();
    initReveals();
    requestAnimationFrame((t) => { last = t; requestAnimationFrame(frame); });

    initLoader(() => {
        // Entrada del hero: el titular sube palabra por palabra.
        setTimeout(() => { const t = $('.hero__title'); if (t) t.classList.add('is-in'); }, 160);
        relayout();
    });

    /* Para accesibilidad: sin JS de scroll en movimiento reducido, mostrar contadores finales */
    if (reduce) runCounters();
})();
