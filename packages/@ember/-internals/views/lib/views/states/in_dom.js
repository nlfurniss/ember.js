import { teardownMandatorySetter } from '@ember/-internals/utils';
import EmberError from '@ember/error';
import { DEBUG } from '@glimmer/env';
import hasElement from './has_element';

const inDOM = Object.assign({}, hasElement, {
  enter(view) {
    // Register the view for event handling. This hash is used by
    // Ember.EventDispatcher to dispatch incoming events.
    view.renderer.register(view);

    if (DEBUG) {
      let elementId = view.elementId;

      teardownMandatorySetter(view, 'elementId');

      Object.defineProperty(view, 'elementId', {
        configurable: true,
        enumerable: true,

        get() {
          return elementId;
        },
        set(value) {
          if (value !== elementId) {
            throw new EmberError("Changing a view's elementId after creation is not allowed");
          }
        },
      });
    }
  },
});

export default Object.freeze(inDOM);
