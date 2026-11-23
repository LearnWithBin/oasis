let atlas, frames;
export async function loadCatArt() {
  if (atlas) return;
  const image = new Image();
  image.src = `${import.meta.env.BASE_URL}assets/cat-atlas-v1.webp`;
  await image.decode();
  const sheet = document.createElement('canvas');
  sheet.width=image.width;sheet.height=image.height;
  const ctx=sheet.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);
  const pixels=ctx.getImageData(0,0,sheet.width,sheet.height).data;
  const sw=sheet.width/2,sh=sheet.height/2;
  frames=[];
  for(let row=0;row<2;row++)for(let col=0;col<2;col++){
    let left=sw,top=sh,right=0,bottom=0;
    for(let y=0;y<sh;y++)for(let x=0;x<sw;x++)if(pixels[((row*sh+y)*sheet.width+col*sw+x)*4+3]>64){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
    frames.push({sx:col*sw+left,sy:row*sh+top,w:right-left+1,h:bottom-top+1});
  }
  atlas=image;
}
export function drawCatFrame(ctx,index,x,y,width,flip=false,bob=0){
  const b=frames[index],height=width*b.h/b.w;
  ctx.save();ctx.translate(x,y+bob);if(flip)ctx.scale(-1,1);
  ctx.drawImage(atlas,b.sx,b.sy,b.w,b.h,-width/2,-height,width,height);ctx.restore();
  return {left:x-width/2,right:x+width/2,top:y-height,bottom:y};
}
export function catFrameCanvas(index){
  const b=frames[index],canvas=document.createElement('canvas');canvas.width=b.w;canvas.height=b.h;
  canvas.getContext('2d').drawImage(atlas,b.sx,b.sy,b.w,b.h,0,0,b.w,b.h);return canvas;
}
export function drawCatPreview(canvas,type){
  const index=type==='cat_home'?3:0,b=frames[index],ctx=canvas.getContext('2d');
  const width=Math.min(canvas.width,canvas.height*b.w/b.h),height=width*b.h/b.w;
  ctx.clearRect(0,0,canvas.width,canvas.height);drawCatFrame(ctx,index,canvas.width/2,(canvas.height+height)/2,width);
}
