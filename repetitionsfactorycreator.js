function createRepetitionsFactory (lib) {
  'use strict';

  /*
   * destroy
   * dec
   * shouldDelayFirst
   * shouldRepeat
   * nextRepetitionIn
   */

  function NoRepetition (desc) {
  }
  NoRepetition.prototype.destroy = function () {
    return;
  };
  NoRepetition.prototype.dec = function () {
    return;
  };
  NoRepetition.prototype.shouldDelayFirst = function () {
    return false;
  };
  NoRepetition.prototype.shouldRepeat = function () {
    return false;
  };
  NoRepetition.prototype.nextRepetitionIn = function () {
    return Infinity;
  };

  function SimpleFiniteRepetition (count) {
    this.count = count;
  }
  SimpleFiniteRepetition.prototype.destroy = function () {
    this.count = null;
  };
  SimpleFiniteRepetition.prototype.dec = function () {
    if (!lib.isNumber(this.count)) {
      return;
    }
    this.count --;
  };
  SimpleFiniteRepetition.prototype.shouldDelayFirst = function () {
    return false;
  };
  SimpleFiniteRepetition.prototype.shouldRepeat = function () {
    if (!lib.isNumber(this.count)) {
      return false;
    }
    if (this.count<1) {
      return false;
    }
    return true;
  };
  SimpleFiniteRepetition.prototype.nextRepetitionIn = function () {
    return 0;
  };

  function FiniteRepetition (desc) {
    SimpleFiniteRepetition.call(this, desc.count);
    this.delay = desc.delay;
    this.post = desc.post;
  }
  lib.inherit(FiniteRepetition, SimpleFiniteRepetition);
  FiniteRepetition.prototype.destroy = function () {
    this.delay = null;
    SimpleFiniteRepetition.prototype.destroy.call(this);
  };
  FiniteRepetition.prototype.shouldDelayFirst = function () {
    return !this.post;
  };
  FiniteRepetition.prototype.nextRepetitionIn = function () {
    if (lib.isNumber(this.delay)) {
      return this.delay;
    }
    return Math.floor(this.delay[0] + (this.delay[1]-this.delay[0])*Math.random());
  };

  function factory (desc) {
    if (!lib.isVal(desc)) {
      return new NoRepetition();
    }
    if (desc === false) {
      return new NoRepetition();
    }
    if (desc === true) {
      return new SimpleFiniteRepetition(Infinity);
    }
    if (lib.isNumber(desc)) {
      return new SimpleFiniteRepetition(desc);
    }
    if (lib.isVal(desc) &&
      lib.isNumber(desc.count) &&
      (lib.isNumber(desc.delay) ||
        (
          lib.isNumber(desc.delay[0]) &&
          lib.isNumber(desc.delay[1])
        )
      )) {
        return new FiniteRepetition(desc);
    }
    console.error('problematic repetition descriptor', desc);
    throw new Error ('No ctor for Repetition');
  }

  return factory;
}

module.exports = createRepetitionsFactory;
