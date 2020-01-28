function createBehavior (lib, Animatable) {
  'use strict';
  var q = lib.q;

  function timeRangeCalculator (trdesc) {
    if (lib.isArray(trdesc) && trdesc.length>1 && trdesc[0] < trdesc[1]) {
      return trdesc.slice(0,2);
    }
    if (trdesc === 'continuous') {
      return 'continuous';
    }
    return [1000, 2000];
  }

  function Animation (registry, registryname, desc) {
    Animatable.call(this, desc.el, registry.result, desc.duration, desc.repeat, desc.endBehavior);
    this.registryname = registryname;
    this.name = desc.name;
    this.softend = desc.stop === 'soft';
  }
  lib.inherit(Animation, Animatable);
  Animation.prototype.destroy = function () {
    this.softend = null;
    this.name = null;
    this.registryname = null;
    Animatable.prototype.destroy.call(this);
  };
  Animation.prototype.start = function () {
    if (this.isWorking()) {
      return q(true);
    }
    return Animatable.prototype.start.call(this, this.registryname, this.name);
  };
  Animation.prototype.stop = function () {
    return Animatable.prototype.stop.call(this, this.softend);
  };
  Animation.prototype.break = function () {
    return Animatable.prototype.break.call(this, this.softend);
  };
  Animation.prototype.switchTo = function (statename) {
    return this.start();
  };
  Animation.fromStateDescriptor = function (registry, registryname, containerel, statedesc) {
    if (!statedesc) {
      throw new Error('No descriptor to load');
    }
    if (!statedesc.name) {
      throw new Error('No descriptor name');
    }
    if (!statedesc.el) {
      throw new Error('No descriptor el');
    }
    if (!statedesc.path) {
      throw new Error('No descriptor path');
    }
    if (!statedesc.duration) {
      throw new Error('No descriptor duration');
    }
    registry.storeFromGroup(registryname, statedesc.name, containerel.childAtPath.apply(containerel, statedesc.path));
    return new Animation(registry, registryname, statedesc);
  };

  function StateableAnimation (states) {
    lib.Map.call(this);
    this.currentstate = null;
    this.targetstate = null;
  }
  lib.inherit(StateableAnimation, lib.Map);
  StateableAnimation.prototype.destroy = function () {
    this.targetstate = null;
    this.currentstate = null;
    lib.Map.prototype.destroy.call(this);
  };
  StateableAnimation.prototype.addState = function (statename, animation) {
    this.add(statename, animation);
  };
  StateableAnimation.prototype.switchTo = function (statename) {
    var st;
    if (this.currentstate === statename) {
      return q(true);
    }
    console.log(this.currentstate, '=>', statename);
    st = this.get(this.currentstate);
    this.currentstate = statename;
    this.targetstate = statename;
    if (st) {
      return st.break().then(
        this.switchToPhase2.bind(this, statename, this.lastSwitch)
      );
    }
    return this.switchToPhase2(statename);
  };
  StateableAnimation.prototype.switchToPhase2 = function (statename, lastswitch) {
    var st;
    if (this.currentstate !== statename) {
      return q(false);
    }
    if (this.lastSwitch !== lastswitch) {
      return q(false);
    }
    st = this.get(this.currentstate);
    if (st) {
      return st.start().then(
        this.onPhase2Done.bind(this)
      );
    }
    console.log('StateableAnimation did not recognize state', this.currentstate, 'cannot start');
    return q(false);
  };
  StateableAnimation.prototype.onPhase2Done = function(endresult){
    //...
    if (endresult && 'object' === typeof endresult && 'switchTo' in endresult){
      this.switchTo(endresult.switchTo);
      return q(endresult.result);
    }
    return q(endresult);
  };

  function Behavior (registry, registryname) {
    lib.Fifo.call(this);
    this.registry = registry;
    this.registryname = registryname || '';
  }
  lib.inherit(Behavior, lib.Fifo);
  Behavior.prototype.destroy = function () {
    this.registryname = null;
    this.registry = null;
    lib.Fifo.prototype.destroy.call(this);
  };
  function starter (statename, promises, ia) {
    promises.push(ia.switchTo(statename));
  }
  function stopper (promises, ia) {
    promises.push(ia.stop());
  }
  Behavior.prototype.load = function (containerel, descriptors) {
    if (!this.registryname) {
      console.warn('Behavior cannot load descriptors, it has no registryname');
      return;
    }
    if (!lib.isArray(descriptors)) {
      console.warn('Behavior cannot load descriptors, they are not an Array');
      return;
    }
    descriptors.forEach(this.loadDescriptor.bind(this, containerel));
  };
  Behavior.prototype.loadDescriptor = function (containerel, desc) {
    var stateable;
    if (!desc) {
      throw new Error('No descriptor to load');
    }
    if (desc.states) {
      stateable = new StateableAnimation();
      this.push(stateable);
      lib.traverseShallow(desc.states, this.loadAState.bind(this, stateable, containerel));
      return;
    }
    this.push(Animation.fromStateDescriptor(this.registry, this.registryname, containerel, desc));
  };
  Behavior.prototype.loadAState = function (stateable, containerel, statedesc, statename) {
    stateable.addState(statename, Animation.fromStateDescriptor(this.registry, this.registryname, containerel, statedesc));
  };
  Behavior.prototype.start = function (statename) {
    var promises = [], _ps = promises;
    this.traverse(starter.bind(null, statename, _ps));
    _ps = null;
    return q.all(promises);
  };
  Behavior.prototype.stop = function () {
    var promises = [], _ps = promises;
    this.traverse(stopper.bind(null, _ps));
    _ps = null;
    return q.all(promises);
  };

  return Behavior;
}

module.exports = createBehavior;
