'use client';
import {useEffect,useState} from 'react';
type Grants = {survey:{enabled:boolean;allQuotations:boolean};quotation:{enabled:boolean;allQuotations:boolean};orderPlacement:boolean;orderHistory:boolean;inventory:boolean};
type Member = {_id?:string;name:string;phoneNumber:string;role:string;isActive:boolean;permissions:Grants};
const empty = ():Member => ({name:'',phoneNumber:'',role:'Member',isActive:true,permissions:{survey:{enabled:false,allQuotations:false},quotation:{enabled:false,allQuotations:false},orderPlacement:false,orderHistory:false,inventory:false}});
const control='w-full rounded-lg border border-slate-300 p-3';
export default function BusinessMembers({apiBase,token}:{apiBase:string;token:string|null}) {
  const [members,setMembers]=useState<Member[]>([]);
  const [form,setForm]=useState<Member|null>(null);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [ready,setReady]=useState(false);
  const [owner,setOwner]=useState<{name:string;phoneNumber:string}|null>(null);
  async function request(path='',method='GET',body?:Member) {
    const response=await fetch(`${apiBase}/api/user/members${path}`,{method,headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:body?JSON.stringify(body):undefined});
    const data=await response.json();
    if(!response.ok) throw Error(data.message||'Unable to manage members');
    return data;
  }
  useEffect(()=>{let cancelled=false;if(!token)return;setBusy(true);request().then(data=>{if(!cancelled){setMembers(data.members);setOwner(data.owner);setReady(true);}}).catch(e=>{if(!cancelled)setError(e.message);}).finally(()=>{if(!cancelled)setBusy(false);});return()=>{cancelled=true;};},[token,apiBase]);
  async function save(event:React.FormEvent) {
    event.preventDefault();if(!form)return;setBusy(true);setError('');
    try {const data=await request(form._id?`/${form._id}`:'',form._id?'PUT':'POST',form);setMembers(data.members);setForm(null);}catch(e){setError(e instanceof Error?e.message:'Save failed');}finally{setBusy(false);}
  }
  async function remove(member:Member) {
    if(!window.confirm(`Remove ${member.name}? Their access will stop immediately.`))return;
    setBusy(true);setError('');try{const data=await request(`/${member._id}`,'DELETE');setMembers(data.members);}catch(e){setError(e instanceof Error?e.message:'Remove failed');}finally{setBusy(false);}
  }
  return <main className="mx-auto max-w-4xl space-y-6 p-6 text-slate-900">
    <div><h1 className="text-2xl font-bold">Business members</h1><p className="mt-2 text-slate-600">Manage who can sign in and which modules they can use. Partner agreement and wallet credits are available only to you, the owner.</p></div>
    {error&&<p role="alert" className="rounded-lg bg-red-50 p-4 text-red-700">{error}</p>}
    {owner&&<div className="rounded-xl border bg-white p-4"><strong>{owner.name} · Owner</strong><p>{owner.phoneNumber} · Full access</p></div>}
    {ready&&<button disabled={busy} className="rounded-lg bg-slate-900 px-5 py-3 text-white" onClick={()=>setForm(empty())}>Add member</button>}
    {members.map(member=><div key={member._id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-white p-4"><div><strong>{member.name}</strong><p>{member.phoneNumber} · {member.role} · {member.isActive?'Active':'Disabled'}</p><p className="text-sm text-slate-500">{[member.permissions.survey.enabled?'Survey':'',member.permissions.quotation.enabled?'Quotation':'',member.permissions.orderPlacement?'Order placement':'',member.permissions.orderHistory?'Order history':'',member.permissions.inventory?'Inventory':''].filter(Boolean).join(', ')||'No module access'}</p></div><div className="flex gap-4"><button disabled={busy} onClick={()=>setForm(structuredClone(member))}>Edit access</button><button disabled={busy} className="text-red-700" onClick={()=>remove(member)}>Remove</button></div></div>)}
    {ready&&!members.length&&<p>No members yet. Add a member using their own phone number.</p>}
    {form&&<form onSubmit={save} className="space-y-4 rounded-xl border bg-white p-6"><h2 className="text-xl font-semibold">{form._id?'Edit member':'New member'}</h2>
      <label className="block">Name<input required maxLength={100} className={control} value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label>
      <label className="block">Phone number<input required inputMode="numeric" pattern="[0-9]{10}" maxLength={10} className={control} value={form.phoneNumber} onChange={e=>setForm({...form,phoneNumber:e.target.value.replace(/\D/g,'')})}/></label>
      <label className="block">Role<input required maxLength={80} className={control} value={form.role} onChange={e=>setForm({...form,role:e.target.value})}/><span className="text-sm text-slate-500">For example, Surveyor or Sales executive. Access is controlled by the permissions below.</span></label>
      <label className="flex gap-3"><input type="checkbox" checked={form.isActive} onChange={e=>setForm({...form,isActive:e.target.checked})}/>Member active</label>
      {(['survey','quotation'] as const).map(key=><fieldset key={key} className="rounded-lg border p-4"><label className="flex gap-3"><input type="checkbox" checked={form.permissions[key].enabled} onChange={e=>setForm({...form,permissions:{...form.permissions,[key]:{...form.permissions[key],enabled:e.target.checked}}})}/>{key==='survey'?'Survey app':'Quotation'}</label><label className="mt-3 flex gap-3 text-sm"><input type="checkbox" disabled={!form.permissions[key].enabled} checked={form.permissions[key].allQuotations} onChange={e=>setForm({...form,permissions:{...form.permissions,[key]:{...form.permissions[key],allQuotations:e.target.checked}}})}/>Show all business quotations</label><p className="mt-2 text-sm text-slate-500">When off, this member sees only quotations they created.</p></fieldset>)}
      {(['orderPlacement','orderHistory','inventory'] as const).map(key=><label key={key} className="flex gap-3"><input type="checkbox" checked={form.permissions[key]} onChange={e=>setForm({...form,permissions:{...form.permissions,[key]:e.target.checked}})}/>{{orderPlacement:'Order placement',orderHistory:'Order history',inventory:'Inventory'}[key]}</label>)}
      <div className="flex gap-4"><button disabled={busy} type="submit" className="rounded-lg bg-slate-900 px-5 py-3 text-white">{busy?'Saving…':'Save member'}</button><button disabled={busy} type="button" onClick={()=>setForm(null)}>Cancel</button></div>
    </form>}
  </main>;
}
