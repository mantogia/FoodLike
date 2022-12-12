var app = (function () {
	'use strict';

	function noop() {}

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

	function set_custom_element_data(node, prop, value) {
		if (prop in node) {
			node[prop] = value;
		} else {
			attr(node, prop, value);
		}
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

	const hash = writable('');

	hashSetter();

	window.onhashchange = () => hashSetter();

	function hashSetter() {
	  hash.set(
	    location.hash.length >= 2 
	    ? location.hash.substring(2) 
	    : ''
	  );
	}

	/* src\app\component\FoodComponent.svelte generated by Svelte v3.1.0 */

	const file = "src\\app\\component\\FoodComponent.svelte";

	function create_fragment(ctx) {
		var div1, img0, img0_src_value, t0, div0, p, b, t1_value = ctx.food.food_name, t1, t2, img1, t3, img2, t4, img3, dispose;

		return {
			c: function create() {
				div1 = element("div");
				img0 = element("img");
				t0 = space();
				div0 = element("div");
				p = element("p");
				b = element("b");
				t1 = text(t1_value);
				t2 = space();
				img1 = element("img");
				t3 = space();
				img2 = element("img");
				t4 = space();
				img3 = element("img");
				img0.src = img0_src_value = "./images/" + ctx.food_nr + ".jpg";
				attr(img0, "onerror", "this.src='images/alt.jpg'");
				img0.className = "card-img-top svelte-1bmos6x";
				img0.alt = "food";
				add_location(img0, file, 85, 4, 2418);
				add_location(b, file, 92, 9, 2822);
				add_location(p, file, 92, 6, 2819);
				img1.src = "./icons/dislike.png";
				img1.className = "dislike svelte-1bmos6x";
				img1.alt = "dislike";
				add_location(img1, file, 93, 6, 2857);
				img2.src = "./icons/like.png";
				img2.className = "like svelte-1bmos6x";
				img2.alt = "like";
				add_location(img2, file, 94, 6, 2951);
				img3.src = "./icons/superlike.png";
				img3.className = "superlike svelte-1bmos6x";
				img3.id = "superlike";
				img3.alt = "superlike";
				add_location(img3, file, 95, 6, 3036);
				div0.className = "card-body svelte-1bmos6x";
				add_location(div0, file, 86, 4, 2526);
				div1.className = "card mx-auto mt-5 svelte-1bmos6x";
				div1.id = "card-element";
				set_style(div1, "width", "18rem");
				set_style(div1, "text-align", "center");
				add_location(div1, file, 84, 0, 2321);

				dispose = [
					listen(img1, "click", ctx.click_handler),
					listen(img2, "click", ctx.click_handler_1),
					listen(img3, "click", ctx.click_handler_2)
				];
			},

			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},

			m: function mount(target, anchor) {
				insert(target, div1, anchor);
				append(div1, img0);
				append(div1, t0);
				append(div1, div0);
				append(div0, p);
				append(p, b);
				append(b, t1);
				append(div0, t2);
				append(div0, img1);
				append(div0, t3);
				append(div0, img2);
				append(div0, t4);
				append(div0, img3);
			},

			p: function update_1(changed, ctx) {
				if ((changed.food_nr) && img0_src_value !== (img0_src_value = "./images/" + ctx.food_nr + ".jpg")) {
					img0.src = img0_src_value;
				}

				if ((changed.food) && t1_value !== (t1_value = ctx.food.food_name)) {
					set_data(t1, t1_value);
				}
			},

			i: noop,
			o: noop,

			d: function destroy(detaching) {
				if (detaching) {
					detach(div1);
				}

				run_all(dispose);
			}
		};
	}

	function delay(milliseconds){
	  return new Promise(resolve => {
	      setTimeout(resolve, milliseconds);
	  });
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
	    

	    async function init(vote) {

	        var element = document.getElementById("card-element");
	        var element2 = document.getElementById("superlike");

	        if (vote == 0) {
	            console.log("dislike!!!");
	            element.classList.add("card-element-dislike");
	            await delay(800);
	            element.classList.remove("card-element-dislike");
	            element.classList.add("card-element-hide");
	            handleVote(vote);
	        } else if (vote == 1) {
	            console.log("like!!!");
	            element.classList.add("card-element-like");
	            await delay(800);
	            element.classList.remove("card-element-like");
	            element.classList.add("card-element-hide");
	            handleVote(vote);
	        } else {
	            console.log("superlike!!!");
	            element2.classList.add("icon-superlike");
	            await delay(400);
	            element.classList.add("card-element-superlike");
	            await delay(800);
	            element.classList.remove("card-element-superlike");
	            element2.classList.remove("icon-superlike");
	            element.classList.add("card-element-hide");
	            handleVote(vote);
	        }
	        element.classList.remove("card-element-hide");
	        element.classList.add("card-element-fade-in");
	        await delay(500);
	        element.classList.remove("card-element-fade-in");
	    }

	    const handleVote = (vote) => {
	        
	        console.log(vote);

	        dispatch('save-vote', vote);
	    };

		function click_handler() {
			return init(0);
		}

		function click_handler_1() {
			return init(1);
		}

		function click_handler_2() {
			return init(2);
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
			init,
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
				add_location(h2, file$1, 90, 4, 1742);
				label0.htmlFor = "usernameInput";
				label0.className = "form-label";
				add_location(label0, file$1, 94, 8, 1839);
				attr(input0, "type", "String");
				input0.className = "form-control";
				input0.id = "usernameInput";
				input0.placeholder = "Dein Benutzername";
				add_location(input0, file$1, 95, 8, 1915);
				div0.className = "mb-3";
				add_location(div0, file$1, 93, 4, 1811);
				label1.htmlFor = "exampleFormControlInput1";
				label1.className = "form-label";
				add_location(label1, file$1, 98, 8, 2108);
				attr(input1, "type", "email");
				input1.className = "form-control";
				input1.id = "exampleFormControlInput1";
				input1.placeholder = "name@example.com";
				add_location(input1, file$1, 99, 8, 2197);
				div1.className = "mb-3";
				add_location(div1, file$1, 97, 4, 2080);
				label2.htmlFor = "inputPassword";
				label2.className = "col-sm-2 col-form-label";
				add_location(label2, file$1, 102, 8, 2403);
				attr(input2, "type", "password");
				input2.className = "form-control";
				input2.id = "inputPassword";
				add_location(input2, file$1, 104, 8, 2547);
				div2.className = "mb-3";
				add_location(div2, file$1, 101, 4, 2375);
				button.disabled = ctx.disabled;
				button.type = "button";
				button.className = "btn btn-primary mb-3";
				add_location(button, file$1, 108, 8, 2742);
				div3.className = "col-auto";
				add_location(div3, file$1, 107, 4, 2710);
				form.className = "row g-3";
				add_location(form, file$1, 92, 4, 1783);

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
				add_location(h2, file$2, 87, 4, 2062);
				label0.htmlFor = "usernameInput";
				label0.className = "form-label";
				add_location(label0, file$2, 91, 8, 2147);
				attr(input0, "type", "String");
				input0.className = "form-control";
				input0.id = "usernameInput";
				input0.placeholder = "Dein Benutzername";
				add_location(input0, file$2, 92, 8, 2223);
				div0.className = "mb-3";
				add_location(div0, file$2, 90, 4, 2119);
				label1.htmlFor = "inputPassword";
				label1.className = "col-sm-2 col-form-label";
				add_location(label1, file$2, 95, 8, 2416);
				attr(input1, "type", "password");
				input1.className = "form-control";
				input1.id = "inputPassword";
				add_location(input1, file$2, 97, 10, 2562);
				div1.className = "mb-3";
				add_location(div1, file$2, 94, 4, 2388);
				button.disabled = ctx.disabled;
				button.type = "button";
				button.className = "btn btn-primary mb-3";
				add_location(button, file$2, 101, 8, 2761);
				div2.className = "col-auto";
				add_location(div2, file$2, 100, 6, 2729);
				form.className = "row g-3";
				add_location(form, file$2, 89, 4, 2091);

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
				a.className = "svelte-hh9rz7";
				add_location(a, file$3, 10, 0, 112);
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
		var div8, div0, t1, div7, h50, t3, p0, t4, br0, t5, br1, t6, b0, t8, b1, t10, b2, t12, br2, t13, div2, img0, t14, div1, h51, t16, p1, t18, div4, img1, t19, div3, h52, t21, p2, t23, div6, img2, t24, div5, h53, t26, p3, t27, u, t29, t30, p4, br3, t31, t32, button, dispose;

		return {
			c: function create() {
				div8 = element("div");
				div0 = element("div");
				div0.textContent = "Fragebogen";
				t1 = space();
				div7 = element("div");
				h50 = element("h5");
				h50.textContent = "Inhalt";
				t3 = space();
				p0 = element("p");
				t4 = text("Dieser Fragbogen beinhaltet eine Vielzahl an Lebensmittel. \r\n        ");
				br0 = element("br");
				t5 = text("Geben Sie bitte an, ob Sie die einzelne Lebensmittel mögen oder nicht. ");
				br1 = element("br");
				t6 = text("Unterscheiden können Sie dabei zwischen ");
				b0 = element("b");
				b0.textContent = "\"dislike\"";
				t8 = text(", ");
				b1 = element("b");
				b1.textContent = "\"like\"";
				t10 = text(" und ");
				b2 = element("b");
				b2.textContent = "\"superlike\"";
				t12 = text(".\r\n        ");
				br2 = element("br");
				t13 = space();
				div2 = element("div");
				img0 = element("img");
				t14 = space();
				div1 = element("div");
				h51 = element("h5");
				h51.textContent = "dislike";
				t16 = space();
				p1 = element("p");
				p1.textContent = "Dieses Lebensmittel mag ich nicht.";
				t18 = space();
				div4 = element("div");
				img1 = element("img");
				t19 = space();
				div3 = element("div");
				h52 = element("h5");
				h52.textContent = "like";
				t21 = space();
				p2 = element("p");
				p2.textContent = "Dieses Lebensmittel mag ich.";
				t23 = space();
				div6 = element("div");
				img2 = element("img");
				t24 = space();
				div5 = element("div");
				h53 = element("h5");
				h53.textContent = "superlike";
				t26 = space();
				p3 = element("p");
				t27 = text("Dieses Lebensmittel mag ich ");
				u = element("u");
				u.textContent = "sehr";
				t29 = text(".");
				t30 = space();
				p4 = element("p");
				br3 = element("br");
				t31 = text("\r\n        Mit diesen Angaben wird eine erste Evaluation durchgeführt.");
				t32 = space();
				button = element("button");
				button.textContent = "Zur Umfrage";
				div0.className = "card-header";
				add_location(div0, file$4, 26, 4, 496);
				h50.className = "card-title";
				add_location(h50, file$4, 30, 6, 590);
				add_location(br0, file$4, 33, 8, 732);
				add_location(br1, file$4, 33, 83, 807);
				add_location(b0, file$4, 33, 127, 851);
				add_location(b1, file$4, 33, 145, 869);
				add_location(b2, file$4, 33, 163, 887);
				add_location(br2, file$4, 34, 8, 916);
				p0.className = "card-text";
				add_location(p0, file$4, 31, 6, 632);
				img0.className = "card-img-top svelte-1noysea";
				img0.src = "./icons/dislike.png";
				img0.alt = "Card image cap";
				add_location(img0, file$4, 37, 8, 996);
				h51.className = "card-title text-center";
				add_location(h51, file$4, 39, 10, 1114);
				p1.className = "card-text text-center";
				add_location(p1, file$4, 40, 10, 1173);
				div1.className = "card-body";
				add_location(div1, file$4, 38, 8, 1079);
				div2.className = "card icons svelte-1noysea";
				set_style(div2, "width", "10rem");
				add_location(div2, file$4, 36, 6, 940);
				img1.className = "card-img-top svelte-1noysea";
				img1.src = "./icons/like.png";
				img1.alt = "Card image cap";
				add_location(img1, file$4, 44, 8, 1339);
				h52.className = "card-title text-center";
				add_location(h52, file$4, 46, 10, 1454);
				p2.className = "card-text text-center";
				add_location(p2, file$4, 47, 10, 1510);
				div3.className = "card-body";
				add_location(div3, file$4, 45, 8, 1419);
				div4.className = "card icons svelte-1noysea";
				set_style(div4, "width", "10rem");
				add_location(div4, file$4, 43, 6, 1283);
				img2.className = "card-img-top svelte-1noysea";
				img2.src = "./icons/superlike.png";
				img2.alt = "Card image cap";
				add_location(img2, file$4, 51, 8, 1670);
				h53.className = "card-title text-center";
				add_location(h53, file$4, 53, 10, 1790);
				add_location(u, file$4, 54, 72, 1913);
				p3.className = "card-text text-center";
				add_location(p3, file$4, 54, 10, 1851);
				div5.className = "card-body";
				add_location(div5, file$4, 52, 8, 1755);
				div6.className = "card icons svelte-1noysea";
				set_style(div6, "width", "10rem");
				add_location(div6, file$4, 50, 6, 1614);
				add_location(br3, file$4, 58, 8, 1998);
				p4.className = "card-text";
				add_location(p4, file$4, 57, 6, 1967);
				button.className = "btn btn-primary";
				add_location(button, file$4, 63, 6, 2109);
				div7.className = "card-body";
				add_location(div7, file$4, 29, 4, 559);
				div8.className = "card text-center mx-auto";
				add_location(div8, file$4, 25, 0, 452);
				dispose = listen(button, "click", ctx.createNewFragebogen);
			},

			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},

			m: function mount(target, anchor) {
				insert(target, div8, anchor);
				append(div8, div0);
				append(div8, t1);
				append(div8, div7);
				append(div7, h50);
				append(div7, t3);
				append(div7, p0);
				append(p0, t4);
				append(p0, br0);
				append(p0, t5);
				append(p0, br1);
				append(p0, t6);
				append(p0, b0);
				append(p0, t8);
				append(p0, b1);
				append(p0, t10);
				append(p0, b2);
				append(p0, t12);
				append(p0, br2);
				append(div7, t13);
				append(div7, div2);
				append(div2, img0);
				append(div2, t14);
				append(div2, div1);
				append(div1, h51);
				append(div1, t16);
				append(div1, p1);
				append(div7, t18);
				append(div7, div4);
				append(div4, img1);
				append(div4, t19);
				append(div4, div3);
				append(div3, h52);
				append(div3, t21);
				append(div3, p2);
				append(div7, t23);
				append(div7, div6);
				append(div6, img2);
				append(div6, t24);
				append(div6, div5);
				append(div5, h53);
				append(div5, t26);
				append(div5, p3);
				append(p3, t27);
				append(p3, u);
				append(p3, t29);
				append(div7, t30);
				append(div7, p4);
				append(p4, br3);
				append(p4, t31);
				append(div7, t32);
				append(div7, button);
			},

			p: noop,
			i: noop,
			o: noop,

			d: function destroy(detaching) {
				if (detaching) {
					detach(div8);
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

	/* src\app\component\UserInfos.svelte generated by Svelte v3.1.0 */

	const file$5 = "src\\app\\component\\UserInfos.svelte";

	function create_fragment$5(ctx) {
		var div15, div0, t1, div14, p0, t2, b0, t4, br0, t5, t6, div1, input0, t7, label0, t9, div2, input1, t10, label1, t12, div3, input2, t13, label2, t15, div4, input3, t16, label3, t18, div5, input4, t19, label4, t21, div6, input5, t22, label5, t24, div7, input6, t25, label6, t27, div8, input7, t28, label7, t30, div9, input8, t31, label8, t33, div10, input9, t34, label9, t36, div11, input10, t37, label10, t39, div12, input11, t40, label11, t42, br1, t43, p1, t44, u, t46, t47, div13, input12, t48, label12, t50, br2, t51, p2, t52, b1, t54, t55, button, dispose;

		return {
			c: function create() {
				div15 = element("div");
				div0 = element("div");
				div0.textContent = "Ihre Angaben";
				t1 = space();
				div14 = element("div");
				p0 = element("p");
				t2 = text("Bitte geben Sie an, ob Sie über einzelne ");
				b0 = element("b");
				b0.textContent = "Allergien oder Unverträglichkeiten";
				t4 = text(" verfügen. ");
				br0 = element("br");
				t5 = text("\r\n      Die Angaben sind notwendig, damit der Fragebogen auf Sie zugeschnitten werden kann.");
				t6 = space();
				div1 = element("div");
				input0 = element("input");
				t7 = space();
				label0 = element("label");
				label0.textContent = "Ei";
				t9 = space();
				div2 = element("div");
				input1 = element("input");
				t10 = space();
				label1 = element("label");
				label1.textContent = "Erdnuss";
				t12 = space();
				div3 = element("div");
				input2 = element("input");
				t13 = space();
				label2 = element("label");
				label2.textContent = "Fisch";
				t15 = space();
				div4 = element("div");
				input3 = element("input");
				t16 = space();
				label3 = element("label");
				label3.textContent = "Krustentiere";
				t18 = space();
				div5 = element("div");
				input4 = element("input");
				t19 = space();
				label4 = element("label");
				label4.textContent = "Kuhmilch";
				t21 = space();
				div6 = element("div");
				input5 = element("input");
				t22 = space();
				label5 = element("label");
				label5.textContent = "Schalenfrüchte";
				t24 = space();
				div7 = element("div");
				input6 = element("input");
				t25 = space();
				label6 = element("label");
				label6.textContent = "Sellerie";
				t27 = space();
				div8 = element("div");
				input7 = element("input");
				t28 = space();
				label7 = element("label");
				label7.textContent = "Senf";
				t30 = space();
				div9 = element("div");
				input8 = element("input");
				t31 = space();
				label8 = element("label");
				label8.textContent = "Sesamsamen";
				t33 = space();
				div10 = element("div");
				input9 = element("input");
				t34 = space();
				label9 = element("label");
				label9.textContent = "Sojabohnen";
				t36 = space();
				div11 = element("div");
				input10 = element("input");
				t37 = space();
				label10 = element("label");
				label10.textContent = "Weichtiere";
				t39 = space();
				div12 = element("div");
				input11 = element("input");
				t40 = space();
				label11 = element("label");
				label11.textContent = "Weizen (Gluten)";
				t42 = space();
				br1 = element("br");
				t43 = space();
				p1 = element("p");
				t44 = text("Ernähren Sie sich ");
				u = element("u");
				u.textContent = "ausschliesslich";
				t46 = text(" vegetarisch?");
				t47 = space();
				div13 = element("div");
				input12 = element("input");
				t48 = space();
				label12 = element("label");
				label12.textContent = "Vegetarisch";
				t50 = space();
				br2 = element("br");
				t51 = space();
				p2 = element("p");
				t52 = text("Wenn Sie alle Fragen beantwortet haben, können Sie auf ");
				b1 = element("b");
				b1.textContent = "Sichern";
				t54 = text(" drücken.");
				t55 = space();
				button = element("button");
				button.textContent = "Sichern";
				div0.className = "card-header";
				add_location(div0, file$5, 73, 2, 1860);
				add_location(b0, file$5, 77, 48, 1990);
				add_location(br0, file$5, 77, 100, 2042);
				add_location(p0, file$5, 77, 4, 1946);
				input0.className = "form-check-input";
				attr(input0, "type", "checkbox");
				attr(input0, "role", "switch");
				input0.id = "allergie1";
				add_location(input0, file$5, 81, 8, 2201);
				label0.className = "form-check-label";
				label0.htmlFor = "allergie1";
				add_location(label0, file$5, 82, 8, 2313);
				div1.className = "form-check form-switch";
				add_location(div1, file$5, 80, 6, 2155);
				input1.className = "form-check-input";
				attr(input1, "type", "checkbox");
				attr(input1, "role", "switch");
				input1.id = "allergie2";
				add_location(input1, file$5, 86, 8, 2442);
				label1.className = "form-check-label";
				label1.htmlFor = "allergie2";
				add_location(label1, file$5, 87, 8, 2554);
				div2.className = "form-check form-switch";
				add_location(div2, file$5, 85, 6, 2396);
				input2.className = "form-check-input";
				attr(input2, "type", "checkbox");
				attr(input2, "role", "switch");
				input2.id = "allergie3";
				add_location(input2, file$5, 91, 8, 2687);
				label2.className = "form-check-label";
				label2.htmlFor = "allergie3";
				add_location(label2, file$5, 92, 8, 2799);
				div3.className = "form-check form-switch";
				add_location(div3, file$5, 90, 6, 2641);
				input3.className = "form-check-input";
				attr(input3, "type", "checkbox");
				attr(input3, "role", "switch");
				input3.id = "allergie4";
				add_location(input3, file$5, 96, 8, 2936);
				label3.className = "form-check-label";
				label3.htmlFor = "allergie4";
				add_location(label3, file$5, 97, 8, 3048);
				div4.className = "form-check form-switch";
				add_location(div4, file$5, 95, 6, 2890);
				input4.className = "form-check-input";
				attr(input4, "type", "checkbox");
				attr(input4, "role", "switch");
				input4.id = "allergie5";
				add_location(input4, file$5, 101, 8, 3186);
				label4.className = "form-check-label";
				label4.htmlFor = "allergie5";
				add_location(label4, file$5, 102, 8, 3298);
				div5.className = "form-check form-switch";
				add_location(div5, file$5, 100, 6, 3140);
				input5.className = "form-check-input";
				attr(input5, "type", "checkbox");
				attr(input5, "role", "switch");
				input5.id = "allergie6";
				add_location(input5, file$5, 105, 8, 3430);
				label5.className = "form-check-label";
				label5.htmlFor = "allergie6";
				add_location(label5, file$5, 106, 8, 3542);
				div6.className = "form-check form-switch";
				add_location(div6, file$5, 104, 6, 3384);
				input6.className = "form-check-input";
				attr(input6, "type", "checkbox");
				attr(input6, "role", "switch");
				input6.id = "allergie7";
				add_location(input6, file$5, 109, 8, 3680);
				label6.className = "form-check-label";
				label6.htmlFor = "allergie7";
				add_location(label6, file$5, 110, 8, 3792);
				div7.className = "form-check form-switch";
				add_location(div7, file$5, 108, 6, 3634);
				input7.className = "form-check-input";
				attr(input7, "type", "checkbox");
				attr(input7, "role", "switch");
				input7.id = "allergie8";
				add_location(input7, file$5, 113, 8, 3924);
				label7.className = "form-check-label";
				label7.htmlFor = "allergie8";
				add_location(label7, file$5, 114, 8, 4036);
				div8.className = "form-check form-switch";
				add_location(div8, file$5, 112, 6, 3878);
				input8.className = "form-check-input";
				attr(input8, "type", "checkbox");
				attr(input8, "role", "switch");
				input8.id = "allergie9";
				add_location(input8, file$5, 117, 8, 4164);
				label8.className = "form-check-label";
				label8.htmlFor = "allergie9";
				add_location(label8, file$5, 118, 8, 4276);
				div9.className = "form-check form-switch";
				add_location(div9, file$5, 116, 6, 4118);
				input9.className = "form-check-input";
				attr(input9, "type", "checkbox");
				attr(input9, "role", "switch");
				input9.id = "allergie10";
				add_location(input9, file$5, 121, 8, 4410);
				label9.className = "form-check-label";
				label9.htmlFor = "allergie10";
				add_location(label9, file$5, 122, 8, 4524);
				div10.className = "form-check form-switch";
				add_location(div10, file$5, 120, 6, 4364);
				input10.className = "form-check-input";
				attr(input10, "type", "checkbox");
				attr(input10, "role", "switch");
				input10.id = "allergie11";
				add_location(input10, file$5, 125, 8, 4659);
				label10.className = "form-check-label";
				label10.htmlFor = "allergie11";
				add_location(label10, file$5, 126, 8, 4773);
				div11.className = "form-check form-switch";
				add_location(div11, file$5, 124, 6, 4613);
				input11.className = "form-check-input";
				attr(input11, "type", "checkbox");
				attr(input11, "role", "switch");
				input11.id = "allergie12";
				add_location(input11, file$5, 129, 8, 4908);
				label11.className = "form-check-label";
				label11.htmlFor = "allergie12";
				add_location(label11, file$5, 130, 8, 5022);
				div12.className = "form-check form-switch";
				add_location(div12, file$5, 128, 6, 4862);
				add_location(br1, file$5, 132, 6, 5116);
				add_location(u, file$5, 133, 27, 5149);
				add_location(p1, file$5, 133, 6, 5128);
				input12.className = "form-check-input";
				attr(input12, "type", "checkbox");
				attr(input12, "role", "switch");
				input12.id = "vegetarisch";
				add_location(input12, file$5, 135, 8, 5242);
				label12.className = "form-check-label";
				label12.htmlFor = "vegetarisch";
				add_location(label12, file$5, 136, 8, 5358);
				div13.className = "form-check form-switch";
				add_location(div13, file$5, 134, 6, 5196);
				add_location(br2, file$5, 138, 6, 5449);
				add_location(b1, file$5, 140, 82, 5539);
				p2.className = "card-text";
				add_location(p2, file$5, 140, 6, 5463);
				button.className = "btn btn-primary";
				add_location(button, file$5, 141, 6, 5574);
				div14.className = "card-body";
				add_location(div14, file$5, 76, 2, 1917);
				div15.className = "card mb-3";
				add_location(div15, file$5, 72, 0, 1833);

				dispose = [
					listen(input0, "change", ctx.input0_change_handler),
					listen(input1, "change", ctx.input1_change_handler),
					listen(input2, "change", ctx.input2_change_handler),
					listen(input3, "change", ctx.input3_change_handler),
					listen(input4, "change", ctx.input4_change_handler),
					listen(input5, "change", ctx.input5_change_handler),
					listen(input6, "change", ctx.input6_change_handler),
					listen(input7, "change", ctx.input7_change_handler),
					listen(input8, "change", ctx.input8_change_handler),
					listen(input9, "change", ctx.input9_change_handler),
					listen(input10, "change", ctx.input10_change_handler),
					listen(input11, "change", ctx.input11_change_handler),
					listen(input12, "change", ctx.input12_change_handler),
					listen(button, "click", ctx.saveAngaben)
				];
			},

			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},

			m: function mount(target, anchor) {
				insert(target, div15, anchor);
				append(div15, div0);
				append(div15, t1);
				append(div15, div14);
				append(div14, p0);
				append(p0, t2);
				append(p0, b0);
				append(p0, t4);
				append(p0, br0);
				append(p0, t5);
				append(div14, t6);
				append(div14, div1);
				append(div1, input0);

				input0.checked = ctx.allergie1;

				append(div1, t7);
				append(div1, label0);
				append(div14, t9);
				append(div14, div2);
				append(div2, input1);

				input1.checked = ctx.allergie2;

				append(div2, t10);
				append(div2, label1);
				append(div14, t12);
				append(div14, div3);
				append(div3, input2);

				input2.checked = ctx.allergie3;

				append(div3, t13);
				append(div3, label2);
				append(div14, t15);
				append(div14, div4);
				append(div4, input3);

				input3.checked = ctx.allergie4;

				append(div4, t16);
				append(div4, label3);
				append(div14, t18);
				append(div14, div5);
				append(div5, input4);

				input4.checked = ctx.allergie5;

				append(div5, t19);
				append(div5, label4);
				append(div14, t21);
				append(div14, div6);
				append(div6, input5);

				input5.checked = ctx.allergie6;

				append(div6, t22);
				append(div6, label5);
				append(div14, t24);
				append(div14, div7);
				append(div7, input6);

				input6.checked = ctx.allergie7;

				append(div7, t25);
				append(div7, label6);
				append(div14, t27);
				append(div14, div8);
				append(div8, input7);

				input7.checked = ctx.allergie8;

				append(div8, t28);
				append(div8, label7);
				append(div14, t30);
				append(div14, div9);
				append(div9, input8);

				input8.checked = ctx.allergie9;

				append(div9, t31);
				append(div9, label8);
				append(div14, t33);
				append(div14, div10);
				append(div10, input9);

				input9.checked = ctx.allergie10;

				append(div10, t34);
				append(div10, label9);
				append(div14, t36);
				append(div14, div11);
				append(div11, input10);

				input10.checked = ctx.allergie11;

				append(div11, t37);
				append(div11, label10);
				append(div14, t39);
				append(div14, div12);
				append(div12, input11);

				input11.checked = ctx.allergie12;

				append(div12, t40);
				append(div12, label11);
				append(div14, t42);
				append(div14, br1);
				append(div14, t43);
				append(div14, p1);
				append(p1, t44);
				append(p1, u);
				append(p1, t46);
				append(div14, t47);
				append(div14, div13);
				append(div13, input12);

				input12.checked = ctx.vegetarisch;

				append(div13, t48);
				append(div13, label12);
				append(div14, t50);
				append(div14, br2);
				append(div14, t51);
				append(div14, p2);
				append(p2, t52);
				append(p2, b1);
				append(p2, t54);
				append(div14, t55);
				append(div14, button);
			},

			p: function update(changed, ctx) {
				if (changed.allergie1) input0.checked = ctx.allergie1;
				if (changed.allergie2) input1.checked = ctx.allergie2;
				if (changed.allergie3) input2.checked = ctx.allergie3;
				if (changed.allergie4) input3.checked = ctx.allergie4;
				if (changed.allergie5) input4.checked = ctx.allergie5;
				if (changed.allergie6) input5.checked = ctx.allergie6;
				if (changed.allergie7) input6.checked = ctx.allergie7;
				if (changed.allergie8) input7.checked = ctx.allergie8;
				if (changed.allergie9) input8.checked = ctx.allergie9;
				if (changed.allergie10) input9.checked = ctx.allergie10;
				if (changed.allergie11) input10.checked = ctx.allergie11;
				if (changed.allergie12) input11.checked = ctx.allergie12;
				if (changed.vegetarisch) input12.checked = ctx.vegetarisch;
			},

			i: noop,
			o: noop,

			d: function destroy(detaching) {
				if (detaching) {
					detach(div15);
				}

				run_all(dispose);
			}
		};
	}

	function instance$5($$self, $$props, $$invalidate) {
		let user =  JSON.parse(localStorage.current_user);
	let allergie1;
	let allergie2;
	let allergie3;
	let allergie4;
	let allergie5;
	let allergie6;
	let allergie7;
	let allergie8;
	let allergie9;
	let allergie10;
	let allergie11;
	let allergie12;
	let vegetarisch;

	let list = [];
	const dispatch = createEventDispatcher();

	function saveAngaben(){

	  if(allergie1){$$invalidate('list', list = [... list, "Ei"]);}  if(allergie2){$$invalidate('list', list = [... list, "Erdnuss"]);}  if(allergie3){$$invalidate('list', list = [... list, "Fisch"]);}  if(allergie4){$$invalidate('list', list = [... list, "Krustentiere"]);}  if(allergie5){$$invalidate('list', list = [... list, "Kuhmilch"]);}  if(allergie6){$$invalidate('list', list = [... list, "Schalenfrüchte"]);}  if(allergie7){$$invalidate('list', list = [... list, "Sellerie"]);}  if(allergie8){$$invalidate('list', list = [... list, "Senf"]);}  if(allergie9){$$invalidate('list', list = [... list, "Sesamsamen"]);}  if(allergie10){$$invalidate('list', list = [... list, "Sojabohnen"]);}  if(allergie11){$$invalidate('list', list = [... list, "Weichtiere"]);}  if(allergie12){$$invalidate('list', list = [... list, "Weizen (Gluten)"]);}  if(vegetarisch){
	    
	    axios.post("/users/" + user.user_id + "/vegetrisch")
	          .then((response) => {
	            console.log(response.data);
	          })
	          .catch((error) => {
	              console.log(error);
	          });
	  }
	  if (list.length > 0){
	    axios.post("/users/" + user.user_id + "/allergien", list)
	          .then((response) => {
	            console.log(response.data);
	          })
	          .catch((error) => {
	              console.log(error);
	          });
	  }

	  axios.post("/users/" + user.user_id + "/angaben")
	          .then((response) => {
	            console.log(response.data);
	          })
	          .catch((error) => {
	              console.log(error);
	          });

	 
	  dispatch("save-Infos");
	  console.log(list);
	}

		function input0_change_handler() {
			allergie1 = this.checked;
			$$invalidate('allergie1', allergie1);
		}

		function input1_change_handler() {
			allergie2 = this.checked;
			$$invalidate('allergie2', allergie2);
		}

		function input2_change_handler() {
			allergie3 = this.checked;
			$$invalidate('allergie3', allergie3);
		}

		function input3_change_handler() {
			allergie4 = this.checked;
			$$invalidate('allergie4', allergie4);
		}

		function input4_change_handler() {
			allergie5 = this.checked;
			$$invalidate('allergie5', allergie5);
		}

		function input5_change_handler() {
			allergie6 = this.checked;
			$$invalidate('allergie6', allergie6);
		}

		function input6_change_handler() {
			allergie7 = this.checked;
			$$invalidate('allergie7', allergie7);
		}

		function input7_change_handler() {
			allergie8 = this.checked;
			$$invalidate('allergie8', allergie8);
		}

		function input8_change_handler() {
			allergie9 = this.checked;
			$$invalidate('allergie9', allergie9);
		}

		function input9_change_handler() {
			allergie10 = this.checked;
			$$invalidate('allergie10', allergie10);
		}

		function input10_change_handler() {
			allergie11 = this.checked;
			$$invalidate('allergie11', allergie11);
		}

		function input11_change_handler() {
			allergie12 = this.checked;
			$$invalidate('allergie12', allergie12);
		}

		function input12_change_handler() {
			vegetarisch = this.checked;
			$$invalidate('vegetarisch', vegetarisch);
		}

		return {
			allergie1,
			allergie2,
			allergie3,
			allergie4,
			allergie5,
			allergie6,
			allergie7,
			allergie8,
			allergie9,
			allergie10,
			allergie11,
			allergie12,
			vegetarisch,
			saveAngaben,
			input0_change_handler,
			input1_change_handler,
			input2_change_handler,
			input3_change_handler,
			input4_change_handler,
			input5_change_handler,
			input6_change_handler,
			input7_change_handler,
			input8_change_handler,
			input9_change_handler,
			input10_change_handler,
			input11_change_handler,
			input12_change_handler
		};
	}

	class UserInfos extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$5, create_fragment$5, safe_not_equal, []);
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

	const file$6 = "src\\app\\pages\\Homepage.svelte";

	// (113:2) {:else}
	function create_else_block_1(ctx) {
		var button, t_1, current_block_type_index, if_block, if_block_anchor, current, dispose;

		var if_block_creators = [
			create_if_block_2,
			create_else_block_2
		];

		var if_blocks = [];

		function select_block_type_2(ctx) {
			if (!ctx.infosDone) return 0;
			return 1;
		}

		current_block_type_index = select_block_type_2(ctx);
		if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

		return {
			c: function create() {
				button = element("button");
				button.textContent = "Ausloggen";
				t_1 = space();
				if_block.c();
				if_block_anchor = empty();
				button.className = "btn btn-secondary position-absolute top-0 end-0 svelte-ecnfgu";
				button.type = "button";
				add_location(button, file$6, 114, 4, 2466);
				dispose = listen(button, "click", ausloggen);
			},

			m: function mount(target, anchor) {
				insert(target, button, anchor);
				insert(target, t_1, anchor);
				if_blocks[current_block_type_index].m(target, anchor);
				insert(target, if_block_anchor, anchor);
				current = true;
			},

			p: function update(changed, ctx) {
				var previous_block_index = current_block_type_index;
				current_block_type_index = select_block_type_2(ctx);
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
					detach(t_1);
				}

				if_blocks[current_block_type_index].d(detaching);

				if (detaching) {
					detach(if_block_anchor);
				}

				dispose();
			}
		};
	}

	// (101:2) {#if !loggedIn}
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
				button.className = "btn btn-secondary mb-3 svelte-ecnfgu";
				add_location(button, file$6, 110, 4, 2323);
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

	// (121:4) {:else}
	function create_else_block_2(ctx) {
		var current;

		var startcomponent = new StartComponent({
			props: { user: ctx.user },
			$$inline: true
		});

		return {
			c: function create() {
				startcomponent.$$.fragment.c();
			},

			m: function mount(target, anchor) {
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
				startcomponent.$$.fragment.i(local);

				current = true;
			},

			o: function outro(local) {
				startcomponent.$$.fragment.o(local);
				current = false;
			},

			d: function destroy(detaching) {
				startcomponent.$destroy(detaching);
			}
		};
	}

	// (119:4) {#if !infosDone}
	function create_if_block_2(ctx) {
		var current;

		var userinfos = new UserInfos({ $$inline: true });
		userinfos.$on("save-Infos", ctx.setInfos);

		return {
			c: function create() {
				userinfos.$$.fragment.c();
			},

			m: function mount(target, anchor) {
				mount_component(userinfos, target, anchor);
				current = true;
			},

			p: noop,

			i: function intro(local) {
				if (current) return;
				userinfos.$$.fragment.i(local);

				current = true;
			},

			o: function outro(local) {
				userinfos.$$.fragment.o(local);
				current = false;
			},

			d: function destroy(detaching) {
				userinfos.$destroy(detaching);
			}
		};
	}

	// (105:4) {:else}
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

	// (102:4) {#if neu}
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

	function create_fragment$6(ctx) {
		var div, h1, t_1, current_block_type_index, if_block, current;

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
				div = element("div");
				h1 = element("h1");
				h1.textContent = "FoodLike";
				t_1 = space();
				if_block.c();
				h1.className = "text-center mx-auto svelte-ecnfgu";
				add_location(h1, file$6, 97, 2, 2114);
				div.className = "mx-auto";
				set_style(div, "width", "50%");
				add_location(div, file$6, 96, 0, 2069);
			},

			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},

			m: function mount(target, anchor) {
				insert(target, div, anchor);
				append(div, h1);
				append(div, t_1);
				if_blocks[current_block_type_index].m(div, null);
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
					if_block.m(div, null);
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
					detach(div);
				}

				if_blocks[current_block_type_index].d();
			}
		};
	}

	function setAdmin() {

		admin.set(true);

	}

	function instance$6($$self, $$props, $$invalidate) {
		
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



	let infosDone = false;

	if (loggedIn){

	  $$invalidate('infosDone', infosDone = getInfos());
	}


	let tempUser = {};
	function getInfos(){
	  $$invalidate('user', user = JSON.parse(localStorage.current_user));
	  axios.get("/users/" + user.user_id)
	          .then((response) => {
	            
	            console.log(response.data);
	            $$invalidate('tempUser', tempUser = response.data);
	            if(tempUser.angaben == true){
	              $$invalidate('infosDone', infosDone = true);
	            }
	          })
	          .catch((error) => {
	              console.log(error);
	          });

	}

	function setInfos(){
	  $$invalidate('infosDone', infosDone = true);
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
			einloggen,
			infosDone,
			setInfos
		};
	}

	class Homepage extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$6, create_fragment$6, safe_not_equal, []);
		}
	}

	/* src\app\pages\Notfound.svelte generated by Svelte v3.1.0 */

	const file$7 = "src\\app\\pages\\Notfound.svelte";

	function create_fragment$7(ctx) {
		var h1, t_1, h2;

		return {
			c: function create() {
				h1 = element("h1");
				h1.textContent = "Falsche Richtung, geh zurück.";
				t_1 = space();
				h2 = element("h2");
				h2.textContent = "Seite nicht gefunden.";
				add_location(h1, file$7, 4, 0, 25);
				add_location(h2, file$7, 5, 0, 65);
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
			init(this, options, null, create_fragment$7, safe_not_equal, []);
		}
	}

	/* src\app\component\EndComponent.svelte generated by Svelte v3.1.0 */

	const file$8 = "src\\app\\component\\EndComponent.svelte";

	function create_fragment$8(ctx) {
		var div2, script, t0, div1, h50, t2, div0, h51, t4, p, t6, lottie_player, a;

		return {
			c: function create() {
				div2 = element("div");
				script = element("script");
				t0 = space();
				div1 = element("div");
				h50 = element("h5");
				h50.textContent = "Ihr Fragebogen";
				t2 = space();
				div0 = element("div");
				h51 = element("h5");
				h51.textContent = "Der Fragebogen wurde beendet 🎉";
				t4 = space();
				p = element("p");
				p.textContent = "Sie haben alle Fragen beantwortet.";
				t6 = space();
				lottie_player = element("lottie-player");
				a = element("a");
				a.textContent = "Zur Evaluation";
				script.src = "https://unpkg.com/@lottiefiles/lottie-player@latest/dist/lottie-player.js";
				add_location(script, file$8, 7, 6, 54);
				h50.className = "card-header";
				add_location(h50, file$8, 9, 6, 225);
				h51.className = "card-title";
				add_location(h51, file$8, 11, 12, 313);
				p.className = "card-text";
				add_location(p, file$8, 16, 12, 448);
				set_custom_element_data(lottie_player, "src", "https://assets3.lottiefiles.com/private_files/lf30_axdai8zf.json");
				set_custom_element_data(lottie_player, "background", "transparent");
				set_custom_element_data(lottie_player, "speed", "1");
				set_style(lottie_player, "width", "300px");
				set_style(lottie_player, "height", "300px");
				set_custom_element_data(lottie_player, "loop", "");
				set_custom_element_data(lottie_player, "autoplay", "");
				lottie_player.className = "svelte-8b54wy";
				add_location(lottie_player, file$8, 17, 12, 521);
				a.href = "#/evaluation";
				a.className = "btn btn-primary svelte-8b54wy";
				add_location(a, file$8, 17, 205, 714);
				div0.className = "card-body";
				add_location(div0, file$8, 10, 6, 276);
				div1.className = "card text-center mx-auto";
				set_style(div1, "width", "50%");
				add_location(div1, file$8, 8, 6, 159);
				add_location(div2, file$8, 6, 0, 41);
			},

			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},

			m: function mount(target, anchor) {
				insert(target, div2, anchor);
				append(div2, script);
				append(div2, t0);
				append(div2, div1);
				append(div1, h50);
				append(div1, t2);
				append(div1, div0);
				append(div0, h51);
				append(div0, t4);
				append(div0, p);
				append(div0, t6);
				append(div0, lottie_player);
				append(div0, a);
			},

			p: noop,
			i: noop,
			o: noop,

			d: function destroy(detaching) {
				if (detaching) {
					detach(div2);
				}
			}
		};
	}

	class EndComponent extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, null, create_fragment$8, safe_not_equal, []);
		}
	}

	/* src\app\pages\Questionspage.svelte generated by Svelte v3.1.0 */

	const file$9 = "src\\app\\pages\\Questionspage.svelte";

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

	function create_fragment$9(ctx) {
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
				button.className = "btn btn-secondary position-absolute top-0 end-0 svelte-fvmssm";
				button.type = "button";
				add_location(button, file$9, 78, 0, 1924);
				h1.className = "svelte-fvmssm";
				add_location(h1, file$9, 83, 0, 2053);
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

	function instance$7($$self, $$props, $$invalidate) {
		
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
			init(this, options, instance$7, create_fragment$9, safe_not_equal, []);
		}
	}

	/* src\app\component\ChartComponent.svelte generated by Svelte v3.1.0 */

	/* src\app\evaluation\EvaluationComponent.svelte generated by Svelte v3.1.0 */

	const file$a = "src\\app\\evaluation\\EvaluationComponent.svelte";

	function create_fragment$a(ctx) {
		var div3, h2, button, b, t0, t1_value = ctx.evaluation[0], t1, button_data_bs_target_value, h2_id_value, t2, div2, div1, strong, p0, t3, t4_value = ctx.evaluation[2], t4, t5, p1, t6, t7_value = ctx.evaluation[1], t7, t8, p2, t9, t10_value = ctx.evaluation[3], t10, t11, p3, t12, t13_value = ctx.evaluation[4], t13, t14, p4, t15, t16_value = ctx.evaluation[5], t16, t17, p5, t18, t19_value = ctx.evaluation[6], t19, t20, div0, canvas, div2_id_value, div2_aria_labelledby_value;

		return {
			c: function create() {
				div3 = element("div");
				h2 = element("h2");
				button = element("button");
				b = element("b");
				t0 = text("Kategorie: ");
				t1 = text(t1_value);
				t2 = space();
				div2 = element("div");
				div1 = element("div");
				strong = element("strong");
				p0 = element("p");
				t3 = text("Anzahl Ratings in dieser Kategorie: ");
				t4 = text(t4_value);
				t5 = space();
				p1 = element("p");
				t6 = text("Summe aller Ratings in dieser Kategorie: ");
				t7 = text(t7_value);
				t8 = space();
				p2 = element("p");
				t9 = text("Durchschnittliches Rating in dieser Kategorie: ");
				t10 = text(t10_value);
				t11 = space();
				p3 = element("p");
				t12 = text("Anzahl dislikes: ");
				t13 = text(t13_value);
				t14 = space();
				p4 = element("p");
				t15 = text("Anzahl likes: ");
				t16 = text(t16_value);
				t17 = space();
				p5 = element("p");
				t18 = text("Anzahl superlikes: ");
				t19 = text(t19_value);
				t20 = space();
				div0 = element("div");
				canvas = element("canvas");
				add_location(b, file$a, 59, 6, 1449);
				button.className = "accordion-button";
				button.type = "button";
				button.dataset.bsToggle = "collapse";
				button.dataset.bsTarget = button_data_bs_target_value = "#collapse" + ctx.index;
				attr(button, "aria-expanded", "true");
				attr(button, "aria-controls", "collapseOne");
				add_location(button, file$a, 58, 4, 1285);
				h2.className = "accordion-header";
				h2.id = h2_id_value = "heading" + ctx.index;
				add_location(h2, file$a, 57, 2, 1230);
				add_location(p0, file$a, 65, 6, 1699);
				add_location(strong, file$a, 64, 6, 1683);
				add_location(p1, file$a, 67, 6, 1783);
				add_location(p2, file$a, 68, 6, 1854);
				add_location(p3, file$a, 69, 6, 1931);
				add_location(p4, file$a, 70, 6, 1978);
				add_location(p5, file$a, 71, 6, 2022);
				canvas.id = "myChart";
				add_location(canvas, file$a, 73, 8, 2108);
				div0.className = "chart-wrapper svelte-2vpluf";
				add_location(div0, file$a, 72, 6, 2071);
				div1.className = "accordion-body";
				add_location(div1, file$a, 63, 4, 1647);
				div2.id = div2_id_value = "collapse" + ctx.index;
				div2.className = "accordion-collapse collapse";
				attr(div2, "aria-labelledby", div2_aria_labelledby_value = "heading" + ctx.index);
				div2.dataset.bsParent = "#accordionExample2";
				add_location(div2, file$a, 62, 2, 1510);
				div3.className = "accordion-item";
				add_location(div3, file$a, 56, 0, 1198);
			},

			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},

			m: function mount(target, anchor) {
				insert(target, div3, anchor);
				append(div3, h2);
				append(h2, button);
				append(button, b);
				append(b, t0);
				append(b, t1);
				append(div3, t2);
				append(div3, div2);
				append(div2, div1);
				append(div1, strong);
				append(strong, p0);
				append(p0, t3);
				append(p0, t4);
				append(div1, t5);
				append(div1, p1);
				append(p1, t6);
				append(p1, t7);
				append(div1, t8);
				append(div1, p2);
				append(p2, t9);
				append(p2, t10);
				append(div1, t11);
				append(div1, p3);
				append(p3, t12);
				append(p3, t13);
				append(div1, t14);
				append(div1, p4);
				append(p4, t15);
				append(p4, t16);
				append(div1, t17);
				append(div1, p5);
				append(p5, t18);
				append(p5, t19);
				append(div1, t20);
				append(div1, div0);
				append(div0, canvas);
			},

			p: function update(changed, ctx) {
				if ((changed.evaluation) && t1_value !== (t1_value = ctx.evaluation[0])) {
					set_data(t1, t1_value);
				}

				if ((changed.index) && button_data_bs_target_value !== (button_data_bs_target_value = "#collapse" + ctx.index)) {
					button.dataset.bsTarget = button_data_bs_target_value;
				}

				if ((changed.index) && h2_id_value !== (h2_id_value = "heading" + ctx.index)) {
					h2.id = h2_id_value;
				}

				if ((changed.evaluation) && t4_value !== (t4_value = ctx.evaluation[2])) {
					set_data(t4, t4_value);
				}

				if ((changed.evaluation) && t7_value !== (t7_value = ctx.evaluation[1])) {
					set_data(t7, t7_value);
				}

				if ((changed.evaluation) && t10_value !== (t10_value = ctx.evaluation[3])) {
					set_data(t10, t10_value);
				}

				if ((changed.evaluation) && t13_value !== (t13_value = ctx.evaluation[4])) {
					set_data(t13, t13_value);
				}

				if ((changed.evaluation) && t16_value !== (t16_value = ctx.evaluation[5])) {
					set_data(t16, t16_value);
				}

				if ((changed.evaluation) && t19_value !== (t19_value = ctx.evaluation[6])) {
					set_data(t19, t19_value);
				}

				if ((changed.index) && div2_id_value !== (div2_id_value = "collapse" + ctx.index)) {
					div2.id = div2_id_value;
				}

				if ((changed.index) && div2_aria_labelledby_value !== (div2_aria_labelledby_value = "heading" + ctx.index)) {
					attr(div2, "aria-labelledby", div2_aria_labelledby_value);
				}
			},

			i: noop,
			o: noop,

			d: function destroy(detaching) {
				if (detaching) {
					detach(div3);
				}
			}
		};
	}

	function instance$8($$self, $$props, $$invalidate) {
		let { evaluation, index } = $$props;

	function createChart() {
	  let ctx = document.getElementById('myChart').getContext('2d');
	  let labels = ['Dislikes', 'Likes', 'Superlikes'];
	  let colorHex = ['#FB3640', '#43AA8B', '#253D5B'];

	  let myChart = new Chart(ctx, {
	    type: 'pie',
	    data: {
	      datasets: [{
	        data: [evaluation[4], evaluation[5], evaluation[6]],
	        backgroundColor: colorHex
	      }],
	      labels: labels
	    },
	    options: {
	      responsive: true,
	      legend: {
	        position: 'bottom'
	      },
	      plugins: {
	        datalabels: {
	          color: '#fff',
	          anchor: 'end',
	          align: 'start',
	          offset: -10,
	          borderWidth: 2,
	          borderColor: '#fff',
	          borderRadius: 25,
	          backgroundColor: (context) => {
	            return context.dataset.backgroundColor;
	          },
	          font: {
	            weight: 'bold',
	            size: '10'
	          },
	          formatter: (value) => {
	            return value + ' %';
	          }
	        }
	      }
	    }
	  });
	}

	onMount(createChart);

		$$self.$set = $$props => {
			if ('evaluation' in $$props) $$invalidate('evaluation', evaluation = $$props.evaluation);
			if ('index' in $$props) $$invalidate('index', index = $$props.index);
		};

		return { evaluation, index };
	}

	class EvaluationComponent extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$8, create_fragment$a, safe_not_equal, ["evaluation", "index"]);

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

	const file$b = "src\\app\\pages\\Evaluationpage.svelte";

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

	// (212:2) {#if adminBool}
	function create_if_block_2$1(ctx) {
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
				button0.textContent = "Fragebogen suchen";
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
				add_location(button0, file$b, 215, 10, 6111);
				h2.className = "accordion-header";
				h2.id = "panelsStayOpen-headingSearch";
				add_location(h2, file$b, 214, 8, 6036);
				label.htmlFor = "Username";
				add_location(label, file$b, 224, 18, 6632);
				input.placeholder = "gesuchter Benutzername";
				attr(input, "type", "String");
				input.className = "form-control";
				input.id = "Username";
				add_location(input, file$b, 225, 18, 6694);
				select.className = "form-select form-select-lg mb-3";
				attr(select, "aria-label", ".form-select-lg example");
				add_location(select, file$b, 227, 18, 6859);
				div0.className = "form-group ";
				add_location(div0, file$b, 223, 16, 6587);
				button1.type = "button";
				button1.className = "btn btn-dark mt-2 svelte-1m06vzk";
				add_location(button1, file$b, 238, 18, 7227);
				button2.type = "button";
				button2.className = "btn btn-dark mt-2 svelte-1m06vzk";
				add_location(button2, file$b, 239, 18, 7332);
				add_location(form, file$b, 222, 12, 6563);
				div1.className = "accordion-body";
				add_location(div1, file$b, 220, 10, 6519);
				div2.id = "panelsStayOpen-collapseSearch";
				div2.className = "accordion-collapse collapse";
				attr(div2, "aria-labelledby", "panelsStayOpen-headingSearch");
				add_location(div2, file$b, 219, 8, 6384);
				div3.className = "accordion-item";
				add_location(div3, file$b, 213, 4, 5998);
				div4.className = "accordion mb-3";
				div4.id = "accordionPanelsStayOpenExample";
				add_location(div4, file$b, 212, 2, 5928);

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

	// (230:20) {#each listAnzeigen as name, i}
	function create_each_block_2(ctx) {
		var option, t_value = ctx.name, t, option_value_value;

		return {
			c: function create() {
				option = element("option");
				t = text(t_value);
				option.__value = option_value_value = ctx.name;
				option.value = option.__value;
				add_location(option, file$b, 230, 20, 7041);
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

	// (262:12) {#each listEvaluation as evaluation, i}
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

	// (310:22) {:else}
	function create_else_block$2(ctx) {
		var t;

		return {
			c: function create() {
				t = text("Superlike");
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

	// (308:55) 
	function create_if_block_1$1(ctx) {
		var t;

		return {
			c: function create() {
				t = text("Liked");
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

	// (306:22) {#if foodRating.rating == 0}
	function create_if_block$2(ctx) {
		var t;

		return {
			c: function create() {
				t = text("Dislike");
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

	// (300:16) {#each newList as foodRating}
	function create_each_block(ctx) {
		var tr, td0, b, t0_value = ctx.foodRating.id, t0, t1, td1, t2_value = ctx.foodRating.food.food_name, t2, t3, td2, t4_value = ctx.foodRating.food.category, t4, t5, td3, t6, td4, img, img_src_value, t7;

		function select_block_type(ctx) {
			if (ctx.foodRating.rating == 0) return create_if_block$2;
			if (ctx.foodRating.rating == 1) return create_if_block_1$1;
			return create_else_block$2;
		}

		var current_block_type = select_block_type(ctx);
		var if_block = current_block_type(ctx);

		return {
			c: function create() {
				tr = element("tr");
				td0 = element("td");
				b = element("b");
				t0 = text(t0_value);
				t1 = space();
				td1 = element("td");
				t2 = text(t2_value);
				t3 = space();
				td2 = element("td");
				t4 = text(t4_value);
				t5 = space();
				td3 = element("td");
				if_block.c();
				t6 = space();
				td4 = element("td");
				img = element("img");
				t7 = space();
				add_location(b, file$b, 301, 26, 9985);
				add_location(td0, file$b, 301, 22, 9981);
				add_location(td1, file$b, 302, 22, 10036);
				add_location(td2, file$b, 303, 22, 10097);
				add_location(td3, file$b, 304, 22, 10157);
				img.src = img_src_value = "./evaluation/" + ctx.foodRating.rating + ".png";
				img.className = "bewertung svelte-1m06vzk";
				img.alt = "bewertung";
				add_location(img, file$b, 313, 26, 10486);
				add_location(td4, file$b, 313, 22, 10482);
				add_location(tr, file$b, 300, 20, 9953);
			},

			m: function mount(target, anchor) {
				insert(target, tr, anchor);
				append(tr, td0);
				append(td0, b);
				append(b, t0);
				append(tr, t1);
				append(tr, td1);
				append(td1, t2);
				append(tr, t3);
				append(tr, td2);
				append(td2, t4);
				append(tr, t5);
				append(tr, td3);
				if_block.m(td3, null);
				append(tr, t6);
				append(tr, td4);
				append(td4, img);
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

				if (current_block_type !== (current_block_type = select_block_type(ctx))) {
					if_block.d(1);
					if_block = current_block_type(ctx);
					if (if_block) {
						if_block.c();
						if_block.m(td3, null);
					}
				}

				if ((changed.newList) && img_src_value !== (img_src_value = "./evaluation/" + ctx.foodRating.rating + ".png")) {
					img.src = img_src_value;
				}
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(tr);
				}

				if_block.d();
			}
		};
	}

	function create_fragment$b(ctx) {
		var button0, t1, div9, h10, t2, t3_value = ctx.thisUser.user_name, t3, t4, t5, div4, div3, h11, button1, b0, t7, div2, div1, div0, t8, br, t9, div8, div7, h12, button2, b1, t11, div6, div5, button3, i0, t12, t13, input, t14, table, thead, tr, th0, t16, th1, t17, i1, t18, th2, t19, i2, t20, th3, t21, i3, t22, th4, t23, tbody, current, dispose;

		var if_block = (ctx.adminBool) && create_if_block_2$1(ctx);

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
				div9 = element("div");
				h10 = element("h1");
				t2 = text("Evaluation ");
				t3 = text(t3_value);
				t4 = space();
				if (if_block) if_block.c();
				t5 = space();
				div4 = element("div");
				div3 = element("div");
				h11 = element("h1");
				button1 = element("button");
				b0 = element("b");
				b0.textContent = "Nach Kategorien";
				t7 = space();
				div2 = element("div");
				div1 = element("div");
				div0 = element("div");

				for (var i = 0; i < each_blocks_1.length; i += 1) {
					each_blocks_1[i].c();
				}

				t8 = space();
				br = element("br");
				t9 = space();
				div8 = element("div");
				div7 = element("div");
				h12 = element("h1");
				button2 = element("button");
				b1 = element("b");
				b1.textContent = "Nach einzelnen Lebensmitteln";
				t11 = space();
				div6 = element("div");
				div5 = element("div");
				button3 = element("button");
				i0 = element("i");
				t12 = text(" Excel");
				t13 = space();
				input = element("input");
				t14 = space();
				table = element("table");
				thead = element("thead");
				tr = element("tr");
				th0 = element("th");
				th0.textContent = "#";
				t16 = space();
				th1 = element("th");
				t17 = text("Name ");
				i1 = element("i");
				t18 = space();
				th2 = element("th");
				t19 = text("Kategorie ");
				i2 = element("i");
				t20 = space();
				th3 = element("th");
				t21 = text("Bewertung ");
				i3 = element("i");
				t22 = space();
				th4 = element("th");
				t23 = space();
				tbody = element("tbody");

				for (var i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].c();
				}
				button0.className = "btn btn-secondary position-absolute top-0 end-0 svelte-1m06vzk";
				button0.type = "button";
				add_location(button0, file$b, 205, 0, 5672);
				h10.className = "text-center";
				add_location(h10, file$b, 209, 2, 5843);
				add_location(b0, file$b, 254, 10, 7853);
				button1.className = "accordion-button";
				button1.type = "button";
				button1.dataset.bsToggle = "collapse";
				button1.dataset.bsTarget = "#collapseCategories";
				attr(button1, "aria-expanded", "true");
				attr(button1, "aria-controls", "collapseOne");
				add_location(button1, file$b, 253, 8, 7682);
				h11.className = "accordion-header";
				h11.id = "headingCategories";
				add_location(h11, file$b, 252, 6, 7620);
				div0.className = "accordion";
				div0.id = "accordionExample2";
				add_location(div0, file$b, 259, 10, 8102);
				div1.className = "accordion-body";
				add_location(div1, file$b, 258, 8, 8062);
				div2.id = "collapseCategories";
				div2.className = "accordion-collapse collapse";
				attr(div2, "aria-labelledby", "headingCategories");
				div2.dataset.bsParent = "#accordionExample1";
				add_location(div2, file$b, 257, 6, 7915);
				div3.className = "accordion-item";
				add_location(div3, file$b, 251, 4, 7584);
				div4.className = "accordion";
				div4.id = "accordionExample1";
				add_location(div4, file$b, 250, 2, 7532);
				add_location(br, file$b, 272, 2, 8395);
				add_location(b1, file$b, 278, 10, 8720);
				button2.className = "accordion-button";
				button2.type = "button";
				button2.dataset.bsToggle = "collapse";
				button2.dataset.bsTarget = "#collapseRating";
				attr(button2, "aria-expanded", "true");
				attr(button2, "aria-controls", "collapseOne");
				add_location(button2, file$b, 277, 8, 8553);
				h12.className = "accordion-header";
				h12.id = "headingRating";
				add_location(h12, file$b, 275, 6, 8493);
				i0.className = "fa-regular fa-file-excel";
				add_location(i0, file$b, 286, 112, 9098);
				button3.className = "btn btn-success float-right svelte-1m06vzk";
				add_location(button3, file$b, 286, 12, 8998);
				input.className = "form-control";
				input.id = "myInput";
				attr(input, "type", "text");
				input.placeholder = "Suchen nach Name, Kategorie oder Bewertung...";
				add_location(input, file$b, 287, 12, 9167);
				th0.scope = "col";
				th0.className = "svelte-1m06vzk";
				add_location(th0, file$b, 291, 18, 9394);
				i1.className = "fa-solid fa-sort";
				add_location(i1, file$b, 292, 69, 9487);
				th1.scope = "col";
				th1.className = "svelte-1m06vzk";
				add_location(th1, file$b, 292, 18, 9436);
				i2.className = "fa-solid fa-sort";
				add_location(i2, file$b, 293, 74, 9600);
				th2.scope = "col";
				th2.className = "svelte-1m06vzk";
				add_location(th2, file$b, 293, 18, 9544);
				i3.className = "fa-solid fa-sort";
				add_location(i3, file$b, 294, 74, 9713);
				th3.scope = "col";
				th3.className = "svelte-1m06vzk";
				add_location(th3, file$b, 294, 18, 9657);
				th4.scope = "col";
				th4.className = "svelte-1m06vzk";
				add_location(th4, file$b, 295, 18, 9770);
				add_location(tr, file$b, 290, 16, 9370);
				add_location(thead, file$b, 289, 14, 9345);
				tbody.id = "single-food-table";
				add_location(tbody, file$b, 298, 14, 9854);
				table.className = "table";
				table.id = "myTable2";
				add_location(table, file$b, 288, 12, 9294);
				div5.className = "accordion-body";
				add_location(div5, file$b, 284, 8, 8944);
				div6.id = "collapseRating";
				div6.className = "accordion-collapse collapse";
				attr(div6, "aria-labelledby", "headingRating");
				div6.dataset.bsParent = "#accordionExample1";
				add_location(div6, file$b, 283, 6, 8805);
				div7.className = "accordion-item";
				add_location(div7, file$b, 274, 4, 8457);
				div8.className = "accordion";
				div8.id = "accordionExample1";
				add_location(div8, file$b, 273, 2, 8405);
				div9.className = "mx-auto";
				set_style(div9, "width", "80%");
				add_location(div9, file$b, 208, 0, 5798);

				dispose = [
					listen(button0, "click", ausloggen),
					listen(button3, "click", ctx.click_handler),
					listen(th1, "click", ctx.click_handler_1),
					listen(th2, "click", ctx.click_handler_2),
					listen(th3, "click", ctx.click_handler_3)
				];
			},

			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},

			m: function mount(target, anchor) {
				insert(target, button0, anchor);
				insert(target, t1, anchor);
				insert(target, div9, anchor);
				append(div9, h10);
				append(h10, t2);
				append(h10, t3);
				append(div9, t4);
				if (if_block) if_block.m(div9, null);
				append(div9, t5);
				append(div9, div4);
				append(div4, div3);
				append(div3, h11);
				append(h11, button1);
				append(button1, b0);
				append(div3, t7);
				append(div3, div2);
				append(div2, div1);
				append(div1, div0);

				for (var i = 0; i < each_blocks_1.length; i += 1) {
					each_blocks_1[i].m(div0, null);
				}

				append(div9, t8);
				append(div9, br);
				append(div9, t9);
				append(div9, div8);
				append(div8, div7);
				append(div7, h12);
				append(h12, button2);
				append(button2, b1);
				append(div7, t11);
				append(div7, div6);
				append(div6, div5);
				append(div5, button3);
				append(button3, i0);
				append(button3, t12);
				append(div5, t13);
				append(div5, input);
				append(div5, t14);
				append(div5, table);
				append(table, thead);
				append(thead, tr);
				append(tr, th0);
				append(tr, t16);
				append(tr, th1);
				append(th1, t17);
				append(th1, i1);
				append(tr, t18);
				append(tr, th2);
				append(th2, t19);
				append(th2, i2);
				append(tr, t20);
				append(tr, th3);
				append(th3, t21);
				append(th3, i3);
				append(tr, t22);
				append(tr, th4);
				append(table, t23);
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
						if_block = create_if_block_2$1(ctx);
						if_block.c();
						if_block.m(div9, t5);
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
							each_blocks_1[i].m(div0, null);
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
					detach(div9);
				}

				if (if_block) if_block.d();

				destroy_each(each_blocks_1, detaching);

				destroy_each(each_blocks, detaching);

				run_all(dispose);
			}
		};
	}

	function sortTable(n) {
	  var table, rows, switching, i, x, y, shouldSwitch, dir, switchcount = 0;
	  table = document.getElementById("myTable2");
	  switching = true;
	  // Set the sorting direction to ascending:
	  dir = "asc";
	  /* Make a loop that will continue until
	  no switching has been done: */
	  while (switching) {
	    // Start by saying: no switching is done:
	    switching = false;
	    rows = table.rows;
	    /* Loop through all table rows (except the
	    first, which contains table headers): */
	    for (i = 1; i < (rows.length - 1); i++) {
	      // Start by saying there should be no switching:
	      shouldSwitch = false;
	      /* Get the two elements you want to compare,
	      one from current row and one from the next: */
	      x = rows[i].getElementsByTagName("TD")[n];
	      y = rows[i + 1].getElementsByTagName("TD")[n];
	      /* Check if the two rows should switch place,
	      based on the direction, asc or desc: */
	      if (dir == "asc") {
	        if (x.innerHTML.toLowerCase() > y.innerHTML.toLowerCase()) {
	          // If so, mark as a switch and break the loop:
	          shouldSwitch = true;
	          break;
	        }
	      } else if (dir == "desc") {
	        if (x.innerHTML.toLowerCase() < y.innerHTML.toLowerCase()) {
	          // If so, mark as a switch and break the loop:
	          shouldSwitch = true;
	          break;
	        }
	      }
	    }
	    if (shouldSwitch) {
	      /* If a switch has been marked, make the switch
	      and mark that a switch has been done: */
	      rows[i].parentNode.insertBefore(rows[i + 1], rows[i]);
	      switching = true;
	      // Each time a switch is done, increase this count by 1:
	      switchcount ++;
	    } else {
	      /* If no switching has been done AND the direction is "asc",
	      set the direction to "desc" and run the while loop again. */
	      if (switchcount == 0 && dir == "asc") {
	        dir = "desc";
	        switching = true;
	      }
	    }
	  }
	}

	function exportTableToExcel (username) {
	    let date = new Date().toJSON();

	    jQuery(document).ready(function () {
	    jQuery("#myTable2").table2excel({
	        filename: "Evaluation_" + username + "_" + date + ".xls"
	    });
	  });
	}

	function instance$9($$self, $$props, $$invalidate) {
		

	  

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

	  //Suchtabelle einzelne Lebensmittel    
	  jQuery(document).ready(function(){
	  jQuery("#myInput").on("keyup", function() {
	    var value = jQuery(this).val().toLowerCase();
	    jQuery("#single-food-table tr").filter(function() {
	      jQuery(this).toggle(jQuery(this).text().toLowerCase().indexOf(value) > -1);
	    });
	  });
	  });

		function input_input_handler() {
			user_name = this.value;
			$$invalidate('user_name', user_name);
		}

		function click_handler() {
			return exportTableToExcel(thisUser.user_name);
		}

		function click_handler_1() {
			return sortTable(1);
		}

		function click_handler_2() {
			return sortTable(2);
		}

		function click_handler_3() {
			return sortTable(3);
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
			input_input_handler,
			click_handler,
			click_handler_1,
			click_handler_2,
			click_handler_3
		};
	}

	class Evaluationpage extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$9, create_fragment$b, safe_not_equal, []);
		}
	}

	/* src\app\routing\Router.svelte generated by Svelte v3.1.0 */

	const file$c = "src\\app\\routing\\Router.svelte";

	function create_fragment$c(ctx) {
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
				main.className = "svelte-12zwhwq";
				add_location(main, file$c, 40, 0, 787);
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

	function instance$a($$self, $$props, $$invalidate) {
		
	 
	  let value = Notfound;

	  hash.subscribe( valu => {
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
			init(this, options, instance$a, create_fragment$c, safe_not_equal, []);
		}
	}

	/* src\app\component\Sidenav.svelte generated by Svelte v3.1.0 */

	const file$d = "src\\app\\component\\Sidenav.svelte";

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

	function create_fragment$d(ctx) {
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
				add_location(h1, file$d, 22, 2, 300);
				li0.className = "svelte-1qeq5wx";
				add_location(li0, file$d, 25, 4, 335);
				li1.className = "svelte-1qeq5wx";
				add_location(li1, file$d, 29, 4, 406);
				li2.className = "svelte-1qeq5wx";
				add_location(li2, file$d, 33, 4, 485);
				ul.className = "svelte-1qeq5wx";
				add_location(ul, file$d, 23, 2, 323);
				nav.className = "svelte-1qeq5wx";
				add_location(nav, file$d, 21, 0, 291);
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
			init(this, options, null, create_fragment$d, safe_not_equal, []);
		}
	}

	/* src\App.svelte generated by Svelte v3.1.0 */

	const file$e = "src\\App.svelte";

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

	function create_fragment$e(ctx) {
		var div, t, current;

		var if_block = (ctx.adminRigths) && create_if_block$3(ctx);

		var router = new Router({ $$inline: true });

		return {
			c: function create() {
				div = element("div");
				if (if_block) if_block.c();
				t = space();
				router.$$.fragment.c();
				div.className = "app-shell svelte-17simda";
				add_location(div, file$e, 27, 0, 419);
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

	function instance$b($$self, $$props, $$invalidate) {
		

	  let adminRigths;

	  admin.subscribe(value => {
			$$invalidate('adminRigths', adminRigths = value);
		});

		return { adminRigths };
	}

	class App extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$b, create_fragment$e, safe_not_equal, []);
		}
	}

	const app = new App({
		target: document.body.querySelector('#app')
	});

	return app;

}());
//# sourceMappingURL=bundle.js.map
