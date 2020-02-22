import { commitPropUpdates } from './props';
import options from '../options';
import { commitChildren } from './children';

/**
 * @param {import('../internal').VNode} root
 */
export function commitRoot(parentDom, root) {
	let commitQueue = [];
	commit(parentDom, root, commitQueue);
	if (options._commit) options._commit(root, commitQueue);
	commitQueue.some(c => {
		try {
			commitQueue = c._renderCallbacks;
			c._renderCallbacks = [];
			commitQueue.some(cb => {
				cb.call(c);
			});
		} catch (e) {
			options._catchError(e, c._vnode);
		}
	});
}

export const commit = (parentDom, vnode, queue) => {
	if (!vnode || vnode.constructor !== undefined) return null;
	let dom = vnode._dom,
		oldDom = vnode._oldDom;
	if (typeof vnode.type === 'function') {
		let c = vnode._component;

		if (c.isNew && c.componentDidMount) {
			c._renderCallbacks.push(c.componentDidMount);
		}

		queue.push(c);
		if (c._bail) {
			return dom;
		}

		if (!c.isNew && c.componentDidUpdate) {
			c._renderCallbacks.push(() =>
				c.componentDidUpdate(c.props, c.state, c._snapshot)
			);
		}

		commitChildren(parentDom, vnode, queue);
	} else {
		if (!oldDom) {
			if (vnode.type == null) {
				return document.createTextNode(vnode.props);
			}

			dom =
				vnode.type === 'svg'
					? document.createElementNS('http://www.w3.org/2000/svg', vnode.type)
					: document.createElement(vnode.type);
		}

		if (vnode.type == null && dom.data != vnode.props) {
			dom.data = vnode.props;
		}

		commitPropUpdates(dom, vnode._updates, false);
		commitChildren(dom, vnode, queue);

		if (vnode.type) {
			if (
				'value' in vnode.props &&
				vnode.props.value !== undefined &&
				vnode.props.value !== dom.value
			) {
				dom.value = vnode.props.value == null ? '' : vnode.props.value;
			}
			if (
				'checked' in vnode.props &&
				vnode.props.checked !== undefined &&
				vnode.props.checked !== dom.checked
			) {
				dom.checked = vnode.props.checked;
			}
		}
	}

	return dom;
};
