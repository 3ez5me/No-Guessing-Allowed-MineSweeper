const loadSprites = (src: string): Promise<ImageBitmap> => {
  const images = new Image();
  images.src = src;
  return new Promise((res, rej) => images.addEventListener("load", () => createImageBitmap(images).then(res, rej)));
};

const sprites = Object.freeze({
  D: await loadSprites("/D.png"),
  L: await loadSprites("/L.png"),
  M: await loadSprites("/M.png"),
  R: await loadSprites("/R.png"),
  LM: await loadSprites("/LM.png"),
  MR: await loadSprites("/MR.png"),
  LR: await loadSprites("/LR.png"),
  LMR: await loadSprites("/LMR.png"),
  GD: await loadSprites("/GD.png"),
  GL: await loadSprites("/GL.png"),
  GM: await loadSprites("/GM.png"),
  GR: await loadSprites("/GR.png"),
  GLM: await loadSprites("/GLM.png"),
  GMR: await loadSprites("/GMR.png"),
  GLR: await loadSprites("/GLR.png"),
  GLMR: await loadSprites("/GLMR.png"),
  CELLS: await loadSprites("/spritesheet.png"),
});

export default sprites;

