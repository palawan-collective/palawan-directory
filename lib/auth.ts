import {createHmac,timingSafeEqual} from 'node:crypto';import {cookies} from 'next/headers';
function eq(a:string,b:string){const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y)}
function sign(s:string){return createHmac('sha256',process.env.SESSION_SECRET||'').update(s).digest('hex')}
export function verifyPassword(p:string){return !!process.env.ADMIN_PASSWORD&&!!process.env.SESSION_SECRET&&eq(p,process.env.ADMIN_PASSWORD)}
export async function login(){const s=String(Date.now()+8*3600*1000);(await cookies()).set('palawan-admin',s+'.'+sign(s),{httpOnly:true,sameSite:'strict',secure:process.env.NODE_ENV==='production',path:'/',maxAge:28800})}
export function buildAdminEnabled() {
  return process.env.DIRECTORY_BUILD_MODE==='true' &&
    (process.env.VERCEL_ENV==='preview'||process.env.NODE_ENV==='development');
}
export async function admin(){if(buildAdminEnabled())return true;if(!process.env.SESSION_SECRET)return false;const [s,h]=(await cookies()).get('palawan-admin')?.value.split('.')||[];return !!s&&!!h&&Number(s)>Date.now()&&eq(h,sign(s))}
