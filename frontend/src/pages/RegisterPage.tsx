import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Stethoscope, Eye, EyeOff, ArrowLeft, ArrowRight, Check, User, Heart, Shield } from 'lucide-react';
import toast from 'react-hot-toast';

// ✅ Moved OUTSIDE RegisterPage so React sees a stable component reference
//    and never unmounts/remounts the input on each keystroke.
const Inp: React.FC<{
  label: string;
  name: string;
  value: string;
  type?: string;
  ph?: string;
  req?: boolean;
  errors: Record<string, string>;
  onChange: (v: string) => void;
}> = ({ label, name, value, type = 'text', ph, req, errors, onChange }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1.5">
      {label} {req && <span className="text-red-400">*</span>}
    </label>
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      className={`input-field ${errors[name] ? 'border-red-400' : ''}`}
      placeholder={ph}
    />
    {errors[name] && <p className="text-xs text-red-500 mt-1">{errors[name]}</p>}
  </div>
);

const RegisterPage: React.FC = () => {
  const [step, setStep] = useState(1);
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    firstName:'', lastName:'', email:'', phone:'', password:'', confirmPassword:'',
    dateOfBirth:'', gender:'', bloodType:'', communicationPreference:'both', allergies:'',
    address: { street:'', city:'', state:'', zipCode:'', country:'Malta' },
    emergencyContact: { name:'', relationship:'', phone:'' },
  });
  const [errors, setErrors] = useState<Record<string,string>>({});
  const u = (f:string,v:any) => { setForm(p=>({...p,[f]:v})); setErrors(p=>({...p,[f]:''})); };
  const uAddr = (f:string,v:string) => setForm(p=>({...p,address:{...p.address,[f]:v}}));
  const uEm = (f:string,v:string) => setForm(p=>({...p,emergencyContact:{...p.emergencyContact,[f]:v}}));

  const v1 = () => {
    const e:Record<string,string>={};
    if(!form.firstName.trim()) e.firstName='Required';
    if(!form.lastName.trim()) e.lastName='Required';
    if(!form.email.trim()) e.email='Required';
    else if(!/\S+@\S+\.\S+/.test(form.email)) e.email='Invalid email';
    if(!form.phone.trim()) e.phone='Required';
    if(!form.password) e.password='Required';
    else if(form.password.length<8) e.password='Min 8 characters';
    if(form.password!==form.confirmPassword) e.confirmPassword='Passwords do not match';
    setErrors(e); return Object.keys(e).length===0;
  };
  const v2 = () => {
    const e:Record<string,string>={};
    if(!form.dateOfBirth) e.dateOfBirth='Required';
    if(!form.gender) e.gender='Required';
    setErrors(e); return Object.keys(e).length===0;
  };
  const next = () => { if(step===1&&v1()) setStep(2); else if(step===2&&v2()) setStep(3); };

  const submit = async () => {
    setLoading(true);
    try {
      await register({...form, allergies: form.allergies?form.allergies.split(',').map(a=>a.trim()):[]});
      toast.success('Account created! Welcome to MedBook.');
      navigate('/my-appointments');
    } catch(err:any) { toast.error(err.response?.data?.message||'Registration failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-primary-600 rounded-2xl mb-3 shadow-lg"><Stethoscope size={28} className="text-white"/></div>
          <h1 className="text-2xl font-bold text-gray-900">Create Your Account</h1>
          <p className="text-gray-500 mt-1 text-sm">Join MedBook to manage your healthcare appointments</p>
        </div>
        <div className="flex items-center gap-2 mb-6">
          {[{n:1,l:'Account',i:<User size={14}/>},{n:2,l:'Personal',i:<Heart size={14}/>},{n:3,l:'Confirm',i:<Shield size={14}/>}].map(({n,l,i})=>(
            <React.Fragment key={n}>
              <button onClick={()=>{if(n<step)setStep(n)}} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${step>=n?'bg-primary-50 text-primary-700':'text-gray-400'}`}>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step>=n?'bg-primary-600 text-white':'bg-gray-200 text-gray-500'}`}>{step>n?<Check size={12}/>:n}</div>
                <span className="hidden sm:inline">{l}</span>
              </button>
              {n<3&&<div className={`flex-1 h-0.5 ${step>n?'bg-primary-400':'bg-gray-200'}`}/>}
            </React.Fragment>
          ))}
        </div>
        <div className="card p-6">
          {step===1&&(<div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Account Details</h2>
            <div className="grid grid-cols-2 gap-3">
              <Inp label="First Name" name="firstName" value={form.firstName} ph="John" req errors={errors} onChange={v=>u('firstName',v)}/>
              <Inp label="Last Name" name="lastName" value={form.lastName} ph="Doe" req errors={errors} onChange={v=>u('lastName',v)}/>
            </div>
            <Inp label="Email" name="email" value={form.email} type="email" ph="john@email.com" req errors={errors} onChange={v=>u('email',v)}/>
            <Inp label="Phone" name="phone" value={form.phone} type="tel" ph="+356 7XXX XXXX" req errors={errors} onChange={v=>u('phone',v)}/>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password <span className="text-red-400">*</span></label>
              <div className="relative">
                <input type={showPw?'text':'password'} value={form.password} onChange={e=>u('password',e.target.value)} className={`input-field pr-10 ${errors.password?'border-red-400':''}`} placeholder="Min 8 characters"/>
                <button type="button" onClick={()=>setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">{showPw?<EyeOff size={18}/>:<Eye size={18}/>}</button>
              </div>
              {errors.password&&<p className="text-xs text-red-500 mt-1">{errors.password}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm Password <span className="text-red-400">*</span></label>
              <input type="password" value={form.confirmPassword} onChange={e=>u('confirmPassword',e.target.value)} className={`input-field ${errors.confirmPassword?'border-red-400':''}`} placeholder="Re-enter password"/>
              {errors.confirmPassword&&<p className="text-xs text-red-500 mt-1">{errors.confirmPassword}</p>}
            </div>
            <button onClick={next} className="btn-primary w-full gap-2">Continue <ArrowRight size={16}/></button>
          </div>)}
          {step===2&&(<div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Personal Information</h2>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Date of Birth *</label><input type="date" value={form.dateOfBirth} onChange={e=>u('dateOfBirth',e.target.value)} className={`input-field ${errors.dateOfBirth?'border-red-400':''}`} max={new Date().toISOString().split('T')[0]}/>{errors.dateOfBirth&&<p className="text-xs text-red-500 mt-1">{errors.dateOfBirth}</p>}</div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Gender *</label><select value={form.gender} onChange={e=>u('gender',e.target.value)} className={`input-field ${errors.gender?'border-red-400':''}`}><option value="">Select...</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select>{errors.gender&&<p className="text-xs text-red-500 mt-1">{errors.gender}</p>}</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Blood Type</label><select value={form.bloodType} onChange={e=>u('bloodType',e.target.value)} className="input-field"><option value="">Unknown</option>{['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(t=><option key={t} value={t}>{t}</option>)}</select></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Notifications</label><select value={form.communicationPreference} onChange={e=>u('communicationPreference',e.target.value)} className="input-field"><option value="both">Email + SMS</option><option value="email">Email only</option><option value="sms">SMS only</option></select></div>
            </div>
            <div><p className="text-sm font-medium text-gray-700 mb-2">Address (optional)</p><input type="text" value={form.address.street} onChange={e=>uAddr('street',e.target.value)} className="input-field mb-2" placeholder="Street"/><div className="grid grid-cols-3 gap-2"><input type="text" value={form.address.city} onChange={e=>uAddr('city',e.target.value)} className="input-field" placeholder="City"/><input type="text" value={form.address.zipCode} onChange={e=>uAddr('zipCode',e.target.value)} className="input-field" placeholder="Postal code"/><input type="text" value={form.address.country} onChange={e=>uAddr('country',e.target.value)} className="input-field" placeholder="Country"/></div></div>
            <div><p className="text-sm font-medium text-gray-700 mb-2">Emergency Contact (optional)</p><div className="grid grid-cols-3 gap-2"><input type="text" value={form.emergencyContact.name} onChange={e=>uEm('name',e.target.value)} className="input-field" placeholder="Name"/><input type="text" value={form.emergencyContact.relationship} onChange={e=>uEm('relationship',e.target.value)} className="input-field" placeholder="Relationship"/><input type="tel" value={form.emergencyContact.phone} onChange={e=>uEm('phone',e.target.value)} className="input-field" placeholder="Phone"/></div></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Allergies (comma-separated)</label><input type="text" value={form.allergies} onChange={e=>u('allergies',e.target.value)} className="input-field" placeholder="e.g. Penicillin, Latex"/></div>
            <div className="flex gap-3"><button onClick={()=>setStep(1)} className="btn-secondary gap-1"><ArrowLeft size={16}/> Back</button><button onClick={next} className="btn-primary flex-1 gap-2">Continue <ArrowRight size={16}/></button></div>
          </div>)}
          {step===3&&(<div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Review & Confirm</h2>
            <div className="bg-surface-50 rounded-xl p-4 space-y-2.5 text-sm">
              {[['Name',`${form.firstName} ${form.lastName}`],['Email',form.email],['Phone',form.phone],['DOB',form.dateOfBirth?new Date(form.dateOfBirth).toLocaleDateString():'—'],['Gender',form.gender||'—'],['Blood Type',form.bloodType||'Unknown'],['Notifications',form.communicationPreference]].map(([l,v])=>(
                <div key={l as string} className="flex justify-between"><span className="text-gray-500">{l}</span><span className="font-medium capitalize">{v}</span></div>
              ))}
            </div>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">By creating an account, you agree to receive appointment reminders via your preferred channel.</div>
            <div className="flex gap-3"><button onClick={()=>setStep(2)} className="btn-secondary gap-1"><ArrowLeft size={16}/> Back</button><button onClick={submit} disabled={loading} className="btn-primary flex-1">{loading?'Creating...':'Create My Account'}</button></div>
          </div>)}
        </div>
        <p className="text-center text-sm text-gray-500 mt-4">Already have an account? <Link to="/login" className="text-primary-600 font-medium hover:text-primary-700">Sign in</Link></p>
      </div>
    </div>
  );
};

export default RegisterPage;