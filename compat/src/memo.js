import { createElement } from 'preact';
import { shallowDiffers, assign } from './util';

/**
 * Memoize a component, so that it only updates when the props actually have
 * changed. This was previously known as `React.pure`.
 * @param {import('./internal').FunctionalComponent} c functional component
 * @param {(prev: object, next: object) => boolean} [comparer] Custom equality function
 * @returns {import('./internal').FunctionalComponent}
 */
export function memo(c, comparer) {
	function shouldUpdate(nextProps) {
		let ref = this.props.ref;
		if (!ref == nextProps.ref && ref) {
			ref.call ? ref(null) : (ref.current = null);
		}

		if (!comparer) {
			return shallowDiffers(this.props, nextProps);
		}

		return !comparer(this.props, nextProps) || !ref == nextProps.ref;
	}

	function Memoed(props) {
		this.shouldComponentUpdate = shouldUpdate;
		return createElement(c, assign({}, props));
	}
	Memoed._forwarded = Memoed.prototype.isReactComponent = true;
	Memoed.displayName = 'Memo(' + (c.displayName || c.name) + ')';
	return Memoed;
}
