import { writeFileSync } from 'node:fs'
import * as icons from 'simple-icons'
// Source catalogue: user-supplied 3d-social-media-logos.zip src/data/icons.ts
const spec = [
  ['siTiktok','tiktok'],
  ['siDiscord','discord'],
  ['siFacebook','facebook'],
  ['siInstagram','instagram'],
  ['siGithub','github'],
]
const out = spec.map(([key,slug])=>{
  const i=icons[key]
  if(!i?.path)throw Error('Missing exact Simple Icons path '+key)
  return {slug,color:'#'+i.hex,path:i.path}
})
// LinkedIn was explicitly shipped as an archived (v9) entry in the user ZIP.
out.push({slug:'linkedin',color:'#0A66C2',path:'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z'})
if(out.length!==6 || new Set(out.map(x=>x.slug)).size!==6)throw Error('6 social logos required')
writeFileSync('../src/scene/socialLogoPaths.ts',`// Generated from supplied 3D Social Media Logos catalogue\nexport const SOCIAL_PATHS = ${JSON.stringify(out,null,2)} as const\n`)
console.log('SOCIAL_PATHS_READY',out.map(x=>x.slug).join(','))
