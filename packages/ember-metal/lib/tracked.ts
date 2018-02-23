import { combine, CONSTANT_TAG, CURRENT_TAG, DirtyableTag, Tag, TagWrapper, UpdatableTag } from '@glimmer/reference';

import {
  MANDATORY_SETTER
} from 'ember/features';
import { meta as metaFor } from './meta';
import { markObjectAsDirty, tagFor, tagForProperty } from './tags';

type Option<T> = T | null;
type unknown = null | undefined | void | {};

interface Dict<T> {
  [key: string]: T;
}

function dict<T>(): Dict<T> {
  return Object.create(null);
}

function mark(obj: unknown, key: string | symbol) {
  let meta = metaFor(obj);
  markObjectAsDirty(meta, key);
}

/**
 * An object that that tracks @tracked properties that were consumed.
 */
class Tracker {
  private tags = new Set<Tag>();

  add(tag: Tag) {
    this.tags.add(tag);
  }

  combine(): Tag {
    let tags: Tag[] = [];
    this.tags.forEach(tag => tags.push(tag));
    return combine(tags);
  }
}

/**
 * @decorator
 *
 * Marks a property as tracked.
 *
 * By default, a component's properties are expected to be static,
 * meaning you are not able to update them and have the template update accordingly.
 * Marking a property as tracked means that when that property changes,
 * a rerender of the component is scheduled so the template is kept up to date.
 *
 * There are two usages for the `@tracked` decorator, shown below.
 *
 * @example No dependencies
 *
 * If you don't pass an argument to `@tracked`, only changes to that property
 * will be tracked:
 *
 * ```typescript
 * import Component, { tracked } from '@glimmer/component';
 *
 * export default class MyComponent extends Component {
 *    @tracked
 *    remainingApples = 10
 * }
 * ```
 *
 * When something changes the component's `remainingApples` property, the rerender
 * will be scheduled.
 *
 * @example Dependents
 *
 * In the case that you have a computed property that depends other
 * properties, you want to track both so that when one of the
 * dependents change, a rerender is scheduled.
 *
 * In the following example we have two properties,
 * `eatenApples`, and `remainingApples`.
 *
 *
 * ```typescript
 * import Component, { tracked } from '@glimmer/component';
 *
 * const totalApples = 100;
 *
 * export default class MyComponent extends Component {
 *    @tracked
 *    eatenApples = 0
 *
 *    @tracked('eatenApples')
 *    get remainingApples() {
 *      return totalApples - this.eatenApples;
 *    }
 *
 *    increment() {
 *      this.eatenApples = this.eatenApples + 1;
 *    }
 *  }
 * ```
 *
 * @param dependencies Optional dependents to be tracked.
 */
export function tracked(target: object, key: string | symbol, descriptor: PropertyDescriptor): PropertyDescriptor {
  if ('value' in descriptor) {
    return descriptorForDataProperty(key, descriptor);
  } else {
    return descriptorForAccessor(key, descriptor);
  }
}

/**
 * Whenever a tracked computed property is entered, the current tracker is
 * saved off and a new tracker is replaced.
 *
 * Any tracked properties consumed are added to the current tracker.
 *
 * When a tracked computed property is exited, the tracker's tags are
 * combined and added to the parent tracker.
 *
 * The consequence is that each tracked computed property has a tag
 * that corresponds to the tracked properties consumed inside of
 * itself, including child tracked computed properties.
 */
let CURRENT_TRACKER: Option<Tracker> = null;

function descriptorForAccessor(key: string | symbol, descriptor: PropertyDescriptor): PropertyDescriptor {
  let get = descriptor.get as Function;
  let set = descriptor.set as Function;

  function getter(this: any) {
    // Swap the parent tracker for a new tracker
    let old = CURRENT_TRACKER;
    let tracker = CURRENT_TRACKER = new Tracker();

    // Call the getter
    let ret = get.call(this);

    // Swap back the parent tracker
    CURRENT_TRACKER = old;

    // Combine the tags in the new tracker and add them to the parent tracker
    let tag = tracker.combine();
    if (CURRENT_TRACKER) CURRENT_TRACKER.add(tag);

    // Update the UpdatableTag for this property with the tag for all of the
    // consumed dependencies.
    mark(this, key);

    return ret;
  }

  function setter(this: unknown) {
    // Bump the global revision counter
    EPOCH.inner.dirty();

    // Mark the UpdatableTag for this property with the current tag.
    mark(this, key);
    set.apply(this, arguments);
  }

  return {
    enumerable: true,
    configurable: false,
    get: get && getter,
    set: set && setter
  };
}

export type Key = string;

/**
  A getter/setter for change tracking for a particular key. The accessor
  acts just like a normal property, but it triggers the `propertyDidChange`
  hook when written to.

  Values are saved on the object using a "shadow key," or a symbol based on the
  tracked property name. Sets write the value to the shadow key, and gets read
  from it.
 */

function descriptorForDataProperty(key, descriptor) {
  let shadowKey = Symbol(key);

  return {
    enumerable: true,
    configurable: true,

    get() {
      if (CURRENT_TRACKER) CURRENT_TRACKER.add(tagForProperty(this, key));

      if (!(shadowKey in this)) {
        this[shadowKey] = descriptor.value;
      }

      return this[shadowKey];
    },

    set(newValue) {
      // Bump the global revision counter
      EPOCH.inner.dirty();

      // Mark the UpdatableTag for this property with the current tag.
      tagForProperty(this, key).inner.update(CURRENT_TAG);
      this[shadowKey] = newValue;
      propertyDidChange();
    }
  };
}

function combinatorForComputedProperties(object: unknown, key: Key, dependencies: Key[] | void): Tag {
  let meta = metaFor(object);

  // Start off with the tag for the CP's own dirty state.
  let tags: Tag[] = [tagForProperty(object, key)];

  // Next, add in all of the tags for its dependencies.
  if (dependencies && dependencies.length) {
    for (let i = 0; i < dependencies.length; i++) {
      tags.push(tagForProperty(object, dependencies[i]));
    }
  }

  // Return a combinator across the CP's tags and its dependencies' tags.
  return combine(tags);
}

export interface Interceptors {
  [key: string]: boolean;
}

let META = Symbol('ember-object');

let hOP = Object.prototype.hasOwnProperty;
function hasOwnProperty(obj: any, key: symbol) {
  return hOP.call(obj, key);
}

const EPOCH = DirtyableTag.create();

let propertyDidChange = function() {};

export function setPropertyDidChange(cb: () => void) {
  propertyDidChange = cb;
}

export class UntrackedPropertyError extends Error {
  static for(obj: any, key: string): UntrackedPropertyError {
    return new UntrackedPropertyError(obj, key, `The property '${key}' on ${obj} was changed after being rendered. If you want to change a property used in a template after the component has rendered, mark the property as a tracked property with the @tracked decorator.`);
  }

  constructor(public target: any, public key: string, message: string) {
    super(message);
  }
}

/**
 * Function that can be used in development mode to generate more meaningful
 * error messages.
 */
export interface UntrackedPropertyErrorThrower {
  (obj: any, key: string): void;
}

function defaultErrorThrower(obj: any, key: string): UntrackedPropertyError {
  throw UntrackedPropertyError.for(obj, key);
}

// export function tagForProperty(obj: any, key: string, throwError: UntrackedPropertyErrorThrower = defaultErrorThrower): Tag {
//   if (typeof obj === 'object' && obj) {
//     if (MANDATORY_SETTER && !hasTag(obj, key)) {
//       installDevModeErrorInterceptor(obj, key, throwError);
//     }

//     let meta = metaFor(obj);
//     return meta.tagFor(key);
//   } else {
//     return CONSTANT_TAG;
//   }
// }

/**
 * In development mode only, we install an ad hoc setter on properties where a
 * tag is requested (i.e., it was used in a template) without being tracked. In
 * cases where the property is set, we raise an error.
 */
function installDevModeErrorInterceptor(obj: object, key: string, throwError: UntrackedPropertyErrorThrower) {
  let target = obj;
  let descriptor: Option<PropertyDescriptor> = null;

  // Find the descriptor for the current property. We may need to walk the
  // prototype chain to do so. If the property is undefined, we may never get a
  // descriptor here.
  let hasOwnDescriptor = true;
  while (target) {
    descriptor = Object.getOwnPropertyDescriptor(target, key);
    if (descriptor) { break; }
    hasOwnDescriptor = false;
    target = Object.getPrototypeOf(target);
  }

  // If possible, define a property descriptor that passes through the current
  // value on reads but throws an exception on writes.
  if (descriptor) {
    let { get, value } = descriptor;

    if (descriptor.configurable || !hasOwnDescriptor) {
      Object.defineProperty(obj, key, {
        configurable: descriptor.configurable,
        enumerable: descriptor.enumerable,

        get() {
          if (get) {
            return get.call(this);
          } else {
            return value;
          }
        },

        set() {
          throwError(this, key);
        }
      });
    }
  } else {
    Object.defineProperty(obj, key, {
      set() {
        throwError(this, key);
      }
    });
  }
}
