import React, { useEffect, useState } from 'react';
import { Activity, Brain, RefreshCw, CheckCircle, BarChart3, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';

interface ModelInfo { model_loaded:boolean; metadata:any; features_used:string[]; }
interface TrainResult { message:string; accuracy:number; auc_score:number; feature_importances:Record<string,number>; }
const ML_URL = import.meta.env.VITE_ML_URL || 'http://localhost:8000';
const featureLabels:Record<string,string>={no_show_rate:'Previous no-show rate',no_show_count:'No-show count',lead_time_days:'Days booked in advance',total_appointments:'Total past appointments',attended_count:'Attended count',cancelled_count:'Cancelled count',age:'Patient age',hour_of_day:'Hour of appointment',day_of_week:'Day of week',is_morning:'Morning appointment',is_monday:'Monday',is_friday:'Friday',gender:'Gender',appointment_type:'Appointment type',is_new_patient:'New patient'};

const AnalyticsPage: React.FC = () => {
  const [info,setInfo]=useState<ModelInfo|null>(null);
  const [result,setResult]=useState<TrainResult|null>(null);
  const [loading,setLoading]=useState(true);
  const [training,setTraining]=useState(false);

  const fetchInfo=async()=>{try{const r=await axios.get(`${ML_URL}/model/info`);setInfo(r.data)}catch(e){console.error(e)}finally{setLoading(false)}};
  useEffect(()=>{fetchInfo()},[]);

  const train=async()=>{setTraining(true);try{const r=await axios.post(`${ML_URL}/train`);setResult(r.data);toast.success(`Trained! Accuracy: ${(r.data.accuracy*100).toFixed(1)}%`);fetchInfo()}catch(e:any){toast.error(e.response?.data?.detail||'Training failed')}finally{setTraining(false)}};

  if(loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"/></div>;

  const m=info?.metadata||{};
  const feats=result?.feature_importances||{};
  const sorted=Object.entries(feats).sort((a,b)=>b[1]-a[1]);
  const maxI=sorted.length>0?sorted[0][1]:1;

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-gray-900">ML Analytics & Model Management</h1><p className="text-sm text-gray-500">Monitor, train, and evaluate the no-show prediction model</p></div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5"><div className="flex items-center gap-3 mb-2"><div className={`w-10 h-10 rounded-lg flex items-center justify-center ${info?.model_loaded?'bg-emerald-100':'bg-red-100'}`}>{info?.model_loaded?<CheckCircle size={20} className="text-emerald-600"/>:<Activity size={20} className="text-red-600"/>}</div><div><p className="text-xs text-gray-500">Status</p><p className={`text-sm font-semibold ${info?.model_loaded?'text-emerald-700':'text-red-700'}`}>{info?.model_loaded?'Active':'Not Trained'}</p></div></div>{m.model_type&&<p className="text-xs text-gray-400">{m.model_type}</p>}</div>
        <div className="card p-5"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center"><Zap size={20} className="text-primary-600"/></div><div><p className="text-xs text-gray-500">Accuracy</p><p className="text-xl font-bold">{m.accuracy?`${(m.accuracy*100).toFixed(1)}%`:'—'}</p></div></div></div>
        <div className="card p-5"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center"><BarChart3 size={20} className="text-violet-600"/></div><div><p className="text-xs text-gray-500">AUC Score</p><p className="text-xl font-bold">{m.auc_score?m.auc_score.toFixed(4):'—'}</p></div></div></div>
        <div className="card p-5"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center"><Brain size={20} className="text-amber-600"/></div><div><p className="text-xs text-gray-500">Training Samples</p><p className="text-xl font-bold">{m.training_samples?m.training_samples.toLocaleString():'—'}</p></div></div>{m.test_samples&&<p className="text-xs text-gray-400 mt-1">Test: {m.test_samples.toLocaleString()}</p>}</div>
      </div>

      <div className="card p-5 flex items-center justify-between flex-wrap gap-4">
        <div><h3 className="font-semibold text-gray-900">Retrain Model</h3><p className="text-sm text-gray-500 mt-0.5">Train on all historical appointment data.{m.trained_at&&<span className="text-gray-400"> Last: {new Date(m.trained_at).toLocaleString()}</span>}</p></div>
        <button onClick={train} disabled={training} className="btn-primary gap-2">{training?<><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Training...</>:<><RefreshCw size={16}/> Train Model</>}</button>
      </div>

      {sorted.length>0&&<div className="card p-5"><h3 className="font-semibold text-gray-900 mb-1">Feature Importances</h3><p className="text-sm text-gray-500 mb-4">Factors influencing no-show prediction</p><div className="space-y-3">{sorted.map(([f,imp],i)=>{const pct=(imp/maxI)*100;const c=i<3?'bg-primary-500':i<6?'bg-primary-300':'bg-gray-300';return(<div key={f} className="flex items-center gap-3"><span className="text-sm text-gray-700 w-48 shrink-0 truncate">{featureLabels[f]||f}</span><div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden"><div className={`h-full ${c} rounded-full`} style={{width:`${pct}%`}}/></div><span className="text-xs font-mono text-gray-500 w-14 text-right">{(imp*100).toFixed(1)}%</span></div>)})}</div></div>}

      <div className="card p-5"><h3 className="font-semibold text-gray-900 mb-3">Features Used ({info?.features_used?.length||0})</h3><div className="flex flex-wrap gap-2">{(info?.features_used||[]).map(f=><span key={f} className="px-3 py-1.5 bg-surface-100 text-gray-600 text-xs rounded-lg font-mono">{f}</span>)}</div></div>

      <div className="card p-5"><h3 className="font-semibold text-gray-900 mb-2">How prediction works</h3><div className="text-sm text-gray-600 space-y-2"><p>The system uses a Gradient Boosting Classifier trained on historical outcomes. When a new appointment is booked, 15 features are evaluated to estimate no-show probability.</p><p>Risk levels:</p><div className="flex gap-4 mt-2"><div className="flex items-center gap-2"><div className="w-3 h-3 bg-emerald-500 rounded-full"/>Low (&lt;30%)</div><div className="flex items-center gap-2"><div className="w-3 h-3 bg-amber-500 rounded-full"/>Medium (30-60%)</div><div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-500 rounded-full"/>High (&gt;60%)</div></div><p className="mt-2">High-risk appointments trigger the confirmation workflow: patient notified 2 days before, 24hrs to confirm, slot reallocated if unconfirmed.</p></div></div>
    </div>
  );
};
export default AnalyticsPage;
