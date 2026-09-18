import React, { useState, useEffect } from 'react';
import {
  User,
  Mail,
  Hash,
  ShieldCheck,
  CheckCircle2,
  Vote,
  Lock,
  ArrowRight,
  AlertCircle,
  Building2,
  GraduationCap,
  Save
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useElection } from '../context/ElectionContext';

export const ProfilePage: React.FC<{ onNavigate?: (page: string) => void }> = ({ onNavigate }) => {
  const { user, updateProfile, updatePassword } = useAuth();
  const { offices, candidates, myVotes } = useElection();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState('');
  const [level, setLevel] = useState('');
  const [profileMsg, setProfileMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwMsg, setPwMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [changingPw, setChangingPw] = useState(false);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
      setPhone(user.phone || '');
      setDepartment(user.department || '');
      setLevel(user.level || '');
    }
  }, [user]);

  if (!user) {
    return (
      <div className="max-w-xl mx-auto my-16 p-8 bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#1E2E4E] rounded-3xl text-center shadow-lg space-y-4">
        <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 mx-auto flex items-center justify-center">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Sign In to View Your Profile</h2>
        <p className="text-sm text-gray-500 dark:text-slate-400">
          Sign in with your email and password to inspect your voter details and ballot record.
        </p>
      </div>
    );
  }

  const initials = (user.full_name || '?').split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg(null);
    setSavingProfile(true);
    const res = await updateProfile({ full_name: fullName, phone, department, level });
    setSavingProfile(false);
    setProfileMsg({
      type: res.success ? 'ok' : 'err',
      text: res.message
    });
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg(null);
    if (newPw !== confirmPw) {
      setPwMsg({ type: 'err', text: 'New passwords do not match.' });
      return;
    }
    setChangingPw(true);
    const res = await updatePassword(newPw);
    setChangingPw(false);
    setPwMsg({ type: res.success ? 'ok' : 'err', text: res.message });
    if (res.success) {
      setNewPw('');
      setConfirmPw('');
    }
  };

  const officeTitle = (id: string) => offices.find((o) => o.id === id)?.title || 'Contested Office';

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-8">
      {/* 1. Voter Details Profile Card */}
      <section className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#1E2E4E] rounded-3xl p-6 md:p-8 shadow-sm relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center space-x-5">
            <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-2xl shadow-md shrink-0">
              {initials || 'U'}
            </div>

            <div className="space-y-1">
              <div className="flex items-center space-x-3">
                <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">{user.full_name || 'Voter'}</h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                  RA-{user.ra_number}
                </span>
              </div>

              <p className="text-sm text-gray-500 dark:text-slate-400 flex items-center space-x-2">
                <Mail className="w-3.5 h-3.5" />
                <span>{user.email}</span>
              </p>

              <div className="flex items-center space-x-3 pt-1 text-xs">
                <span className={`flex items-center space-x-1 font-semibold ${user.status === 'active' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{user.status === 'active' ? 'Active account' : 'Suspended'}</span>
                </span>
                <span className="text-gray-300 dark:text-slate-600">|</span>
                <span className="font-mono text-gray-500 capitalize">Role: {user.role}</span>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-gray-500 dark:text-slate-400">
                <span className="flex items-center space-x-1">
                  <Building2 className="w-3.5 h-3.5" />
                  <span>{user.department || 'General Constituent'}</span>
                </span>
                {user.level && (
                  <span className="flex items-center space-x-1">
                    <GraduationCap className="w-3.5 h-3.5" />
                    <span>Level {user.level}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-start md:items-end text-xs text-gray-500 dark:text-slate-400 space-y-2">
            <div className="p-3 bg-gray-50 dark:bg-[#16223B] border border-gray-200 dark:border-[#1E2E4E] rounded-2xl flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-blue-500" />
              <span>Voter record verified</span>
            </div>
            <span className="text-[11px] font-mono text-gray-400">
              Registered: {new Date(user.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>
      </section>

      {/* 2. Edit Contact Details */}
      <section className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#1E2E4E] rounded-3xl p-6 md:p-8 shadow-sm space-y-4">
        <div className="border-b border-gray-100 dark:border-[#1E2E4E] pb-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span>My Contact Details</span>
          </h2>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
            Your RA Number and email are locked. You can update everything else.
          </p>
        </div>

        {profileMsg && (
          <div className={`p-3 rounded-2xl text-xs flex items-center space-x-2 ${
            profileMsg.type === 'ok'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-900/50'
              : 'bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 border border-red-300 dark:border-red-900/50'
          }`}>
            {profileMsg.type === 'ok' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{profileMsg.text}</span>
          </div>
        )}

        <form onSubmit={handleSaveProfile} className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-semibold mb-1 text-gray-700 dark:text-slate-300">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-[#1E2E4E] bg-gray-50 dark:bg-[#16223B] text-gray-900 dark:text-white outline-none"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1 text-gray-700 dark:text-slate-300">Phone</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+234..."
              className="w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-[#1E2E4E] bg-gray-50 dark:bg-[#16223B] text-gray-900 dark:text-white outline-none"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1 text-gray-700 dark:text-slate-300">Department</label>
            <input
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="e.g. Computer Science"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-[#1E2E4E] bg-gray-50 dark:bg-[#16223B] text-gray-900 dark:text-white outline-none"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1 text-gray-700 dark:text-slate-300">Level</label>
            <input
              type="text"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              placeholder="e.g. 300"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-[#1E2E4E] bg-gray-50 dark:bg-[#16223B] text-gray-900 dark:text-white outline-none"
            />
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={savingProfile}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold disabled:opacity-60 flex items-center space-x-2"
            >
              <Save className="w-4 h-4" />
              <span>{savingProfile ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </section>

      {/* 3. Account Security: Change Password */}
      <section className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#1E2E4E] rounded-3xl p-6 md:p-8 shadow-sm space-y-4">
        <div className="border-b border-gray-100 dark:border-[#1E2E4E] pb-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Lock className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <span>Account Security</span>
          </h2>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
            Change the password you use to sign in with your email
          </p>
        </div>

        {pwMsg && (
          <div className={`p-3 rounded-2xl text-xs flex items-center space-x-2 ${
            pwMsg.type === 'ok'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-900/50'
              : 'bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 border border-red-300 dark:border-red-900/50'
          }`}>
            {pwMsg.type === 'ok' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{pwMsg.text}</span>
          </div>
        )}

        <form onSubmit={handleChangePassword} className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <label className="block font-semibold mb-1 text-gray-700 dark:text-slate-300">New Password (min. 6)</label>
            <input
              type="password"
              required
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-[#1E2E4E] bg-gray-50 dark:bg-[#16223B] text-gray-900 dark:text-white outline-none"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1 text-gray-700 dark:text-slate-300">Confirm New Password</label>
            <input
              type="password"
              required
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-[#1E2E4E] bg-gray-50 dark:bg-[#16223B] text-gray-900 dark:text-white outline-none"
            />
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={changingPw}
              className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold disabled:opacity-60"
            >
              {changingPw ? 'Saving...' : 'Change Password'}
            </button>
          </div>
        </form>
      </section>

      {/* 4. Who You Voted For */}
      <section className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#1E2E4E] rounded-3xl p-6 md:p-8 shadow-sm space-y-5">
        <div className="border-b border-gray-100 dark:border-[#1E2E4E] pb-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Vote className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <span>My Cast Ballots (Who You Voted For)</span>
          </h2>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
            Your selections are saved securely and can be changed until voting closes.
          </p>
        </div>

        {myVotes.length === 0 ? (
          <div className="py-8 text-center text-gray-500 dark:text-slate-400 text-sm">
            <p>You have not cast any votes yet.</p>
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); onNavigate?.('vote'); }}
              className="mt-3 inline-block px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-xl hover:bg-blue-700 transition-colors"
            >
              Proceed to Vote Portal
            </a>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-gray-400 uppercase bg-gray-50 dark:bg-[#16223B]/60 rounded-xl">
                <tr>
                  <th className="py-3 px-4 rounded-l-xl">Office / Position</th>
                  <th className="py-3 px-4">Your Selection</th>
                  <th className="py-3 px-4">Choice</th>
                  <th className="py-3 px-4 rounded-r-xl">Cast Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-[#1E2E4E]">
                {myVotes.map((vote) => {
                  const candidateName = candidates.find((c) => c.id === vote.candidate_id)?.full_name || 'Selected Candidate';
                  return (
                    <tr key={vote.id} className="hover:bg-gray-50 dark:hover:bg-[#16223B]/30 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-gray-900 dark:text-white">
                        {officeTitle(vote.office_id)}
                      </td>
                      <td className="py-3.5 px-4 text-gray-700 dark:text-slate-200">
                        {vote.choice === 'candidate' ? candidateName : candidateName}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full font-bold text-xs ${
                          vote.choice === 'for'
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                            : vote.choice === 'against'
                            ? 'bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300'
                            : 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300'
                        }`}>
                          <span>
                            {vote.choice === 'for' ? 'VOTED FOR' : vote.choice === 'against' ? 'VOTED AGAINST' : 'SELECTED'}
                          </span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-gray-500 dark:text-slate-400">
                        {new Date(vote.created_at).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};