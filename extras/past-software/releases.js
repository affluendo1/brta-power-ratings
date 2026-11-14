/* Published X.Y release commits. Pin new releases here once their release commit is on main. */
(() => {
  'use strict';
  // The first completed history import supplies the data for 4.0 and 4.1.
  const snapshots = {
    tikituff91: { version: '9.1', commit: '157972b513e12916fb646f15f7547b493e3e3716' },
    tikiphonkaura90: { version: '9.0', commit: 'c97633e215a9a43f9c32367a737d36d7bc58dbd3' },
    tikitaka6785: { version: '8.5', commit: 'e9f5f1bb9efce5a1afdbb36bc12dcd82a2c1d6f2' },
    tikituff84: { version: '8.4', commit: '9403e0daff2da5ffd76b698abd6ead6c97db1302' },
    tikiphonkaura83: { version: '8.3', commit: '08405e71c1b6ffa62ef4d02080a4b5daa2bb6951' },
    miguelaura82: { version: '8.2', commit: 'b990701d1c80da5f547d228bb67bed80629eddb1' },
    tikitaka6781: { version: '8.1', commit: 'f3c6a3fb8a0463f3aec4fd6db81a3fcaf7a4c071' },
    tikituff80: { version: '8.0', commit: 'ba3144d7d358811178ff10c7b719d1bcd4b08b28' },
    miguelaura71: { version: '7.1', commit: '799755cc753ac094be56bd9063250444338407aa' },
    tikitaka6770: { version: '7.0', commit: '4f4365868e601e9e55066fbfd30b45701ddb195e' },
    miguelaura64: { version: '6.4', commit: 'bf746e34777f21d2f11560547e95839bcf39b3fe' },
    tikitaka6763: { version: '6.3', commit: 'ed6ebfe2e67a8978b4d00acc1ae6693f34e1f9ab' },
    tikituff62: { version: '6.2', commit: 'ed2a1af22f84e43cbd62fdb80af30f8ef70b0c20' },
    tikiphonkaura61: { version: '6.1', commit: '01f9c0372be41ce4518c6645a68b6ceb457bc49d' },
    miguelaura60: { version: '6.0', commit: '1616417efe02c1c9493b0cdd6db02242d06c18ff' },
    tikiphonkaura54: { version: '5.4', commit: '9ce7301faaf73ab9e8080e24acaff86e83ec0c96' },
    miguelaura53: { version: '5.3', commit: '199930cbfd40725c45c558dcc9033050c1d7dab7' },
    tikitaka6752: { version: '5.2', commit: 'a574b7a5f9759a54304510d653b4f1c50c85ae7c' },
    tikituff51: { version: '5.1', commit: '0f71ce4f4fb056c0f891adbb0c8aa43fb79867b9' },
    tikiphonkaura50: { version: '5.0', commit: 'b0e32592bbd61ca23c678e555ede690072e25d63' },
    tikituff44: { version: '4.4', commit: '1b2feddd348c3c176ee5734565137456712524fc' },
    tikiphonkaura43: { version: '4.3', commit: '98d5c6eae619a33be430b6b4d8ac7b7df3e9bdb0' },
    miguelaura42: { version: '4.2', commit: '8586e7fb576d7f0423b420c67f7ee112916f00b1' },
    tikitaka6741: { version: '4.1', commit: 'd4bd830dde275ef250e6e6fb05e0573113450cbd', archive: '917de2d2f116501c24fa0f4b7c220f00c85d671e' },
    tikituff40: { version: '4.0', commit: '2a9af4c01ddf8c429609f2acf3f3489c7b1bb872', archive: '917de2d2f116501c24fa0f4b7c220f00c85d671e' },
    tikiphonkaura36: { version: '3.6', commit: '61beefebfdf2e03fcb217143ebf7dc89ebe864c8' },
    miguelaura35: { version: '3.5', commit: '4e09c02b6c2211684759205a657858d36b2005b8' },
    tikitaka6734: { version: '3.4', commit: '977afd840b12ea438fed6654efaaf807c141d3df' },
    tikituff33: { version: '3.3', commit: 'f88e4dd532458761257ad4c9ffae15b8f4dc0742' },
    tikiphonkaura32: { version: '3.2', commit: '6580fdee645f530ce5cde536028a68a3a909c741' },
    miguelaura31: { version: '3.1', commit: '8c46e55b7addd3de679a5cdc66a4f6b4aa139f43' },
    tikitaka6730: { version: '3.0', commit: '14bdc175be6a8a96ea3a070587e66b370c1cec0e' },
    miguelaura24: { version: '2.4', commit: 'f70a4c97e6d7ab615a71e878b38841e1f6b5cd38' },
    tikitaka6723: { version: '2.3', commit: 'f14d8dbacc0a56801ad3388800b8ed01ec0bc4ee' },
    tikituff22: { version: '2.2', commit: '82284b3e5d7ce94587b488286a0e5b65a518137b' },
    tikiphonkaura21: { version: '2.1', commit: '06fed947c4cb2719a3973e5ab4d64d279f367b5a' },
    miguelaura20: { version: '2.0', commit: '55017898493401d25920ebd9229ec1a7d6466f93' },
    tikiphonkaura10: { version: '1.0', commit: 'a740d28fcd097a41ef468e7892ed6d25dba07664' },
  };

  globalThis.BRTAPastSoftware = Object.freeze({
    extrasKey: 'brta-module-enabled-v1',
    snapshots,
    byVersion: Object.fromEntries(Object.entries(snapshots).map(([alias, snapshot]) => [snapshot.version, alias])),
  });
})();
