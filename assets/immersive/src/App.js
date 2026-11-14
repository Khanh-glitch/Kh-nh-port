import { jsx as h, jsxs } from 'react/jsx-runtime';
import { useState, useEffect, useCallback } from 'react';
import SpaceScene from 'ship/components/SpaceScene';
import { flight } from 'ship/lib/flight';
export default function App() {
  const [status,setStatus]=useState('Đang mở không gian…');
  const [painted,setPainted]=useState(false);
  const [cockpitReady,setCockpitReady]=useState(false);
  const [gate,setGate]=useState(false);
  const [jump,setJump]=useState('idle');
  const [spooled,setSpooled]=useState(false);
  useEffect(()=>{
    const progress=e=>{setStatus(e.detail);setPainted(true)};
    const msg=e=>{if(e.origin===location.origin && e.source===parent && e.data?.type==='ORBITA_SPACE_READY')setGate(e.data.ready===true)};
    const ready=()=>setCockpitReady(true);
    window.addEventListener('orbita-hx9-progress',progress);window.addEventListener('ORBITA_SPACE_LOCAL_PAINTED',ready);window.addEventListener('message',msg);
    if(window.__orbitaSpacePainted)ready();
    return ()=>{window.removeEventListener('orbita-hx9-progress',progress);window.removeEventListener('ORBITA_SPACE_LOCAL_PAINTED',ready);window.removeEventListener('message',msg)};
  },[]);
  useEffect(()=>{
    if (jump !== 'charging') return;
    const timer=setTimeout(()=>setSpooled(true),flight.reduced?250:1900);
    return ()=>clearTimeout(timer);
  },[jump]);
  useEffect(()=>{
    // A genuine island frame AND the original acceleration lead are both
    // required before the flash. Keep rendering the ship during preparation.
    if (jump === 'charging' && gate && spooled) setJump('flash');
    else if (jump === 'flash' && !gate) setJump('charging');
  },[jump,gate,spooled]);
  useEffect(()=>{
    if (jump !== 'flash' || !gate) return;
    const timer=setTimeout(()=>{
      flight.warp=false;
      parent.postMessage({type:'ORBITA_SPACE_WARP_COMPLETE'},location.origin);
    },flight.reduced?20:520);
    return ()=>clearTimeout(timer);
  },[jump,gate]);
  useEffect(()=>()=>{flight.warp=false},[]);
  const engage=useCallback(()=>{
    if(!cockpitReady||jump!=='idle')return;
    setSpooled(false);setJump('charging');setStatus('Đang tăng tốc · chuẩn bị đảo Orbita…');flight.warp=true;
    parent.postMessage({type:'ORBITA_SPACE_ENGAGE'},location.origin);
  },[cockpitReady,jump]);
  return jsxs('div',{className:'app hx9-app','data-space-painted':painted?'true':'false','data-jump':jump,children:[
    h(SpaceScene,{}),
    jsxs('div',{className:'hx9-status',role:'status','aria-live':'polite',children:[
      h('div',{className:'hx9-eyebrow',children:'ORBITA · HX-9'}),
      h('div',{className:'hx9-title',children:'Hành trình đang hình thành'}),
      h('div',{className:'hx9-copy',children:jump === 'charging' ? 'Đang tăng tốc · chuẩn bị đảo Orbita…' : gate?'Phi thuyền sẵn sàng · Không gian Orbita đã mở':status}),
      h('div',{className:'hx9-line',children:h('span',{})}),
      cockpitReady && h('button',{type:'button',className:'hx9-enter',disabled:jump!=='idle',onClick:engage,children:jump!=='idle'?'ĐANG KHỞI HÀNH':'BƯỚC VÀO ORBITA'})
    ]}),
    h('div',{className:'flash','aria-hidden':'true'})
  ]});
}
