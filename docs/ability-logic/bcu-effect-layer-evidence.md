# BCU effect layer evidence

## Wave / mini-wave

`BattleWaveRuntimePatch` already treats wave and mini-wave as stage projectile effects.
The runtime stores the wave object's entity layer on creation, spawns the visual at the wave world position, and sets `bcuScaleMode` to `STAGE_PROJECTILE`.
The renderer then draws stage projectile effects through the stage-layer pass before the next actor layer.

## Actor status / proc blocked visuals

BCU actor-bound status visuals are not hit smoke. They are actor draw-effect visuals. In this project that means:

- use the actor current layer
- use y offset 0 from the actor layer baseline
- use scale 0.75
- mark the effect as `ENTITY_STATUS`

The project implementation now sets `procInvalid` to `BCU_SCALE_MODE.ENTITY_STATUS`, `scale: 0.75`, and `bcuSmokeYOffset: 0` in `BcuProcImmunityVisualPatch.js`.

## Renderer formulas

Current renderer behavior after this change:

- Stage projectile effects: `baseY - yOffset * cameraScale`; wave visuals pass `yOffset=0`.
- StageBasis.lea EAnimCont effects: `baseY + offsetY * finalScale`.
- Actor-bound status visuals: `baseY - 0`, with final scale controlled by `scale=0.75`.
