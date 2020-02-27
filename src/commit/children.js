import { commit } from './index';
import { unmount } from '../diff';

export const commitChildren = (parentDom, vnode, q) => {
	let children = vnode._children || [],
		firstChildDom,
		sibDom,
		j,
		oldDom;

	// Iterate over updated children
	children.forEach(childVNode => {
		if (childVNode == null) return;

		oldDom = oldDom || childVNode._oldDom;
		let newDom = (childVNode._dom = commit(parentDom, childVNode, q));

		if (newDom != null) {
			if (firstChildDom == null) {
				firstChildDom = newDom;
			}

			if (childVNode._lastDomChild != null) {
				newDom = childVNode._lastDomChild;
				childVNode._lastDomChild = null;
			} else if (newDom != oldDom || newDom.parentNode == null) {
				outer: if (oldDom == null || oldDom.parentNode !== parentDom) {
					parentDom.appendChild(newDom);
				} else {
					for (
						sibDom = oldDom, j = 0;
						(sibDom = sibDom.nextSibling) && j < vnode._oldChildrenLength;
						j += 2
					) {
						if (sibDom == newDom) {
							break outer;
						}
					}
					parentDom.insertBefore(newDom, oldDom);
				}

				if (vnode.type == 'option') {
					parentDom.value = '';
				}
			}

			oldDom = newDom.nextSibling;

			if (typeof vnode.type == 'function') {
				vnode._lastDomChild = newDom;
			}
		}
	});

	if (vnode._toRemove) {
		vnode._toRemove.forEach(v => {
			unmount(v, vnode);
		});
	}
};
