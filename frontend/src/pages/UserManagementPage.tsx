import React, { useEffect, useState } from 'react';
import { userApi, departmentApi } from '../services/api';
import { Shield, Plus, Search, Edit2, UserX, X, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import type { User, Department, Pagination, UserRole } from '../types';

const ROLES:{value:UserRole;label:string}[]=[
  {value:'admin',label:'Administrator'},{value:'doctor',label:'Doctor'},{value:'receptionist',label:'Receptionist'},
  {value:'nurse',label:'Nurse'},{value:'patient',label:'Patient'},{value:'data_analyst',label:'Data Analyst'},{value:'manager',label:'Manager'},
];
const roleColors:Record<string,string>={admin:'bg-red-50 text-red-700 ring-red-600/20',doctor:'bg-blue-50 text-blue-700 ring-blue-600/20',receptionist:'bg-cyan-50 text-cyan-700 ring-cyan-600/20',nurse:'bg-pink-50 text-pink-700 ring-pink-600/20',patient:'bg-gray-100 text-gray-700 ring-gray-600/20',data_analyst:'bg-violet-50 text-violet-700 ring-violet-600/20',manager:'bg-amber-50 text-amber-700 ring-amber-600/20'};

interface FormData { email:string; password:string; firstName:string; lastName:string; role:UserRole; phone:string; departmentId:string; }
const empty:FormData = {email:'',password:'',firstName:'',lastName:'',role:'receptionist',phone:'',departmentId:''};

const UserManagementPage: React.FC = () => {
  const [users,setUsers]=useState<User[]>([]);
  const [depts,setDepts]=useState<Department[]>([]);
  const [pag,setPag]=useState<Pagination>({page:1,limit:20,total:0,pages:0});
  const [loading,setLoading]=useState(true);
  const [search,setSearch]=useState('');
  const [roleFilter,setRoleFilter]=useState('');
  const [showModal,setShowModal]=useState(false);
  const [editing,setEditing]=useState<User|null>(null);
  const [form,setForm]=useState<FormData>(empty);
  const [saving,setSaving]=useState(false);

  useEffect(()=>{departmentApi.getAll().then(r=>setDepts(r.data.data))},[]);
  const fetch=async(page=1)=>{setLoading(true);try{const p:any={page,limit:20};if(search)p.search=search;if(roleFilter)p.role=roleFilter;const r=await userApi.getAll(p);setUsers(r.data.data);setPag(r.data.pagination);}catch(e){console.error(e)}finally{setLoading(false)}};
  useEffect(()=>{const t=setTimeout(()=>fetch(),300);return()=>clearTimeout(t)},[search,roleFilter]);

  const openCreate=()=>{setEditing(null);setForm(empty);setShowModal(true)};
  const openEdit=(u:User)=>{setEditing(u);setForm({email:u.email,password:'',firstName:u.firstName,lastName:u.lastName,role:u.role,phone:u.phone||'',departmentId:typeof u.departmentId==='object'?(u.departmentId as any)?._id||'':u.departmentId||''});setShowModal(true)};

  const save=async()=>{
    if(!form.firstName||!form.lastName||!form.email){toast.error('Name and email required');return;}
    setSaving(true);
    try{
      if(editing){await userApi.update(editing._id,{firstName:form.firstName,lastName:form.lastName,phone:form.phone,role:form.role,departmentId:form.departmentId||undefined});toast.success('User updated');}
      else{if(!form.password||form.password.length<8){toast.error('Password min 8 chars');setSaving(false);return;}await userApi.create(form);toast.success('User created');}
      setShowModal(false);fetch(pag.page);
    }catch(e:any){toast.error(e.response?.data?.message||'Failed')}finally{setSaving(false)}
  };

  const deactivate=async(u:User)=>{if(!window.confirm(`Deactivate ${u.firstName} ${u.lastName}?`))return;try{await userApi.delete(u._id);toast.success('Deactivated');fetch(pag.page)}catch{toast.error('Failed')}};

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-2xl font-bold text-gray-900">User Management</h1><p className="text-sm text-gray-500">{pag.total} total users</p></div>
        <button onClick={openCreate} className="btn-primary gap-2"><Plus size={16}/> Add User</button>
      </div>
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search..." className="input-field pl-9"/></div>
        <select value={roleFilter} onChange={e=>setRoleFilter(e.target.value)} className="input-field w-auto"><option value="">All roles</option>{ROLES.map(r=><option key={r.value} value={r.value}>{r.label}</option>)}</select>
      </div>
      <div className="card overflow-hidden">
        {loading?<div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"/></div>
        :users.length===0?<div className="p-12 text-center text-gray-400"><Shield size={48} className="mx-auto mb-3 opacity-30"/><p>No users found</p></div>
        :<div className="overflow-x-auto"><table className="w-full"><thead className="bg-surface-50"><tr><th className="table-header">Name</th><th className="table-header">Email</th><th className="table-header">Role</th><th className="table-header">Department</th><th className="table-header">Status</th><th className="table-header">Actions</th></tr></thead>
        <tbody className="divide-y divide-gray-100">{users.map(u=>(
          <tr key={u._id} className="hover:bg-surface-50"><td className="table-cell font-medium"><div className="flex items-center gap-2.5"><div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center shrink-0"><span className="text-xs font-semibold text-primary-700">{u.firstName?.[0]}{u.lastName?.[0]}</span></div>{u.role==='doctor'?'Dr. ':''}{u.firstName} {u.lastName}</div></td>
          <td className="table-cell text-gray-500">{u.email}</td>
          <td className="table-cell"><span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset ${roleColors[u.role]||roleColors.patient}`}>{ROLES.find(r=>r.value===u.role)?.label}</span></td>
          <td className="table-cell text-gray-500">{typeof u.departmentId==='object'?(u.departmentId as any)?.name:'—'}</td>
          <td className="table-cell"><span className={`badge ${u.isActive?'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20':'bg-gray-100 text-gray-500 ring-1 ring-inset ring-gray-400/20'}`}>{u.isActive?'Active':'Inactive'}</span></td>
          <td className="table-cell"><div className="flex gap-1"><button onClick={()=>openEdit(u)} className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded"><Edit2 size={15}/></button>{u.isActive&&<button onClick={()=>deactivate(u)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"><UserX size={15}/></button>}</div></td></tr>
        ))}</tbody></table></div>}
        {pag.pages>1&&<div className="flex items-center justify-between p-4 border-t border-gray-100"><p className="text-sm text-gray-500">Page {pag.page} of {pag.pages}</p><div className="flex gap-2"><button onClick={()=>fetch(pag.page-1)} disabled={pag.page<=1} className="btn-secondary py-1.5 px-2.5 disabled:opacity-40"><ChevronLeft size={16}/></button><button onClick={()=>fetch(pag.page+1)} disabled={pag.page>=pag.pages} className="btn-secondary py-1.5 px-2.5 disabled:opacity-40"><ChevronRight size={16}/></button></div></div>}
      </div>

      {showModal&&<div className="fixed inset-0 z-50 flex items-center justify-center p-4"><div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={()=>setShowModal(false)}/><div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md" style={{animation:'modalIn 0.2s ease-out'}}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100"><h3 className="text-lg font-semibold">{editing?'Edit User':'Create User'}</h3><button onClick={()=>setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} className="text-gray-500"/></button></div>
        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3"><div><label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label><input value={form.firstName} onChange={e=>setForm({...form,firstName:e.target.value})} className="input-field"/></div><div><label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label><input value={form.lastName} onChange={e=>setForm({...form,lastName:e.target.value})} className="input-field"/></div></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Email *</label><input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} className="input-field" disabled={!!editing}/></div>
          {!editing&&<div><label className="block text-sm font-medium text-gray-700 mb-1">Password *</label><input type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} className="input-field" placeholder="Min 8 characters"/></div>}
          <div className="grid grid-cols-2 gap-3"><div><label className="block text-sm font-medium text-gray-700 mb-1">Role *</label><select value={form.role} onChange={e=>setForm({...form,role:e.target.value as UserRole})} className="input-field">{ROLES.map(r=><option key={r.value} value={r.value}>{r.label}</option>)}</select></div><div><label className="block text-sm font-medium text-gray-700 mb-1">Phone</label><input type="tel" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} className="input-field"/></div></div>
          {['doctor','nurse'].includes(form.role)&&<div><label className="block text-sm font-medium text-gray-700 mb-1">Department</label><select value={form.departmentId} onChange={e=>setForm({...form,departmentId:e.target.value})} className="input-field"><option value="">None</option>{depts.map(d=><option key={d._id} value={d._id}>{d.name}</option>)}</select></div>}
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end"><button onClick={()=>setShowModal(false)} className="btn-secondary">Cancel</button><button onClick={save} disabled={saving} className="btn-primary gap-1">{saving?'Saving...':<><Check size={16}/> {editing?'Update':'Create'}</>}</button></div>
      </div><style>{`@keyframes modalIn{from{opacity:0;transform:scale(.95) translateY(10px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style></div>}
    </div>
  );
};
export default UserManagementPage;
