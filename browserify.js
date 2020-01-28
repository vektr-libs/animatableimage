var lR = ALLEX.execSuite.libRegistry;

lR.register('vektr_animatableimagelib',
  require('./libindex')(
    ALLEX, 
    lR.get('vektr_renderinglib'),
    lR.get('vektr_modifierslib')
  )
);
