var app = (function () {
	'use strict';

	function noop() {}

	const identity = x => x;

	function assign(tar, src) {
		for (const k in src) tar[k] = src[k];
		return tar;
	}

	function add_location(element, file, line, column, char) {
		element.__svelte_meta = {
			loc: { file, line, column, char }
		};
	}

	function run(fn) {
		return fn();
	}

	function blank_object() {
		return Object.create(null);
	}

	function run_all(fns) {
		fns.forEach(run);
	}

	function is_function(thing) {
		return typeof thing === 'function';
	}

	function safe_not_equal(a, b) {
		return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
	}

	function validate_store(store, name) {
		if (!store || typeof store.subscribe !== 'function') {
			throw new Error(`'${name}' is not a store with a 'subscribe' method`);
		}
	}

	function subscribe(component, store, callback) {
		const unsub = store.subscribe(callback);

		component.$$.on_destroy.push(unsub.unsubscribe
			? () => unsub.unsubscribe()
			: unsub);
	}

	function create_slot(definition, ctx, fn) {
		if (definition) {
			const slot_ctx = get_slot_context(definition, ctx, fn);
			return definition[0](slot_ctx);
		}
	}

	function get_slot_context(definition, ctx, fn) {
		return definition[1]
			? assign({}, assign(ctx.$$scope.ctx, definition[1](fn ? fn(ctx) : {})))
			: ctx.$$scope.ctx;
	}

	function get_slot_changes(definition, ctx, changed, fn) {
		return definition[1]
			? assign({}, assign(ctx.$$scope.changed || {}, definition[1](fn ? fn(changed) : {})))
			: ctx.$$scope.changed || {};
	}

	const tasks = new Set();
	let running = false;

	function run_tasks() {
		tasks.forEach(task => {
			if (!task[0](window.performance.now())) {
				tasks.delete(task);
				task[1]();
			}
		});

		running = tasks.size > 0;
		if (running) requestAnimationFrame(run_tasks);
	}

	function loop(fn) {
		let task;

		if (!running) {
			running = true;
			requestAnimationFrame(run_tasks);
		}

		return {
			promise: new Promise(fulfil => {
				tasks.add(task = [fn, fulfil]);
			}),
			abort() {
				tasks.delete(task);
			}
		};
	}

	function append(target, node) {
		target.appendChild(node);
	}

	function insert(target, node, anchor) {
		target.insertBefore(node, anchor);
	}

	function detach(node) {
		node.parentNode.removeChild(node);
	}

	function destroy_each(iterations, detaching) {
		for (let i = 0; i < iterations.length; i += 1) {
			if (iterations[i]) iterations[i].d(detaching);
		}
	}

	function element(name) {
		return document.createElement(name);
	}

	function text(data) {
		return document.createTextNode(data);
	}

	function space() {
		return text(' ');
	}

	function empty() {
		return text('');
	}

	function listen(node, event, handler, options) {
		node.addEventListener(event, handler, options);
		return () => node.removeEventListener(event, handler, options);
	}

	function attr(node, attribute, value) {
		if (value == null) node.removeAttribute(attribute);
		else node.setAttribute(attribute, value);
	}

	function children(element) {
		return Array.from(element.childNodes);
	}

	function set_data(text, data) {
		data = '' + data;
		if (text.data !== data) text.data = data;
	}

	function set_style(node, key, value) {
		node.style.setProperty(key, value);
	}

	function custom_event(type, detail) {
		const e = document.createEvent('CustomEvent');
		e.initCustomEvent(type, false, false, detail);
		return e;
	}

	let stylesheet;
	let active = 0;
	let current_rules = {};

	// https://github.com/darkskyapp/string-hash/blob/master/index.js
	function hash(str) {
		let hash = 5381;
		let i = str.length;

		while (i--) hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
		return hash >>> 0;
	}

	function create_rule(node, a, b, duration, delay, ease, fn, uid = 0) {
		const step = 16.666 / duration;
		let keyframes = '{\n';

		for (let p = 0; p <= 1; p += step) {
			const t = a + (b - a) * ease(p);
			keyframes += p * 100 + `%{${fn(t, 1 - t)}}\n`;
		}

		const rule = keyframes + `100% {${fn(b, 1 - b)}}\n}`;
		const name = `__svelte_${hash(rule)}_${uid}`;

		if (!current_rules[name]) {
			if (!stylesheet) {
				const style = element('style');
				document.head.appendChild(style);
				stylesheet = style.sheet;
			}

			current_rules[name] = true;
			stylesheet.insertRule(`@keyframes ${name} ${rule}`, stylesheet.cssRules.length);
		}

		const animation = node.style.animation || '';
		node.style.animation = `${animation ? `${animation}, ` : ``}${name} ${duration}ms linear ${delay}ms 1 both`;

		active += 1;
		return name;
	}

	function delete_rule(node, name) {
		node.style.animation = (node.style.animation || '')
			.split(', ')
			.filter(name
				? anim => anim.indexOf(name) < 0 // remove specific animation
				: anim => anim.indexOf('__svelte') === -1 // remove all Svelte animations
			)
			.join(', ');

		if (name && !--active) clear_rules();
	}

	function clear_rules() {
		requestAnimationFrame(() => {
			if (active) return;
			let i = stylesheet.cssRules.length;
			while (i--) stylesheet.deleteRule(i);
			current_rules = {};
		});
	}

	let current_component;

	function set_current_component(component) {
		current_component = component;
	}

	function get_current_component() {
		if (!current_component) throw new Error(`Function called outside component initialization`);
		return current_component;
	}

	function onMount(fn) {
		get_current_component().$$.on_mount.push(fn);
	}

	function createEventDispatcher() {
		const component = current_component;

		return (type, detail) => {
			const callbacks = component.$$.callbacks[type];

			if (callbacks) {
				// TODO are there situations where events could be dispatched
				// in a server (non-DOM) environment?
				const event = custom_event(type, detail);
				callbacks.slice().forEach(fn => {
					fn.call(component, event);
				});
			}
		};
	}

	const dirty_components = [];

	const resolved_promise = Promise.resolve();
	let update_scheduled = false;
	const binding_callbacks = [];
	const render_callbacks = [];
	const flush_callbacks = [];

	function schedule_update() {
		if (!update_scheduled) {
			update_scheduled = true;
			resolved_promise.then(flush);
		}
	}

	function add_render_callback(fn) {
		render_callbacks.push(fn);
	}

	function flush() {
		const seen_callbacks = new Set();

		do {
			// first, call beforeUpdate functions
			// and update components
			while (dirty_components.length) {
				const component = dirty_components.shift();
				set_current_component(component);
				update(component.$$);
			}

			while (binding_callbacks.length) binding_callbacks.shift()();

			// then, once components are updated, call
			// afterUpdate functions. This may cause
			// subsequent updates...
			while (render_callbacks.length) {
				const callback = render_callbacks.pop();
				if (!seen_callbacks.has(callback)) {
					callback();

					// ...so guard against infinite loops
					seen_callbacks.add(callback);
				}
			}
		} while (dirty_components.length);

		while (flush_callbacks.length) {
			flush_callbacks.pop()();
		}

		update_scheduled = false;
	}

	function update($$) {
		if ($$.fragment) {
			$$.update($$.dirty);
			run_all($$.before_render);
			$$.fragment.p($$.dirty, $$.ctx);
			$$.dirty = null;

			$$.after_render.forEach(add_render_callback);
		}
	}

	let promise;

	function wait() {
		if (!promise) {
			promise = Promise.resolve();
			promise.then(() => {
				promise = null;
			});
		}

		return promise;
	}

	let outros;

	function group_outros() {
		outros = {
			remaining: 0,
			callbacks: []
		};
	}

	function check_outros() {
		if (!outros.remaining) {
			run_all(outros.callbacks);
		}
	}

	function on_outro(callback) {
		outros.callbacks.push(callback);
	}

	function create_in_transition(node, fn, params) {
		let config = fn(node, params);
		let running = false;
		let animation_name;
		let task;
		let uid = 0;

		function cleanup() {
			if (animation_name) delete_rule(node, animation_name);
		}

		function go() {
			const {
				delay = 0,
				duration = 300,
				easing = identity,
				tick: tick$$1 = noop,
				css
			} = config;

			if (css) animation_name = create_rule(node, 0, 1, duration, delay, easing, css, uid++);
			tick$$1(0, 1);

			const start_time = window.performance.now() + delay;
			const end_time = start_time + duration;

			if (task) task.abort();
			running = true;

			task = loop(now => {
				if (running) {
					if (now >= end_time) {
						tick$$1(1, 0);
						cleanup();
						return running = false;
					}

					if (now >= start_time) {
						const t = easing((now - start_time) / duration);
						tick$$1(t, 1 - t);
					}
				}

				return running;
			});
		}

		let started = false;

		return {
			start() {
				if (started) return;

				delete_rule(node);

				if (typeof config === 'function') {
					config = config();
					wait().then(go);
				} else {
					go();
				}
			},

			invalidate() {
				started = false;
			},

			end() {
				if (running) {
					cleanup();
					running = false;
				}
			}
		};
	}

	function create_out_transition(node, fn, params) {
		let config = fn(node, params);
		let running = true;
		let animation_name;

		const group = outros;

		group.remaining += 1;

		function go() {
			const {
				delay = 0,
				duration = 300,
				easing = identity,
				tick: tick$$1 = noop,
				css
			} = config;

			if (css) animation_name = create_rule(node, 1, 0, duration, delay, easing, css);

			const start_time = window.performance.now() + delay;
			const end_time = start_time + duration;

			loop(now => {
				if (running) {
					if (now >= end_time) {
						tick$$1(0, 1);

						if (!--group.remaining) {
							// this will result in `end()` being called,
							// so we don't need to clean up here
							run_all(group.callbacks);
						}

						return false;
					}

					if (now >= start_time) {
						const t = easing((now - start_time) / duration);
						tick$$1(1 - t, t);
					}
				}

				return running;
			});
		}

		if (typeof config === 'function') {
			wait().then(() => {
				config = config();
				go();
			});
		} else {
			go();
		}

		return {
			end(reset) {
				if (reset && config.tick) {
					config.tick(1, 0);
				}

				if (running) {
					if (animation_name) delete_rule(node, animation_name);
					running = false;
				}
			}
		};
	}

	function mount_component(component, target, anchor) {
		const { fragment, on_mount, on_destroy, after_render } = component.$$;

		fragment.m(target, anchor);

		// onMount happens after the initial afterUpdate. Because
		// afterUpdate callbacks happen in reverse order (inner first)
		// we schedule onMount callbacks before afterUpdate callbacks
		add_render_callback(() => {
			const new_on_destroy = on_mount.map(run).filter(is_function);
			if (on_destroy) {
				on_destroy.push(...new_on_destroy);
			} else {
				// Edge case - component was destroyed immediately,
				// most likely as a result of a binding initialising
				run_all(new_on_destroy);
			}
			component.$$.on_mount = [];
		});

		after_render.forEach(add_render_callback);
	}

	function destroy(component, detaching) {
		if (component.$$) {
			run_all(component.$$.on_destroy);
			component.$$.fragment.d(detaching);

			// TODO null out other refs, including component.$$ (but need to
			// preserve final state?)
			component.$$.on_destroy = component.$$.fragment = null;
			component.$$.ctx = {};
		}
	}

	function make_dirty(component, key) {
		if (!component.$$.dirty) {
			dirty_components.push(component);
			schedule_update();
			component.$$.dirty = {};
		}
		component.$$.dirty[key] = true;
	}

	function init(component, options, instance, create_fragment, not_equal$$1, prop_names) {
		const parent_component = current_component;
		set_current_component(component);

		const props = options.props || {};

		const $$ = component.$$ = {
			fragment: null,
			ctx: null,

			// state
			props: prop_names,
			update: noop,
			not_equal: not_equal$$1,
			bound: blank_object(),

			// lifecycle
			on_mount: [],
			on_destroy: [],
			before_render: [],
			after_render: [],
			context: new Map(parent_component ? parent_component.$$.context : []),

			// everything else
			callbacks: blank_object(),
			dirty: null
		};

		let ready = false;

		$$.ctx = instance
			? instance(component, props, (key, value) => {
				if ($$.ctx && not_equal$$1($$.ctx[key], $$.ctx[key] = value)) {
					if ($$.bound[key]) $$.bound[key](value);
					if (ready) make_dirty(component, key);
				}
			})
			: props;

		$$.update();
		ready = true;
		run_all($$.before_render);
		$$.fragment = create_fragment($$.ctx);

		if (options.target) {
			if (options.hydrate) {
				$$.fragment.l(children(options.target));
			} else {
				$$.fragment.c();
			}

			if (options.intro && component.$$.fragment.i) component.$$.fragment.i();
			mount_component(component, options.target, options.anchor);
			flush();
		}

		set_current_component(parent_component);
	}

	class SvelteComponent {
		$destroy() {
			destroy(this, true);
			this.$destroy = noop;
		}

		$on(type, callback) {
			const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
			callbacks.push(callback);

			return () => {
				const index = callbacks.indexOf(callback);
				if (index !== -1) callbacks.splice(index, 1);
			};
		}

		$set() {
			// overridden by instance, if it has props
		}
	}

	class SvelteComponentDev extends SvelteComponent {
		constructor(options) {
			if (!options || (!options.target && !options.$$inline)) {
				throw new Error(`'target' is a required option`);
			}

			super();
		}

		$destroy() {
			super.$destroy();
			this.$destroy = () => {
				console.warn(`Component was already destroyed`); // eslint-disable-line no-console
			};
		}
	}

	function writable(value, start = noop) {
		let stop;
		const subscribers = [];

		function set(new_value) {
			if (safe_not_equal(value, new_value)) {
				value = new_value;
				if (!stop) return; // not ready
				subscribers.forEach(s => s[1]());
				subscribers.forEach(s => s[0](value));
			}
		}

		function update(fn) {
			set(fn(value));
		}

		function subscribe(run, invalidate = noop) {
			const subscriber = [run, invalidate];
			subscribers.push(subscriber);
			if (subscribers.length === 1) stop = start(set) || noop;
			run(value);

			return () => {
				const index = subscribers.indexOf(subscriber);
				if (index !== -1) subscribers.splice(index, 1);
				if (subscribers.length === 0) stop();
			};
		}

		return { set, update, subscribe };
	}

	const hash$1 = writable('');

	hashSetter();

	window.onhashchange = () => hashSetter();

	function hashSetter() {
	  hash$1.set(
	    location.hash.length >= 2 
	    ? location.hash.substring(2) 
	    : ''
	  );
	}

	/*
	Adapted from https://github.com/mattdesl
	Distributed under MIT License https://github.com/mattdesl/eases/blob/master/LICENSE.md
	*/

	function cubicOut(t) {
		var f = t - 1.0;
		return f * f * f + 1.0;
	}

	function fade(node, {
		delay = 0,
		duration = 400
	}) {
		const o = +getComputedStyle(node).opacity;

		return {
			delay,
			duration,
			css: t => `opacity: ${t * o}`
		};
	}

	function scale(node, {
		delay = 0,
		duration = 400,
		easing = cubicOut,
		start = 0,
		opacity = 0
	}) {
		const style = getComputedStyle(node);
		const target_opacity = +style.opacity;
		const transform = style.transform === 'none' ? '' : style.transform;

		const sd = 1 - start;
		const od = target_opacity * (1 - opacity);

		return {
			delay,
			duration,
			easing,
			css: (t, u) => `
			transform: ${transform} scale(${1 - (sd * u)});
			opacity: ${target_opacity - (od * u)}
		`
		};
	}

	/* src\app\component\FoodComponent.svelte generated by Svelte v3.1.0 */

	const file = "src\\app\\component\\FoodComponent.svelte";

	function create_fragment(ctx) {
		var div1, img, img_src_value, img_alt_value, t0, div0, button0, t2, button1, t4, button2, div1_intro, div1_outro, current, dispose;

		return {
			c: function create() {
				div1 = element("div");
				img = element("img");
				t0 = space();
				div0 = element("div");
				button0 = element("button");
				button0.textContent = "dislike";
				t2 = space();
				button1 = element("button");
				button1.textContent = "like";
				t4 = space();
				button2 = element("button");
				button2.textContent = "superlike";
				img.src = img_src_value = "./images/" + ctx.food_nr + ".jpg";
				img.className = "card-img-top svelte-129nl5t";
				img.alt = img_alt_value = ctx.food.food_name;
				add_location(img, file, 55, 4, 1229);
				button0.className = "btn btn-primary";
				button0.id = "dislike";
				add_location(button0, file, 58, 6, 1351);
				button1.className = "btn btn-primary";
				button1.id = "like";
				add_location(button1, file, 59, 6, 1450);
				button2.className = "btn btn-primary";
				button2.id = "superlike";
				add_location(button2, file, 60, 6, 1543);
				div0.className = "card-body svelte-129nl5t";
				add_location(div0, file, 56, 4, 1312);
				div1.className = "card mx-auto mt-5 svelte-129nl5t";
				div1.id = "card-element";
				set_style(div1, "width", "18rem");
				set_style(div1, "text-align", "center");
				add_location(div1, file, 54, 0, 1115);

				dispose = [
					listen(button0, "click", ctx.click_handler),
					listen(button1, "click", ctx.click_handler_1),
					listen(button2, "click", ctx.click_handler_2)
				];
			},

			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},

			m: function mount(target, anchor) {
				insert(target, div1, anchor);
				append(div1, img);
				append(div1, t0);
				append(div1, div0);
				append(div0, button0);
				append(div0, t2);
				append(div0, button1);
				append(div0, t4);
				append(div0, button2);
				current = true;
			},

			p: function update_1(changed, ctx) {
				if ((!current || changed.food_nr) && img_src_value !== (img_src_value = "./images/" + ctx.food_nr + ".jpg")) {
					img.src = img_src_value;
				}

				if ((!current || changed.food) && img_alt_value !== (img_alt_value = ctx.food.food_name)) {
					img.alt = img_alt_value;
				}
			},

			i: function intro(local) {
				if (current) return;
				add_render_callback(() => {
					if (div1_outro) div1_outro.end(1);
					if (!div1_intro) div1_intro = create_in_transition(div1, scale, {});
					div1_intro.start();
				});

				current = true;
			},

			o: function outro(local) {
				if (div1_intro) div1_intro.invalidate();

				if (local) {
					div1_outro = create_out_transition(div1, fade, {});
				}

				current = false;
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(div1);
					if (div1_outro) div1_outro.end();
				}

				run_all(dispose);
			}
		};
	}

	function instance($$self, $$props, $$invalidate) {
		
	  
	    const dispatch = createEventDispatcher();

	    let { food_nr } = $$props;

	    let food = {};
	    let { onChange } = $$props;
	    
	    onMount(() => update());

	    function update(){
	        axios.get("/foods/" + food_nr)
	        .then((response) => {
	            //console.log(response.data);
	            $$invalidate('food', food = response.data);
	        })
	        .catch((error) => {
	            console.log(error);
	        });
	    }

	    const handleVote = (vote) => {
	        
	        console.log(vote);

	        dispatch('save-vote', vote);

	        if (vote == 0) {
	            console.log("dislike!!!");
	        } else if (vote == 1) {
	            console.log("like!!!");
	        } else {
	            console.log("superlike!!!");
	        }
	    };

		function click_handler() {
			return handleVote(0);
		}

		function click_handler_1() {
			return handleVote(1);
		}

		function click_handler_2() {
			return handleVote(2);
		}

		$$self.$set = $$props => {
			if ('food_nr' in $$props) $$invalidate('food_nr', food_nr = $$props.food_nr);
			if ('onChange' in $$props) $$invalidate('onChange', onChange = $$props.onChange);
		};

		$$self.$$.update = ($$dirty = { food_nr: 1, onChange: 1, food: 1 }) => {
			if ($$dirty.food_nr) { food_nr && update(); }
			if ($$dirty.onChange || $$dirty.food) { onChange(food); }
		};

		return {
			food_nr,
			food,
			onChange,
			handleVote,
			click_handler,
			click_handler_1,
			click_handler_2
		};
	}

	class FoodComponent extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance, create_fragment, safe_not_equal, ["food_nr", "onChange"]);

			const { ctx } = this.$$;
			const props = options.props || {};
			if (ctx.food_nr === undefined && !('food_nr' in props)) {
				console.warn("<FoodComponent> was created without expected prop 'food_nr'");
			}
			if (ctx.onChange === undefined && !('onChange' in props)) {
				console.warn("<FoodComponent> was created without expected prop 'onChange'");
			}
		}

		get food_nr() {
			throw new Error("<FoodComponent>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set food_nr(value) {
			throw new Error("<FoodComponent>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get onChange() {
			throw new Error("<FoodComponent>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set onChange(value) {
			throw new Error("<FoodComponent>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}
	}

	/* src\app\component\FormComponent.svelte generated by Svelte v3.1.0 */

	const file$1 = "src\\app\\component\\FormComponent.svelte";

	function create_fragment$1(ctx) {
		var h2, t1, form, div0, label0, t3, input0, t4, div1, label1, t6, input1, t7, div2, label2, t9, input2, t10, div3, button, t11, dispose;

		return {
			c: function create() {
				h2 = element("h2");
				h2.textContent = "Erstelle ein neues Konto";
				t1 = space();
				form = element("form");
				div0 = element("div");
				label0 = element("label");
				label0.textContent = "Benutzername";
				t3 = space();
				input0 = element("input");
				t4 = space();
				div1 = element("div");
				label1 = element("label");
				label1.textContent = "E-Mail-Adresse";
				t6 = space();
				input1 = element("input");
				t7 = space();
				div2 = element("div");
				label2 = element("label");
				label2.textContent = "Passwort";
				t9 = space();
				input2 = element("input");
				t10 = space();
				div3 = element("div");
				button = element("button");
				t11 = text("Registrieren");
				add_location(h2, file$1, 91, 0, 1649);
				label0.htmlFor = "usernameInput";
				label0.className = "form-label";
				add_location(label0, file$1, 95, 4, 1730);
				attr(input0, "type", "String");
				input0.className = "form-control";
				input0.id = "usernameInput";
				input0.placeholder = "Dein Benutzername";
				add_location(input0, file$1, 96, 4, 1801);
				div0.className = "mb-3";
				add_location(div0, file$1, 94, 0, 1707);
				label1.htmlFor = "exampleFormControlInput1";
				label1.className = "form-label";
				add_location(label1, file$1, 99, 4, 1979);
				attr(input1, "type", "email");
				input1.className = "form-control";
				input1.id = "exampleFormControlInput1";
				input1.placeholder = "name@example.com";
				add_location(input1, file$1, 100, 4, 2063);
				div1.className = "mb-3";
				add_location(div1, file$1, 98, 0, 1956);
				label2.htmlFor = "inputPassword";
				label2.className = "col-sm-2 col-form-label";
				add_location(label2, file$1, 103, 4, 2254);
				attr(input2, "type", "password");
				input2.className = "form-control";
				input2.id = "inputPassword";
				add_location(input2, file$1, 105, 6, 2390);
				div2.className = "mb-3";
				add_location(div2, file$1, 102, 0, 2231);
				button.disabled = ctx.disabled;
				button.type = "button";
				button.className = "btn btn-primary mb-3";
				add_location(button, file$1, 109, 4, 2569);
				div3.className = "col-auto";
				add_location(div3, file$1, 108, 2, 2542);
				form.className = "row g-3";
				add_location(form, file$1, 93, 0, 1684);

				dispose = [
					listen(input0, "input", ctx.input0_input_handler),
					listen(input0, "change", ctx.checkUsername),
					listen(input1, "input", ctx.input1_input_handler),
					listen(input1, "change", ctx.checkEmailAdress),
					listen(input2, "input", ctx.input2_input_handler),
					listen(input2, "change", ctx.checkPassword),
					listen(button, "click", ctx.saveUser)
				];
			},

			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},

			m: function mount(target, anchor) {
				insert(target, h2, anchor);
				insert(target, t1, anchor);
				insert(target, form, anchor);
				append(form, div0);
				append(div0, label0);
				append(div0, t3);
				append(div0, input0);

				input0.value = ctx.user.user_name;

				append(form, t4);
				append(form, div1);
				append(div1, label1);
				append(div1, t6);
				append(div1, input1);

				input1.value = ctx.user.user_email;

				append(form, t7);
				append(form, div2);
				append(div2, label2);
				append(div2, t9);
				append(div2, input2);

				input2.value = ctx.user.user_password;

				append(form, t10);
				append(form, div3);
				append(div3, button);
				append(button, t11);
			},

			p: function update(changed, ctx) {
				if (changed.user) input0.value = ctx.user.user_name;
				if (changed.user) input1.value = ctx.user.user_email;
				if (changed.user) input2.value = ctx.user.user_password;

				if (changed.disabled) {
					button.disabled = ctx.disabled;
				}
			},

			i: noop,
			o: noop,

			d: function destroy(detaching) {
				if (detaching) {
					detach(h2);
					detach(t1);
					detach(form);
				}

				run_all(dispose);
			}
		};
	}

	let minLength = 4;

	function hasNumbers(t)
	  {
	  var regex = /\d/g;
	  return regex.test(t);
	}

	function instance$1($$self, $$props, $$invalidate) {
		const dispatch = createEventDispatcher();

	let user = {
	    user_name: "",
	    user_email: "",
	    user_password: "",
	    food_ratings: []
	};


	function saveUser(){

	    console.log(user);

	    axios.post('/users', user)
	        .then((response) => {
	            console.log(response.data);
	            localStorage.current_user = JSON.stringify(response.data);
	            console.log(localStorage.current_user);
	            dispatch("logIn", response.data);
	        })
	        .catch((error) => {
	            console.log(error);
	        });
	    
	}


	let check_username = false;

	function checkUsername(){
	        if(user.user_name.length >= minLength){
	            $$invalidate('check_username', check_username = true);
	            check();
	        } else{
	            $$invalidate('check_username', check_username = false);
	        }
	    
	}

	let check_mail = false;

	function checkEmailAdress(){
	    let mail = user.user_email;
	    if(mail.length >= minLength && mail.search("@") != -1 && mail.search(".") != -1){
	        $$invalidate('check_mail', check_mail = true);
	        check();
	    } else{
	        $$invalidate('check_mail', check_mail = false);
	    }

	}

	let check_password = false;

	function checkPassword(){
	    let password = user.user_password;

	    let test = hasNumbers(password);
	    if(password.length >= minLength && test){
	        $$invalidate('check_password', check_password = true);
	        check();

	    } else{
	        $$invalidate('check_password', check_password = false);
	    }

	}   


	let disabled = !(check_password && check_mail && check_username);

	function check(){

	    $$invalidate('disabled', disabled = !(check_password && check_mail && check_username));
	}

		function input0_input_handler() {
			user.user_name = this.value;
			$$invalidate('user', user);
		}

		function input1_input_handler() {
			user.user_email = this.value;
			$$invalidate('user', user);
		}

		function input2_input_handler() {
			user.user_password = this.value;
			$$invalidate('user', user);
		}

		return {
			user,
			saveUser,
			checkUsername,
			checkEmailAdress,
			checkPassword,
			disabled,
			input0_input_handler,
			input1_input_handler,
			input2_input_handler
		};
	}

	class FormComponent extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$1, create_fragment$1, safe_not_equal, []);
		}
	}

	/* src\app\component\LoginComponent.svelte generated by Svelte v3.1.0 */

	const file$2 = "src\\app\\component\\LoginComponent.svelte";

	function create_fragment$2(ctx) {
		var h2, t1, form, div0, label0, t3, input0, t4, div1, label1, t6, input1, t7, div2, button, t8, dispose;

		return {
			c: function create() {
				h2 = element("h2");
				h2.textContent = "Anmelden";
				t1 = space();
				form = element("form");
				div0 = element("div");
				label0 = element("label");
				label0.textContent = "Benutzername";
				t3 = space();
				input0 = element("input");
				t4 = space();
				div1 = element("div");
				label1 = element("label");
				label1.textContent = "Passwort";
				t6 = space();
				input1 = element("input");
				t7 = space();
				div2 = element("div");
				button = element("button");
				t8 = text("Anmelden");
				add_location(h2, file$2, 87, 4, 1975);
				label0.htmlFor = "usernameInput";
				label0.className = "form-label";
				add_location(label0, file$2, 91, 8, 2056);
				attr(input0, "type", "String");
				input0.className = "form-control";
				input0.id = "usernameInput";
				input0.placeholder = "Dein Benutzername";
				add_location(input0, file$2, 92, 8, 2131);
				div0.className = "mb-3";
				add_location(div0, file$2, 90, 4, 2029);
				label1.htmlFor = "inputPassword";
				label1.className = "col-sm-2 col-form-label";
				add_location(label1, file$2, 95, 8, 2321);
				attr(input1, "type", "password");
				input1.className = "form-control";
				input1.id = "inputPassword";
				add_location(input1, file$2, 97, 10, 2465);
				div1.className = "mb-3";
				add_location(div1, file$2, 94, 4, 2294);
				button.disabled = ctx.disabled;
				button.type = "button";
				button.className = "btn btn-primary mb-3";
				add_location(button, file$2, 101, 8, 2660);
				div2.className = "col-auto";
				add_location(div2, file$2, 100, 6, 2629);
				form.className = "row g-3";
				add_location(form, file$2, 89, 4, 2002);

				dispose = [
					listen(input0, "input", ctx.input0_input_handler),
					listen(input0, "change", ctx.checkUsername),
					listen(input1, "input", ctx.input1_input_handler),
					listen(input1, "change", ctx.checkPassword),
					listen(button, "click", ctx.checkAccount)
				];
			},

			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},

			m: function mount(target, anchor) {
				insert(target, h2, anchor);
				insert(target, t1, anchor);
				insert(target, form, anchor);
				append(form, div0);
				append(div0, label0);
				append(div0, t3);
				append(div0, input0);

				input0.value = ctx.user.user_name;

				append(form, t4);
				append(form, div1);
				append(div1, label1);
				append(div1, t6);
				append(div1, input1);

				input1.value = ctx.user.user_password;

				append(form, t7);
				append(form, div2);
				append(div2, button);
				append(button, t8);
			},

			p: function update(changed, ctx) {
				if (changed.user) input0.value = ctx.user.user_name;
				if (changed.user) input1.value = ctx.user.user_password;

				if (changed.disabled) {
					button.disabled = ctx.disabled;
				}
			},

			i: noop,
			o: noop,

			d: function destroy(detaching) {
				if (detaching) {
					detach(h2);
					detach(t1);
					detach(form);
				}

				run_all(dispose);
			}
		};
	}

	let minLength$1 = 4;

	function hasNumbers$1(t)
	    {
	    var regex = /\d/g;
	    return regex.test(t);
	}

	function instance$2($$self, $$props, $$invalidate) {
		const dispatch = createEventDispatcher();

	    let user = {
	        user_name: "",
	        user_email: "",
	        user_password: "",
	        food_ratings: []
	    };
	    
	    let check_username = false;
	    
	    function checkUsername(){
	        if(user.user_name.length >= minLength$1){
	            $$invalidate('check_username', check_username = true);
	            check();
	        } else{
	            $$invalidate('check_username', check_username = false);
	        }
	    
	    }
	    
	    
	    let check_password = false;
	    
	    function checkPassword(){
	        let password = user.user_password;
	    
	        let test = hasNumbers$1(password);
	        if(password.length >= minLength$1 && test){
	            $$invalidate('check_password', check_password = true);
	            check();
	    
	        } else{
	            $$invalidate('check_password', check_password = false);
	        }
	    
	    }   
	    
	    
	    let disabled = !(check_password && check_username);
	    
	    function check(){
	    
	        $$invalidate('disabled', disabled = !(check_password && check_username));
	    }
	    
	    
	    function checkAccount(){

	        axios.get("users/name/" + user.user_name)
	            .then((response) => {
	            console.log(response.data);
	            const pw = response.data.user_password;
	            if(pw.localeCompare(user.user_password) == 0){

	                localStorage.current_user = JSON.stringify(response.data);
	                console.log(localStorage.current_user);
	                console.log(JSON.parse(localStorage.current_user).user_name);
	                console.log("localStorage gespeichert");
	                dispatch("logIn", response.data);
	                
	            } else{

	                console.log("Username or Password is invalid");
	                
	            }

	            })
	            .catch((error) => {
	                console.log(error);
	            });
	    }

		function input0_input_handler() {
			user.user_name = this.value;
			$$invalidate('user', user);
		}

		function input1_input_handler() {
			user.user_password = this.value;
			$$invalidate('user', user);
		}

		return {
			user,
			checkUsername,
			checkPassword,
			disabled,
			checkAccount,
			input0_input_handler,
			input1_input_handler
		};
	}

	class LoginComponent extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$2, create_fragment$2, safe_not_equal, []);
		}
	}

	/* src\app\component\RouterLink.svelte generated by Svelte v3.1.0 */

	const file$3 = "src\\app\\component\\RouterLink.svelte";

	function create_fragment$3(ctx) {
		var a, a_href_value, current;

		const default_slot_1 = ctx.$$slots.default;
		const default_slot = create_slot(default_slot_1, ctx, null);

		return {
			c: function create() {
				a = element("a");

				if (default_slot) default_slot.c();

				a.href = a_href_value = "#/" + ctx.url;
				a.className = "svelte-1b10eml";
				add_location(a, file$3, 10, 0, 102);
			},

			l: function claim(nodes) {
				if (default_slot) default_slot.l(a_nodes);
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},

			m: function mount(target, anchor) {
				insert(target, a, anchor);

				if (default_slot) {
					default_slot.m(a, null);
				}

				current = true;
			},

			p: function update(changed, ctx) {
				if (default_slot && default_slot.p && changed.$$scope) {
					default_slot.p(get_slot_changes(default_slot_1, ctx, changed,), get_slot_context(default_slot_1, ctx, null));
				}

				if ((!current || changed.url) && a_href_value !== (a_href_value = "#/" + ctx.url)) {
					a.href = a_href_value;
				}
			},

			i: function intro(local) {
				if (current) return;
				if (default_slot && default_slot.i) default_slot.i(local);
				current = true;
			},

			o: function outro(local) {
				if (default_slot && default_slot.o) default_slot.o(local);
				current = false;
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(a);
				}

				if (default_slot) default_slot.d(detaching);
			}
		};
	}

	function instance$3($$self, $$props, $$invalidate) {
		let { url } = $$props;

		let { $$slots = {}, $$scope } = $$props;

		$$self.$set = $$props => {
			if ('url' in $$props) $$invalidate('url', url = $$props.url);
			if ('$$scope' in $$props) $$invalidate('$$scope', $$scope = $$props.$$scope);
		};

		return { url, $$slots, $$scope };
	}

	class RouterLink extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$3, create_fragment$3, safe_not_equal, ["url"]);

			const { ctx } = this.$$;
			const props = options.props || {};
			if (ctx.url === undefined && !('url' in props)) {
				console.warn("<RouterLink> was created without expected prop 'url'");
			}
		}

		get url() {
			throw new Error("<RouterLink>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set url(value) {
			throw new Error("<RouterLink>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}
	}

	/* src\app\component\StartComponent.svelte generated by Svelte v3.1.0 */

	const file$4 = "src\\app\\component\\StartComponent.svelte";

	function create_fragment$4(ctx) {
		var div2, div0, t1, div1, h5, t3, p, t4, br0, br1, t5, b0, t7, br2, t8, b1, t10, br3, t11, b2, t13, u, t15, br4, br5, t16, t17, button, dispose;

		return {
			c: function create() {
				div2 = element("div");
				div0 = element("div");
				div0.textContent = "Fragebogen";
				t1 = space();
				div1 = element("div");
				h5 = element("h5");
				h5.textContent = "Inhalt";
				t3 = space();
				p = element("p");
				t4 = text("Dieser Fragbogen beinhaltet eine vielzahl an Lebensmittel. \n        Geben Sie bitte an, ob Sie die einzelne Lebensmittel mögen oder nicht. Unterscheiden können Sie dabei zwischen \"dislike\", \"like\" und \"superlike\".\n        ");
				br0 = element("br");
				br1 = element("br");
				t5 = space();
				b0 = element("b");
				b0.textContent = "dislike";
				t7 = text(" = dieses Lebensmittel mag ich nicht.");
				br2 = element("br");
				t8 = space();
				b1 = element("b");
				b1.textContent = "like";
				t10 = text(" = dieses Lebensmittel mag ich.");
				br3 = element("br");
				t11 = space();
				b2 = element("b");
				b2.textContent = "superlike";
				t13 = text(" = dieses Lebensmittel mag ich ");
				u = element("u");
				u.textContent = "sehr";
				t15 = text(".\n        ");
				br4 = element("br");
				br5 = element("br");
				t16 = text("\n        Mit diesen Angaben wird eine erste Evaluation durchgeführt.");
				t17 = space();
				button = element("button");
				button.textContent = "Zur Umfrage";
				div0.className = "card-header";
				add_location(div0, file$4, 26, 4, 450);
				h5.className = "card-title";
				add_location(h5, file$4, 30, 6, 540);
				add_location(br0, file$4, 35, 8, 842);
				add_location(br1, file$4, 35, 12, 846);
				add_location(b0, file$4, 36, 8, 859);
				add_location(br2, file$4, 36, 59, 910);
				add_location(b1, file$4, 37, 8, 923);
				add_location(br3, file$4, 37, 50, 965);
				add_location(b2, file$4, 38, 8, 978);
				add_location(u, file$4, 38, 55, 1025);
				add_location(br4, file$4, 39, 8, 1046);
				add_location(br5, file$4, 39, 12, 1050);
				p.className = "card-text";
				add_location(p, file$4, 31, 6, 581);
				button.className = "btn btn-primary";
				add_location(button, file$4, 44, 6, 1156);
				div1.className = "card-body";
				add_location(div1, file$4, 29, 4, 510);
				div2.className = "card";
				add_location(div2, file$4, 25, 0, 427);
				dispose = listen(button, "click", ctx.createNewFragebogen);
			},

			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},

			m: function mount(target, anchor) {
				insert(target, div2, anchor);
				append(div2, div0);
				append(div2, t1);
				append(div2, div1);
				append(div1, h5);
				append(div1, t3);
				append(div1, p);
				append(p, t4);
				append(p, br0);
				append(p, br1);
				append(p, t5);
				append(p, b0);
				append(p, t7);
				append(p, br2);
				append(p, t8);
				append(p, b1);
				append(p, t10);
				append(p, br3);
				append(p, t11);
				append(p, b2);
				append(p, t13);
				append(p, u);
				append(p, t15);
				append(p, br4);
				append(p, br5);
				append(p, t16);
				append(div1, t17);
				append(div1, button);
			},

			p: noop,
			i: noop,
			o: noop,

			d: function destroy(detaching) {
				if (detaching) {
					detach(div2);
				}

				dispose();
			}
		};
	}

	function switchUrl(){

	const url= "http://localhost:8082/#/questions";
	window.location = url;

	}

	function instance$4($$self, $$props, $$invalidate) {
		let { user } = $$props;

	async function createNewFragebogen(){
	  axios.get("/users/" + user.user_id + "/fragebogen")
	          .then((response) => {
	            console.log(response.data);

	            switchUrl();
	          })
	          .catch((error) => {
	              console.log(error);
	          });
	}

		$$self.$set = $$props => {
			if ('user' in $$props) $$invalidate('user', user = $$props.user);
		};

		return { user, createNewFragebogen };
	}

	class StartComponent extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$4, create_fragment$4, safe_not_equal, ["user"]);

			const { ctx } = this.$$;
			const props = options.props || {};
			if (ctx.user === undefined && !('user' in props)) {
				console.warn("<StartComponent> was created without expected prop 'user'");
			}
		}

		get user() {
			throw new Error("<StartComponent>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set user(value) {
			throw new Error("<StartComponent>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}
	}

	function is_date(obj) {
		return Object.prototype.toString.call(obj) === '[object Date]';
	}

	function get_interpolator(a, b) {
		if (a === b || a !== a) return () => a;

		const type = typeof a;

		if (type !== typeof b || Array.isArray(a) !== Array.isArray(b)) {
			throw new Error('Cannot interpolate values of different type');
		}

		if (Array.isArray(a)) {
			const arr = b.map((bi, i) => {
				return get_interpolator(a[i], bi);
			});

			return t => arr.map(fn => fn(t));
		}

		if (type === 'object') {
			if (!a || !b) throw new Error('Object cannot be null');

			if (is_date(a) && is_date(b)) {
				a = a.getTime();
				b = b.getTime();
				const delta = b - a;
				return t => new Date(a + t * delta);
			}

			const keys = Object.keys(b);
			const interpolators = {};

			keys.forEach(key => {
				interpolators[key] = get_interpolator(a[key], b[key]);
			});

			return t => {
				const result = {};
				keys.forEach(key => {
					result[key] = interpolators[key](t);
				});
				return result;
			};
		}

		if (type === 'number') {
			const delta = b - a;
			return t => a + t * delta;
		}

		throw new Error(`Cannot interpolate ${type} values`);
	}

	function tweened(value, defaults = {}) {
		const store = writable(value);

		let task;
		let target_value = value;

		function set(new_value, opts) {
			target_value = new_value;

			let previous_task = task;
			let started = false;

			let {
				delay = 0,
				duration = 400,
				easing = identity,
				interpolate = get_interpolator
			} = assign(assign({}, defaults), opts);

			const start = window.performance.now() + delay;
			let fn;

			task = loop(now => {
				if (now < start) return true;

				if (!started) {
					fn = interpolate(value, new_value);
					if (typeof duration === 'function') duration = duration(value, new_value);
					started = true;
				}

				if (previous_task) {
					previous_task.abort();
					previous_task = null;
				}

				const elapsed = now - start;

				if (elapsed > duration) {
					store.set(value = new_value);
					return false;
				}

				store.set(value = fn(easing(elapsed / duration)));
				return true;
			});

			return task.promise;
		}

		return {
			set,
			update: (fn, opts) => set(fn(target_value, value), opts),
			subscribe: store.subscribe
		};
	}

	/* src\app\component\test.svelte generated by Svelte v3.1.0 */

	const file$5 = "src\\app\\component\\test.svelte";

	function create_fragment$5(ctx) {
		var h1, t1, progress_1, t2, div, button0, t4, button1, t6, button2, t8, button3, t10, button4, dispose;

		return {
			c: function create() {
				h1 = element("h1");
				h1.textContent = "Click a button and watch the SvelteKit transition magic happen 🌟";
				t1 = space();
				progress_1 = element("progress");
				t2 = space();
				div = element("div");
				button0 = element("button");
				button0.textContent = "0%";
				t4 = space();
				button1 = element("button");
				button1.textContent = "25%";
				t6 = space();
				button2 = element("button");
				button2.textContent = "50%";
				t8 = space();
				button3 = element("button");
				button3.textContent = "75%";
				t10 = space();
				button4 = element("button");
				button4.textContent = "100%";
				add_location(h1, file$5, 12, 1, 199);
				progress_1.value = ctx.$progress;
				add_location(progress_1, file$5, 14, 0, 277);
				add_location(button0, file$5, 16, 1, 333);
				add_location(button1, file$5, 17, 1, 390);
				add_location(button2, file$5, 18, 1, 451);
				add_location(button3, file$5, 19, 1, 511);
				add_location(button4, file$5, 20, 1, 576);
				div.className = "buttons";
				add_location(div, file$5, 15, 0, 309);

				dispose = [
					listen(button0, "click", ctx.click_handler),
					listen(button1, "click", ctx.click_handler_1),
					listen(button2, "click", ctx.click_handler_2),
					listen(button3, "click", ctx.click_handler_3),
					listen(button4, "click", ctx.click_handler_4)
				];
			},

			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},

			m: function mount(target, anchor) {
				insert(target, h1, anchor);
				insert(target, t1, anchor);
				insert(target, progress_1, anchor);
				insert(target, t2, anchor);
				insert(target, div, anchor);
				append(div, button0);
				append(div, t4);
				append(div, button1);
				append(div, t6);
				append(div, button2);
				append(div, t8);
				append(div, button3);
				append(div, t10);
				append(div, button4);
			},

			p: function update(changed, ctx) {
				if (changed.$progress) {
					progress_1.value = ctx.$progress;
				}
			},

			i: noop,
			o: noop,

			d: function destroy(detaching) {
				if (detaching) {
					detach(h1);
					detach(t1);
					detach(progress_1);
					detach(t2);
					detach(div);
				}

				run_all(dispose);
			}
		};
	}

	function instance$5($$self, $$props, $$invalidate) {
		let $progress;

		

	const progress = tweened(0, {
	  duration: 4000,
	  easing: cubicOut,
	}); validate_store(progress, 'progress'); subscribe($$self, progress, $$value => { $progress = $$value; $$invalidate('$progress', $progress); });

		function click_handler() {
			return progress.set(0);
		}

		function click_handler_1() {
			return progress.set(0.25);
		}

		function click_handler_2() {
			return progress.set(0.5);
		}

		function click_handler_3() {
			return progress.set(0.75);
		}

		function click_handler_4() {
			return progress.set(1);
		}

		return {
			progress,
			$progress,
			click_handler,
			click_handler_1,
			click_handler_2,
			click_handler_3,
			click_handler_4
		};
	}

	class Test extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$5, create_fragment$5, safe_not_equal, []);
		}
	}

	/* src\app\component\UserInfos.svelte generated by Svelte v3.1.0 */

	const file$6 = "src\\app\\component\\UserInfos.svelte";

	function create_fragment$6(ctx) {
		var div7, div0, t1, div6, p0, t2, u, t4, t5, div1, input0, t6, label0, t8, div2, input1, t9, label1, t11, div3, input2, t12, label2, t14, div4, input3, t15, label3, t17, div5, input4, t18, label4, t20, p1, t21, b, t23, t24, button, dispose;

		return {
			c: function create() {
				div7 = element("div");
				div0 = element("div");
				div0.textContent = "Ihre Angaben";
				t1 = space();
				div6 = element("div");
				p0 = element("p");
				t2 = text("Geben Sie bitte an, ob Sie über einzelne \r\n      ");
				u = element("u");
				u.textContent = "Allergien/Unverträglichkeiten/Präferenzen";
				t4 = text(" verfügen. Die Angaben werden benutzt, damit der Fragebogen auf Sie zugeschnitten werden kann.");
				t5 = space();
				div1 = element("div");
				input0 = element("input");
				t6 = space();
				label0 = element("label");
				label0.textContent = "Allergie 1";
				t8 = space();
				div2 = element("div");
				input1 = element("input");
				t9 = space();
				label1 = element("label");
				label1.textContent = "Allergie 2";
				t11 = space();
				div3 = element("div");
				input2 = element("input");
				t12 = space();
				label2 = element("label");
				label2.textContent = "Allergie 3";
				t14 = space();
				div4 = element("div");
				input3 = element("input");
				t15 = space();
				label3 = element("label");
				label3.textContent = "Allergie 4";
				t17 = space();
				div5 = element("div");
				input4 = element("input");
				t18 = space();
				label4 = element("label");
				label4.textContent = "Allergie 5";
				t20 = space();
				p1 = element("p");
				t21 = text("Wenn Sie alle Fragen beantwortet haben, können Sie auf ");
				b = element("b");
				b.textContent = "Sichern";
				t23 = text(" drücken. Ihre Angaben sind vorerst nicht anpassbar.");
				t24 = space();
				button = element("button");
				button.textContent = "Sichern";
				div0.className = "card-header";
				add_location(div0, file$6, 18, 2, 190);
				add_location(u, file$6, 23, 6, 328);
				add_location(p0, file$6, 22, 4, 276);
				input0.className = "form-check-input";
				attr(input0, "type", "checkbox");
				attr(input0, "role", "switch");
				input0.id = "allergie1";
				add_location(input0, file$6, 25, 8, 527);
				label0.className = "form-check-label";
				label0.htmlFor = "allergie1";
				add_location(label0, file$6, 26, 8, 637);
				div1.className = "form-check form-switch";
				add_location(div1, file$6, 24, 4, 481);
				input1.className = "form-check-input";
				attr(input1, "type", "checkbox");
				attr(input1, "role", "switch");
				input1.id = "allergie2";
				add_location(input1, file$6, 30, 8, 774);
				label1.className = "form-check-label";
				label1.htmlFor = "allergie2";
				add_location(label1, file$6, 31, 8, 884);
				div2.className = "form-check form-switch";
				add_location(div2, file$6, 29, 6, 728);
				input2.className = "form-check-input";
				attr(input2, "type", "checkbox");
				attr(input2, "role", "switch");
				input2.id = "allergie3";
				add_location(input2, file$6, 35, 8, 1020);
				label2.className = "form-check-label";
				label2.htmlFor = "allergie3";
				add_location(label2, file$6, 36, 8, 1130);
				div3.className = "form-check form-switch";
				add_location(div3, file$6, 34, 6, 974);
				input3.className = "form-check-input";
				attr(input3, "type", "checkbox");
				attr(input3, "role", "switch");
				input3.id = "allergie4";
				add_location(input3, file$6, 40, 8, 1272);
				label3.className = "form-check-label";
				label3.htmlFor = "allergie4";
				add_location(label3, file$6, 41, 8, 1382);
				div4.className = "form-check form-switch";
				add_location(div4, file$6, 39, 6, 1226);
				input4.className = "form-check-input";
				attr(input4, "type", "checkbox");
				attr(input4, "role", "switch");
				input4.id = "allergie5";
				add_location(input4, file$6, 45, 8, 1518);
				label4.className = "form-check-label";
				label4.htmlFor = "allergie5";
				add_location(label4, file$6, 46, 8, 1628);
				div5.className = "form-check form-switch";
				add_location(div5, file$6, 44, 6, 1472);
				add_location(b, file$6, 48, 82, 1792);
				p1.className = "card-text";
				add_location(p1, file$6, 48, 6, 1716);
				button.className = "btn btn-primary";
				add_location(button, file$6, 49, 6, 1870);
				div6.className = "card-body";
				add_location(div6, file$6, 21, 2, 247);
				div7.className = "card mb-3";
				add_location(div7, file$6, 17, 0, 163);

				dispose = [
					listen(input0, "change", ctx.input0_change_handler),
					listen(input1, "change", ctx.input1_change_handler),
					listen(input2, "change", ctx.input2_change_handler),
					listen(input3, "change", ctx.input3_change_handler),
					listen(input4, "change", ctx.input4_change_handler),
					listen(button, "click", saveAngaben)
				];
			},

			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},

			m: function mount(target, anchor) {
				insert(target, div7, anchor);
				append(div7, div0);
				append(div7, t1);
				append(div7, div6);
				append(div6, p0);
				append(p0, t2);
				append(p0, u);
				append(p0, t4);
				append(div6, t5);
				append(div6, div1);
				append(div1, input0);

				input0.value = ctx.allergie1;

				append(div1, t6);
				append(div1, label0);
				append(div6, t8);
				append(div6, div2);
				append(div2, input1);

				input1.value = ctx.allergie2;

				append(div2, t9);
				append(div2, label1);
				append(div6, t11);
				append(div6, div3);
				append(div3, input2);

				input2.value = ctx.allergie3;

				append(div3, t12);
				append(div3, label2);
				append(div6, t14);
				append(div6, div4);
				append(div4, input3);

				input3.value = ctx.allergie4;

				append(div4, t15);
				append(div4, label3);
				append(div6, t17);
				append(div6, div5);
				append(div5, input4);

				input4.value = ctx.allergie5;

				append(div5, t18);
				append(div5, label4);
				append(div6, t20);
				append(div6, p1);
				append(p1, t21);
				append(p1, b);
				append(p1, t23);
				append(div6, t24);
				append(div6, button);
			},

			p: function update(changed, ctx) {
				if (changed.allergie1) input0.value = ctx.allergie1;
				if (changed.allergie2) input1.value = ctx.allergie2;
				if (changed.allergie3) input2.value = ctx.allergie3;
				if (changed.allergie4) input3.value = ctx.allergie4;
				if (changed.allergie5) input4.value = ctx.allergie5;
			},

			i: noop,
			o: noop,

			d: function destroy(detaching) {
				if (detaching) {
					detach(div7);
				}

				run_all(dispose);
			}
		};
	}

	function saveAngaben(){

	axios.post("");
	}

	function instance$6($$self, $$props, $$invalidate) {
		let allergie1;
	let allergie2;
	let allergie3;
	let allergie4;
	let allergie5;

		function input0_change_handler() {
			allergie1 = this.value;
			$$invalidate('allergie1', allergie1);
		}

		function input1_change_handler() {
			allergie2 = this.value;
			$$invalidate('allergie2', allergie2);
		}

		function input2_change_handler() {
			allergie3 = this.value;
			$$invalidate('allergie3', allergie3);
		}

		function input3_change_handler() {
			allergie4 = this.value;
			$$invalidate('allergie4', allergie4);
		}

		function input4_change_handler() {
			allergie5 = this.value;
			$$invalidate('allergie5', allergie5);
		}

		return {
			allergie1,
			allergie2,
			allergie3,
			allergie4,
			allergie5,
			input0_change_handler,
			input1_change_handler,
			input2_change_handler,
			input3_change_handler,
			input4_change_handler
		};
	}

	class UserInfos extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$6, create_fragment$6, safe_not_equal, []);
		}
	}

	let control;
	try{

	    control = (JSON.parse(localStorage.current_user).user_id == 1);
	} 
	catch{
	    
	    control = (false);
	}


	const admin = writable(control);
	    


	function resetPage() {
	    window.location.reload();
	}

	function ausloggen(){
	    console.log("logged out");
	    localStorage.clear();
	    const url= "http://localhost:8082/#/";
	    window.location = url;
	    resetPage();
	    admin.set(false);
	    return false
	  }

	/* src\app\pages\Homepage.svelte generated by Svelte v3.1.0 */

	const file$7 = "src\\app\\pages\\Homepage.svelte";

	// (87:0) {:else}
	function create_else_block_1(ctx) {
		var button, t1, t2, current, dispose;

		var userinfos = new UserInfos({ $$inline: true });

		var startcomponent = new StartComponent({
			props: { user: ctx.user },
			$$inline: true
		});

		return {
			c: function create() {
				button = element("button");
				button.textContent = "Ausloggen";
				t1 = space();
				userinfos.$$.fragment.c();
				t2 = space();
				startcomponent.$$.fragment.c();
				button.className = "btn btn-secondary position-absolute top-0 end-0 svelte-1fla2g2";
				button.type = "button";
				add_location(button, file$7, 88, 2, 1829);
				dispose = listen(button, "click", ausloggen);
			},

			m: function mount(target, anchor) {
				insert(target, button, anchor);
				insert(target, t1, anchor);
				mount_component(userinfos, target, anchor);
				insert(target, t2, anchor);
				mount_component(startcomponent, target, anchor);
				current = true;
			},

			p: function update(changed, ctx) {
				var startcomponent_changes = {};
				if (changed.user) startcomponent_changes.user = ctx.user;
				startcomponent.$set(startcomponent_changes);
			},

			i: function intro(local) {
				if (current) return;
				userinfos.$$.fragment.i(local);

				startcomponent.$$.fragment.i(local);

				current = true;
			},

			o: function outro(local) {
				userinfos.$$.fragment.o(local);
				startcomponent.$$.fragment.o(local);
				current = false;
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(button);
					detach(t1);
				}

				userinfos.$destroy(detaching);

				if (detaching) {
					detach(t2);
				}

				startcomponent.$destroy(detaching);

				dispose();
			}
		};
	}

	// (75:0) {#if !loggedIn}
	function create_if_block(ctx) {
		var current_block_type_index, if_block, t0, button, t1, current, dispose;

		var if_block_creators = [
			create_if_block_1,
			create_else_block
		];

		var if_blocks = [];

		function select_block_type_1(ctx) {
			if (ctx.neu) return 0;
			return 1;
		}

		current_block_type_index = select_block_type_1(ctx);
		if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

		return {
			c: function create() {
				if_block.c();
				t0 = space();
				button = element("button");
				t1 = text(ctx.text);
				set_style(button, "margin-top", "1.0em ");
				button.type = "button";
				button.className = "btn btn-secondary mb-3 svelte-1fla2g2";
				add_location(button, file$7, 84, 2, 1696);
				dispose = listen(button, "click", ctx.btnHandler);
			},

			m: function mount(target, anchor) {
				if_blocks[current_block_type_index].m(target, anchor);
				insert(target, t0, anchor);
				insert(target, button, anchor);
				append(button, t1);
				current = true;
			},

			p: function update(changed, ctx) {
				var previous_block_index = current_block_type_index;
				current_block_type_index = select_block_type_1(ctx);
				if (current_block_type_index === previous_block_index) {
					if_blocks[current_block_type_index].p(changed, ctx);
				} else {
					group_outros();
					on_outro(() => {
						if_blocks[previous_block_index].d(1);
						if_blocks[previous_block_index] = null;
					});
					if_block.o(1);
					check_outros();

					if_block = if_blocks[current_block_type_index];
					if (!if_block) {
						if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
						if_block.c();
					}
					if_block.i(1);
					if_block.m(t0.parentNode, t0);
				}

				if (!current || changed.text) {
					set_data(t1, ctx.text);
				}
			},

			i: function intro(local) {
				if (current) return;
				if (if_block) if_block.i();
				current = true;
			},

			o: function outro(local) {
				if (if_block) if_block.o();
				current = false;
			},

			d: function destroy(detaching) {
				if_blocks[current_block_type_index].d(detaching);

				if (detaching) {
					detach(t0);
					detach(button);
				}

				dispose();
			}
		};
	}

	// (79:2) {:else}
	function create_else_block(ctx) {
		var current;

		var logincomponent = new LoginComponent({ $$inline: true });
		logincomponent.$on("logIn", ctx.einloggen);

		return {
			c: function create() {
				logincomponent.$$.fragment.c();
			},

			m: function mount(target, anchor) {
				mount_component(logincomponent, target, anchor);
				current = true;
			},

			p: noop,

			i: function intro(local) {
				if (current) return;
				logincomponent.$$.fragment.i(local);

				current = true;
			},

			o: function outro(local) {
				logincomponent.$$.fragment.o(local);
				current = false;
			},

			d: function destroy(detaching) {
				logincomponent.$destroy(detaching);
			}
		};
	}

	// (76:2) {#if neu}
	function create_if_block_1(ctx) {
		var current;

		var formcomponent = new FormComponent({ $$inline: true });
		formcomponent.$on("logIn", ctx.einloggen);

		return {
			c: function create() {
				formcomponent.$$.fragment.c();
			},

			m: function mount(target, anchor) {
				mount_component(formcomponent, target, anchor);
				current = true;
			},

			p: noop,

			i: function intro(local) {
				if (current) return;
				formcomponent.$$.fragment.i(local);

				current = true;
			},

			o: function outro(local) {
				formcomponent.$$.fragment.o(local);
				current = false;
			},

			d: function destroy(detaching) {
				formcomponent.$destroy(detaching);
			}
		};
	}

	function create_fragment$7(ctx) {
		var t0, h1, t2, current_block_type_index, if_block, if_block_anchor, current;

		var test = new Test({ $$inline: true });

		var if_block_creators = [
			create_if_block,
			create_else_block_1
		];

		var if_blocks = [];

		function select_block_type(ctx) {
			if (!ctx.loggedIn) return 0;
			return 1;
		}

		current_block_type_index = select_block_type(ctx);
		if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

		return {
			c: function create() {
				test.$$.fragment.c();
				t0 = space();
				h1 = element("h1");
				h1.textContent = "FoodLike";
				t2 = space();
				if_block.c();
				if_block_anchor = empty();
				add_location(h1, file$7, 72, 0, 1543);
			},

			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},

			m: function mount(target, anchor) {
				mount_component(test, target, anchor);
				insert(target, t0, anchor);
				insert(target, h1, anchor);
				insert(target, t2, anchor);
				if_blocks[current_block_type_index].m(target, anchor);
				insert(target, if_block_anchor, anchor);
				current = true;
			},

			p: function update(changed, ctx) {
				var previous_block_index = current_block_type_index;
				current_block_type_index = select_block_type(ctx);
				if (current_block_type_index === previous_block_index) {
					if_blocks[current_block_type_index].p(changed, ctx);
				} else {
					group_outros();
					on_outro(() => {
						if_blocks[previous_block_index].d(1);
						if_blocks[previous_block_index] = null;
					});
					if_block.o(1);
					check_outros();

					if_block = if_blocks[current_block_type_index];
					if (!if_block) {
						if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
						if_block.c();
					}
					if_block.i(1);
					if_block.m(if_block_anchor.parentNode, if_block_anchor);
				}
			},

			i: function intro(local) {
				if (current) return;
				test.$$.fragment.i(local);

				if (if_block) if_block.i();
				current = true;
			},

			o: function outro(local) {
				test.$$.fragment.o(local);
				if (if_block) if_block.o();
				current = false;
			},

			d: function destroy(detaching) {
				test.$destroy(detaching);

				if (detaching) {
					detach(t0);
					detach(h1);
					detach(t2);
				}

				if_blocks[current_block_type_index].d(detaching);

				if (detaching) {
					detach(if_block_anchor);
				}
			}
		};
	}

	function setAdmin() {

		admin.set(true);

	}

	function instance$7($$self, $$props, $$invalidate) {
		
	  let neu = true;
	  let text = "Bereits ein Konto?";
	 

	  function btnHandler(){
	  $$invalidate('neu', neu = !neu);

	  if (neu){
	    $$invalidate('text', text = "Bereits ein Konto?");
	  }else{
	    $$invalidate('text', text = "Noch kein Konto?");
	  }
	  }

	//let loggedIn = false;
	let loggedIn = localStorage.current_user != null;

	function adminReset(){
	  if (!loggedIn){
	    admin.set(false);
	    console.log(loggedIn);
	  } else{
	    $$invalidate('user', user = JSON.parse(localStorage.current_user));
	  }
	}

	let user = {};

	function einloggen(){
	  $$invalidate('loggedIn', loggedIn = true);
	  if (JSON.parse(localStorage.current_user).user_id == 1){
	    setAdmin();
	  }
	  $$invalidate('user', user = JSON.parse(localStorage.current_user));
	}

		$$self.$$.update = ($$dirty = { loggedIn: 1 }) => {
			if ($$dirty.loggedIn) { loggedIn && adminReset(); }
		};

		$$invalidate('loggedIn', loggedIn = localStorage.current_user != null);

		return {
			neu,
			text,
			btnHandler,
			loggedIn,
			user,
			einloggen
		};
	}

	class Homepage extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$7, create_fragment$7, safe_not_equal, []);
		}
	}

	/* src\app\pages\Notfound.svelte generated by Svelte v3.1.0 */

	const file$8 = "src\\app\\pages\\Notfound.svelte";

	function create_fragment$8(ctx) {
		var h1, t_1, h2;

		return {
			c: function create() {
				h1 = element("h1");
				h1.textContent = "Falsche Richtung, geh zurück.";
				t_1 = space();
				h2 = element("h2");
				h2.textContent = "Seite nicht gefunden.";
				add_location(h1, file$8, 4, 0, 21);
				add_location(h2, file$8, 5, 0, 60);
			},

			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},

			m: function mount(target, anchor) {
				insert(target, h1, anchor);
				insert(target, t_1, anchor);
				insert(target, h2, anchor);
			},

			p: noop,
			i: noop,
			o: noop,

			d: function destroy(detaching) {
				if (detaching) {
					detach(h1);
					detach(t_1);
					detach(h2);
				}
			}
		};
	}

	class Notfound extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, null, create_fragment$8, safe_not_equal, []);
		}
	}

	/* src\app\component\EndComponent.svelte generated by Svelte v3.1.0 */

	const file$9 = "src\\app\\component\\EndComponent.svelte";

	function create_fragment$9(ctx) {
		var div1, h50, t1, div0, h51, t3, p, t5, a;

		return {
			c: function create() {
				div1 = element("div");
				h50 = element("h5");
				h50.textContent = "Ihr Fragebogen";
				t1 = space();
				div0 = element("div");
				h51 = element("h5");
				h51.textContent = "Der Fragebogen wurde beendet.";
				t3 = space();
				p = element("p");
				p.textContent = "Sie haben alle Fragen beantwortet.";
				t5 = space();
				a = element("a");
				a.textContent = "Zur Evaluation";
				h50.className = "card-header";
				add_location(h50, file$9, 8, 4, 59);
				h51.className = "card-title";
				add_location(h51, file$9, 10, 6, 137);
				p.className = "card-text";
				add_location(p, file$9, 15, 6, 238);
				a.href = "#/evaluation";
				a.className = "btn btn-primary";
				add_location(a, file$9, 20, 6, 326);
				div0.className = "card-body";
				add_location(div0, file$9, 9, 4, 107);
				div1.className = "card";
				add_location(div1, file$9, 7, 0, 36);
			},

			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},

			m: function mount(target, anchor) {
				insert(target, div1, anchor);
				append(div1, h50);
				append(div1, t1);
				append(div1, div0);
				append(div0, h51);
				append(div0, t3);
				append(div0, p);
				append(div0, t5);
				append(div0, a);
			},

			p: noop,
			i: noop,
			o: noop,

			d: function destroy(detaching) {
				if (detaching) {
					detach(div1);
				}
			}
		};
	}

	class EndComponent extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, null, create_fragment$9, safe_not_equal, []);
		}
	}

	/* src\app\pages\Questionspage.svelte generated by Svelte v3.1.0 */

	const file$a = "src\\app\\pages\\Questionspage.svelte";

	// (88:2) {:else}
	function create_else_block$1(ctx) {
		var current;

		var endcomponent = new EndComponent({ $$inline: true });

		return {
			c: function create() {
				endcomponent.$$.fragment.c();
			},

			m: function mount(target, anchor) {
				mount_component(endcomponent, target, anchor);
				current = true;
			},

			p: noop,

			i: function intro(local) {
				if (current) return;
				endcomponent.$$.fragment.i(local);

				current = true;
			},

			o: function outro(local) {
				endcomponent.$$.fragment.o(local);
				current = false;
			},

			d: function destroy(detaching) {
				endcomponent.$destroy(detaching);
			}
		};
	}

	// (86:1) {#if !endOfList}
	function create_if_block$1(ctx) {
		var current;

		var foodcomponent = new FoodComponent({
			props: {
			food_nr: ctx.food_nr,
			onChange: ctx.func
		},
			$$inline: true
		});
		foodcomponent.$on("save-vote", ctx.saveRelation);

		return {
			c: function create() {
				foodcomponent.$$.fragment.c();
			},

			m: function mount(target, anchor) {
				mount_component(foodcomponent, target, anchor);
				current = true;
			},

			p: function update(changed, ctx) {
				var foodcomponent_changes = {};
				if (changed.food_nr) foodcomponent_changes.food_nr = ctx.food_nr;
				foodcomponent.$set(foodcomponent_changes);
			},

			i: function intro(local) {
				if (current) return;
				foodcomponent.$$.fragment.i(local);

				current = true;
			},

			o: function outro(local) {
				foodcomponent.$$.fragment.o(local);
				current = false;
			},

			d: function destroy(detaching) {
				foodcomponent.$destroy(detaching);
			}
		};
	}

	function create_fragment$a(ctx) {
		var button, t1, h1, t3, current_block_type_index, if_block, if_block_anchor, current, dispose;

		var if_block_creators = [
			create_if_block$1,
			create_else_block$1
		];

		var if_blocks = [];

		function select_block_type(ctx) {
			if (!ctx.endOfList) return 0;
			return 1;
		}

		current_block_type_index = select_block_type(ctx);
		if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

		return {
			c: function create() {
				button = element("button");
				button.textContent = "Ausloggen";
				t1 = space();
				h1 = element("h1");
				h1.textContent = "Fragebogen";
				t3 = space();
				if_block.c();
				if_block_anchor = empty();
				button.className = "btn btn-secondary position-absolute top-0 end-0 svelte-e0yqjo";
				button.type = "button";
				add_location(button, file$a, 78, 0, 1846);
				h1.className = "svelte-e0yqjo";
				add_location(h1, file$a, 83, 0, 1970);
				dispose = listen(button, "click", ausloggen);
			},

			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},

			m: function mount(target, anchor) {
				insert(target, button, anchor);
				insert(target, t1, anchor);
				insert(target, h1, anchor);
				insert(target, t3, anchor);
				if_blocks[current_block_type_index].m(target, anchor);
				insert(target, if_block_anchor, anchor);
				current = true;
			},

			p: function update(changed, ctx) {
				var previous_block_index = current_block_type_index;
				current_block_type_index = select_block_type(ctx);
				if (current_block_type_index === previous_block_index) {
					if_blocks[current_block_type_index].p(changed, ctx);
				} else {
					group_outros();
					on_outro(() => {
						if_blocks[previous_block_index].d(1);
						if_blocks[previous_block_index] = null;
					});
					if_block.o(1);
					check_outros();

					if_block = if_blocks[current_block_type_index];
					if (!if_block) {
						if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
						if_block.c();
					}
					if_block.i(1);
					if_block.m(if_block_anchor.parentNode, if_block_anchor);
				}
			},

			i: function intro(local) {
				if (current) return;
				if (if_block) if_block.i();
				current = true;
			},

			o: function outro(local) {
				if (if_block) if_block.o();
				current = false;
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(button);
					detach(t1);
					detach(h1);
					detach(t3);
				}

				if_blocks[current_block_type_index].d(detaching);

				if (detaching) {
					detach(if_block_anchor);
				}

				dispose();
			}
		};
	}

	let fragebogen_nr = 1;

	function instance$8($$self, $$props, $$invalidate) {
		
	  let endOfList = false;

	  let food = {};
	  let user = JSON.parse(localStorage.current_user);
	  let rating;
	  let anzahlEmpty = 0;
	  let newList = [];
	  let index = -1;
	  let food_nr = 1;
	  let indexList = [];

	  let begin = getInformation();


	  async function  getInformation(){
	    axios.get("/users/" + user.user_id + "/food_ratings")
	        .then((response) => {
	            $$invalidate('newList', newList = response.data);
	            for (let fr in newList) {

	              if (newList[fr].rating == 99){
	                $$invalidate('anzahlEmpty', anzahlEmpty = anzahlEmpty + 1);
	                $$invalidate('indexList', indexList = [...indexList, newList[fr].food.food_id]);
	              }
	            }
	            if(anzahlEmpty == 0){
	              $$invalidate('endOfList', endOfList = true);
	            }else{
	              $$invalidate('endOfList', endOfList = false);
	              console.log(anzahlEmpty);
	              nextFood();
	            }
	            return anzahlEmpty
	        })
	        .catch((error) => {
	            console.log(error);

	            return 0
	        });

	  }
	  const saveRelation = (e) => {
	    $$invalidate('rating', rating = e.detail);
	    axios.post("/food_ratings/" + user.user_id +"/"+ food.food_id +"/"+ fragebogen_nr +"/"+ rating)
	          .then((response) => {
	            console.log(response.data);
	            nextFood();
	          })
	          .catch((error) => {
	              console.log(error);
	          });
	  };

	  const nextFood = () =>{
	    $$invalidate('index', index = index + 1);

	    if (index < anzahlEmpty){
	      
	      $$invalidate('food_nr', food_nr = indexList[index]);
	    } else{
	      $$invalidate('endOfList', endOfList = true);
	    }

	  };

		function func(newFood) {
			const $$result = food = newFood;
			$$invalidate('food', food);
			return $$result;
		}

		return {
			endOfList,
			food,
			food_nr,
			saveRelation,
			func
		};
	}

	class Questionspage extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$8, create_fragment$a, safe_not_equal, []);
		}
	}

	/* src\app\component\ChartComponent.svelte generated by Svelte v3.1.0 */

	/* src\app\evaluation\EvaluationComponent.svelte generated by Svelte v3.1.0 */

	const file$b = "src\\app\\evaluation\\EvaluationComponent.svelte";

	function create_fragment$b(ctx) {
		var div2, h2, button, t0, t1, t2_value = ctx.evaluation[0], t2, button_data_bs_target_value, h2_id_value, t3, div1, div0, strong, p0, t4, t5_value = ctx.evaluation[2], t5, t6, p1, t7, t8_value = ctx.evaluation[1], t8, t9, p2, t10, t11_value = ctx.evaluation[3], t11, t12, p3, t13, t14_value = ctx.evaluation[4], t14, t15, p4, t16, t17_value = ctx.evaluation[5], t17, t18, p5, t19, t20_value = ctx.evaluation[6], t20, div1_id_value, div1_aria_labelledby_value;

		return {
			c: function create() {
				div2 = element("div");
				h2 = element("h2");
				button = element("button");
				t0 = text(ctx.index);
				t1 = text(" Kategorie: ");
				t2 = text(t2_value);
				t3 = space();
				div1 = element("div");
				div0 = element("div");
				strong = element("strong");
				p0 = element("p");
				t4 = text("Anzahl Ratings in dieser Kategorie: ");
				t5 = text(t5_value);
				t6 = space();
				p1 = element("p");
				t7 = text("Summe aller Ratings in dieser Kategorie: ");
				t8 = text(t8_value);
				t9 = space();
				p2 = element("p");
				t10 = text("Durchschnittliches Rating in dieser Kategorie: ");
				t11 = text(t11_value);
				t12 = space();
				p3 = element("p");
				t13 = text("Anzahl dislikes: ");
				t14 = text(t14_value);
				t15 = space();
				p4 = element("p");
				t16 = text("Anzahl likes: ");
				t17 = text(t17_value);
				t18 = space();
				p5 = element("p");
				t19 = text("Anzahl superlikes: ");
				t20 = text(t20_value);
				button.className = "accordion-button";
				button.type = "button";
				button.dataset.bsToggle = "collapse";
				button.dataset.bsTarget = button_data_bs_target_value = "#collapse" + ctx.index;
				attr(button, "aria-expanded", "true");
				attr(button, "aria-controls", "collapseOne");
				add_location(button, file$b, 11, 4, 150);
				h2.className = "accordion-header";
				h2.id = h2_id_value = "heading" + ctx.index;
				add_location(h2, file$b, 10, 2, 96);
				add_location(p0, file$b, 18, 6, 557);
				add_location(strong, file$b, 17, 6, 542);
				add_location(p1, file$b, 20, 6, 639);
				add_location(p2, file$b, 21, 6, 709);
				add_location(p3, file$b, 22, 6, 785);
				add_location(p4, file$b, 23, 6, 831);
				add_location(p5, file$b, 24, 6, 874);
				div0.className = "accordion-body";
				add_location(div0, file$b, 16, 4, 507);
				div1.id = div1_id_value = "collapse" + ctx.index;
				div1.className = "accordion-collapse collapse";
				attr(div1, "aria-labelledby", div1_aria_labelledby_value = "heading" + ctx.index);
				div1.dataset.bsParent = "#accordionExample";
				add_location(div1, file$b, 15, 2, 372);
				div2.className = "accordion-item";
				add_location(div2, file$b, 9, 0, 65);
			},

			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},

			m: function mount(target, anchor) {
				insert(target, div2, anchor);
				append(div2, h2);
				append(h2, button);
				append(button, t0);
				append(button, t1);
				append(button, t2);
				append(div2, t3);
				append(div2, div1);
				append(div1, div0);
				append(div0, strong);
				append(strong, p0);
				append(p0, t4);
				append(p0, t5);
				append(div0, t6);
				append(div0, p1);
				append(p1, t7);
				append(p1, t8);
				append(div0, t9);
				append(div0, p2);
				append(p2, t10);
				append(p2, t11);
				append(div0, t12);
				append(div0, p3);
				append(p3, t13);
				append(p3, t14);
				append(div0, t15);
				append(div0, p4);
				append(p4, t16);
				append(p4, t17);
				append(div0, t18);
				append(div0, p5);
				append(p5, t19);
				append(p5, t20);
			},

			p: function update(changed, ctx) {
				if (changed.index) {
					set_data(t0, ctx.index);
				}

				if ((changed.evaluation) && t2_value !== (t2_value = ctx.evaluation[0])) {
					set_data(t2, t2_value);
				}

				if ((changed.index) && button_data_bs_target_value !== (button_data_bs_target_value = "#collapse" + ctx.index)) {
					button.dataset.bsTarget = button_data_bs_target_value;
				}

				if ((changed.index) && h2_id_value !== (h2_id_value = "heading" + ctx.index)) {
					h2.id = h2_id_value;
				}

				if ((changed.evaluation) && t5_value !== (t5_value = ctx.evaluation[2])) {
					set_data(t5, t5_value);
				}

				if ((changed.evaluation) && t8_value !== (t8_value = ctx.evaluation[1])) {
					set_data(t8, t8_value);
				}

				if ((changed.evaluation) && t11_value !== (t11_value = ctx.evaluation[3])) {
					set_data(t11, t11_value);
				}

				if ((changed.evaluation) && t14_value !== (t14_value = ctx.evaluation[4])) {
					set_data(t14, t14_value);
				}

				if ((changed.evaluation) && t17_value !== (t17_value = ctx.evaluation[5])) {
					set_data(t17, t17_value);
				}

				if ((changed.evaluation) && t20_value !== (t20_value = ctx.evaluation[6])) {
					set_data(t20, t20_value);
				}

				if ((changed.index) && div1_id_value !== (div1_id_value = "collapse" + ctx.index)) {
					div1.id = div1_id_value;
				}

				if ((changed.index) && div1_aria_labelledby_value !== (div1_aria_labelledby_value = "heading" + ctx.index)) {
					attr(div1, "aria-labelledby", div1_aria_labelledby_value);
				}
			},

			i: noop,
			o: noop,

			d: function destroy(detaching) {
				if (detaching) {
					detach(div2);
				}
			}
		};
	}

	function instance$9($$self, $$props, $$invalidate) {
		let { evaluation, index } = $$props;

		$$self.$set = $$props => {
			if ('evaluation' in $$props) $$invalidate('evaluation', evaluation = $$props.evaluation);
			if ('index' in $$props) $$invalidate('index', index = $$props.index);
		};

		return { evaluation, index };
	}

	class EvaluationComponent extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$9, create_fragment$b, safe_not_equal, ["evaluation", "index"]);

			const { ctx } = this.$$;
			const props = options.props || {};
			if (ctx.evaluation === undefined && !('evaluation' in props)) {
				console.warn("<EvaluationComponent> was created without expected prop 'evaluation'");
			}
			if (ctx.index === undefined && !('index' in props)) {
				console.warn("<EvaluationComponent> was created without expected prop 'index'");
			}
		}

		get evaluation() {
			throw new Error("<EvaluationComponent>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set evaluation(value) {
			throw new Error("<EvaluationComponent>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get index() {
			throw new Error("<EvaluationComponent>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set index(value) {
			throw new Error("<EvaluationComponent>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}
	}

	/* src\app\pages\Evaluationpage.svelte generated by Svelte v3.1.0 */

	const file$c = "src\\app\\pages\\Evaluationpage.svelte";

	function get_each_context(ctx, list, i) {
		const child_ctx = Object.create(ctx);
		child_ctx.foodRating = list[i];
		return child_ctx;
	}

	function get_each_context_1(ctx, list, i) {
		const child_ctx = Object.create(ctx);
		child_ctx.evaluation = list[i];
		child_ctx.i = i;
		return child_ctx;
	}

	function get_each_context_2(ctx, list, i) {
		const child_ctx = Object.create(ctx);
		child_ctx.name = list[i];
		child_ctx.i = i;
		return child_ctx;
	}

	// (136:0) {#if adminBool}
	function create_if_block$2(ctx) {
		var div4, div3, h2, button0, t1, div2, div1, form, div0, label, t3, input, t4, select, t5, button1, t7, button2, dispose;

		var each_value_2 = ctx.listAnzeigen;

		var each_blocks = [];

		for (var i = 0; i < each_value_2.length; i += 1) {
			each_blocks[i] = create_each_block_2(get_each_context_2(ctx, each_value_2, i));
		}

		return {
			c: function create() {
				div4 = element("div");
				div3 = element("div");
				h2 = element("h2");
				button0 = element("button");
				button0.textContent = "Frgabogen suchen";
				t1 = space();
				div2 = element("div");
				div1 = element("div");
				form = element("form");
				div0 = element("div");
				label = element("label");
				label.textContent = "Benutzername";
				t3 = space();
				input = element("input");
				t4 = space();
				select = element("select");

				for (var i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].c();
				}

				t5 = space();
				button1 = element("button");
				button1.textContent = "Suchen";
				t7 = space();
				button2 = element("button");
				button2.textContent = "Zurücksetzen";
				button0.className = "accordion-button collapsed";
				button0.type = "button";
				button0.dataset.bsToggle = "collapse";
				button0.dataset.bsTarget = "#panelsStayOpen-collapseSearch";
				attr(button0, "aria-expanded", "false");
				attr(button0, "aria-controls", "panelsStayOpen-collapseTwo");
				add_location(button0, file$c, 140, 8, 3057);
				h2.className = "accordion-header";
				h2.id = "panelsStayOpen-headingSearch";
				add_location(h2, file$c, 139, 6, 2985);
				label.htmlFor = "Username";
				add_location(label, file$c, 149, 16, 3552);
				input.placeholder = "gesuchter Benutzername";
				attr(input, "type", "String");
				input.className = "form-control";
				input.id = "Username";
				add_location(input, file$c, 150, 16, 3611);
				select.className = "form-select form-select-lg mb-3";
				attr(select, "aria-label", ".form-select-lg example");
				add_location(select, file$c, 157, 16, 3857);
				div0.className = "form-group ";
				add_location(div0, file$c, 148, 14, 3510);
				button1.type = "button";
				button1.className = "btn btn-dark mt-2 svelte-1lkipq6";
				add_location(button1, file$c, 168, 16, 4195);
				button2.type = "button";
				button2.className = "btn btn-dark mt-2 svelte-1lkipq6";
				add_location(button2, file$c, 169, 16, 4297);
				add_location(form, file$c, 147, 10, 3489);
				div1.className = "accordion-body";
				add_location(div1, file$c, 145, 8, 3449);
				div2.id = "panelsStayOpen-collapseSearch";
				div2.className = "accordion-collapse collapse";
				attr(div2, "aria-labelledby", "panelsStayOpen-headingSearch");
				add_location(div2, file$c, 144, 6, 3317);
				div3.className = "accordion-item";
				add_location(div3, file$c, 138, 2, 2950);
				div4.className = "accordion mb-3";
				div4.id = "accordionPanelsStayOpenExample";
				add_location(div4, file$c, 137, 0, 2883);

				dispose = [
					listen(input, "input", ctx.input_input_handler),
					listen(input, "change", ctx.listeAnpassen),
					listen(button1, "click", ctx.changeUser),
					listen(button2, "click", ctx.reset)
				];
			},

			m: function mount(target, anchor) {
				insert(target, div4, anchor);
				append(div4, div3);
				append(div3, h2);
				append(h2, button0);
				append(div3, t1);
				append(div3, div2);
				append(div2, div1);
				append(div1, form);
				append(form, div0);
				append(div0, label);
				append(div0, t3);
				append(div0, input);

				input.value = ctx.user_name;

				append(div0, t4);
				append(div0, select);

				for (var i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].m(select, null);
				}

				append(form, t5);
				append(form, button1);
				append(form, t7);
				append(form, button2);
			},

			p: function update(changed, ctx) {
				if (changed.user_name) input.value = ctx.user_name;

				if (changed.listAnzeigen) {
					each_value_2 = ctx.listAnzeigen;

					for (var i = 0; i < each_value_2.length; i += 1) {
						const child_ctx = get_each_context_2(ctx, each_value_2, i);

						if (each_blocks[i]) {
							each_blocks[i].p(changed, child_ctx);
						} else {
							each_blocks[i] = create_each_block_2(child_ctx);
							each_blocks[i].c();
							each_blocks[i].m(select, null);
						}
					}

					for (; i < each_blocks.length; i += 1) {
						each_blocks[i].d(1);
					}
					each_blocks.length = each_value_2.length;
				}
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(div4);
				}

				destroy_each(each_blocks, detaching);

				run_all(dispose);
			}
		};
	}

	// (160:18) {#each listAnzeigen as name, i}
	function create_each_block_2(ctx) {
		var option, t_value = ctx.name, t, option_value_value;

		return {
			c: function create() {
				option = element("option");
				t = text(t_value);
				option.__value = option_value_value = ctx.name;
				option.value = option.__value;
				add_location(option, file$c, 160, 18, 4030);
			},

			m: function mount(target, anchor) {
				insert(target, option, anchor);
				append(option, t);
			},

			p: function update(changed, ctx) {
				if ((changed.listAnzeigen) && t_value !== (t_value = ctx.name)) {
					set_data(t, t_value);
				}

				if ((changed.listAnzeigen) && option_value_value !== (option_value_value = ctx.name)) {
					option.__value = option_value_value;
				}

				option.value = option.__value;
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(option);
				}
			}
		};
	}

	// (183:0) {#each listEvaluation as evaluation, i}
	function create_each_block_1(ctx) {
		var current;

		var evaluationcomponent = new EvaluationComponent({
			props: {
			index: ctx.i,
			evaluation: ctx.evaluation
		},
			$$inline: true
		});

		return {
			c: function create() {
				evaluationcomponent.$$.fragment.c();
			},

			m: function mount(target, anchor) {
				mount_component(evaluationcomponent, target, anchor);
				current = true;
			},

			p: function update(changed, ctx) {
				var evaluationcomponent_changes = {};
				if (changed.listEvaluation) evaluationcomponent_changes.evaluation = ctx.evaluation;
				evaluationcomponent.$set(evaluationcomponent_changes);
			},

			i: function intro(local) {
				if (current) return;
				evaluationcomponent.$$.fragment.i(local);

				current = true;
			},

			o: function outro(local) {
				evaluationcomponent.$$.fragment.o(local);
				current = false;
			},

			d: function destroy(detaching) {
				evaluationcomponent.$destroy(detaching);
			}
		};
	}

	// (211:14) {#each newList as foodRating}
	function create_each_block(ctx) {
		var tr, th, t0_value = ctx.foodRating.id, t0, t1, td0, t2_value = ctx.foodRating.food.food_name, t2, t3, td1, t4_value = ctx.foodRating.food.category, t4, t5, td2, t6_value = ctx.foodRating.rating, t6, t7;

		return {
			c: function create() {
				tr = element("tr");
				th = element("th");
				t0 = text(t0_value);
				t1 = space();
				td0 = element("td");
				t2 = text(t2_value);
				t3 = space();
				td1 = element("td");
				t4 = text(t4_value);
				t5 = space();
				td2 = element("td");
				t6 = text(t6_value);
				t7 = space();
				th.scope = "row";
				add_location(th, file$c, 212, 20, 5503);
				add_location(td0, file$c, 213, 20, 5560);
				add_location(td1, file$c, 214, 20, 5618);
				add_location(td2, file$c, 215, 20, 5675);
				add_location(tr, file$c, 211, 16, 5478);
			},

			m: function mount(target, anchor) {
				insert(target, tr, anchor);
				append(tr, th);
				append(th, t0);
				append(tr, t1);
				append(tr, td0);
				append(td0, t2);
				append(tr, t3);
				append(tr, td1);
				append(td1, t4);
				append(tr, t5);
				append(tr, td2);
				append(td2, t6);
				append(tr, t7);
			},

			p: function update(changed, ctx) {
				if ((changed.newList) && t0_value !== (t0_value = ctx.foodRating.id)) {
					set_data(t0, t0_value);
				}

				if ((changed.newList) && t2_value !== (t2_value = ctx.foodRating.food.food_name)) {
					set_data(t2, t2_value);
				}

				if ((changed.newList) && t4_value !== (t4_value = ctx.foodRating.food.category)) {
					set_data(t4, t4_value);
				}

				if ((changed.newList) && t6_value !== (t6_value = ctx.foodRating.rating)) {
					set_data(t6, t6_value);
				}
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(tr);
				}
			}
		};
	}

	function create_fragment$c(ctx) {
		var button0, t1, h10, t2, t3_value = ctx.thisUser.user_name, t3, t4, t5, div3, t6, div2, h2, button1, h11, t8, div1, div0, table, thead, tr, th0, t10, th1, t12, th2, t14, th3, t16, tbody, current, dispose;

		var if_block = (ctx.adminBool) && create_if_block$2(ctx);

		var each_value_1 = ctx.listEvaluation;

		var each_blocks_1 = [];

		for (var i = 0; i < each_value_1.length; i += 1) {
			each_blocks_1[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
		}

		function outro_block(i, detaching, local) {
			if (each_blocks_1[i]) {
				if (detaching) {
					on_outro(() => {
						each_blocks_1[i].d(detaching);
						each_blocks_1[i] = null;
					});
				}

				each_blocks_1[i].o(local);
			}
		}

		var each_value = ctx.newList;

		var each_blocks = [];

		for (var i = 0; i < each_value.length; i += 1) {
			each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
		}

		return {
			c: function create() {
				button0 = element("button");
				button0.textContent = "Ausloggen";
				t1 = space();
				h10 = element("h1");
				t2 = text("Evaluation ");
				t3 = text(t3_value);
				t4 = space();
				if (if_block) if_block.c();
				t5 = space();
				div3 = element("div");

				for (var i = 0; i < each_blocks_1.length; i += 1) {
					each_blocks_1[i].c();
				}

				t6 = space();
				div2 = element("div");
				h2 = element("h2");
				button1 = element("button");
				h11 = element("h1");
				h11.textContent = "Ratings";
				t8 = space();
				div1 = element("div");
				div0 = element("div");
				table = element("table");
				thead = element("thead");
				tr = element("tr");
				th0 = element("th");
				th0.textContent = "#";
				t10 = space();
				th1 = element("th");
				th1.textContent = "Name";
				t12 = space();
				th2 = element("th");
				th2.textContent = "Category";
				t14 = space();
				th3 = element("th");
				th3.textContent = "Rating";
				t16 = space();
				tbody = element("tbody");

				for (var i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].c();
				}
				button0.className = "btn btn-secondary position-absolute top-0 end-0 svelte-1lkipq6";
				button0.type = "button";
				add_location(button0, file$c, 129, 0, 2700);
				add_location(h10, file$c, 133, 0, 2824);
				add_location(h11, file$c, 195, 8, 4904);
				button1.className = "accordion-button";
				button1.type = "button";
				button1.dataset.bsToggle = "collapse";
				button1.dataset.bsTarget = "#collapseRating";
				attr(button1, "aria-expanded", "true");
				attr(button1, "aria-controls", "collapseOne");
				add_location(button1, file$c, 194, 6, 4740);
				h2.className = "accordion-header";
				h2.id = "headingRating";
				add_location(h2, file$c, 193, 4, 4685);
				th0.scope = "col";
				add_location(th0, file$c, 203, 16, 5202);
				th1.scope = "col";
				add_location(th1, file$c, 204, 16, 5241);
				th2.scope = "col";
				add_location(th2, file$c, 205, 16, 5283);
				th3.scope = "col";
				add_location(th3, file$c, 206, 16, 5329);
				add_location(tr, file$c, 202, 14, 5181);
				add_location(thead, file$c, 201, 12, 5159);
				add_location(tbody, file$c, 209, 12, 5410);
				table.className = "table";
				add_location(table, file$c, 200, 10, 5125);
				div0.className = "accordion-body";
				add_location(div0, file$c, 199, 6, 5086);
				div1.id = "collapseRating";
				div1.className = "accordion-collapse collapse";
				attr(div1, "aria-labelledby", "headingRating");
				div1.dataset.bsParent = "#accordionExample";
				add_location(div1, file$c, 198, 4, 4951);
				div2.className = "accordion-item";
				add_location(div2, file$c, 192, 2, 4652);
				div3.className = "accordion";
				div3.id = "accordionExample";
				add_location(div3, file$c, 181, 0, 4471);
				dispose = listen(button0, "click", ausloggen);
			},

			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},

			m: function mount(target, anchor) {
				insert(target, button0, anchor);
				insert(target, t1, anchor);
				insert(target, h10, anchor);
				append(h10, t2);
				append(h10, t3);
				insert(target, t4, anchor);
				if (if_block) if_block.m(target, anchor);
				insert(target, t5, anchor);
				insert(target, div3, anchor);

				for (var i = 0; i < each_blocks_1.length; i += 1) {
					each_blocks_1[i].m(div3, null);
				}

				append(div3, t6);
				append(div3, div2);
				append(div2, h2);
				append(h2, button1);
				append(button1, h11);
				append(div2, t8);
				append(div2, div1);
				append(div1, div0);
				append(div0, table);
				append(table, thead);
				append(thead, tr);
				append(tr, th0);
				append(tr, t10);
				append(tr, th1);
				append(tr, t12);
				append(tr, th2);
				append(tr, t14);
				append(tr, th3);
				append(table, t16);
				append(table, tbody);

				for (var i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].m(tbody, null);
				}

				current = true;
			},

			p: function update(changed, ctx) {
				if ((!current || changed.thisUser) && t3_value !== (t3_value = ctx.thisUser.user_name)) {
					set_data(t3, t3_value);
				}

				if (ctx.adminBool) {
					if (if_block) {
						if_block.p(changed, ctx);
					} else {
						if_block = create_if_block$2(ctx);
						if_block.c();
						if_block.m(t5.parentNode, t5);
					}
				} else if (if_block) {
					if_block.d(1);
					if_block = null;
				}

				if (changed.listEvaluation) {
					each_value_1 = ctx.listEvaluation;

					for (var i = 0; i < each_value_1.length; i += 1) {
						const child_ctx = get_each_context_1(ctx, each_value_1, i);

						if (each_blocks_1[i]) {
							each_blocks_1[i].p(changed, child_ctx);
							each_blocks_1[i].i(1);
						} else {
							each_blocks_1[i] = create_each_block_1(child_ctx);
							each_blocks_1[i].c();
							each_blocks_1[i].i(1);
							each_blocks_1[i].m(div3, t6);
						}
					}

					group_outros();
					for (; i < each_blocks_1.length; i += 1) outro_block(i, 1, 1);
					check_outros();
				}

				if (changed.newList) {
					each_value = ctx.newList;

					for (var i = 0; i < each_value.length; i += 1) {
						const child_ctx = get_each_context(ctx, each_value, i);

						if (each_blocks[i]) {
							each_blocks[i].p(changed, child_ctx);
						} else {
							each_blocks[i] = create_each_block(child_ctx);
							each_blocks[i].c();
							each_blocks[i].m(tbody, null);
						}
					}

					for (; i < each_blocks.length; i += 1) {
						each_blocks[i].d(1);
					}
					each_blocks.length = each_value.length;
				}
			},

			i: function intro(local) {
				if (current) return;
				for (var i = 0; i < each_value_1.length; i += 1) each_blocks_1[i].i();

				current = true;
			},

			o: function outro(local) {
				each_blocks_1 = each_blocks_1.filter(Boolean);
				for (let i = 0; i < each_blocks_1.length; i += 1) outro_block(i, 0);

				current = false;
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(button0);
					detach(t1);
					detach(h10);
					detach(t4);
				}

				if (if_block) if_block.d(detaching);

				if (detaching) {
					detach(t5);
					detach(div3);
				}

				destroy_each(each_blocks_1, detaching);

				destroy_each(each_blocks, detaching);

				dispose();
			}
		};
	}

	function instance$a($$self, $$props, $$invalidate) {
		

	    let user = JSON.parse(localStorage.current_user);
	    let thisUser = user;
	    let newList = [];
	    let listEvaluation = [];

	    onMount(()=> {
	      getEvaluations(user);
	      
	    });

	    let listNames = [];
	    let listAnzeigen = [];

	    function getUserNames(){
	      axios.get("/users/name")
	        .then((response) => {
	            console.log(response.data);
	            $$invalidate('listNames', listNames = response.data);
	            $$invalidate('listAnzeigen', listAnzeigen = listNames);
	        })
	        .catch((error) => {
	            console.log(error);
	        });
	    }

	    function getEvaluations(u){
	      axios.get("/food_ratings/users/" + u.user_id + "/string")
	        .then((response) => {
	            console.log(response.data);
	            $$invalidate('listEvaluation', listEvaluation = response.data);
	            getRatings(u);
	        })
	        .catch((error) => {
	            console.log(error);
	        });

	        
	    }

	    function getRatings(u){
	      axios.get("/users/" + u.user_id + "/food_ratings")
	        .then((response) => {
	            console.log(response.data);
	            $$invalidate('newList', newList = response.data);

	            //const newEv = new Evaluation();
	            //listEvaluation = [...listEvaluation, newEv];
	            getUserNames();
	         })
	        .catch((error) => {
	            console.log(error);
	        });
	    }
	    
	    let user_name = "";

	  function changeUser(){
	      
	      axios.get("users/name/" + user_name)
	        .then((response) => {
	            console.log(response.data);
	            $$invalidate('thisUser', thisUser = response.data);
	            getData(thisUser);

	         })
	        .catch((error) => {
	            console.log(error);
	        });
	  }

	let adminBool;


	admin.subscribe(value => {
	  $$invalidate('adminBool', adminBool = value);
		});

	console.log(adminBool);
	function reset (){
	  getEvaluations(user);
	  $$invalidate('thisUser', thisUser = user);
	}


	function listeAnpassen(){
	  $$invalidate('listAnzeigen', listAnzeigen = listNames.filter(isBigEnough));
	}

	function isBigEnough(value) {
	  return value.includes(user_name);
	}

	    /*class Evaluation {

	      constructor

	      (category, anzahl_0, anzahl_1, anzahl_2, anzahl_total, summe, durchschnitt) 

	      { 

	        this.category = category;
	        this.anzahl_0 = anzahl_0;
	        this.anzahl_1 = anzahl_1;
	        this.anzahl_2 = anzahl_2;
	        this.anzahl_total = anzahl_total;
	        this.summe = summe,
	        this.durchschnitt = durchschnitt

	      }
	     
	      }*/

		function input_input_handler() {
			user_name = this.value;
			$$invalidate('user_name', user_name);
		}

		return {
			thisUser,
			newList,
			listEvaluation,
			listAnzeigen,
			user_name,
			changeUser,
			adminBool,
			reset,
			listeAnpassen,
			input_input_handler
		};
	}

	class Evaluationpage extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$a, create_fragment$c, safe_not_equal, []);
		}
	}

	/* src\app\routing\Router.svelte generated by Svelte v3.1.0 */

	const file$d = "src\\app\\routing\\Router.svelte";

	function create_fragment$d(ctx) {
		var main, current;

		var switch_value = ctx.value;

		function switch_props(ctx) {
			return { $$inline: true };
		}

		if (switch_value) {
			var switch_instance = new switch_value(switch_props(ctx));
		}

		return {
			c: function create() {
				main = element("main");
				if (switch_instance) switch_instance.$$.fragment.c();
				main.className = "svelte-agre66";
				add_location(main, file$d, 40, 0, 747);
			},

			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},

			m: function mount(target, anchor) {
				insert(target, main, anchor);

				if (switch_instance) {
					mount_component(switch_instance, main, null);
				}

				current = true;
			},

			p: function update(changed, ctx) {
				if (switch_value !== (switch_value = ctx.value)) {
					if (switch_instance) {
						group_outros();
						const old_component = switch_instance;
						on_outro(() => {
							old_component.$destroy();
						});
						old_component.$$.fragment.o(1);
						check_outros();
					}

					if (switch_value) {
						switch_instance = new switch_value(switch_props(ctx));

						switch_instance.$$.fragment.c();
						switch_instance.$$.fragment.i(1);
						mount_component(switch_instance, main, null);
					} else {
						switch_instance = null;
					}
				}
			},

			i: function intro(local) {
				if (current) return;
				if (switch_instance) switch_instance.$$.fragment.i(local);

				current = true;
			},

			o: function outro(local) {
				if (switch_instance) switch_instance.$$.fragment.o(local);
				current = false;
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(main);
				}

				if (switch_instance) switch_instance.$destroy();
			}
		};
	}

	function instance$b($$self, $$props, $$invalidate) {
		
	 
	  let value = Notfound;

	  hash$1.subscribe( valu => {
	    switch(valu) {
	      case '':
	        $$invalidate('value', value = Homepage);
	        break;
	        case 'questions':
	        $$invalidate('value', value = Questionspage);
	        break;
	        case 'evaluation':
	        $$invalidate('value', value = Evaluationpage);
	        break;
	      default:
	        $$invalidate('value', value = Notfound);
	    }
	  });

		return { value };
	}

	class Router extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$b, create_fragment$d, safe_not_equal, []);
		}
	}

	/* src\app\component\Sidenav.svelte generated by Svelte v3.1.0 */

	const file$e = "src\\app\\component\\Sidenav.svelte";

	// (27:6) <RouterLink url=''>
	function create_default_slot_2(ctx) {
		var t;

		return {
			c: function create() {
				t = text("Homepage");
			},

			m: function mount(target, anchor) {
				insert(target, t, anchor);
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(t);
				}
			}
		};
	}

	// (31:6) <RouterLink url='questions'>
	function create_default_slot_1(ctx) {
		var t;

		return {
			c: function create() {
				t = text("Umfrage");
			},

			m: function mount(target, anchor) {
				insert(target, t, anchor);
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(t);
				}
			}
		};
	}

	// (35:6) <RouterLink url='evaluation'>
	function create_default_slot(ctx) {
		var t;

		return {
			c: function create() {
				t = text("Evaluation");
			},

			m: function mount(target, anchor) {
				insert(target, t, anchor);
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(t);
				}
			}
		};
	}

	function create_fragment$e(ctx) {
		var nav, h1, t1, ul, li0, t2, li1, t3, li2, current;

		var routerlink0 = new RouterLink({
			props: {
			url: "",
			$$slots: { default: [create_default_slot_2] },
			$$scope: { ctx }
		},
			$$inline: true
		});

		var routerlink1 = new RouterLink({
			props: {
			url: "questions",
			$$slots: { default: [create_default_slot_1] },
			$$scope: { ctx }
		},
			$$inline: true
		});

		var routerlink2 = new RouterLink({
			props: {
			url: "evaluation",
			$$slots: { default: [create_default_slot] },
			$$scope: { ctx }
		},
			$$inline: true
		});

		return {
			c: function create() {
				nav = element("nav");
				h1 = element("h1");
				h1.textContent = "Navigation";
				t1 = space();
				ul = element("ul");
				li0 = element("li");
				routerlink0.$$.fragment.c();
				t2 = space();
				li1 = element("li");
				routerlink1.$$.fragment.c();
				t3 = space();
				li2 = element("li");
				routerlink2.$$.fragment.c();
				add_location(h1, file$e, 22, 2, 278);
				li0.className = "svelte-9jqyde";
				add_location(li0, file$e, 25, 4, 310);
				li1.className = "svelte-9jqyde";
				add_location(li1, file$e, 29, 4, 377);
				li2.className = "svelte-9jqyde";
				add_location(li2, file$e, 33, 4, 452);
				ul.className = "svelte-9jqyde";
				add_location(ul, file$e, 23, 2, 300);
				nav.className = "svelte-9jqyde";
				add_location(nav, file$e, 21, 0, 270);
			},

			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},

			m: function mount(target, anchor) {
				insert(target, nav, anchor);
				append(nav, h1);
				append(nav, t1);
				append(nav, ul);
				append(ul, li0);
				mount_component(routerlink0, li0, null);
				append(ul, t2);
				append(ul, li1);
				mount_component(routerlink1, li1, null);
				append(ul, t3);
				append(ul, li2);
				mount_component(routerlink2, li2, null);
				current = true;
			},

			p: function update(changed, ctx) {
				var routerlink0_changes = {};
				if (changed.$$scope) routerlink0_changes.$$scope = { changed, ctx };
				routerlink0.$set(routerlink0_changes);

				var routerlink1_changes = {};
				if (changed.$$scope) routerlink1_changes.$$scope = { changed, ctx };
				routerlink1.$set(routerlink1_changes);

				var routerlink2_changes = {};
				if (changed.$$scope) routerlink2_changes.$$scope = { changed, ctx };
				routerlink2.$set(routerlink2_changes);
			},

			i: function intro(local) {
				if (current) return;
				routerlink0.$$.fragment.i(local);

				routerlink1.$$.fragment.i(local);

				routerlink2.$$.fragment.i(local);

				current = true;
			},

			o: function outro(local) {
				routerlink0.$$.fragment.o(local);
				routerlink1.$$.fragment.o(local);
				routerlink2.$$.fragment.o(local);
				current = false;
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(nav);
				}

				routerlink0.$destroy();

				routerlink1.$destroy();

				routerlink2.$destroy();
			}
		};
	}

	class Sidenav extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, null, create_fragment$e, safe_not_equal, []);
		}
	}

	/* src\App.svelte generated by Svelte v3.1.0 */

	const file$f = "src\\App.svelte";

	// (30:2) {#if adminRigths}
	function create_if_block$3(ctx) {
		var current;

		var sidenav = new Sidenav({
			props: { class: "sidenav" },
			$$inline: true
		});

		return {
			c: function create() {
				sidenav.$$.fragment.c();
			},

			m: function mount(target, anchor) {
				mount_component(sidenav, target, anchor);
				current = true;
			},

			i: function intro(local) {
				if (current) return;
				sidenav.$$.fragment.i(local);

				current = true;
			},

			o: function outro(local) {
				sidenav.$$.fragment.o(local);
				current = false;
			},

			d: function destroy(detaching) {
				sidenav.$destroy(detaching);
			}
		};
	}

	function create_fragment$f(ctx) {
		var div, t, current;

		var if_block = (ctx.adminRigths) && create_if_block$3(ctx);

		var router = new Router({ $$inline: true });

		return {
			c: function create() {
				div = element("div");
				if (if_block) if_block.c();
				t = space();
				router.$$.fragment.c();
				div.className = "app-shell svelte-h5712t";
				add_location(div, file$f, 27, 0, 392);
			},

			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},

			m: function mount(target, anchor) {
				insert(target, div, anchor);
				if (if_block) if_block.m(div, null);
				append(div, t);
				mount_component(router, div, null);
				current = true;
			},

			p: function update(changed, ctx) {
				if (ctx.adminRigths) {
					if (!if_block) {
						if_block = create_if_block$3(ctx);
						if_block.c();
						if_block.i(1);
						if_block.m(div, t);
					} else {
										if_block.i(1);
					}
				} else if (if_block) {
					group_outros();
					on_outro(() => {
						if_block.d(1);
						if_block = null;
					});

					if_block.o(1);
					check_outros();
				}
			},

			i: function intro(local) {
				if (current) return;
				if (if_block) if_block.i();

				router.$$.fragment.i(local);

				current = true;
			},

			o: function outro(local) {
				if (if_block) if_block.o();
				router.$$.fragment.o(local);
				current = false;
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(div);
				}

				if (if_block) if_block.d();

				router.$destroy();
			}
		};
	}

	function instance$c($$self, $$props, $$invalidate) {
		

	  let adminRigths;

	  admin.subscribe(value => {
			$$invalidate('adminRigths', adminRigths = value);
		});

		return { adminRigths };
	}

	class App extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$c, create_fragment$f, safe_not_equal, []);
		}
	}

	const app = new App({
		target: document.body.querySelector('#app')
	});

	return app;

}());
//# sourceMappingURL=bundle.js.map
