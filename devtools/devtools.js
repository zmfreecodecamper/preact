/* global __REACT_DEVTOOLS_GLOBAL_HOOK__ */

import { options } from 'preact';

// Internal helpers from preact
import { ATTR_KEY } from '../src/constants';

const EMPTY_ARRAY = [];

const MapImpl = typeof WeakMap!=='undefined' ? WeakMap : typeof Map!=='undefined' ? Map : Object;

/** Quicker Array.from ponyfill */
function toArray(arrayLike) {
	let arr = [];
	for (let i=arrayLike.length; i--; ) arr[i] = arrayLike[i];
	return arr;
}


/**
 * Return a ReactElement-compatible object for the current state of a preact
 * component.
 */
function createReactElement(component) {
	return {
		type: component.constructor,
		key: component.key,
		ref: null, // Unsupported
		props: component.props
	};
}


const domComponentMapping = new MapImpl();


/**
 * Create a ReactDOMComponent-compatible object for a given DOM node rendered
 * by preact.
 *
 * This implements the subset of the ReactDOMComponent interface that
 * React DevTools requires in order to display DOM nodes in the inspector with
 * the correct type and properties.
 *
 * @param {Node} node
 */
function createReactDOMComponent(node) {
	let isText = node.nodeType === Node.TEXT_NODE;

	// --- ReactDOMComponent interface

	// let instance = node.__devToolsInstance;
	let instance = domComponentMapping.get(node);

	if (!instance) {
		// instance = node.__devToolsInstance = {
		instance = {
			// __childNodes: isText ? EMPTY_ARRAY : toArray(node.childNodes),
			__childNodes: node.childNodes,

			// --- Additional properties used by preact devtools
			// get _renderedChildren() {
			// 	return childNodes.map( child => updateReactComponent(child._component || child) );
			// },

			// A flag indicating whether the devtools have been notified about the
			// existence of this component instance yet.
			_inDevTools: false,

			// This is used to send the appropriate notifications when DOM components
			// are added or updated between composite component updates.
			node
		};

		domComponentMapping.set(node, instance);

		Object.defineProperty(instance, '_renderedChildren', {
			get: getSanitizedChildren
		});
	}

	instance._currentElement = isText ? node.nodeValue : {
		type: node.nodeName.toLowerCase(),
		props: node[ATTR_KEY]
	};

	instance._stringText = isText ? node.nodeValue : null;

	return instance;
}


function getSanitizedChildren() {
	return this.__childNodes ? EMPTY_ARRAY.map.call(this.__childNodes, getSanitizedChild) : EMPTY_ARRAY;
	// return this.__childNodes.map(getSanitizedChild);
}

function getSanitizedChild(child) {
	return updateReactComponent(child._component || child);
}

/**
 * Return the name of a component created by a `ReactElement`-like object.
 *
 * @param {ReactElement} element
 */
function typeName(element) {
	if (typeof element.type === 'function') {
		return element.type.displayName || element.type.name;
	}
	return element.type;
}

/** Hoisted ReactCompositeComponent method to return displayName/name of wrapped component */
function getCompositeComponentName() {
	return typeName(this._currentElement);
}

/** Hoisted proxy for ReactCompositeComponent.forceUpdate */
function forceUpdateParentComponent(...args) {
	if (this._instance.forceUpdate) this._instance.forceUpdate(...args);
}

/** Hoisted proxy for ReactCompositeComponent.setState */
function setStateParentComponent(...args) {
	if (this._instance.setState) this._instance.setState(...args);
}

/** Hoisted ReactCompositeComponent._renderedComponent getter */
function getCompositeRenderedComponent() {
	return updateReactComponent(this._instance._component || this._instance.base);
	// return updateReactComponent(this.node._component || this.node);
}


const compositeComponentMapping = new MapImpl();


/**
 * Return a ReactCompositeComponent-compatible object for a given preact
 * component instance.
 *
 * This implements the subset of the ReactCompositeComponent interface that
 * the DevTools requires in order to walk the component tree and inspect the
 * component's properties.
 *
 * See https://github.com/facebook/react-devtools/blob/e31ec5825342eda570acfc9bcb43a44258fceb28/backend/getData.js
 */
function createReactCompositeComponent(component) {
	const _currentElement = createReactElement(component);
	const node = component.base;

	// let instance = component.__devToolsInstance;
	let instance = compositeComponentMapping.get(component);

	if (!instance) {
		// instance = component.__devToolsInstance = {
		instance = {
			// --- ReactDOMComponent properties
			_currentElement,
			getName: getCompositeComponentName,
			forceUpdate: forceUpdateParentComponent,
			setState: setStateParentComponent,
			props: component.props,
			state: component.state,

			// --- Additional properties used by preact devtools

			// React DevTools exposes the `_instance` field of the selected item in the
			// component tree as `$r` in the console.  `_instance` must refer to a
			// React Component (or compatible) class instance with `props` and `state`
			// fields and `setState()`, `forceUpdate()` methods.
			// _instance: instance,
			_instance: component,

			node
		};

		compositeComponentMapping.set(component, instance);

		Object.defineProperty(instance, '_renderedComponent', { get: getCompositeRenderedComponent });
	}

	// these are updated on every pass.
	instance.props = component.props;
	instance.state = component.state;
	instance.context = component.context;

	// If the root node returned by this component instance's render function
	// was itself a composite component, there will be a `_component` property
	// containing the child component instance.
	// if (component._component) {
	// 	instance._renderedComponent = updateReactComponent(component._component);
	// }
	// else {
	// 	// Otherwise, if the render() function returned an HTML/SVG element,
	// 	// create a ReactDOMComponent-like object for the DOM node itself.
	// 	instance._renderedComponent = updateReactComponent(node);
	// }

	return instance;
}


/**
 * Map of Component|Node to ReactDOMComponent|ReactCompositeComponent-like
 * object.
 *
 * The same React*Component instance must be used when notifying devtools
 * about the initial mount of a component and subsequent updates.
 */
let instanceMap = new MapImpl();

/**
 * Update (and create if necessary) the ReactDOMComponent|ReactCompositeComponent-like
 * instance for a given preact component instance or DOM Node.
 *
 * @param {Component|Node} componentOrNode
 */
function updateReactComponent(componentOrNode) {
	const newInstance = componentOrNode instanceof Node ?
		createReactDOMComponent(componentOrNode) :
		createReactCompositeComponent(componentOrNode);
	if (!instanceMap.has(componentOrNode)) {
		instanceMap.set(componentOrNode, newInstance);
	}
	// if (instanceMap.has(componentOrNode)) {
	// 	let inst = instanceMap.get(componentOrNode);
	//	Object.assign(inst, newInstance);
	// 	return inst;
	// }
	// instanceMap.set(componentOrNode, newInstance);
	return newInstance;
}

function nextRootKey(roots) {
	return '.' + Object.keys(roots).length;
}

/**
 * Find all root component instances rendered by preact in `node`'s children
 * and add them to the `roots` map.
 *
 * @param {DOMElement} node
 * @param {[key: string] => ReactDOMComponent|ReactCompositeComponent}
 */
function findRoots(node, roots) {
	if (node._component) {
		roots[nextRootKey(roots)] = updateReactComponent(node._component);
	}
	else {
		let child = node.firstChild;
		while (child) {
			findRoots(child, roots);
			child = child.nextSibling;
		}
	}
}

/**
 * Create a bridge for exposing preact's component tree to React DevTools.
 *
 * It creates implementations of the interfaces that ReactDOM passes to
 * devtools to enable it to query the component tree and hook into component
 * updates.
 *
 * See https://github.com/facebook/react/blob/59ff7749eda0cd858d5ee568315bcba1be75a1ca/src/renderers/dom/ReactDOM.js
 * for how ReactDOM exports its internals for use by the devtools and
 * the `attachRenderer()` function in
 * https://github.com/facebook/react-devtools/blob/e31ec5825342eda570acfc9bcb43a44258fceb28/backend/attachRenderer.js
 * for how the devtools consumes the resulting objects.
 */
function createDevToolsBridge() {
	// The devtools has different paths for interacting with the renderers from
	// React Native, legacy React DOM and current React DOM.
	//
	// Here we emulate the interface for the current React DOM (v15+) lib.

	// ReactDOMComponentTree-like object
	const ComponentTree = {
		getNodeFromInstance(instance) {
			return instance.node;
		},
		getClosestInstanceFromNode(node) {
			while (node && !node._component) {
				node = node.parentNode;
			}
			return node ? updateReactComponent(node._component) : null;
		}
	};

	// Map of root ID (the ID is unimportant) to component instance.
	let roots = {};
	findRoots(document.body, roots);

	// ReactMount-like object
	//
	// Used by devtools to discover the list of root component instances and get
	// notified when new root components are rendered.
	const Mount = {
		_instancesByReactRootID: roots,

		// Stub - React DevTools expects to find this method and replace it
		// with a wrapper in order to observe new root components being added
		_renderNewRootComponent(/* instance, ... */) { }
	};

	// ReactReconciler-like object
	const Reconciler = {
		// Stubs - React DevTools expects to find these methods and replace them
		// with wrappers in order to observe components being mounted, updated and
		// unmounted
		mountComponent(/* instance, ... */) { },
		performUpdateIfNecessary(/* instance, ... */) { },
		receiveComponent(/* instance, ... */) { },
		unmountComponent(/* instance, ... */) { }
	};

	/** Notify devtools that a new component instance has been mounted into the DOM. */
	const componentAdded = component => {
		const instance = updateReactComponent(component);
		if (isRootComponent(component)) {
			instance._rootID = nextRootKey(roots);
			roots[instance._rootID] = instance;
			Mount._renderNewRootComponent(instance);
		}
		visitNonCompositeChildren(instance, childInst => {
			childInst._inDevTools = true;
			Reconciler.mountComponent(childInst);
		});
		Reconciler.mountComponent(instance);
	};

	/** Notify devtools that a component has been updated with new props/state. */
	const componentUpdated = component => {
		const prevRenderedChildren = [];
		// visitNonCompositeChildren(instanceMap.get(component), childInst => {
		visitNonCompositeChildren(updateReactComponent(component), childInst => {
		// visitNonCompositeChildren(component.__devToolsInstance, childInst => {
			prevRenderedChildren.push(childInst);
		});

		// Notify devtools about updates to this component and any non-composite
		// children
		const instance = updateReactComponent(component);
		Reconciler.receiveComponent(instance);
		visitNonCompositeChildren(instance, childInst => {
			if (!childInst._inDevTools) {
				// New DOM child component
				childInst._inDevTools = true;
				Reconciler.mountComponent(childInst);
			} else {
				// Updated DOM child component
				Reconciler.receiveComponent(childInst);
			}
		});

		// For any non-composite children that were removed by the latest render,
		// remove the corresponding ReactDOMComponent-like instances and notify
		// the devtools
		prevRenderedChildren.forEach(childInst => {
			if (!document.body.contains(childInst.node)) {
				instanceMap.delete(childInst.node);
				Reconciler.unmountComponent(childInst);
			}
		});
	};

	/** Notify devtools that a component has been unmounted from the DOM. */
	const componentRemoved = component => {
		const instance = updateReactComponent(component);
		visitNonCompositeChildren(childInst => {
			instanceMap.delete(childInst.node);
			Reconciler.unmountComponent(childInst);
		});
		Reconciler.unmountComponent(instance);
		instanceMap.delete(component);
		if (instance._rootID) {
			delete roots[instance._rootID];
		}
	};

	return {
		componentAdded,
		componentUpdated,
		componentRemoved,

		// Interfaces passed to devtools via __REACT_DEVTOOLS_GLOBAL_HOOK__.inject()
		ComponentTree,
		Mount,
		Reconciler
	};
}

/**
 * Return `true` if a preact component is a top level component rendered by
 * `render()` into a container Element.
 */
function isRootComponent(component) {
	// `_parentComponent` is actually `__u` after minification
	if (component._parentComponent || component.__u) {
		// Component with a composite parent
		return false;
	}
	if (component.base.parentElement && component.base.parentElement[ATTR_KEY]) {
		// Component with a parent DOM element rendered by Preact
		return false;
	}
	return true;
}

/**
 * Visit all child instances of a ReactCompositeComponent-like object that are
 * not composite components (ie. they represent DOM elements or text)
 *
 * @param {Component} component
 * @param {(Component) => void} visitor
 */
function visitNonCompositeChildren(component, visitor) {
	// if (component._renderedComponent) {
	// 	if (!component._renderedComponent._component) {
	// 		visitor(component._renderedComponent);
	// 		visitNonCompositeChildren(component._renderedComponent, visitor);
	// 	}
	// } else if (component._renderedChildren) {
	// 	component._renderedChildren.forEach(child => {
	// 		visitor(child);
	// 		if (!child._component) visitNonCompositeChildren(child, visitor);
	// 	});
	// }
	if (component._renderedComponent) {
		if (!component._renderedComponent._component) {
			visitor(component._renderedComponent);
			visitNonCompositeChildren(component._renderedComponent, visitor);
		}
	}
	else if (component._renderedChildren) {
		let children = component._renderedChildren;
		for (let i=0; i<children.length; i++) {
			let child = children[i];
			visitor(child);
			if (!child._component) visitNonCompositeChildren(child, visitor);
		}
	}
}

/**
 * Create a bridge between the preact component tree and React's dev tools
 * and register it.
 *
 * After this function is called, the React Dev Tools should be able to detect
 * "React" on the page and show the component tree.
 *
 * This function hooks into preact VNode creation in order to expose functional
 * components correctly, so it should be called before the root component(s)
 * are rendered.
 *
 * Returns a cleanup function which unregisters the hooks.
 */
export function initDevTools() {
	if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ === 'undefined') {
		// React DevTools are not installed
		return;
	}

	// Notify devtools when preact components are mounted, updated or unmounted
	const bridge = createDevToolsBridge();

	const nextAfterMount = options.afterMount;
	options.afterMount = component => {
		bridge.componentAdded(component);
		if (nextAfterMount) nextAfterMount(component);
	};

	const nextAfterUpdate = options.afterUpdate;
	options.afterUpdate = component => {
		bridge.componentUpdated(component);
		if (nextAfterUpdate) nextAfterUpdate(component);
	};

	const nextBeforeUnmount = options.beforeUnmount;
	options.beforeUnmount = component => {
		bridge.componentRemoved(component);
		if (nextBeforeUnmount) nextBeforeUnmount(component);
	};

	// Notify devtools about this instance of "React"
	__REACT_DEVTOOLS_GLOBAL_HOOK__.inject(bridge);

	return () => {
		options.afterMount = nextAfterMount;
		options.afterUpdate = nextAfterUpdate;
		options.beforeUnmount = nextBeforeUnmount;
	};
}
