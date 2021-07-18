import { getOwner, Owner } from '@ember/-internals/owner';
import { schedule } from '@ember/runloop';
import { Template } from '@glimmer/interfaces';
import { createComputeRef, Reference, updateRef } from '@glimmer/reference';
import { consumeTag, createTag, dirtyTag } from '@glimmer/validator';
import { SimpleElement } from '@simple-dom/interface';
import { OutletDefinitionState } from '../component-managers/outlet';
import { OutletState } from '../utils/outlet';

export interface BootEnvironment {
  hasDOM: boolean;
  isInteractive: boolean;
  options: any;
}

const TOP_LEVEL_NAME = '-top-level';
const TOP_LEVEL_OUTLET = 'main';

export default class OutletView {
  static extend(injections: any): typeof OutletView {
    return class extends OutletView {
      static create(options: any) {
        if (options) {
          return super.create(Object.assign({}, injections, options));
        } else {
          return super.create(injections);
        }
      }
    };
  }

  static reopenClass(injections: any): void {
    Object.assign(this, injections);
  }

  static create(options: any): OutletView {
    let { _environment, template: templateFactory } = options;
    let owner = getOwner(options);
    let template = templateFactory(owner);
    return new OutletView(_environment, owner, template);
  }

  private ref: Reference;
  public state: OutletDefinitionState;

  constructor(
    private _environment: BootEnvironment,
    public owner: Owner,
    public template: Template
  ) {
    let outletStateTag = createTag();
    let outletState: OutletState = {
      outlets: { main: undefined },
      render: {
        owner: owner,
        into: undefined,
        outlet: TOP_LEVEL_OUTLET,
        name: TOP_LEVEL_NAME,
        controller: undefined,
        model: undefined,
        template,
      },
    };

    let ref = (this.ref = createComputeRef(
      () => {
        consumeTag(outletStateTag);
        return outletState;
      },
      (state: OutletState) => {
        dirtyTag(outletStateTag);
        outletState.outlets.main = state;
      }
    ));

    this.state = {
      ref,
      name: TOP_LEVEL_NAME,
      outlet: TOP_LEVEL_OUTLET,
      template,
      controller: undefined,
      model: undefined,
    };
  }

  appendTo(selector: string | SimpleElement): void {
    let target;

    if (this._environment.hasDOM) {
      target = typeof selector === 'string' ? document.querySelector(selector) : selector;
    } else {
      target = selector;
    }

    let renderer = this.owner.lookup('renderer:-dom');

    schedule('render', renderer, 'appendOutletView', this, target);
  }

  rerender(): void {
    /**/
  }

  setOutletState(state: OutletState): void {
    updateRef(this.ref, state);
  }

  destroy(): void {
    /**/
  }
}
