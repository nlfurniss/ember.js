import { CONSTANT_TAG, UpdatableTag, DirtyableTag, combine } from '@glimmer/reference';
import { meta as metaFor } from './meta';
import { isProxy } from './is_proxy';
import run from './run_loop';

let hasViews = () => false;

export function setHasViews(fn) {
  hasViews = fn;
}

function makeTag() {
  return DirtyableTag.create();
}

export const TRACKED_GETTERS = new WeakMap();

export function tagForProperty(object, propertyKey, _meta) {
  if (typeof object !== 'object' || object === null) { return CONSTANT_TAG; }

  if (isProxy(object)) {
    return tagFor(object, meta);
  }

  let meta = _meta === undefined ? metaFor(object) : _meta;
  let tags = meta.writableTags();
  let tag = tags[propertyKey];
  if (tag) { return tag; }

  let pair = combine([DirtyableTag.create(), UpdatableTag.create(CONSTANT_TAG)]);
  return tags[propertyKey] = pair;
}

export function tagFor(object, _meta) {
  if (typeof object === 'object' && object !== null) {
    let meta = _meta === undefined ? metaFor(object) : _meta;
    return meta.writableTag(makeTag);
  } else {
    return CONSTANT_TAG;
  }
}

export function dirty(tag) {
  tag.inner.first.inner.dirty();
}

export function update(outer, inner) {
  outer.inner.second.inner.update(inner);
}

export function markObjectAsDirty(obj, propertyKey, meta) {
  let objectTag = meta.readableTag();
  let tags = meta.readableTags();
  let propertyTag = tags !== undefined ? tags[propertyKey] : undefined;

  if (objectTag !== undefined) {
    if (isProxy(obj)) {
      objectTag.inner.first.inner.dirty();
    } else {
      objectTag.inner.dirty();
    }
  }

  if (propertyTag !== undefined) {
    dirty(propertyTag);
  }

  if (objectTag !== undefined || propertyTag !== undefined) {
    ensureRunloop();
  }
}

let backburner;
function ensureRunloop() {
  if (backburner === undefined) {
    backburner = run.backburner;
  }

  if (hasViews()) {
    backburner.ensureInstance();
  }
}
