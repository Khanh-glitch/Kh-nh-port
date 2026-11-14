import { portfolio } from 'ship/portfolioData';
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
  const [briefOpen,setBriefOpen]=useState(false);
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
    // Elapsed wall time alone does not mean the flight has accelerated: the
    // simulation clamps its time step when frames are late. Require the real
    // animated speed as well as the genuine island frame and original lead.
    if (jump === 'charging' && gate && spooled) {
      let frame;
      const waitForSpeed=()=>{
        if (flight.reduced || flight.speed >= 9) setJump('flash');
        else frame=requestAnimationFrame(waitForSpeed);
      };
      waitForSpeed();
      return ()=>cancelAnimationFrame(frame);
    }
    if (jump === 'flash' && !gate) setJump('charging');
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
  useEffect(()=>{ window.addEventListener('orbita-hx9-enter',engage); return ()=>window.removeEventListener('orbita-hx9-enter',engage); },[engage]);
  useEffect(()=>{const open=()=>setBriefOpen(true);window.addEventListener('orbita-hx9-brief',open);return ()=>window.removeEventListener('orbita-hx9-brief',open)},[]);
  return jsxs('div',{className:'app hx9-app','data-space-painted':painted?'true':'false','data-jump':jump,'data-island-ready':gate?'true':'false',children:[
    h(SpaceScene,{}),
    jsxs('div',{className:'hx9-status'+(cockpitReady?' hx9-status-ready':''),role:'status','aria-live':'polite',children:[
      h('div',{className:'hx9-eyebrow',children:'ORBITA · HX-9'}),
      h('div',{className:'hx9-title',children:'Hành trình đang hình thành'}),
      h('div',{className:'hx9-copy',children:jump === 'charging' ? 'Đang tăng tốc · chuẩn bị đảo Orbita…' : gate?'Phi thuyền sẵn sàng · Không gian Orbita đã mở':status}),
      h('div',{className:'hx9-line',children:h('span',{})}),
      cockpitReady && h('button',{type:'button',className:'hx9-enter',disabled:jump!=='idle',onClick:engage,children:jump!=='idle'?'ĐANG KHỞI HÀNH':'BƯỚC VÀO ORBITA'})
    ]}),
    cockpitReady && h('p',{className:'hx9-sr-only',children:portfolio.name+'. '+portfolio.focus+'. '+portfolio.summary.join('. ')+'. '+portfolio.corava.title+': '+portfolio.corava.role+'. '+portfolio.music.title+': '+portfolio.music.role+'.'}),
    cockpitReady && jump === 'idle' && jsxs('details',{className:'hx9-mobile-brief',open:briefOpen,onToggle:e=>setBriefOpen(e.currentTarget.open),children:[
      h('summary',{children:'HỒ SƠ & TÁC PHẨM'}),
      jsxs('div',{className:'hx9-mobile-brief-body',children:[
        h('strong',{className:'hx9-brief-name',children:portfolio.name}),
        h('p',{children:portfolio.focus+' — '+portfolio.headline}),
        ...portfolio.highlights.map(item=>jsxs('section',{className:'hx9-brief-item',children:[
          h('span',{className:'hx9-brief-category',children:item.category}),
          h('strong',{children:item.title}),h('p',{children:item.role}),
          item.url ? h('a',{href:item.url,target:'_blank',rel:'noopener noreferrer',children:item.linkLabel+' ↗'}) : h('span',{className:'hx9-brief-note',children:item.linkLabel})
        ]},item.title)),
        h('a',{className:'hx9-brief-demo',href:portfolio.project.url,target:'_blank',rel:'noopener noreferrer',children:'Chơi APEX CHAOS ↗'})
      ]})
    ]}),
    cockpitReady && jump === 'idle' && jsxs('nav',{className:'hx9-actions','aria-label':'Liên kết portfolio và liên hệ',children:[
      h('a',{href:portfolio.project.url,target:'_blank',rel:'noopener noreferrer',children:'CHƠI APEX CHAOS ↗'}),
      h('a',{href:portfolio.links.linkedin,target:'_blank',rel:'noopener noreferrer',children:'LIÊN HỆ LINKEDIN ↗'}),
      h('a',{href:portfolio.links.github,target:'_blank',rel:'noopener noreferrer',children:'GITHUB ↗'})
    ]}),
    h('div',{className:'flash','aria-hidden':'true'})
  ]});
}
