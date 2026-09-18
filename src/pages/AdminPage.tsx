import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  Users,
  Briefcase,
  Settings2,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Mail,
  Hash,
  UserRound,
  Crown,
  Shield,
  FileText,
  Coins,
  Megaphone,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Pencil
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useElection } from '../context/ElectionContext';
import { Profile, RegistrationEntry, Office, Candidate } from '../types';

type AdminTab = 'bank' | 'voters' | 'manage' | 'settings';

const officeIcons = ['Crown', 'Shield', 'FileText', 'Coins', 'Megaphone', 'Sparkles'];
const iconMap: Record<string, React.ComponentType<any>> = { Crown, Shield, FileText, Coins, Megaphone, Sparkles };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

function toDateTimeLocal(iso: string | undefined | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const AdminPage: React.FC<{ onNavigate?: (page: string) => void }> = () => {
  const { user } = useAuth();
  const { settings, offices, candidates, updateSettings, refreshAll } = useElection();

  const [tab, setTab] = useState<AdminTab>('bank');

  const [bankEntries, setBankEntries] = useState<RegistrationEntry[]>([]);
  const [voters, setVoters] = useState<Profile[]>([]);

  const [newBankRA, setNewBankRA] = useState('');
  const [newBankEmail, setNewBankEmail] = useState('');
  const [newBankName, setNewBankName] = useState('');

  const [officeForm, setOfficeForm] = useState<{ id: string | null; title: string; description: string; icon: string; sort_order: number }>({
    id: null,
    title: '',
    description: '',
    icon: 'Crown',
    sort_order: offices.length + 1
  });

  const [candForm, setCandForm] = useState<{ id: string | null; office_id: string; ra_number: string; full_name: string; tagline: string; statement: string }>({
    id: null,
    office_id: '',
    ra_number: '',
    full_name: '',
    tagline: '',
    statement: ''
  });

  const [settingsForm, setSettingsForm] = useState({
    site_name: '',
    about_title: '',
    about_content: '',
    about_image_url: '',
    election_start: '',
    election_end: ''
  });

  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const flash = (type: 'ok' | 'err', text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 4000);
  };

  const loadBank = useCallback(async () => {
    const { data, error } = await supabase.from('registration_bank').select('*').order('created_at');
    if (error) console.error('bank load', error.message);
    else setBankEntries((data as RegistrationEntry[]) || []);
  }, []);

  const loadVoters = useCallback(async () => {
    const { data, error } = await supabase.from('profiles').select('*').order('created_at');
    if (error) console.error('voters load', error.message);
    else setVoters((data as Profile[]) || []);
  }, []);

  useEffect(() => {
    loadBank();
    loadVoters();
  }, [loadBank, loadVoters]);

  useEffect(() => {
    if (settings) {
      setSettingsForm({
        site_name: settings.site_name,
        about_title: settings.about_title,
        about_content: settings.about_content,
        about_image_url: settings.about_image_url,
        election_start: toDateTimeLocal(settings.election_start),
        election_end: toDateTimeLocal(settings.election_end)
      });
    }
  }, [settings]);

  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const isSuperadmin = user?.role === 'superadmin';

  if (!isAdmin) {
    return (
      <div className="max-w-xl mx-auto my-16 p-8 bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#1E2E4E] rounded-3xl text-center shadow-lg space-y-4">
        <div className="w-16 h-16 rounded-full bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 mx-auto flex items-center justify-center">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Committee Only</h2>
        <p className="text-sm text-gray-500 dark:text-slate-400">
          This section is restricted to the electoral committee.
        </p>
      </div>
    );
  }

  const tabs: { id: AdminTab; label: string; icon: React.ComponentType<any> }[] = [
    { id: 'bank', label: 'Registration Bank', icon: Mail },
    { id: 'voters', label: 'Voters', icon: Users },
    { id: 'manage', label: 'Offices & Candidates', icon: Briefcase },
    { id: 'settings', label: 'Settings', icon: Settings2 }
  ];

  const addBankEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    const ra = newBankRA.replace(/^RA-?/i, '').trim();
    const email = newBankEmail.trim().toLowerCase();
    if (!ra || !email) {
      flash('err', 'RA Number and email are required.');
      return;
    }
    setBusy(true);
    const { error } = await supabase.from('registration_bank').insert({
      ra_number: ra,
      email,
      full_name: newBankName.trim()
    });
    setBusy(false);
    if (error) {
      flash('err', 'Could not add entry: ' + error.message);
      return;
    }
    setNewBankRA('');
    setNewBankEmail('');
    setNewBankName('');
    await loadBank();
    flash('ok', 'Bank entry added. This voter can now register.');
  };

  const deleteBankEntry = async (id: string) => {
    setBusy(true);
    const { error } = await supabase.from('registration_bank').delete().eq('id', id);
    setBusy(false);
    if (error) flash('err', 'Delete failed: ' + error.message);
    else {
      await loadBank();
      flash('ok', 'Bank entry removed.');
    }
  };

  const setVoterRole = async (v: Profile, newRole: string) => {
    if (!isSuperadmin && newRole === 'superadmin') {
      flash('err', 'Only the Superadmin can appoint a Superadmin.');
      return;
    }
    setBusy(true);
    const { error } = await supabase.from('profiles').update({ role: newRole, updated_at: new Date().toISOString() }).eq('id', v.id);
    setBusy(false);
    if (error) flash('err', 'Role change failed: ' + error.message);
    else {
      await loadVoters();
      if (v.id === user?.id) await refreshAll();
      flash('ok', `${v.full_name || 'Voter'} is now ${newRole}.`);
    }
  };

  const toggleVoterStatus = async (v: Profile) => {
    const next = v.status === 'active' ? 'suspended' : 'active';
    setBusy(true);
    const { error } = await supabase.from('profiles').update({ status: next, updated_at: new Date().toISOString() }).eq('id', v.id);
    setBusy(false);
    if (error) flash('err', 'Update failed: ' + error.message);
    else {
      await loadVoters();
      flash('ok', `${v.full_name || 'Voter'} is now ${next}.`);
    }
  };

  const saveOffice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!officeForm.title.trim()) {
      flash('err', 'Office title is required.');
      return;
    }
    setBusy(true);
    let error: any = null;
    if (officeForm.id) {
      ({ error } = await supabase
        .from('offices')
        .update({ title: officeForm.title.trim(), description: officeForm.description.trim(), icon: officeForm.icon, sort_order: officeForm.sort_order })
        .eq('id', officeForm.id));
    } else {
      ({ error } = await supabase.from('offices').insert({
        title: officeForm.title.trim(),
        description: officeForm.description.trim(),
        icon: officeForm.icon,
        sort_order: officeForm.sort_order
      }));
    }
    setBusy(false);
    if (error) flash('err', 'Office save failed: ' + error.message);
    else {
      await refreshAll();
      setOfficeForm({ id: null, title: '', description: '', icon: 'Crown', sort_order: offices.length + 1 });
      flash('ok', officeForm.id ? 'Office updated.' : 'Office created.');
    }
  };

  const deleteOffice = async (id: string) => {
    if (!window.confirm('Delete this office and ALL its candidates?')) return;
    setBusy(true);
    const { error } = await supabase.from('offices').delete().eq('id', id);
    setBusy(false);
    if (error) flash('err', 'Delete failed: ' + error.message);
    else {
      await refreshAll();
      flash('ok', 'Office removed.');
    }
  };

  const saveCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candForm.full_name.trim() || !candForm.ra_number.trim() || !candForm.office_id) {
      flash('err', 'Name, RA number and office are required.');
      return;
    }
    setBusy(true);
    let error: any = null;
    if (candForm.id) {
      ({ error } = await supabase
        .from('candidates')
        .update({
          office_id: candForm.office_id,
          ra_number: candForm.ra_number.trim(),
          full_name: candForm.full_name.trim(),
          tagline: candForm.tagline.trim(),
          statement: candForm.statement.trim()
        })
        .eq('id', candForm.id));
    } else {
      ({ error } = await supabase.from('candidates').insert({
        office_id: candForm.office_id,
        ra_number: candForm.ra_number.trim(),
        full_name: candForm.full_name.trim(),
        tagline: candForm.tagline.trim(),
        statement: candForm.statement.trim()
      }));
    }
    setBusy(false);
    if (error) flash('err', 'Candidate save failed: ' + error.message);
    else {
      await refreshAll();
      setCandForm({ id: null, office_id: '', ra_number: '', full_name: '', tagline: '', statement: '' });
      flash('ok', candForm.id ? 'Candidate updated.' : 'Candidate created.');
    }
  };

  const deleteCandidate = async (id: string) => {
    if (!window.confirm('Delete this candidate?')) return;
    setBusy(true);
    const { error } = await supabase.from('candidates').delete().eq('id', id);
    setBusy(false);
    if (error) flash('err', 'Delete failed: ' + error.message);
    else {
      await refreshAll();
      flash('ok', 'Candidate removed.');
    }
  };

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const patch: Partial<typeof settingsForm> & { election_start?: string; election_end?: string } = {};
    if (settingsForm.site_name !== settings?.site_name) patch.site_name = settingsForm.site_name.trim();
    if (settingsForm.about_title !== settings?.about_title) patch.about_title = settingsForm.about_title.trim();
    if (settingsForm.about_content !== settings?.about_content) patch.about_content = settingsForm.about_content;
    if (settingsForm.about_image_url !== settings?.about_image_url) patch.about_image_url = settingsForm.about_image_url.trim();
    if (settingsForm.election_start) patch.election_start = new Date(settingsForm.election_start).toISOString();
    if (settingsForm.election_end) patch.election_end = new Date(settingsForm.election_end).toISOString();

    if (Object.keys(patch).length === 0) {
      setBusy(false);
      flash('ok', 'Settings are already up to date.');
      return;
    }
    const ok = await updateSettings(patch as any);
    setBusy(false);
    if (ok) flash('ok', 'Settings saved.');
    else flash('err', 'Settings save failed.');
  };

  const toggleSetting = async (key: 'registration_open' | 'voting_open') => {
    setBusy(true);
    const ok = await updateSettings({ [key]: !settings?.[key] } as any);
    setBusy(false);
    if (ok) flash('ok', `${key === 'registration_open' ? 'Registration' : 'Voting'} is now ${settings?.[key] ? 'closed' : 'open'}.`);
    else flash('err', 'Toggle failed.');
  };

  const inputCls =
    'w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-[#1E2E4E] bg-gray-50 dark:bg-[#16223B] text-gray-900 dark:text-white text-xs outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20';
  const btnPrimary =
    'px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50 flex items-center space-x-2';
  const btnDanger =
    'p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors';

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
            <ShieldCheck className="w-4 h-4" />
            <span>{isSuperadmin ? 'Superadmin Console' : 'Committee Console'}</span>
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white mt-1">Election Administration</h1>
        </div>

        <div className="flex items-center space-x-2 text-[11px] font-mono text-gray-500 dark:text-slate-400 bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#1E2E4E] rounded-xl px-3 py-2">
          <span>{voters.length} voters</span>
          <span>•</span>
          <span>{bankEntries.length} bank entries</span>
          <span>•</span>
          <span>{offices.length} offices</span>
        </div>
      </div>

      {msg && (
        <div className={`p-3 rounded-2xl text-xs flex items-center space-x-2 ${
          msg.type === 'ok'
            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-900/50'
            : 'bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 border border-red-300 dark:border-red-900/50'
        }`}>
          {msg.type === 'ok' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{msg.text}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#1E2E4E] p-1 rounded-2xl gap-1 shadow-sm">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                tab === t.id
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-[#16223B]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* ---------------- REGISTRATION BANK ---------------- */}
      {tab === 'bank' && (
        <div className="space-y-6">
          <section className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#1E2E4E] rounded-3xl p-6 shadow-sm space-y-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <span>Add to Registration Bank</span>
              </h2>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                Only people whose RA Number + email are listed here can register. Email matching is case-insensitive.
              </p>
            </div>

            <form onSubmit={addBankEntry} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1 text-gray-700 dark:text-slate-300">RA Number</label>
                <div className="flex items-center rounded-xl border border-gray-300 dark:border-[#1E2E4E] bg-gray-50 dark:bg-[#16223B] overflow-hidden focus-within:border-emerald-500">
                  <span className="px-2.5 py-2.5 bg-gray-200 dark:bg-slate-800 text-gray-600 dark:text-slate-300 font-mono font-bold text-xs border-r border-gray-300 dark:border-[#1E2E4E]">RA-</span>
                  <input
                    type="text"
                    required
                    inputMode="numeric"
                    placeholder="3001"
                    value={newBankRA}
                    onChange={(e) => setNewBankRA(e.target.value.replace(/\D/g, ''))}
                    className="flex-1 px-3 py-2.5 bg-transparent text-gray-900 dark:text-white font-mono font-bold text-sm outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1 text-gray-700 dark:text-slate-300">Email</label>
                <input
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={newBankEmail}
                  onChange={(e) => setNewBankEmail(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1 text-gray-700 dark:text-slate-300">Full Name (optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Adaeze Okafor"
                  value={newBankName}
                  onChange={(e) => setNewBankName(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div className="sm:col-span-3">
                <button type="submit" disabled={busy} className={btnPrimary}>
                  <Plus className="w-4 h-4" />
                  <span>{busy ? 'Saving...' : 'Add Bank Entry'}</span>
                </button>
              </div>
            </form>
          </section>

          <section className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#1E2E4E] rounded-3xl p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Existing Entries ({bankEntries.length})
            </h2>

            {bankEntries.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">
                The bank is empty. Voter registration is fully closed until you add entries here.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-gray-400 uppercase bg-gray-50 dark:bg-[#16223B]/60 rounded-xl font-bold">
                    <tr>
                      <th className="py-3 px-4 rounded-l-xl">RA Number</th>
                      <th className="py-3 px-4">Full Name</th>
                      <th className="py-3 px-4">Email</th>
                      <th className="py-3 px-4">Added</th>
                      <th className="py-3 px-4 text-right rounded-r-xl">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-[#1E2E4E]">
                    {bankEntries.map((entry) => (
                      <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-[#16223B]/30">
                        <td className="py-3 px-4 font-mono font-bold text-blue-600 dark:text-blue-400">RA-{entry.ra_number}</td>
                        <td className="py-3 px-4 text-gray-700 dark:text-slate-200">{entry.full_name || '—'}</td>
                        <td className="py-3 px-4 text-gray-500">{entry.email}</td>
                        <td className="py-3 px-4 font-mono text-gray-400">{formatDate(entry.created_at)}</td>
                        <td className="py-3 px-4 text-right">
                          <button onClick={() => deleteBankEntry(entry.id)} disabled={busy} className={btnDanger} title="Remove entry">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {/* ---------------- VOTERS ---------------- */}
      {tab === 'voters' && (
        <section className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#1E2E4E] rounded-3xl p-6 shadow-sm space-y-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Registered Voters ({voters.length})
            </h2>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
              Manage roles and account status. Suspended voters cannot vote.
            </p>
          </div>

          {voters.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No voters have registered yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-gray-400 uppercase bg-gray-50 dark:bg-[#16223B]/60 rounded-xl font-bold">
                  <tr>
                    <th className="py-3 px-4 rounded-l-xl">Voter</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right rounded-r-xl">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-[#1E2E4E]">
                  {voters.map((v) => (
                    <tr key={v.id} className="hover:bg-gray-50 dark:hover:bg-[#16223B]/30">
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2.5">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                            {(v.full_name || '?').split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900 dark:text-white">{v.full_name || '—'}</p>
                            <p className="font-mono text-[10px] text-blue-600 dark:text-blue-400">RA-{v.ra_number}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-500">{v.email}</td>
                      <td className="py-3 px-4 text-gray-600 dark:text-slate-300">{v.department || '—'}</td>
                      <td className="py-3 px-4">
                        <select
                          value={v.role}
                          disabled={busy}
                          onChange={(e) => setVoterRole(v, e.target.value)}
                          className={`px-2 py-1 rounded-lg text-[11px] font-bold border outline-none ${
                            v.role === 'superadmin'
                              ? 'bg-purple-100 dark:bg-purple-950/60 border-purple-300 dark:border-purple-900/50 text-purple-700 dark:text-purple-300'
                              : v.role === 'admin'
                              ? 'bg-indigo-100 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-900/50 text-indigo-700 dark:text-indigo-300'
                              : 'bg-gray-100 dark:bg-slate-800 border-gray-300 dark:border-slate-700 text-gray-600 dark:text-slate-300'
                          }`}
                        >
                          <option value="member">member</option>
                          <option value="admin">admin</option>
                          {isSuperadmin && <option value="superadmin">superadmin</option>}
                        </select>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-[10px] font-bold ${
                          v.status === 'active'
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                            : 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${v.status === 'active' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                          <span>{v.status}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          {v.id !== user?.id && (
                            <button
                              onClick={() => toggleVoterStatus(v)}
                              disabled={busy}
                              className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold border border-gray-200 dark:border-[#1E2E4E] text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-[#16223B] transition-colors"
                            >
                              {v.status === 'active' ? 'Suspend' : 'Reinstate'}
                            </button>
                          )}
                          {v.id === user?.id && (
                            <span className="text-[10px] text-gray-400 font-mono">This is you</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ---------------- OFFICES & CANDIDATES ---------------- */}
      {tab === 'manage' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Offices */}
          <section className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#1E2E4E] rounded-3xl p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              <span>Offices / Positions</span>
            </h2>

            <form onSubmit={saveOffice} className="space-y-3 border border-gray-200 dark:border-[#1E2E4E] rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-700 dark:text-slate-300">
                  {officeForm.id ? 'Edit Office' : 'New Office'}
                </span>
                {officeForm.id && (
                  <button
                    type="button"
                    onClick={() => setOfficeForm({ id: null, title: '', description: '', icon: 'Crown', sort_order: offices.length + 1 })}
                    className="text-[11px] font-bold text-gray-400 hover:text-gray-600"
                  >
                    Cancel edit
                  </button>
                )}
              </div>
              <input
                type="text"
                required
                placeholder="Office title — e.g. Students' Union President"
                value={officeForm.title}
                onChange={(e) => setOfficeForm({ ...officeForm, title: e.target.value })}
                className={inputCls}
              />
              <input
                type="text"
                placeholder="Short description"
                value={officeForm.description}
                onChange={(e) => setOfficeForm({ ...officeForm, description: e.target.value })}
                className={inputCls}
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1 text-gray-500">Icon</label>
                  <div className="flex items-center space-x-1.5">
                    {officeIcons.map((ic) => {
                      const Icon = iconMap[ic];
                      return (
                        <button
                          key={ic}
                          type="button"
                          onClick={() => setOfficeForm({ ...officeForm, icon: ic })}
                          className={`p-1.5 rounded-lg transition-colors ${
                            officeForm.icon === ic
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 dark:bg-slate-800 text-gray-500 hover:text-blue-600'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1 text-gray-500">Sort Order</label>
                  <input
                    type="number"
                    value={officeForm.sort_order}
                    onChange={(e) => setOfficeForm({ ...officeForm, sort_order: Number(e.target.value) || 0 })}
                    className={inputCls}
                  />
                </div>
              </div>
              <button type="submit" disabled={busy} className={btnPrimary}>
                <Plus className="w-4 h-4" />
                <span>{officeForm.id ? 'Save Office' : 'Create Office'}</span>
              </button>
            </form>

            <div className="space-y-3">
              {offices.map((office) => {
                const Icon = iconMap[office.icon] || Crown;
                const count = candidates.filter((c) => c.office_id === office.id).length;
                return (
                  <div key={office.id} className="border border-gray-200 dark:border-[#1E2E4E] rounded-2xl p-4 flex items-start justify-between gap-3">
                    <div className="flex items-start space-x-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                        <Icon className="w-4.5 h-4.5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-sm text-gray-900 dark:text-white">{office.title}</h3>
                        {office.description && (
                          <p className="text-[11px] text-gray-500 dark:text-slate-400 line-clamp-1">{office.description}</p>
                        )}
                        <span className="text-[10px] font-mono text-gray-400">{count} candidate(s)</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1 shrink-0">
                      <button
                        onClick={() => setOfficeForm({ id: office.id, title: office.title, description: office.description, icon: office.icon, sort_order: office.sort_order })}
                        className={btnDanger + ' text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30'}
                        title="Edit office"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => deleteOffice(office.id)} disabled={busy} className={btnDanger} title="Delete office">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
              {offices.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">
                  No offices yet. Create your first contested position above.
                </p>
              )}
            </div>
          </section>

          {/* Candidates */}
          <section className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#1E2E4E] rounded-3xl p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <UserRound className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <span>Candidates / Contestants</span>
            </h2>

            {offices.length === 0 ? (
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-amber-800 dark:text-amber-300 text-xs flex items-center space-x-3">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>Create an office first, then add candidates to it.</span>
              </div>
            ) : (
              <form onSubmit={saveCandidate} className="space-y-3 border border-gray-200 dark:border-[#1E2E4E] rounded-2xl p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-700 dark:text-slate-300">
                    {candForm.id ? 'Edit Candidate' : 'New Candidate'}
                  </span>
                  {candForm.id && (
                    <button
                      type="button"
                      onClick={() => setCandForm({ id: null, office_id: '', ra_number: '', full_name: '', tagline: '', statement: '' })}
                      className="text-[11px] font-bold text-gray-400 hover:text-gray-600"
                    >
                      Cancel edit
                    </button>
                  )}
                </div>

                <select
                  required
                  value={candForm.office_id}
                  onChange={(e) => setCandForm({ ...candForm, office_id: e.target.value })}
                  className={inputCls}
                >
                  <option value="">Select office...</option>
                  {offices.map((o) => (
                    <option key={o.id} value={o.id}>{o.title}</option>
                  ))}
                </select>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1 text-gray-500">RA Number</label>
                    <div className="flex items-center rounded-xl border border-gray-300 dark:border-[#1E2E4E] bg-gray-50 dark:bg-[#16223B] overflow-hidden focus-within:border-blue-500">
                      <span className="px-2.5 py-2 bg-gray-200 dark:bg-slate-800 text-gray-600 dark:text-slate-300 font-mono font-bold text-xs border-r border-gray-300 dark:border-[#1E2E4E]">RA-</span>
                      <input
                        type="text"
                        required
                        inputMode="numeric"
                        placeholder="3001"
                        value={candForm.ra_number}
                        onChange={(e) => setCandForm({ ...candForm, ra_number: e.target.value.replace(/\D/g, '') })}
                        className="flex-1 px-3 py-2.5 bg-transparent text-gray-900 dark:text-white font-mono font-bold text-sm outline-none"
                      />
                    </div>
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="Full name"
                    value={candForm.full_name}
                    onChange={(e) => setCandForm({ ...candForm, full_name: e.target.value })}
                    className={inputCls + ' mt-0'}
                  />
                </div>

                <input
                  type="text"
                  placeholder="Campaign tagline"
                  value={candForm.tagline}
                  onChange={(e) => setCandForm({ ...candForm, tagline: e.target.value })}
                  className={inputCls}
                />
                <textarea
                  placeholder="Manifesto / statement"
                  rows={3}
                  value={candForm.statement}
                  onChange={(e) => setCandForm({ ...candForm, statement: e.target.value })}
                  className={inputCls + ' resize-y'}
                />

                <button type="submit" disabled={busy} className={btnPrimary}>
                  <Plus className="w-4 h-4" />
                  <span>{candForm.id ? 'Save Candidate' : 'Create Candidate'}</span>
                </button>
              </form>
            )}

            <div className="space-y-3">
              {candidates.map((c) => {
                const office = offices.find((o) => o.id === c.office_id);
                return (
                  <div key={c.id} className="border border-gray-200 dark:border-[#1E2E4E] rounded-2xl p-4 flex items-start justify-between gap-3">
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0">
                        {c.full_name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-sm text-gray-900 dark:text-white">{c.full_name}</h3>
                        <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400">RA-{c.ra_number}</span>
                        {c.tagline && <p className="text-[11px] text-gray-500 dark:text-slate-400 italic line-clamp-1">"{c.tagline}"</p>}
                        <span className="text-[10px] text-gray-400">for {office?.title || 'unknown office'}</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1 shrink-0">
                      <button
                        onClick={() => setCandForm({ id: c.id, office_id: c.office_id, ra_number: c.ra_number, full_name: c.full_name, tagline: c.tagline, statement: c.statement })}
                        className={btnDanger + ' text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30'}
                        title="Edit candidate"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => deleteCandidate(c.id)} disabled={busy} className={btnDanger} title="Delete candidate">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
              {candidates.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">
                  No candidates yet.
                </p>
              )}
            </div>
          </section>
        </div>
      )}

      {/* ---------------- SETTINGS ---------------- */}
      {tab === 'settings' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <section className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#1E2E4E] rounded-3xl p-6 shadow-sm space-y-5">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <span>Platform & Election Details</span>
            </h2>

            <div className="grid grid-cols-2 gap-3">
              <div className={settings?.registration_open ? '' : 'opacity-90'}>
                <div className="rounded-2xl border border-gray-200 dark:border-[#1E2E4E] p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-sm text-gray-900 dark:text-white">Voter Registration</p>
                      <p className="text-[11px] text-gray-500 dark:text-slate-400">
                        {settings?.registration_open ? 'Open — voters can register' : 'Closed — registration is locked'}
                      </p>
                    </div>
                    <button
                      onClick={() => toggleSetting('registration_open')}
                      disabled={busy}
                      className={`p-1.5 rounded-lg transition-colors ${
                        settings?.registration_open
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                          : 'bg-gray-200 dark:bg-slate-800 text-gray-500'
                      }`}
                    >
                      {settings?.registration_open ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <div className="rounded-2xl border border-gray-200 dark:border-[#1E2E4E] p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-sm text-gray-900 dark:text-white">Voting</p>
                      <p className="text-[11px] text-gray-500 dark:text-slate-400">
                        {settings?.voting_open ? 'Open — ballots are being accepted' : 'Closed — no ballots accepted'}
                      </p>
                    </div>
                    <button
                      onClick={() => toggleSetting('voting_open')}
                      disabled={busy}
                      className={`p-1.5 rounded-lg transition-colors ${
                        settings?.voting_open
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                          : 'bg-gray-200 dark:bg-slate-800 text-gray-500'
                      }`}
                    >
                      {settings?.voting_open ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <form onSubmit={saveSettings} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1 text-gray-700 dark:text-slate-300">Site Name</label>
                <input
                  type="text"
                  value={settingsForm.site_name}
                  onChange={(e) => setSettingsForm({ ...settingsForm, site_name: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1 text-gray-700 dark:text-slate-300">Election Start</label>
                  <input
                    type="datetime-local"
                    value={settingsForm.election_start}
                    onChange={(e) => setSettingsForm({ ...settingsForm, election_start: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1 text-gray-700 dark:text-slate-300">Election End</label>
                  <input
                    type="datetime-local"
                    value={settingsForm.election_end}
                    onChange={(e) => setSettingsForm({ ...settingsForm, election_end: e.target.value })}
                    className={inputCls}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1 text-gray-700 dark:text-slate-300">About Title</label>
                <input
                  type="text"
                  value={settingsForm.about_title}
                  onChange={(e) => setSettingsForm({ ...settingsForm, about_title: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1 text-gray-700 dark:text-slate-300">About Content</label>
                <textarea
                  rows={4}
                  value={settingsForm.about_content}
                  onChange={(e) => setSettingsForm({ ...settingsForm, about_content: e.target.value })}
                  className={inputCls + ' resize-y'}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1 text-gray-700 dark:text-slate-300">About Image URL (optional)</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={settingsForm.about_image_url}
                  onChange={(e) => setSettingsForm({ ...settingsForm, about_image_url: e.target.value })}
                  className={inputCls}
                />
              </div>
              <button type="submit" disabled={busy} className={btnPrimary}>
                <CheckCircle2 className="w-4 h-4" />
                <span>{busy ? 'Saving...' : 'Save Settings'}</span>
              </button>
            </form>
          </section>

          <section className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#1E2E4E] rounded-3xl p-6 shadow-sm space-y-4 self-start">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Election Snapshot</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-gray-200 dark:border-[#1E2E4E] p-4">
                <div className="flex items-center space-x-2 text-[11px] font-semibold text-gray-500 dark:text-slate-400">
                  <Hash className="w-3.5 h-3.5" />
                  <span>Voters</span>
                </div>
                <p className="text-2xl font-extrabold text-gray-900 dark:text-white mt-1">{voters.length}</p>
              </div>
              <div className="rounded-2xl border border-gray-200 dark:border-[#1E2E4E] p-4">
                <div className="flex items-center space-x-2 text-[11px] font-semibold text-gray-500 dark:text-slate-400">
                  <Mail className="w-3.5 h-3.5" />
                  <span>Bank Entries</span>
                </div>
                <p className="text-2xl font-extrabold text-gray-900 dark:text-white mt-1">{bankEntries.length}</p>
              </div>
              <div className="rounded-2xl border border-gray-200 dark:border-[#1E2E4E] p-4">
                <div className="flex items-center space-x-2 text-[11px] font-semibold text-gray-500 dark:text-slate-400">
                  <Briefcase className="w-3.5 h-3.5" />
                  <span>Offices</span>
                </div>
                <p className="text-2xl font-extrabold text-gray-900 dark:text-white mt-1">{offices.length}</p>
              </div>
              <div className="rounded-2xl border border-gray-200 dark:border-[#1E2E4E] p-4">
                <div className="flex items-center space-x-2 text-[11px] font-semibold text-gray-500 dark:text-slate-400">
                  <UserRound className="w-3.5 h-3.5" />
                  <span>Candidates</span>
                </div>
                <p className="text-2xl font-extrabold text-gray-900 dark:text-white mt-1">{candidates.length}</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/40 text-purple-800 dark:text-purple-300 text-xs space-y-1.5">
              <p className="font-bold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                Guardrails enforced by the database
              </p>
              <p>• Voters may only register if their RA + email are in the bank.</p>
              <p>• Nobody can see another voter's details or the bank list.</p>
              <p>• Admins cannot edit or delete the Superadmin account.</p>
              <p>• Ballots are one-per-position, enforced at the database level.</p>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};