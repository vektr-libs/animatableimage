function createImageAnimator (lib, repetitionFactory, rendering, modifiers) {
  'use strict';

  var Modifier = modifiers.Modifier,
    Animator = modifiers.Animator,
    Sprite = rendering.Sprite,
    q = lib.q,
    qlib = lib.qlib,
    JobBase = qlib.JobBase,
    Settable = lib.Settable;

  function AnimatableJob (animatable, image_id, animation_id, defer) {
    JobBase.call(this, defer);
    Settable.call(this);
    this.animatable = animatable;
    this.image_id = image_id;
    this.animation_id = animation_id;
    this._animator = null;
    this._animator_l = null;
    this._c = null;
  }
  lib.inherit(AnimatableJob, JobBase);
  Settable.addMethods(AnimatableJob);
  AnimatableJob.prototype.destroy = function () {
    console.log('AnimatableJob finishing');
    this._c = null;
    this.cleanAnimatorDestroyedListener();
    if (this._animator) {
      this._animator.destroy();
    }
    this._animator = null;
    this.animation_id = null;
    this.image_id = null;
    if (this.animatable && this.animatable.currentJob === this) {
      this.animatable.currentJob = null;
    }
    this.animatable = null;
    Settable.prototype.destroy.call(this);
    JobBase.prototype.destroy.call(this);
  };
  AnimatableJob.prototype.attachListener = function () {
    return {
      destroy: lib.dummyFunc
    };
  };
  AnimatableJob.prototype.maybeBreak = function (finished) {
    var ss;
    if (!(this.animatable && this.animatable.destroyed && this.animatable.currentJob === this)) {
      this.resolve(false);
      return true;
    }
    ss = this.animatable.shouldStop; 
    if (ss && !ss.soft && ss.defer) {
      this.animatable.shouldStop = null;
      this.resolve(!!finished || false);
      ss.defer.resolve(true);
      return true;
    }
    return false;
  };
  AnimatableJob.prototype.cleanAnimatorDestroyedListener = function () {
    if(this._animator_l) {
      this._animator_l.destroy();
    }
    this._animator_l = null;
  };
  AnimatableJob.prototype.go = function () {
    var ret;
    if (this.maybeBreak()) {
      return q(false);
    }
    ret = this.defer.promise;
    this._start();
    return ret;
  };
  AnimatableJob.prototype._start = function () {
    if (this.maybeBreak()) {
      console.log('maybeBreak?');
      return;
    }
    this.animatable.setCurrent(this.image_id, this.animation_id);
    this._c = 0;
    if (!this.animatable.current_image_arr) {
      this.resolve(true);
      return;
    }
    this.animatable.set('index', 0);
    if (this.animatable.repetitive.shouldDelayFirst()) {
      return q.delay(this.animatable.repetitive.nextRepetitionIn(), true).then(
        this._run.bind(this)
      );
    }
    return this._run();
  };
  AnimatableJob.prototype._run = function () {
    if (this.maybeBreak()) {
      return;
    }
    if (null === this.image_id || !lib.isVal(this.image_id)) {
      qlib.promise2defer(this.animatable.stop(), this);
      return;
    }
    this.cleanAnimatorDestroyedListener();
    this._animator = new Animator(this, {
      props: {
        index : {
          amount: this.animatable.current_image_arr.length,
          limit : this.animatable.limit
        }
      },
      duration : this.animatable.duration
    });

    if (this._animator.destroyed) {
      this._animator_l = this._animator.destroyed.attach(this._onAnimationDone.bind(this));
    } else {
      this._onAnimationDone();
    }
  };
  AnimatableJob.prototype.set_index = function (index) {
    if (this.maybeBreak()) {
      return;
    }
    return this.animatable.set_index(index);
  };
  AnimatableJob.prototype.set_dindex = function (dindex) {
    this._c += dindex;
    return this.set_index(Math.floor(this._c));
  };
  AnimatableJob.prototype._onAnimationDone = function () {
    if (this.maybeBreak(true)) {
      return;
    }
    if (this._animator) {
      this._animator.destroy();
    }
    this._animator = null;
    this.index = null;
    this._c = null;
    this.animatable.current_image_arr = null;
    this.cleanAnimatorDestroyedListener();
    if (!this.maybeRunAgain()) {
      this.resolve(true);
    }
  };
  AnimatableJob.prototype.maybeRunAgain = function () {
    if (this.maybeBreak(true)) {
      return false;
    }
    this.animatable.repetitive.dec();
    if (this.animatable.repetitive.shouldRepeat()) {
      if (this.animatable.repetitive.shouldDelayFirst()) {
        this._start();
        return true;
      }
      q.delay(this.animatable.repetitive.nextRepetitionIn(), true).then(
        this._start.bind(this)
      );
      return true;
    }
    return false;
  };
  AnimatableJob.prototype.poke = function () {
    if (!this._animator) {
      console.log('poke has no _animator, so maybeBreak');
      this.maybeBreak();
    }
  };


  function checkRegistry (registry, registryname) {
    if (!lib.isFunction(registry.get)) {
      throw new Error('Registry named '+registryname+' is not a registry');
    }
  }
  function checkAnimRegistry (animregistry) {
    animregistry.traverse(checkRegistry);
  }

  var _iaid = 0;
  function ImageAnimator (el, animregistry, duration, repetitive, endBehavior) {
    checkAnimRegistry(animregistry);
    this._id = ++_iaid;
    Modifier.call(this, el);
    this.limit = 0.1;
    this.animregistry = animregistry;
    this.current_image_arr = null;

    this.currentJob = null;

    this.index = null;
    this.duration = isNaN(duration) ? null : duration;

    this.repetitive = repetitionFactory(repetitive);
    this.endBehavior = endBehavior;
    this.shouldStop = null;
    this.debug = null;
  }
  lib.inherit (ImageAnimator, Modifier);
  ImageAnimator.prototype.__cleanUp = function () {
    this.stop();
    this.shouldStop = null;
    this.endBehavior = null;
    this.repetitive = null;
    this.limit = null;
    this.debug = null;
    this.duration = null;
    this.current_image_arr = null;
    this.animregistry = null;
    Modifier.prototype.__cleanUp.call(this);
  };

  ImageAnimator.prototype.setCurrent = function (image_id, animation_id) {
    var registry;
    this.index = null;
    if (!this.animregistry) {
      this.destroy();
      return;
    }
    registry = this.animregistry.get(image_id);
    if (!registry) {
      this.current_image_arr = null;
      console.warn ('no image registry found for image', image_id);
      this.hide();
      return;
    }

    var f = registry.get(animation_id);
    if (!f) {
      this.current_image_arr = null;
      console.warn('no animation found for id ', animation_id);
      return;
    }


    this.current_image_arr = f.frames;
    if (!lib.isArray(this.current_image_arr)) {
      this.current_image_arr = null;
      return;
    }
    if (this.current_image_arr.some(imageInvalid)) {
      this.current_image_arr = null;
      return;
    }
    //console.log('ImageAnimator', this._id, 'got image_id', image_id, 'animation_id', animation_id, '=>', this.current_image_arr.length, 'frames');
  };

  function imageInvalid (img) {
    return !lib.isVal(img);
  }

  ImageAnimator.prototype.set_repetitive = function (val) {
    this.stop();
    if (this.repetitive) {
      this.repetitive.destroy();
    }
    this.repetitive = repetitionFactory(val);
  };

  ImageAnimator.prototype.set_duration = function (val) {
    this.stop();
    this.duration = val;
  };

  ImageAnimator.prototype.isEmptyAnimation = function (image_id, animation_id) {
    var s, a;
    if (!this.animregistry) {
      return true;
    }
    s = this.animregistry.get(image_id);
    if (!s) return true;
    a = s[animation_id];
    if (!a) return true;
    return !!a.get(animation_id);
  };

  ImageAnimator.prototype.start = function (image_id, animation_id) {
    if (this.isWorking()) {
      throw new Error('isWorking!');
      //return this.currentJob.defer.promise;
    }
    this.currentJob = new AnimatableJob(this, image_id, animation_id);
    return this.currentJob.go().then(
      this.onAnimationJobDone.bind(this)
    );
  };

  ImageAnimator.prototype.doTheFinish = function(animresult){
    if (this.endBehavior) {
      if (this.endBehavior === true){
        this.hide();
        return q(animresult);
      }
      if (this.endBehavior.hide){
        this.hide();
      }
      if (this.endBehavior.switchTo){
        return q({switchTo : this.endBehavior.switchTo, result : animresult});
      }
    }
    return q(animresult);
  };

  ImageAnimator.prototype.onAnimationJobDone = function (animresult) {
    console.log('onAnimationJobDone', animresult);
    return this.doTheFinish(animresult);
  };

  ImageAnimator.prototype.set_index = function (index) {
    if (this.debug) {
      console.log(this.get('el').get('id'), 'setting index ',index, 'to', this.current_image_arr.length, 'and visibility', this.get('el').get('display'));
    }
    if (!this.current_image_arr || index >= this.current_image_arr.length) {
      if (this.debug) {
        console.log('index', index, 'out of current_image_arr boundaries', this.current_image_arr ? ('[0-'+(this.current_image_arr.length-1)+']'): 'none');
        this.hide();
      }
      return;
    }
    if (!this.current_image_arr[index]) {
      if (this.debug) {
        console.log('no image at current_image_arr for index', index);
        this.hide();
      }
      return;
    }
    this.setImage (this.current_image_arr[index]);
    this.index = index;
    //console.log('ImageAnimator', this._id, 'set image', index, 'from', this.current_image_arr.length, 'frames total');
    return true;
  };

  ImageAnimator.prototype.setImage = function (img) {
    var el;
    if (!img) {
      console.warn ('Setting no image to animatable ... Will hide myself');
      this.hide();
      return;
    }
    el = this.get('el');
    if (!el) {
      this.hide();
      return;
    }
    if (!lib.isFunction(el.onRemoteLoaded)) {
      console.error('ImageAnimator\'s element', el, 'is not Image-like, has no onRemoteLoaded');
      this.hide();
      return;
    }
    el.onRemoteLoaded((img instanceof Sprite) ? img.content.sprite.image : img);
    this.show();
  };

  ImageAnimator.prototype.set_dindex = function (dindex) {
    this._c += dindex;

    if (this.debug) {
      console.log(this.get('el').get('id'), 'setting d_index', dindex, this._c);
    }
    return this.set('index', Math.floor(this._c));
  };

  ImageAnimator.prototype.setStaticImage = function (image_id, animation_id, index){
    this.setCurrent(image_id, animation_id);
    this.set('index', index);
  };

  ImageAnimator.prototype.hide = function () {
    Modifier.prototype.hide.call(this);
  };

  ImageAnimator.prototype.stop = function (soft) {
    //this.hide();
    return this.break(soft);
  };

  ImageAnimator.prototype.break = function (soft) {
    //console.log('should stop ....');
    var ret;
    //console.log('ImageAnimator', this.name, 'break soft', soft);
    /*
    console.trace();
    if (!soft) {
      console.trace();
    }
    */
    if (this.isWorking()) {
      if (soft) {
        if (!this.shouldStop) {
          this.shouldStop = {
            defer: q.defer(),
            soft: soft
          };
        }
        ret = this.shouldStop.defer.promise;
        this.currentJob.poke();
        return ret.then(
          this.doTheFinish.bind(this)
        );
      } else {
        ret = this.currentJob.defer.promise;
        this.shouldStop = null;
        this.currentJob.resolve(false);
        this.currentJob = null;
        return ret;
      }
    }
    return this.doTheFinish(true);
  };

  ImageAnimator.prototype.isWorking = function () {
    var ret = this.currentJob && this.currentJob.defer;
    return ret;
  };

  return ImageAnimator;
}

module.exports = createImageAnimator;
