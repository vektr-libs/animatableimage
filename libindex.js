function createLib (execlib, rendering, modifiers) {
  'use strict';

  var lib = execlib.lib,
    ret = {},
    repetitionFactory = require('./repetitionsfactorycreator')(lib),
    ImageAnimator = require('./imageanimatorcreator')(lib, repetitionFactory, rendering, modifiers);
  
  return {
    ImageAnimator: ImageAnimator,
    Behavior: require('./behaviorcreator')(lib, ImageAnimator)
  };
}

module.exports = createLib;
