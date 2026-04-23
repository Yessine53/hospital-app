import React from 'react';
import { X, Calendar, Clock, User, Building2, AlertTriangle, CheckCircle, XCircle, FileText, Activity, Hash } from 'lucide-react';
import type { Appointment } from '../types';

interface Props { appointment:Appointment|null; isOpen:boolean; onClose:()=>void; onConfirm?:(id:string)=>void; onCancel?:(id:string)=>void; onStatusChange?:(id:string,status:string)=>void; }

const statusCfg:Record<string,{color:string;label:string}>={scheduled:{color:'bg-blue-100 text-blue-800',label:'Scheduled'},confirmed:{color:'bg-emerald-100 text-emerald-800',label:'Confirmed'},pending_confirmation:{color:'bg-amber-100 text-amber-800',label:'Pending Confirmation'},checked_in:{color:'bg-indigo-100 text-indigo-800',label:'Checked In'},in_progress:{color:'bg-violet-100 text-violet-800',label:'In Progress'},completed:{color:'bg-gray-100 text-gray-700',label:'Completed'},cancelled:{color:'bg-red-100 text-red-800',label:'Cancelled'},no_show:{color:'bg-red-200 text-red-900',label:'No Show'},rescheduled:{color:'bg-purple-100 text-purple-800',label:'Rescheduled'},reallocated:{color:'bg-purple-100 text-purple-800',label:'Reallocated'}};
const riskCfg:Record<string,{color:string;bg:string}>={low:{color:'text-emerald-700',bg:'bg-emerald-50'},medium:{color:'text-amber-700',bg:'bg-amber-50'},high:{color:'text-red-700',bg:'bg-red-50'}};

const AppointmentModal:React.FC<Props>=({appointment:appt,isOpen,onClose,onConfirm,onCancel,onStatusChange})=>{
  if(!isOpen||!appt) return null;
  const st=statusCfg[appt.status]||{color:'bg-gray-100 text-gray-700',label:appt.status};
  const risk=appt.riskLevel?riskCfg[appt.riskLevel]:null;
  const isActive=['scheduled','confirmed','pending_confirmation','checked_in'].includes(appt.status);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose}/>
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" style={{animation:'modalIn 0.2s ease-out'}}>
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div><h2 className="text-lg font-semibold text-gray-900">Appointment Details</h2><p className="text-xs text-gray-400">ID: {appt._id.slice(-8).toUpperCase()}</p></div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} className="text-gray-500"/></button>
        </div>
        <div className="px-6 py-5 space-y-5">
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${st.color}`}>{st.label}</span>
            {appt.riskLevel&&risk&&<span className={`px-3 py-1.5 rounded-full text-sm font-medium ${risk.bg} ${risk.color} flex items-center gap-1`}><AlertTriangle size={14}/>{appt.riskLevel} risk ({((appt.riskScore||0)*100).toFixed(0)}%)</span>}
          </div>

          {appt.status==='pending_confirmation'&&<div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 flex items-start gap-2"><AlertTriangle size={18} className="mt-0.5 shrink-0"/><div><p className="font-medium">Confirmation required</p>{appt.confirmationDeadline&&<p className="text-xs mt-0.5">Deadline: {new Date(appt.confirmationDeadline).toLocaleString()}</p>}</div></div>}

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-start gap-3"><div className="w-9 h-9 bg-primary-50 rounded-lg flex items-center justify-center shrink-0"><Calendar size={18} className="text-primary-600"/></div><div><p className="text-xs text-gray-500">Date</p><p className="text-sm font-medium">{new Date(appt.date).toLocaleDateString('en-US',{weekday:'short',month:'long',day:'numeric',year:'numeric'})}</p></div></div>
            <div className="flex items-start gap-3"><div className="w-9 h-9 bg-primary-50 rounded-lg flex items-center justify-center shrink-0"><Clock size={18} className="text-primary-600"/></div><div><p className="text-xs text-gray-500">Time</p><p className="text-sm font-medium">{appt.startTime} – {appt.endTime}</p><p className="text-xs text-gray-400">{appt.duration} min</p></div></div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-start gap-3"><div className="w-9 h-9 bg-cyan-50 rounded-lg flex items-center justify-center shrink-0"><User size={18} className="text-cyan-600"/></div><div><p className="text-xs text-gray-500">Patient</p><p className="text-sm font-medium">{appt.patientId?.userId?.firstName} {appt.patientId?.userId?.lastName}</p>{appt.patientId?.userId?.email&&<p className="text-xs text-gray-400">{appt.patientId.userId.email}</p>}</div></div>
            <div className="flex items-start gap-3"><div className="w-9 h-9 bg-violet-50 rounded-lg flex items-center justify-center shrink-0"><Activity size={18} className="text-violet-600"/></div><div><p className="text-xs text-gray-500">Doctor</p><p className="text-sm font-medium">Dr. {appt.doctorId?.firstName} {appt.doctorId?.lastName}</p></div></div>
          </div>

          <div className="flex items-start gap-3"><div className="w-9 h-9 bg-amber-50 rounded-lg flex items-center justify-center shrink-0"><Building2 size={18} className="text-amber-600"/></div><div><p className="text-xs text-gray-500">Department</p><p className="text-sm font-medium">{appt.departmentId?.name}</p></div></div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-start gap-3"><div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center shrink-0"><Hash size={18} className="text-gray-500"/></div><div><p className="text-xs text-gray-500">Type</p><p className="text-sm font-medium capitalize">{appt.type.replace('_',' ')}</p></div></div>
            <div className="flex items-start gap-3"><div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center shrink-0"><FileText size={18} className="text-gray-500"/></div><div><p className="text-xs text-gray-500">Booked via</p><p className="text-sm font-medium capitalize">{appt.bookingSource.replace('_',' ')}</p></div></div>
          </div>

          {(appt.reason||appt.notes)&&<div className="bg-surface-50 rounded-xl p-4">{appt.reason&&<div className="mb-2"><p className="text-xs text-gray-500 mb-0.5">Reason</p><p className="text-sm text-gray-700">{appt.reason}</p></div>}{appt.notes&&<div><p className="text-xs text-gray-500 mb-0.5">Notes</p><p className="text-sm text-gray-700">{appt.notes}</p></div>}</div>}

          {appt.patientId&&<div className="bg-surface-50 rounded-xl p-4"><p className="text-xs font-medium text-gray-500 mb-2">Patient History</p><div className="grid grid-cols-4 gap-3 text-center"><div><p className="text-lg font-bold text-gray-900">{appt.patientId.totalAppointments||0}</p><p className="text-[10px] text-gray-400">Total</p></div><div><p className="text-lg font-bold text-emerald-600">{appt.patientId.attendedAppointments||0}</p><p className="text-[10px] text-gray-400">Attended</p></div><div><p className="text-lg font-bold text-red-600">{appt.patientId.noShowCount||0}</p><p className="text-[10px] text-gray-400">No-Shows</p></div><div><p className="text-lg font-bold text-amber-600">{appt.patientId.totalAppointments?((appt.patientId.noShowCount/appt.patientId.totalAppointments)*100).toFixed(0)+'%':'N/A'}</p><p className="text-[10px] text-gray-400">Rate</p></div></div></div>}

          {appt.riskScore!==undefined&&<div className={`rounded-xl p-4 ${risk?.bg||'bg-gray-50'}`}><p className="text-xs font-medium text-gray-500 mb-2">No-Show Risk</p><div className="flex items-center gap-3"><div className="flex-1"><div className="h-3 bg-white/60 rounded-full overflow-hidden"><div className={`h-full rounded-full ${appt.riskLevel==='high'?'bg-red-500':appt.riskLevel==='medium'?'bg-amber-500':'bg-emerald-500'}`} style={{width:`${(appt.riskScore||0)*100}%`}}/></div></div><span className={`text-xl font-bold ${risk?.color||'text-gray-700'}`}>{((appt.riskScore||0)*100).toFixed(1)}%</span></div></div>}
        </div>

        {isActive&&<div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 flex gap-2 rounded-b-2xl">
          {(appt.status==='scheduled'||appt.status==='pending_confirmation')&&onConfirm&&<button onClick={()=>onConfirm(appt._id)} className="btn-success flex-1 gap-1"><CheckCircle size={16}/> Confirm</button>}
          {appt.status==='scheduled'&&onStatusChange&&<button onClick={()=>onStatusChange(appt._id,'checked_in')} className="btn-primary flex-1 gap-1">Check In</button>}
          {appt.status==='checked_in'&&onStatusChange&&<button onClick={()=>onStatusChange(appt._id,'completed')} className="btn-success flex-1 gap-1"><CheckCircle size={16}/> Complete</button>}
          {onCancel&&!['cancelled','completed','no_show'].includes(appt.status)&&<button onClick={()=>onCancel(appt._id)} className="btn-secondary text-red-600 hover:bg-red-50 gap-1"><XCircle size={16}/> Cancel</button>}
        </div>}
      </div>
      <style>{`@keyframes modalIn{from{opacity:0;transform:scale(.95) translateY(10px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>
    </div>
  );
};
export default AppointmentModal;
