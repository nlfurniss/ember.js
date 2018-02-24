import {
  computed,
  defineProperty,
  get,
  set,
  tracked
} from '../..';

import { moduleFor, AbstractTestCase } from 'internal-test-helpers';
import { tagForProperty } from '../..';

moduleFor('tracked get validation', class extends AbstractTestCase {
  [`@test validators for tracked getters with dependencies should invalidate when the dependencies invalidate`](assert) {
    class Tracked {
      constructor(first, last) {
        this.first = first;
        this.last = last;
      }
    }

    track(Tracked, ['first', 'last'], {
      get full() {
        return `${this.first} ${this.last}`;
      }
    });

    let obj = new Tracked('Tom', 'Dale');

    let tag = tagForProperty(obj, 'full');
    let snapshot = tag.value();

    let full = obj.full;
    assert.equal(full, 'Tom Dale');
    assert.equal(tag.validate(snapshot), false);

    snapshot = tag.value();
    assert.equal(tag.validate(snapshot), true);

    obj.first = 'Thomas';
    assert.equal(tag.validate(snapshot), false);

    assert.equal(obj.full, 'Thomas Dale');
    snapshot = tag.value();

    assert.equal(tag.validate(snapshot), true);
  }

  [`@test interaction with Ember object model (tracked property depending on Ember property)`](assert) {
    class Tracked {
      constructor(name) {
        this.name = name;
      }
    }

    track(Tracked, ['name'], {
      get full() {
        return `${get(this.name, 'first')} ${get(this.name, 'last')}`;
      }
    });

    let tom = { first: 'Tom', last: 'Dale' };

    let obj = new Tracked(tom);

    let tag = tagForProperty(obj, 'full');
    let snapshot = tag.value();

    let full = obj.full;
    assert.equal(full, 'Tom Dale');
    assert.equal(tag.validate(snapshot), false);

    snapshot = tag.value();
    assert.equal(tag.validate(snapshot), true);

    set(tom, 'first', 'Thomas');
    assert.equal(tag.validate(snapshot), false, 'invalid after setting with Ember set');

    assert.equal(obj.full, 'Thomas Dale');
    snapshot = tag.value();

    assert.equal(tag.validate(snapshot), true);
  }

  [`@test interaction with Ember object model (Ember computed property depending on tracked property)`](assert) {
    class EmberObject {
      constructor(name) {
        this.name = name;
      }
    }

    defineProperty(EmberObject.prototype, 'full', computed('name', function() {
      let name = get(this, 'name');
      return `${name.first} ${name.last}`;
    }));

    class Name {
      constructor(first, last) {
        this.first = first;
        this.last = last;
      }
    }

    track(Name, ['first', 'last']);

    let tom = new Name('Tom', 'Dale');
    let obj = new EmberObject(tom);

    let tag = tagForProperty(obj, 'full');
    let snapshot = tag.value();

    let full = get(obj, 'full');
    assert.equal(full, 'Tom Dale');
    assert.equal(tag.validate(snapshot), true);

    snapshot = tag.value();
    assert.equal(tag.validate(snapshot), true);

    tom.first = 'Thomas';
    assert.equal(tag.validate(snapshot), false, 'invalid after setting with tracked properties');

    assert.equal(get(obj, 'full'), 'Thomas Dale');
    snapshot = tag.value();

    // assert.equal(tag.validate(snapshot), true);
  }
});


function track(Class, properties, accessors = {}) {
  let proto = Class.prototype;

  properties.forEach(prop => defineData(proto, prop));

  let keys = Object.getOwnPropertyNames(accessors);

  keys.forEach(key => defineAccessor(proto, key, Object.getOwnPropertyDescriptor(accessors, key)));
}

function defineData(prototype, property) {
  Object.defineProperty(prototype, property, tracked(prototype, property, {
    enumerable: true,
    configurable: true,
    writable: true,
    value: undefined
  }));
}

function defineAccessor(prototype, property, descriptor) {
  Object.defineProperty(prototype, property, tracked(prototype, property, descriptor));
}
