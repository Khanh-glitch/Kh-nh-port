import { jsx as h, jsxs } from 'react/jsx-runtime';
import { useState, useEffect, useCallback } from 'react';
import SpaceScene from 'ship/components/SpaceScene';
import { flight } from 'ship/lib/flight';
export default function App() {
  const [status,setStatus]=useState('Đang mở không gian…');
  const [painted,setPainted]=useState(false);
  const [gate,setGate]=useState(false);
  const [jump,setJump]=useState(false);
  useEffect(()=>{
    const progress=e=>{setStatus(e.detail);setPainted(true)};
    const msg=e=>{if(e.origin===location.origin && e.source===parent && e.data?.type==='ORBITA_SPACE_READY')setGate(e.data.ready===true)};
    window.addEventListener('orbita-hx9-progress',progress);window.addEventListener('message',msg);
    return ()=>{window.removeEventListener('orbita-hx9-progress',progress);window.removeEventListener('message',msg)};
  },[]);
  const engage=useCallback(()=>{
    if(!gate||jump)return;
    setJump(true);flight.warp=true;
    parent.postMessage({type:'ORBITA_SPACE_ENGAGE'},location.origin);
    setTimeout(()=>parent.postMessage({type:'ORBITA_SPACE_WARP_COMPLETE'},location.origin),flight.reduced?300:2200);
  },[gate,jump]);
  return jsxs('div',{className:'app hx9-app','data-space-painted':painted?'true':'false',children:[
    h(SpaceScene,{}),
    jsxs('div',{className:'hx9-status',role:'status','aria-live':'polite',children:[
      h('div',{className:'hx9-eyebrow',children:'ORBITA · HX-9'}),
      h('div',{className:'hx9-title',children:'Hành trình đang hình thành'}),
      h('div',{className:'hx9-copy',children:gate?'Phi thuyền sẵn sàng · Không gian Orbita đã mở':status}),
      h('div',{className:'hx9-line',children:h('span',{})}),
      gate && h('button',{type:'button',className:'hx9-enter',disabled:jump,onClick:engage,children:jump?'ĐANG KHỞI HÀNH':'BƯỚC VÀO ORBITA'})
    ]})
  ]});
}
