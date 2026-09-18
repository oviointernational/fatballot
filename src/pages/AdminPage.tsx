import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  UserPlus, 
  Settings, 
  Users, 
  Plus, 
  CheckCircle2, 
  AlertCircle, 
  Calendar, 
  Eye, 
  Globe, 
  FileText,
  Briefcase,
  Lock,
  Layers,
  Save,
  Check,
  Search,
  Trash2,
  Undo,
  ExternalLink,
  Copy,
  RefreshCw,
  Award,
  ShieldCheck,
  UserCheck,
  Radio,
  Clock,
  Edit3,
  ArrowUpDown,
  X,
  Play,
  Square,
  Zap,
  KeyRound,
  Ban
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useElection } from '../context/ElectionContext';
import { supabase } from '../lib/supabase';
import { mapVoterRow, mapAgentRow, mapObserverRow, mapTimelineRow, mapScreeningCriteriaRow, mapCandidateScreeningRow } from '../lib/mappers';
import { 
  SiteSettings, 
  Voter, 
  Office, 
  CandidateProfile, 
  ScreeningCriteria, 
  ElectionAgent, 
  Observer,
  CandidateScreening,
  TimelineItem
} from '../types';

type AdminTab = 'access' | 'committee' | 'users' | 'offices' | 'agents' | 'observers' | 'timeline';

const genToken = (): string =>
  Array.from(crypto.getRandomValues(new Uint8Array(24)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

export const AdminPage: React.FC<{ onNavigate: (page: string) => void }> = ({ onNavigate }) => {
  const { user, sessionToken } = useAuth();
  const { settings, updateSettings, refreshAll, offices, candidates } = useElection();

  const isSuperadmin = user?.role === 'superadmin';
  const isCommittee = user?.role === 'committee';
  const canAccessAdmin = isSuperadmin || isCommittee;

  const audit = async (eventType: string, details: Record<string, any>): Promise<void> => {
    const { error } = await supabase.rpc('append_audit', {
      p_event_type: eventType,
      p_actor: user
        ? { id: user.id, raNumber: user.raNumber, name: user.name, email: user.email, role: user.role }
        : {},
      p_details: details
    });
    if (error) console.error('Audit append failed', error);
  };

  const [activeTab, setActiveTab] = useState<AdminTab>(() => isSuperadmin ? 'access' : 'users');
  
  // Data lists
  const [voters, setVoters] = useState<Voter[]>([]);
  const [agents, setAgents] = useState<ElectionAgent[]>([]);
  const [observers, setObservers] = useState<Observer[]>([]);
  const [screeningCriteria, setScreeningCriteria] = useState<ScreeningCriteria[]>([]);

  // Tab 2: Committee Admin state
  const [committeeAdmins, setCommitteeAdmins] = useState<Voter[]>([]);
  const [committeeSearch, setCommitteeSearch] = useState('');
  const [showAddCommitteeModal, setShowAddCommitteeModal] = useState(false);
  const [selectedVoterIdsForCommittee, setSelectedVoterIdsForCommittee] = useState<string[]>([]);
  const [voterSearchForCommittee, setVoterSearchForCommittee] = useState('');
  const [addingCommittee, setAddingCommittee] = useState(false);
  const [committeeFeedback, setCommitteeFeedback] = useState<string | null>(null);
  const [appointmentRole, setAppointmentRole] = useState<'committee' | 'ycec'>('committee');

  // Auto-redirect away from Superadmin-only tabs if user is committee admin
  useEffect(() => {
    if (!isSuperadmin && (activeTab === 'access' || activeTab === 'committee')) {
      setActiveTab('users');
    }
  }, [isSuperadmin, activeTab]);

  // Modals & details
  const [selectedUserForDetail, setSelectedUserForDetail] = useState<Voter | null>(null);

  // Edit-user state (Superadmin record included — editable from this chamber)
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [editFirstName, setEditFirstName] = useState('');
  const [editMiddleName, setEditMiddleName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editDepartment, setEditDepartment] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [savingUserEdit, setSavingUserEdit] = useState(false);

  // Tab 1: Access Control & Superadmin Settings
  const [permissions, setPermissions] = useState(settings.permissions || {
    canRegisterUsers: ['superadmin', 'committee'],
    canAccreditUsers: ['superadmin', 'committee'],
    canCreateOffices: ['superadmin', 'committee'],
    canAssignOffices: ['superadmin', 'committee'],
    canCreateScreeningCriteria: ['superadmin', 'committee'],
    canAssignAgents: ['superadmin', 'committee'],
    canCreateObservers: ['superadmin']
  });
  const [siteName, setSiteName] = useState(settings.siteName);
  const [aboutTitle, setAboutTitle] = useState(settings.aboutTitle);
  const [aboutContent, setAboutContent] = useState(settings.aboutContent);
  const [aboutImageUrl, setAboutImageUrl] = useState(settings.aboutImageUrl);
  const [startTime, setStartTime] = useState(settings.electionStartTime.slice(0, 16));
  const [endTime, setEndTime] = useState(settings.electionEndTime.slice(0, 16));
  const [contestantsCanViewVoters, setContestantsCanViewVoters] = useState(settings.contestantsCanViewVoters);
  const [publicAuditLog, setPublicAuditLog] = useState(settings.publicAuditLog);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsFeedback, setSettingsFeedback] = useState<string | null>(null);

  // Reset-election / end-election modals (SuperAdmin password re-verification)
  const [showResetElectionModal, setShowResetElectionModal] = useState(false);
  const [resetElectionStart, setResetElectionStart] = useState('');
  const [resetElectionHours, setResetElectionHours] = useState('72');
  const [resetElectionPassword, setResetElectionPassword] = useState('');
  const [resetElectionError, setResetElectionError] = useState<string | null>(null);
  const [resettingElection, setResettingElection] = useState(false);

  const [showEndElectionModal, setShowEndElectionModal] = useState(false);
  const [endElectionPassword, setEndElectionPassword] = useState('');
  const [endElectionError, setEndElectionError] = useState<string | null>(null);
  const [endingElection, setEndingElection] = useState(false);

  const [showNoElectionModal, setShowNoElectionModal] = useState(false);
  const [noElectionPassword, setNoElectionPassword] = useState('');
  const [noElectionError, setNoElectionError] = useState<string | null>(null);
  const [voidingElection, setVoidingElection] = useState(false);
  
  // Election status computation (local, mirrors ElectionContext logic)
  const now = new Date().getTime();
  const noElection = settings.electionMode === 'none';
  const electionStart = new Date(settings.electionStartTime).getTime();
  const electionEnd = new Date(settings.electionEndTime).getTime();
  const isElectionActiveNow = !noElection && now >= electionStart && now <= electionEnd;

  // Tab 2: Users
  const [userSearch, setUserSearch] = useState('');
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [regFirstName, setRegFirstName] = useState('');
  const [regMiddleName, setRegMiddleName] = useState('');
  const [regLastName, setRegLastName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regRaNumber, setRegRaNumber] = useState('');
  const [regRole, setRegRole] = useState<'voter' | 'contestant' | 'committee'>('voter');
  const [regDepartment, setRegDepartment] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regError, setRegError] = useState<string | null>(null);
  const [submittingUser, setSubmittingUser] = useState(false);

  // Reset-password state (user detail modal)
  const [resetPassword, setResetPassword] = useState('');
  const [resetFeedback, setResetFeedback] = useState<string | null>(null);
  const [resettingPassword, setResettingPassword] = useState(false);

  // Tab 3: Offices
  const [officeSearch, setOfficeSearch] = useState('');
  const [newOfficeTitle, setNewOfficeTitle] = useState('');
  const [newOfficeDesc, setNewOfficeDesc] = useState('');
  const [selectedOfficeForAssign, setSelectedOfficeForAssign] = useState<string>('');
  const [assignUserSearch, setAssignUserSearch] = useState('');
  const [assignOfficeError, setAssignOfficeError] = useState<string | null>(null);

  // Screening Criteria management
  const [selectedOfficeForCriteria, setSelectedOfficeForCriteria] = useState<string>('');
  const [criteriaTitle, setCriteriaTitle] = useState('');
  const [criteriaItems, setCriteriaItems] = useState<string[]>(['']);
  const [savingCriteria, setSavingCriteria] = useState(false);

  // Screening Evaluation Tool
  const [screeningCandidateId, setScreeningCandidateId] = useState<string>('');
  const [evalResults, setEvalResults] = useState<{ criterion: string; passed: boolean }[]>([]);
  const [screeningFeedback, setScreeningFeedback] = useState<string | null>(null);

  // Tab 4: Agents
  const [agentSearch, setAgentSearch] = useState('');
  const [showAddAgentModal, setShowAddAgentModal] = useState(false);
  const [agentOfficeId, setAgentOfficeId] = useState('');
  const [agentVoterId, setAgentVoterId] = useState('');
  const [agentCandidateId, setAgentCandidateId] = useState('');
  const [agentError, setAgentError] = useState<string | null>(null);

  // Tab 5: Observers
  const [observerSearch, setObserverSearch] = useState('');
  const [showAddObserverModal, setShowAddObserverModal] = useState(false);
  const [obsName, setObsName] = useState('');
  const [obsRank, setObsRank] = useState('');
  const [obsOffice, setObsOffice] = useState('');
  const [obsPhone, setObsPhone] = useState('');
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Tab 6: Timeline Management state
  const [timelineItems, setTimelineItems] = useState<TimelineItem[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [editingMilestoneId, setEditingMilestoneId] = useState<string | null>(null);
  const [milestoneTitle, setMilestoneTitle] = useState('');
  const [milestoneDate, setMilestoneDate] = useState('');
  const [milestoneDesc, setMilestoneDesc] = useState('');
  const [milestoneStatus, setMilestoneStatus] = useState<'completed' | 'active' | 'upcoming'>('upcoming');
  const [milestoneOrder, setMilestoneOrder] = useState<number>(1);
  const [milestoneIcon, setMilestoneIcon] = useState('Clock');
  const [timelineFeedback, setTimelineFeedback] = useState<string | null>(null);
  const [timelineSearch, setTimelineSearch] = useState('');

  useEffect(() => {
    fetchAllData();
  }, [sessionToken, user?.id]);

  const fetchAllData = async () => {
    try {
      const [votersRes, agentsRes, obsRes, critRes, timeRes] = await Promise.all([
        supabase.from('voters').select('*').order('ra_number'),
        supabase.from('agents').select('*').order('assigned_at', { ascending: false }),
        supabase.from('observers').select('*'),
        supabase.from('screening_criteria').select('*'),
        supabase.from('timeline').select('*').order('"order"')
      ]);

      if (!votersRes.error) setVoters((votersRes.data || []).map(mapVoterRow));
      if (!agentsRes.error) setAgents((agentsRes.data || []).map(mapAgentRow));
      if (!obsRes.error) setObservers((obsRes.data || []).map(mapObserverRow));
      if (!critRes.error) setScreeningCriteria((critRes.data || []).map(mapScreeningCriteriaRow));
      if (!timeRes.error) setTimelineItems((timeRes.data || []).map(mapTimelineRow));
      setCommitteeAdmins((votersRes.data || []).map(mapVoterRow).filter(v => v.role === 'committee' || v.role === 'ycec'));
    } catch (e) {
      console.error(e);
    }
  };

  const fetchTimeline = async () => {
    setTimelineLoading(true);
    try {
      const res = await supabase.from('timeline').select('*').order('"order"');
      if (!res.error) setTimelineItems((res.data || []).map(mapTimelineRow));
    } catch (e) {
      console.error(e);
    } finally {
      setTimelineLoading(false);
    }
  };

  // ----------------------------------------------------
  // ACTION HANDLERS
  // ----------------------------------------------------

  // Committee Admin / YCEC Commissioner Handlers
  const handleAddCommitteeAdmins = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedVoterIdsForCommittee.length === 0) return;

    setAddingCommittee(true);
    try {
      const targetRole: 'committee' | 'ycec' = appointmentRole;
      const selected = voters.filter(v => selectedVoterIdsForCommittee.includes(v.id));

      const { error } = await supabase
        .from('voters')
        .update({ role: targetRole })
        .in('id', selectedVoterIdsForCommittee);

      if (!error) {
        if (targetRole === 'ycec') {
          const rows = selected.map(v => ({
            id: `ycec-${v.id}`,
            name: `${v.firstName} ${v.middleName ? v.middleName + ' ' : ''}${v.lastName}`,
            role: 'YCEC Commissioner',
            email: v.email,
            phone: v.phone || '',
            avatar: v.avatar || '',
            tenure: ''
          }));
          await supabase.from('ycec_members').upsert(rows, { onConflict: 'id' });
          setCommitteeFeedback(`${selectedVoterIdsForCommittee.length} officer(s) appointed as YCEC Commissioner(s)!`);
          audit('YCEC_COMMISSIONER_APPOINTED', { voterIds: selectedVoterIdsForCommittee });
        } else {
          setCommitteeFeedback(`${selectedVoterIdsForCommittee.length} officer(s) appointed to Committee!`);
          audit('COMMITTEE_ADMINS_APPOINTED', { voterIds: selectedVoterIdsForCommittee });
        }
        setTimeout(() => setCommitteeFeedback(null), 4000);
        setShowAddCommitteeModal(false);
        setSelectedVoterIdsForCommittee([]);
        fetchAllData();
      } else {
        alert(error.message || 'Failed to appoint officers.');
      }
    } catch (err) {
      console.error(err);
      alert('Network error appointing officers.');
    } finally {
      setAddingCommittee(false);
    }
  };

  const handleRemoveCommitteeAdmin = async (voterId: string) => {
    const officer = committeeAdmins.find(v => v.id === voterId);
    const label = officer?.role === 'ycec' ? 'YCEC Commissioner' : 'Electoral Committee officer';
    if (!confirm(`Are you sure you want to remove this officer (${label})?`)) return;
    try {
      const { error } = await supabase
        .from('voters')
        .update({ role: 'voter' })
        .eq('id', voterId);

      if (!error) {
        if (officer?.role === 'ycec') {
          await supabase.from('ycec_members').delete().eq('id', `ycec-${voterId}`);
          audit('YCEC_COMMISSIONER_REMOVED', { voterId });
        } else {
          audit('COMMITTEE_ADMIN_REMOVED', { voterId });
        }
        setCommitteeFeedback('Officer removed.');
        setTimeout(() => setCommitteeFeedback(null), 4000);
        fetchAllData();
      } else {
        alert(error.message || 'Failed to remove officer.');
      }
    } catch (err) {
      console.error(err);
      alert('Network error removing committee administrator.');
    }
  };

  // Timeline Action Handlers
  const handleSaveMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!milestoneTitle.trim() || !milestoneDate.trim()) {
      alert('Please provide milestone title and date/period.');
      return;
    }

    setTimelineLoading(true);
    try {
      if (editingMilestoneId) {
        const res = await supabase
          .from('timeline')
          .update({
            title: milestoneTitle,
            date: milestoneDate,
            description: milestoneDesc,
            status: milestoneStatus,
            order: Number(milestoneOrder),
            icon: milestoneIcon
          })
          .eq('id', editingMilestoneId)
          .select('*')
          .single();

        if (!res.error && res.data) {
          setTimelineItems(prev => prev.map(t => t.id === editingMilestoneId ? mapTimelineRow(res.data) : t).sort((a, b) => a.order - b.order));
          setTimelineFeedback('Milestone updated successfully!');
          audit('MILESTONE_UPDATED', { milestoneId: editingMilestoneId, title: milestoneTitle });
          resetMilestoneForm();
        } else {
          alert('Failed to update milestone');
        }
      } else {
        const res = await supabase
          .from('timeline')
          .insert({
            id: `time-${Date.now()}`,
            title: milestoneTitle,
            date: milestoneDate,
            description: milestoneDesc,
            status: milestoneStatus,
            order: Number(milestoneOrder) || timelineItems.length + 1,
            icon: milestoneIcon
          })
          .select('*')
          .single();

        if (!res.error && res.data) {
          setTimelineItems(prev => [...prev, mapTimelineRow(res.data)].sort((a, b) => a.order - b.order));
          setTimelineFeedback('New electoral milestone created!');
          audit('MILESTONE_CREATED', { milestoneId: res.data.id, title: milestoneTitle });
          resetMilestoneForm();
        } else {
          alert('Failed to create milestone');
        }
      }
      setTimeout(() => setTimelineFeedback(null), 3500);
    } catch (err) {
      console.error(err);
      alert('Network error saving milestone');
    } finally {
      setTimelineLoading(false);
    }
  };

  const resetMilestoneForm = () => {
    setEditingMilestoneId(null);
    setMilestoneTitle('');
    setMilestoneDate('');
    setMilestoneDesc('');
    setMilestoneStatus('upcoming');
    setMilestoneOrder(timelineItems.length + 1);
    setMilestoneIcon('Clock');
  };

  const handleEditMilestone = (item: TimelineItem) => {
    setEditingMilestoneId(item.id);
    setMilestoneTitle(item.title);
    setMilestoneDate(item.date);
    setMilestoneDesc(item.description);
    setMilestoneStatus(item.status);
    setMilestoneOrder(item.order);
    setMilestoneIcon(item.icon || 'Clock');
    window.scrollTo({ top: 400, behavior: 'smooth' });
  };

  const handleDeleteMilestone = async (id: string) => {
    if (!confirm('Are you sure you want to delete this electoral milestone?')) return;
    try {
      const { error } = await supabase.from('timeline').delete().eq('id', id);
      if (!error) {
        setTimelineItems(prev => prev.filter(t => t.id !== id));
        if (editingMilestoneId === id) resetMilestoneForm();
        setTimelineFeedback('Milestone removed.');
        audit('MILESTONE_DELETED', { milestoneId: id });
        setTimeout(() => setTimelineFeedback(null), 3000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleQuickStatusToggle = async (id: string, newStatus: 'completed' | 'active' | 'upcoming') => {
    try {
      const res = await supabase
        .from('timeline')
        .update({ status: newStatus })
        .eq('id', id)
        .select('*')
        .single();
      if (!res.error && res.data) {
        setTimelineItems(prev => prev.map(t => t.id === id ? mapTimelineRow(res.data) : t));
        audit('MILESTONE_STATUS_CHANGED', { milestoneId: id, status: newStatus });
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Accredit / Un-accredit Toggle
  const handleToggleAccreditation = async (voter: Voter, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const res = await supabase
        .from('voters')
        .update({ is_accredited: !voter.isAccredited })
        .eq('id', voter.id)
        .select('*')
        .single();

      if (!res.error && res.data) {
        const updated = mapVoterRow(res.data);
        setVoters(prev => prev.map(v => v.id === updated.id ? updated : v));
        if (selectedUserForDetail?.id === updated.id) {
          setSelectedUserForDetail(updated);
        }
        audit(updated.isAccredited ? 'VOTER_ACCREDITED' : 'VOTER_UNACCREDITED', { voterId: voter.id, raNumber: voter.raNumber });
        refreshAll();
      } else {
        alert(res.error?.message || 'Failed to update accreditation.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Edit Voter (name, email, department, phone — Superadmin included)
  const startEditingUser = (voter: Voter) => {
    setEditFirstName(voter.firstName);
    setEditMiddleName(voter.middleName || '');
    setEditLastName(voter.lastName);
    setEditEmail(voter.email);
    setEditDepartment(voter.department || '');
    setEditPhone(voter.phone || '');
    setEditError(null);
    setIsEditingUser(true);
  };

  const handleSaveUserEdit = async () => {
    if (!selectedUserForDetail) return;
    if (!editFirstName.trim() || !editLastName.trim() || !editEmail.trim()) {
      setEditError('First name, last name, and email are required.');
      return;
    }
    setSavingUserEdit(true);
    setEditError(null);
    try {
      if (editEmail.trim().toLowerCase() !== (selectedUserForDetail.email || '').toLowerCase()) {
        setEditError('The email is the voter\'s sign-in identifier and cannot be changed here. Use the Registration Bank to provision a fresh account if needed.');
        return;
      }
      const res = await supabase
        .from('voters')
        .update({
          first_name: editFirstName.trim(),
          middle_name: editMiddleName.trim(),
          last_name: editLastName.trim(),
          department: editDepartment.trim(),
          phone: editPhone.trim()
        })
        .eq('id', selectedUserForDetail.id)
        .select('*')
        .single();
      if (!res.error && res.data) {
        const updated = mapVoterRow(res.data);
        setVoters(prev => prev.map(v => v.id === updated.id ? updated : v));
        setSelectedUserForDetail(updated);
        setIsEditingUser(false);
        audit('VOTER_DETAILS_UPDATED', { voterId: selectedUserForDetail.id });
        refreshAll();
      } else {
        setEditError(res.error?.message || 'Failed to save changes.');
      }
    } catch (err: any) {
      setEditError(err.message || 'Network error.');
    } finally {
      setSavingUserEdit(false);
    }
  };

  // Reset a voter's password (self-service email)
  const handleResetPassword = async () => {
    if (!selectedUserForDetail) return;
    setResettingPassword(true);
    setResetFeedback(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(selectedUserForDetail.email || '');
      if (!error) {
        setResetFeedback('Password reset email sent to the voter. They must click the link in the email and set a new password (self-service).');
        setResetPassword('');
        audit('PASSWORD_RESET_REQUESTED', { raNumber: selectedUserForDetail.raNumber });
      } else {
        throw error;
      }
    } catch (err: any) {
      setResetFeedback(err.message || 'Reset failed.');
    } finally {
      setResettingPassword(false);
    }
  };

  // Delete Voter
  const handleDeleteVoter = async (voterId: string) => {    if (!confirm('Are you sure you want to remove this voter? You can re-register them anytime.')) return;
    try {
      await supabase.from('votes').delete().eq('voter_ra_number', voters.find(v => v.id === voterId)?.raNumber || '');
      const { error } = await supabase.from('voters').delete().eq('id', voterId);
      if (!error) {
        setVoters(prev => prev.filter(v => v.id !== voterId));
        setSelectedUserForDetail(null);
        audit('VOTER_DELETED', { voterId });
        refreshAll();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Register New User
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);
    if (!regFirstName || !regLastName || !regEmail || !regRaNumber) {
      setRegError('First name, last name, email, and numeric RA number are required.');
      return;
    }
    if (!regPassword || regPassword.length < 6) {
      setRegError('Set an initial password of at least 6 characters and share it securely with the voter.');
      return;
    }

    setSubmittingUser(true);
    try {
      const { error } = await supabase
        .from('registration_bank')
        .insert({
          id: `bank-${Date.now()}`,
          ra_number: regRaNumber.trim(),
          email: regEmail.trim().toLowerCase(),
          full_name: `${regFirstName.trim()} ${regMiddleName.trim() ? regMiddleName.trim() + ' ' : ''}${regLastName.trim()}`.trim()
        });

      if (!error) {
        setVoters(prev => prev);
        audit('AUTH_ACTIVATION_REQUESTED', {
          raNumber: regRaNumber.trim(),
          email: regEmail.trim().toLowerCase(),
          requestedRole: regRole
        });
        alert(`${regFirstName.trim()} ${regLastName.trim()} added to the Registration Bank. They can now self-register at the sign-in screen with RA-${regRaNumber.trim()} and their email.`);
        setShowCreateUserModal(false);
        setRegFirstName('');
        setRegMiddleName('');
        setRegLastName('');
        setRegEmail('');
        setRegRaNumber('');
        setRegDepartment('');
        setRegPhone('');
        setRegPassword('');
        refreshAll();
      } else {
        if (error.code === '23505') {
          setRegError('That RA number or email is already in the Registration Bank.');
        } else {
          setRegError(error.message || 'Registration provisioning failed.');
        }
      }
    } catch (err: any) {
      setRegError(err.message || 'Network error.');
    } finally {
      setSubmittingUser(false);
    }
  };

  // Create Office
  const handleCreateOffice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOfficeTitle) return;

    try {
      const res = await supabase
        .from('offices')
        .insert({
          id: `off-${Date.now()}`,
          title: newOfficeTitle,
          description: newOfficeDesc || 'Executive Contested Office',
          order: offices.length + 1,
          icon: 'Crown'
        })
        .select('*')
        .single();

      if (!res.error) {
        setNewOfficeTitle('');
        setNewOfficeDesc('');
        audit('OFFICE_CREATED', { officeTitle: newOfficeTitle });
        refreshAll();
      } else {
        alert(res.error.message || 'Failed to create office.');
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Delete Office
  const handleDeleteOffice = async (officeId: string) => {
    if (!confirm('Are you sure you want to delete this office? All contestant assignments can be redone.')) return;
    try {
      const { error } = await supabase.from('offices').delete().eq('id', officeId);
      if (!error) {
        audit('OFFICE_DELETED', { officeId });
        refreshAll();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Assign Office to User
  const handleAssignOffice = async (voterId: string, officeId: string) => {
    setAssignOfficeError(null);
    try {
      const voter = voters.find(v => v.id === voterId);
      if (!voter) { setAssignOfficeError('Voter not found.'); return; }

      // Upsert candidate row
      const existingCand = candidates.find(c => c.raNumber === voter.raNumber);
      if (!existingCand) {
        await supabase.from('candidates').insert({
          id: `cand-${Date.now()}`,
          office_id: officeId,
          voter_id: voterId,
          name: `${voter.firstName} ${voter.middleName ? voter.middleName + ' ' : ''}${voter.lastName}`,
          ra_number: voter.raNumber,
          avatar: voter.avatar || '',
          tagline: '',
          vision: '',
          antecedent: [],
          current_offices: [],
          achievements: [],
          contact_email: voter.email
        });
      }

      const res = await supabase
        .from('voters')
        .update({ role: 'contestant', assigned_office_id: officeId })
        .eq('id', voterId)
        .select('*')
        .single();

      if (!res.error && res.data) {
        const updated = mapVoterRow(res.data);
        setVoters(prev => prev.map(v => v.id === updated.id ? updated : v));
        audit('OFFICE_ASSIGNED', { voterId, officeId, raNumber: voter.raNumber });
        refreshAll();
      } else {
        setAssignOfficeError(res.error?.message || 'Assignment failed.');
      }
    } catch (err: any) {
      setAssignOfficeError(err.message || 'Network error.');
    }
  };

  const handleUnassignOffice = async (voterId: string) => {
    try {
      // Remove candidate rows for this voter
      await supabase.from('candidates').delete().eq('voter_id', voterId);

      const res = await supabase
        .from('voters')
        .update({ role: 'voter', assigned_office_id: null })
        .eq('id', voterId)
        .select('*')
        .single();

      if (!res.error && res.data) {
        const updated = mapVoterRow(res.data);
        setVoters(prev => prev.map(v => v.id === updated.id ? updated : v));
        audit('OFFICE_UNASSIGNED', { voterId });
        refreshAll();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Save Screening Criteria
  const handleSaveCriteria = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOfficeForCriteria || !criteriaTitle) return;

    const cleanedItems = criteriaItems.map(c => c.trim()).filter(Boolean);
    if (cleanedItems.length === 0) {
      alert('Please add at least one screening criterion.');
      return;
    }

    setSavingCriteria(true);
    try {
      const res = await supabase
        .from('screening_criteria')
        .upsert({
          id: `crit-${Date.now()}`,
          office_id: selectedOfficeForCriteria,
          title: criteriaTitle,
          criteria: cleanedItems
        }, { onConflict: 'office_id' })
        .select('*')
        .single();

      if (!res.error && res.data) {
        const saved = mapScreeningCriteriaRow(res.data);
        setScreeningCriteria(prev => {
          const filtered = prev.filter(sc => sc.officeId !== selectedOfficeForCriteria);
          return [...filtered, saved];
        });
        audit('SCREENING_CRITERIA_UPDATED', { officeId: selectedOfficeForCriteria, title: criteriaTitle });
        alert('Screening criteria saved successfully!');
      } else {
        alert(res.error?.message || 'Failed to save screening criteria.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingCriteria(false);
    }
  };

  // Submit Candidate Screening
  const handleSubmitScreening = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!screeningCandidateId || evalResults.length === 0) return;

    const cand = candidates.find(c => c.id === screeningCandidateId);
    if (!cand) return;

    try {
      const scored = evalResults.filter(r => r.passed).length;
      const total = evalResults.length;
      const percentage = Math.round((scored / total) * 100);
      const isScreened = percentage >= 50;

      const res = await supabase
        .from('candidate_screenings')
        .upsert({
          candidate_id: cand.id,
          office_id: cand.officeId,
          results: evalResults,
          passed_count: scored,
          total_count: total,
          percentage,
          is_screened: isScreened,
          screened_at: new Date().toISOString()
        }, { onConflict: 'candidate_id' })
        .select('*')
        .single();

      if (!res.error) {
        await supabase.from('voters').update({ is_screened: isScreened }).eq('ra_number', cand.raNumber);
        setScreeningFeedback(
          isScreened
            ? `PASSED (${scored}/${total} - ${percentage}%). Candidate declared SCREENED!`
            : `FAILED (${scored}/${total} - ${percentage}%). Needs >= 50% to be screened.`
        );
        audit(isScreened ? 'CANDIDATE_SCREENED_PASS' : 'CANDIDATE_SCREENED_FAIL', {
          candidateId: cand.id,
          candidateName: cand.name,
          officeId: cand.officeId,
          passedCount: scored,
          totalCount: total,
          percentage
        });
        fetchAllData();
        refreshAll();
      } else {
        alert(res.error.message || 'Screening submission failed.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Assign Agent
  const handleAssignAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    setAgentError(null);
    if (!agentOfficeId || !agentVoterId || !agentCandidateId) {
      setAgentError('Please select office, voter, and candidate.');
      return;
    }

    try {
      const voter = voters.find(v => v.id === agentVoterId);
      const cand = candidates.find(c => c.id === agentCandidateId);
      if (!voter || !cand) {
        setAgentError('Selected voter or candidate no longer exists. Refresh and try again.');
        return;
      }

      const { data, error } = await supabase
        .from('agents')
        .insert({
          id: `agent-${Date.now()}`,
          voter_id: voter.id,
          voter_ra_number: Number(voter.raNumber),
          voter_name: `${voter.firstName} ${voter.middleName ? voter.middleName + ' ' : ''}${voter.lastName}`,
          office_id: agentOfficeId,
          candidate_id: cand.id,
          candidate_name: cand.name
        })
        .select('*')
        .single();

      if (!error && data) {
        await supabase
          .from('voters')
          .update({ is_agent: true, agent_office_id: agentOfficeId, agent_candidate_id: cand.id })
          .eq('id', voter.id);
        setAgents(prev => [...prev, mapAgentRow(data)]);
        setShowAddAgentModal(false);
        setAgentVoterId('');
        setAgentCandidateId('');
        audit('AGENT_ASSIGNED', { voterId: voter.id, voterRa: voter.raNumber, candidateId: cand.id, candidateName: cand.name });
        fetchAllData();
      } else {
        setAgentError(error?.message || 'Agent assignment failed.');
      }
    } catch (err: any) {
      setAgentError(err.message || 'Network error.');
    }
  };

  // Remove Agent
  const handleDeleteAgent = async (agentId: string) => {
    if (!confirm('Remove this agent? You can assign a new agent anytime.')) return;
    try {
      const agent = agents.find(a => a.id === agentId);
      const { error } = await supabase.from('agents').delete().eq('id', agentId);
      if (!error) {
        if (agent) {
          await supabase
            .from('voters')
            .update({ is_agent: false, agent_office_id: null, agent_candidate_id: null })
            .eq('id', agent.voterId);
          audit('AGENT_REMOVED', { voterId: agent.voterId, candidateId: agent.candidateId });
        }
        setAgents(prev => prev.filter(a => a.id !== agentId));
        fetchAllData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Add Observer
  const handleAddObserver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!obsName || !obsRank || !obsPhone) {
      alert('Name, rank, and phone are required.');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('observers')
        .insert({
          id: `obs-${Date.now()}`,
          name: obsName,
          rank: obsRank,
          office: obsOffice || '',
          phone: obsPhone,
          token: genToken()
        })
        .select('*')
        .single();

      if (!error && data) {
        const newObs = mapObserverRow(data);
        setObservers(prev => [...prev, newObs]);
        setShowAddObserverModal(false);
        setObsName('');
        setObsRank('');
        setObsOffice('');
        setObsPhone('');
        audit('OBSERVER_CREATED', { observerId: newObs.id, name: newObs.name });
      } else {
        alert(error?.message || 'Failed to add observer.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Regenerate Observer Link
  const handleRegenerateObserverLink = async (observerId: string) => {
    if (!confirm('Regenerate link? The previous observer link will be immediately invalidated.')) return;
    try {
      const res = await supabase
        .from('observers')
        .update({ token: genToken() })
        .eq('id', observerId)
        .select('*')
        .single();

      if (!res.error && res.data) {
        const updated = mapObserverRow(res.data);
        setObservers(prev => prev.map(o => o.id === updated.id ? updated : o));
        audit('OBSERVER_TOKEN_REGENERATED', { observerId });
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Delete Observer
  const handleDeleteObserver = async (observerId: string) => {
    if (!confirm('Delete this observer?')) return;
    try {
      const { error } = await supabase.from('observers').delete().eq('id', observerId);
      if (!error) {
        setObservers(prev => prev.filter(o => o.id !== observerId));
        audit('OBSERVER_DELETED', { observerId });
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Copy Observer Link
  const copyObserverUrl = (token: string) => {
    const url = `${window.location.origin}/?observerToken=${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 3000);
  };

  // Save Settings & Permissions
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    const ok = await updateSettings({
      siteName,
      aboutTitle,
      aboutContent,
      aboutImageUrl,
      electionStartTime: new Date(startTime).toISOString(),
      electionEndTime: new Date(endTime).toISOString(),
      contestantsCanViewVoters,
      publicAuditLog,
      permissions
    });
    setSavingSettings(false);

    if (ok) {
      setSettingsFeedback('Settings & access controls saved successfully!');
      setTimeout(() => setSettingsFeedback(null), 4000);
      refreshAll();
    } else {
      alert('Failed to save settings.');
    }
  };

  // Election Control Handlers (SuperAdmin only)
  const handleStartElection = async () => {
    if (!isSuperadmin) return;
    setSavingSettings(true);
    const nowISO = new Date().toISOString();
    try {
      const ok = await updateSettings({ electionStartTime: nowISO, electionMode: undefined });
      if (ok) {
        setStartTime(nowISO.slice(0, 16));
        setSettingsFeedback('Election started immediately!');
        setTimeout(() => setSettingsFeedback(null), 4000);
        refreshAll();
      }
    } catch (err) {
      console.error(err);
      alert('Failed to start election.');
    } finally {
      setSavingSettings(false);
    }
  };

  const verifySuperadminPassword = async (password: string): Promise<string | null> => {
    if (!user?.email) return 'Session email unavailable.';
    const { error } = await supabase.auth.signInWithPassword({ email: user.email, password });
    return error ? 'Incorrect password.' : null;
  };

  // Empties the ballot box entirely and returns how many ballots were removed.
  const clearAllVotes = async (): Promise<number> => {
    const { data, error } = await supabase.from('votes').delete().neq('id', '').select('id');
    if (error) {
      console.error('Failed to clear votes:', error);
      return 0;
    }
    return data?.length ?? 0;
  };

  const handleResetElection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperadmin || !resetElectionStart) return;
    setResetElectionError(null);
    setResettingElection(true);

    try {
      const err = await verifySuperadminPassword(resetElectionPassword);
      if (err) { setResetElectionError(err); setResettingElection(false); return; }

      const startISO = new Date(resetElectionStart).toISOString();
      const hours = Math.max(1, Number(resetElectionHours) || 72);
      const endISO = new Date(new Date(resetElectionStart).getTime() + hours * 3600000).toISOString();

      const ok = await updateSettings({
        electionStartTime: startISO,
        electionEndTime: endISO,
        electionMode: undefined
      });
      if (ok) {
        // Reset as brand new: wipe every cast ballot so the new ballot starts fresh.
        const votesCleared = await clearAllVotes();
        setStartTime(startISO.slice(0, 16));
        setEndTime(endISO.slice(0, 16));
        setSettingsFeedback(
          votesCleared > 0
            ? `Election timer reset — ${votesCleared} prior ballot(s) wiped.`
            : 'Election timer has been completely reset!'
        );
        setTimeout(() => setSettingsFeedback(null), 4000);
        audit('ELECTION_RESET', { newStartTime: startISO, newEndTime: endISO, durationHours: hours, votesCleared });
        setShowResetElectionModal(false);
        setResetElectionPassword('');
        refreshAll();
      } else {
        setResetElectionError('Failed to save settings.');
      }
    } catch (err: any) {
      setResetElectionError(err.message || 'Network error.');
    } finally {
      setResettingElection(false);
    }
  };

  const handleEndElection = async () => {
    if (!isSuperadmin) return;
    setShowEndElectionModal(true);
    setEndElectionPassword('');
    setEndElectionError(null);
  };

  const confirmEndElection = async () => {
    if (!isSuperadmin) return;
    setEndingElection(true);
    setEndElectionError(null);
    try {
      const err = await verifySuperadminPassword(endElectionPassword);
      if (err) { setEndElectionError(err); setEndingElection(false); return; }

      const nowISO = new Date().toISOString();
      const ok = await updateSettings({ electionEndTime: nowISO });
      if (ok) {
        setEndTime(nowISO.slice(0, 16));
        setSettingsFeedback('Election ended successfully!');
        setTimeout(() => setSettingsFeedback(null), 4000);
        audit('ELECTION_ENDED', {});
        setShowEndElectionModal(false);
        refreshAll();
      } else {
        setEndElectionError('Failed to end election.');
      }
    } catch (err: any) {
      setEndElectionError(err.message || 'Network error.');
    } finally {
      setEndingElection(false);
    }
  };

  const handleNoElectionClick = () => {
    if (!isSuperadmin) return;
    setShowNoElectionModal(true);
    setNoElectionPassword('');
    setNoElectionError(null);
  };

  const confirmNoElection = async () => {
    if (!isSuperadmin) return;
    setVoidingElection(true);
    setNoElectionError(null);
    try {
      const err = await verifySuperadminPassword(noElectionPassword);
      if (err) { setNoElectionError(err); setVoidingElection(false); return; }

      const ok = await updateSettings({ electionMode: 'none' });
      if (ok) {
        // With no election at all, prior ballots must not linger or count.
        const votesCleared = await clearAllVotes();
        setSettingsFeedback(
          votesCleared > 0
            ? `Election voided — ${votesCleared} prior ballot(s) wiped.`
            : 'Election set to NO ELECTION.'
        );
        setTimeout(() => setSettingsFeedback(null), 4000);
        audit('ELECTION_VOIDED', { votesCleared });
        setShowNoElectionModal(false);
        setNoElectionPassword('');
        refreshAll();
      } else {
        setNoElectionError('Failed to save election mode.');
      }
    } catch (err: any) {
      setNoElectionError(err.message || 'Network error.');
    } finally {
      setVoidingElection(false);
    }
  };

  // Committee Admin Selection Helpers
  const availableVotersForCommittee = voters.filter(v =>
    v.role !== 'committee' && v.role !== 'superadmin' && (appointmentRole === 'ycec' ? v.role !== 'ycec' : true)
  );
  const filteredVotersForCommittee = availableVotersForCommittee.filter(v =>
    `${v.firstName} ${v.lastName}`.toLowerCase().includes(voterSearchForCommittee.toLowerCase()) ||
    v.raNumber.toLowerCase().includes(voterSearchForCommittee.toLowerCase()) ||
    (v.department && v.department.toLowerCase().includes(voterSearchForCommittee.toLowerCase())) ||
    v.email.toLowerCase().includes(voterSearchForCommittee.toLowerCase())
  );

  const toggleVoterSelection = (id: string) => {
    setSelectedVoterIdsForCommittee(prev =>
      prev.includes(id) ? prev.filter(vId => vId !== id) : [...prev, id]
    );
  };

  const selectAllFilteredVoters = () => {
    const allFilteredIds = filteredVotersForCommittee.map(v => v.id);
    setSelectedVoterIdsForCommittee(Array.from(new Set([...selectedVoterIdsForCommittee, ...allFilteredIds])));
  };

  const clearSelectedVoters = () => {
    setSelectedVoterIdsForCommittee([]);
  };

  // ----------------------------------------------------
  // ACCESS GUARD: Only Committee and SuperAdmin can view Admin Page
  // ----------------------------------------------------
  if (!canAccessAdmin) {
    return (
      <div className="max-w-xl mx-auto my-16 p-8 bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#1E2E4E] rounded-3xl text-center shadow-lg space-y-4">
        <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 mx-auto flex items-center justify-center">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Restricted Administration Chamber</h2>
        <p className="text-sm text-gray-500 dark:text-slate-400">
          This portal is reserved strictly for appointed Committee Administrators and the Superadmin. Constituents without administrative accreditation cannot access this governance chamber.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
          <button
            onClick={() => onNavigate('login')}
            className="w-full sm:w-auto px-5 py-2.5 border border-gray-300 dark:border-[#1E2E4E] text-gray-700 dark:text-slate-300 font-semibold rounded-xl text-xs"
          >
            Go to Secure Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header & Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 dark:border-[#1E2E4E] pb-5">
        <div>
          <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
            <Shield className="w-4 h-4" />
            <span>Youth Electoral Committee Secretariat</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-white mt-1">
            Electoral Governance & Administration
          </h1>
        </div>

        {/* Tab Navigation - Non-Superadmins cannot see Access Control or Committee Admin */}
        <div className="flex flex-wrap bg-gray-100 dark:bg-[#16223B] p-1.5 rounded-2xl gap-1">
          {isSuperadmin && (
            <>
              <button
                onClick={() => setActiveTab('access')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'access'
                    ? 'bg-white dark:bg-purple-600 text-purple-700 dark:text-white shadow-xs'
                    : 'text-gray-600 dark:text-slate-400 hover:text-gray-900'
                }`}
              >
                1. Access Control
              </button>

              <button
                onClick={() => setActiveTab('committee')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'committee'
                    ? 'bg-white dark:bg-purple-600 text-purple-700 dark:text-white shadow-xs'
                    : 'text-gray-600 dark:text-slate-400 hover:text-gray-900'
                }`}
              >
                2. Committee Admin
              </button>
            </>
          )}

          <button
            onClick={() => setActiveTab('users')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'users'
                ? 'bg-white dark:bg-purple-600 text-purple-700 dark:text-white shadow-xs'
                : 'text-gray-600 dark:text-slate-400 hover:text-gray-900'
            }`}
          >
            {isSuperadmin ? '3. Registered Users' : '1. Registered Users'}
          </button>

          <button
            onClick={() => setActiveTab('offices')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'offices'
                ? 'bg-white dark:bg-purple-600 text-purple-700 dark:text-white shadow-xs'
                : 'text-gray-600 dark:text-slate-400 hover:text-gray-900'
            }`}
          >
            {isSuperadmin ? '4. Offices & Screening' : '2. Offices & Screening'}
          </button>

          <button
            onClick={() => setActiveTab('agents')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'agents'
                ? 'bg-white dark:bg-purple-600 text-purple-700 dark:text-white shadow-xs'
                : 'text-gray-600 dark:text-slate-400 hover:text-gray-900'
            }`}
          >
            {isSuperadmin ? '5. Agents' : '3. Agents'}
          </button>

          <button
            onClick={() => setActiveTab('observers')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'observers'
                ? 'bg-white dark:bg-purple-600 text-purple-700 dark:text-white shadow-xs'
                : 'text-gray-600 dark:text-slate-400 hover:text-gray-900'
            }`}
          >
            {isSuperadmin ? '6. Observers' : '4. Observers'}
          </button>

          <button
            onClick={() => setActiveTab('timeline')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'timeline'
                ? 'bg-white dark:bg-purple-600 text-purple-700 dark:text-white shadow-xs'
                : 'text-gray-600 dark:text-slate-400 hover:text-gray-900'
            }`}
          >
            {isSuperadmin ? '7. Timeline' : '5. Timeline'}
          </button>
        </div>
      </div>

      {/* Role State Banner */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-3xl bg-gray-50 dark:bg-[#16223B] border border-gray-200 dark:border-[#1E2E4E] text-xs shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-xl bg-purple-600 flex items-center justify-center shrink-0 text-white font-bold">
            {isSuperadmin ? <ShieldCheck className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
          </div>
          <div>
            <span className="font-bold text-gray-900 dark:text-white">
              {isSuperadmin ? 'SuperAdmin Executive Session' : 'Committee Administrator Session'}
            </span>
            <p className="text-gray-500 dark:text-slate-400 mt-0.5">
              Logged in as: <strong>{user?.firstName} {user?.lastName}</strong> (RA-{user?.raNumber}) · Role: <span className="uppercase font-mono text-purple-600 dark:text-purple-400 font-bold">{user?.role}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          {/* Dev quick-login removed: no server API exists in the browser-only build */}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: ACCESS CONTROL & SUPERADMIN SETTINGS */}
      {/* ========================================================================= */}
      {activeTab === 'access' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#1E2E4E] rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-[#1E2E4E] pb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  <span>Access Control & Permission Allocations</span>
                </h2>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                  Superadmin settings: Assign roles authorized to execute each administrative mandate
                </p>
              </div>

              {settingsFeedback && (
                <div className="flex items-center space-x-1.5 px-3 py-1 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-xs font-medium rounded-lg border border-emerald-300">
                  <Check className="w-3.5 h-3.5" />
                  <span>{settingsFeedback}</span>
                </div>
              )}
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-6 text-xs">
              {/* Permissions Matrix */}
              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-[#16223B] border border-gray-200 dark:border-[#1E2E4E] space-y-4">
                <h3 className="font-bold text-gray-900 dark:text-white text-sm">
                  Role Authority Matrix
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { key: 'canRegisterUsers', label: 'Can Register New Users (Unaccredited)' },
                    { key: 'canAccreditUsers', label: 'Can Accredit Users (Toggle Checkmark)' },
                    { key: 'canCreateOffices', label: 'Can Create Offices / Contested Positions' },
                    { key: 'canAssignOffices', label: 'Can Assign Offices (Max 1 per Contestant)' },
                    { key: 'canCreateScreeningCriteria', label: 'Can Create Screening Criteria' },
                    { key: 'canAssignAgents', label: 'Can Assign Agents to Candidates' },
                    { key: 'canCreateObservers', label: 'Can Create Observers & Unique Links' },
                  ].map(({ key, label }) => {
                    const current = (permissions as any)[key] || [];

                    return (
                      <div key={key} className="p-3.5 bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#1E2E4E] rounded-2xl space-y-2.5">
                        <span className="font-bold text-gray-900 dark:text-white block text-xs">{label}</span>

                        {/* SuperAdmin status */}
                        <div className="flex items-center space-x-1.5 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>SuperAdmin (Permanent System Authority)</span>
                        </div>

                        {/* Specific Committee Admin Officers Selection */}
                        <div className="pt-1 space-y-1.5">
                          <span className="text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider block">
                            Delegate To Committee Officers:
                          </span>

                          {committeeAdmins.length === 0 ? (
                            <p className="text-[11px] text-amber-600 dark:text-amber-400 italic">
                              No Committee Administrators appointed yet. Appoint officers in Committee Admin tab to delegate this authority.
                            </p>
                          ) : (
                            <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                              {committeeAdmins.map((admin) => {
                                const isChecked = current.includes(admin.id) || current.includes(admin.raNumber);
                                const toggleUser = () => {
                                  if (!isSuperadmin) return;
                                  const updated = isChecked
                                    ? current.filter((r: string) => r !== admin.id && r !== admin.raNumber)
                                    : [...current, admin.id];
                                  setPermissions((prev: any) => ({ ...prev, [key]: updated }));
                                };

                                return (
                                  <label
                                    key={admin.id}
                                    className={`flex items-center space-x-2 px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer ${
                                      isChecked
                                        ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-300 dark:border-purple-800 text-purple-900 dark:text-purple-200'
                                        : 'bg-gray-50 dark:bg-[#16223B]/60 border-gray-200 dark:border-[#1E2E4E] text-gray-700 dark:text-slate-300 hover:bg-gray-100'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      disabled={!isSuperadmin}
                                      checked={isChecked}
                                      onChange={toggleUser}
                                      className="w-3.5 h-3.5 accent-purple-600 rounded"
                                    />
                                    <span className="font-semibold text-xs">{admin.firstName} {admin.lastName}</span>
                                    <span className="font-mono text-[10px] text-purple-600 dark:text-purple-400 font-bold">(RA-{admin.raNumber})</span>
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* System Site Name */}
              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-[#16223B] border border-gray-200 dark:border-[#1E2E4E] space-y-2">
                <label className="block font-bold text-gray-900 dark:text-white text-sm">
                  System Header Title / Platform Name
                </label>
                <input
                  type="text"
                  required
                  disabled={!isSuperadmin}
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                  className="w-full max-w-md px-3.5 py-2 rounded-xl border border-gray-300 dark:border-[#1E2E4E] bg-white dark:bg-[#0F172A] text-gray-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* About Section */}
              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-[#16223B] border border-gray-200 dark:border-[#1E2E4E] space-y-3">
                <label className="block font-bold text-gray-900 dark:text-white text-sm">
                  About Section Title & Manifesto
                </label>
                <input
                  type="text"
                  required
                  disabled={!isSuperadmin}
                  value={aboutTitle}
                  onChange={(e) => setAboutTitle(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-300 dark:border-[#1E2E4E] bg-white dark:bg-[#0F172A] text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                />
                <textarea
                  rows={3}
                  required
                  disabled={!isSuperadmin}
                  value={aboutContent}
                  onChange={(e) => setAboutContent(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-300 dark:border-[#1E2E4E] bg-white dark:bg-[#0F172A] text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500 leading-relaxed"
                />
              </div>

              {/* Election Logo / Branding Image */}
              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-[#16223B] border border-gray-200 dark:border-[#1E2E4E] space-y-3">
                <label className="block font-bold text-gray-900 dark:text-white text-sm">
                  Election Logo / Branding Image URL
                </label>
                <input
                  type="text"
                  disabled={!isSuperadmin}
                  value={aboutImageUrl}
                  onChange={(e) => setAboutImageUrl(e.target.value)}
                  placeholder="https://example.com/logo.png (optional - shows default branding if empty)"
                  className="w-full max-w-xl px-3.5 py-2 rounded-xl border border-gray-300 dark:border-[#1E2E4E] bg-white dark:bg-[#0F172A] text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                />
                <p className="text-[11px] text-gray-500 dark:text-slate-400">
                  Logo displayed on Dashboard's Official Election Mandate. Recommended: square PNG/SVG, transparent background. Leave empty for default FatBallot branding.
                </p>
              </div>

              {/* Timetable */}
              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-[#16223B] border border-gray-200 dark:border-[#1E2E4E] space-y-3">
                <label className="block font-bold text-gray-900 dark:text-white text-sm">
                  Election Active Schedule
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <span className="text-[11px] text-gray-500 block mb-1">Start Time</span>
                    <input
                      type="datetime-local"
                      disabled={!isSuperadmin}
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-300 dark:border-[#1E2E4E] bg-white dark:bg-[#0F172A] text-gray-900 dark:text-white font-mono"
                    />
                  </div>
                  <div>
                    <span className="text-[11px] text-gray-500 block mb-1">End Time</span>
                    <input
                      type="datetime-local"
                      disabled={!isSuperadmin}
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-300 dark:border-[#1E2E4E] bg-white dark:bg-[#0F172A] text-gray-900 dark:text-white font-mono"
                    />
                  </div>
                </div>
                
                {/* Election Control Buttons - SuperAdmin Only */}
                {isSuperadmin && (
                  <div className="pt-4 border-t border-gray-200 dark:border-[#1E2E4E] space-y-3">
                    <div className="flex items-center space-x-2 text-xs font-semibold text-gray-900 dark:text-white">
                      <Zap className="w-4 h-4 text-amber-500" />
                      <span>Manual Election Control</span>
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-slate-400">
                      Instantly activate or conclude the election. Overrides scheduled times.
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={handleStartElection}
                        disabled={savingSettings || isElectionActiveNow}
                        className="flex items-center space-x-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-sm transition-all text-xs"
                      >
                        <Play className="w-4 h-4" />
                        <span>Start Election Now</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleEndElection}
                        disabled={savingSettings || !isElectionActiveNow}
                        className="flex items-center space-x-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-sm transition-all text-xs"
                      >
                        <Square className="w-4 h-4" />
                        <span>End Election Now</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowResetElectionModal(true)}
                        disabled={savingSettings}
                        className="flex items-center space-x-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-sm transition-all text-xs"
                      >
                        <RefreshCw className="w-4 h-4" />
                        <span>Reset Election Timer</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleNoElectionClick}
                        disabled={savingSettings || noElection}
                        className="flex items-center space-x-2 px-4 py-2.5 bg-slate-600 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-sm transition-all text-xs"
                      >
                        <Ban className="w-4 h-4" />
                        <span>No Election</span>
                      </button>
                    </div>
                    <div className="flex items-center space-x-2 text-[11px]">
                      <span className={`w-2 h-2 rounded-full ${noElection ? 'bg-slate-400' : isElectionActiveNow ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                      <span className={noElection ? 'text-slate-500 dark:text-slate-400 font-semibold' : isElectionActiveNow ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-gray-500 dark:text-slate-400'}>
                        {noElection ? 'Election is NOT SCHEDULED (No Election mode)' : isElectionActiveNow ? 'Election is LIVE' : 'Election is INACTIVE'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Toggles */}
              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-[#16223B] border border-gray-200 dark:border-[#1E2E4E] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-white">Allow Contestants to View Their Voters</div>
                    <p className="text-gray-500 text-[11px]">Enables contestants to export certified list of voters who chose them.</p>
                  </div>
                  <input
                    type="checkbox"
                    disabled={!isSuperadmin}
                    checked={contestantsCanViewVoters}
                    onChange={(e) => setContestantsCanViewVoters(e.target.checked)}
                    className="w-5 h-5 accent-purple-600 rounded cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-[#1E2E4E]">
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-white">Public Audit Log (Dispute Mode)</div>
                    <p className="text-gray-500 text-[11px]">Unlocks the sitewide tamper-evident ledger for all constituents.</p>
                  </div>
                  <input
                    type="checkbox"
                    disabled={!isSuperadmin}
                    checked={publicAuditLog}
                    onChange={(e) => setPublicAuditLog(e.target.checked)}
                    className="w-5 h-5 accent-purple-600 rounded cursor-pointer"
                  />
                </div>
              </div>

              {isSuperadmin && (
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="py-3 px-6 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-md transition-all flex items-center space-x-2"
                >
                  <Save className="w-4 h-4" />
                  <span>{savingSettings ? 'Saving...' : 'Save & Publish Permissions'}</span>
                </button>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Reset Election Modal (SuperAdmin password re-verification) */}
      {showResetElectionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#1E2E4E] rounded-3xl p-6 max-w-md w-full shadow-2xl animate-fadeIn space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-[#1E2E4E] pb-3">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white text-base flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 text-amber-500" />
                  <span>Reset Election Timer</span>
                </h3>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                  Set a brand-new election day &amp; time, as if voting has not started.
                  A new ballot begins empty: every previously cast vote is wiped from the ledger.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowResetElectionModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {resetElectionError && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-900/50 text-red-800 dark:text-red-300 text-xs font-semibold">
                {resetElectionError}
              </div>
            )}

            <form onSubmit={handleResetElection} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-2">New Election Day &amp; Time</label>
                <input
                  type="datetime-local"
                  required
                  value={resetElectionStart}
                  onChange={(e) => setResetElectionStart(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-[#1E2E4E] bg-gray-50 dark:bg-[#16223B] text-gray-900 dark:text-white font-mono outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-2">Election Duration (hours)</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={resetElectionHours}
                  onChange={(e) => setResetElectionHours(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-[#1E2E4E] bg-gray-50 dark:bg-[#16223B] text-gray-900 dark:text-white font-mono outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-2">Superadmin Password (to confirm)</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={resetElectionPassword}
                  onChange={(e) => setResetElectionPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-[#1E2E4E] bg-gray-50 dark:bg-[#16223B] text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-gray-100 dark:border-[#1E2E4E]">
                <button
                  type="button"
                  onClick={() => setShowResetElectionModal(false)}
                  className="px-4 py-2 border rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resettingElection}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center space-x-1.5"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>{resettingElection ? 'Resetting...' : 'Reset Election Timer'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* End Election Modal (Superadmin password re-verification) */}
      {showEndElectionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#1E2E4E] rounded-3xl p-6 max-w-md w-full shadow-2xl animate-fadeIn space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-[#1E2E4E] pb-3">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white text-base flex items-center gap-2">
                  <Square className="w-5 h-5 text-red-500" />
                  <span>End Election Now</span>
                </h3>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                  Conclude the election immediately and close the ballot.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowEndElectionModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {endElectionError && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-900/50 text-red-800 dark:text-red-300 text-xs font-semibold">
                {endElectionError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-2">Superadmin Password (to confirm)</label>
                <input
                  type="password"
                  required
                  autoFocus
                  placeholder="••••••••"
                  value={endElectionPassword}
                  onChange={(e) => setEndElectionPassword(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') confirmEndElection(); }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-[#1E2E4E] bg-gray-50 dark:bg-[#16223B] text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-gray-100 dark:border-[#1E2E4E]">
                <button
                  type="button"
                  onClick={() => setShowEndElectionModal(false)}
                  className="px-4 py-2 border rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={endingElection}
                  onClick={confirmEndElection}
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center space-x-1.5"
                >
                  <Square className="w-4 h-4" />
                  <span>{endingElection ? 'Ending...' : 'End Election Now'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* No Election Modal (Superadmin password re-verification) */}
      {showNoElectionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#1E2E4E] rounded-3xl p-6 max-w-md w-full shadow-2xl animate-fadeIn space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-[#1E2E4E] pb-3">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white text-base flex items-center gap-2">
                  <Ban className="w-5 h-5 text-slate-500" />
                  <span>No Election</span>
                </h3>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                  Disable the election entirely: no countdown, no ended banner, no tally.
                  Every previously cast vote is wiped from the ledger.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowNoElectionModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {noElectionError && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-900/50 text-red-800 dark:text-red-300 text-xs font-semibold">
                {noElectionError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-2">Superadmin Password (to confirm)</label>
                <input
                  type="password"
                  required
                  autoFocus
                  placeholder="••••••••"
                  value={noElectionPassword}
                  onChange={(e) => setNoElectionPassword(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') confirmNoElection(); }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-[#1E2E4E] bg-gray-50 dark:bg-[#16223B] text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-slate-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-gray-100 dark:border-[#1E2E4E]">
                <button
                  type="button"
                  onClick={() => setShowNoElectionModal(false)}
                  className="px-4 py-2 border rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={voidingElection}
                  onClick={confirmNoElection}
                  className="px-5 py-2 bg-slate-600 hover:bg-slate-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center space-x-1.5"
                >
                  <Ban className="w-4 h-4" />
                  <span>{voidingElection ? 'Disabling...' : 'No Election'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: COMMITTEE ADMIN (SUPERADMIN ONLY) */}
      {/* ========================================================================= */}
      {isSuperadmin && activeTab === 'committee' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#1E2E4E] rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 dark:border-[#1E2E4E] pb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Shield className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  <span>Committee & YCEC Officers Registry</span>
                </h2>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                  Appoint Committee Administrators or YCEC Commissioners from registered voters, or remove officers.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {committeeFeedback && (
                  <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-xs font-semibold rounded-xl border border-emerald-300">
                    <Check className="w-3.5 h-3.5" />
                    <span>{committeeFeedback}</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => { setAppointmentRole('ycec'); setShowAddCommitteeModal(true); }}
                  className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl shadow-xs transition-all flex items-center space-x-2 text-xs"
                >
                  <Award className="w-4 h-4" />
                  <span>+ Appoint YCEC Commissioner</span>
                </button>

                <button
                  type="button"
                  onClick={() => { setAppointmentRole('committee'); setShowAddCommitteeModal(true); }}
                  className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-xs transition-all flex items-center space-x-2 text-xs"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>+ Appoint Committee Admin</span>
                </button>
              </div>
            </div>

            {/* Search Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search committee officers by name, RA, or department..."
                  value={committeeSearch}
                  onChange={(e) => setCommitteeSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 dark:border-[#1E2E4E] bg-white dark:bg-[#0F172A] text-xs text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <span className="text-xs text-gray-500">
                Active Committee & YCEC Officers: <strong>{committeeAdmins.length}</strong>
              </span>
            </div>

            {/* Committee Admins Table */}
            <div className="overflow-x-auto border border-gray-200 dark:border-[#1E2E4E] rounded-2xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 dark:bg-[#16223B] text-gray-500 dark:text-slate-400 uppercase tracking-wider text-[10px] font-bold border-b border-gray-200 dark:border-[#1E2E4E]">
                  <tr>
                    <th className="py-3 px-4">Officer Name & Contact</th>
                    <th className="py-3 px-4">RA Number</th>
                    <th className="py-3 px-4">Department / Faculty</th>
                    <th className="py-3 px-4">Role Status</th>
                    <th className="py-3 px-4">Allocated Mandates</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-[#1E2E4E]">
                  {committeeAdmins.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-gray-400 text-xs">
                        No officers appointed yet. Click "+ Appoint Committee Admin" or "+ Appoint YCEC Commissioner" to select officers from registered voters.
                      </td>
                    </tr>
                  ) : (
                    committeeAdmins
                      .filter(admin =>
                        `${admin.firstName} ${admin.lastName}`.toLowerCase().includes(committeeSearch.toLowerCase()) ||
                        admin.raNumber.toLowerCase().includes(committeeSearch.toLowerCase()) ||
                        admin.email.toLowerCase().includes(committeeSearch.toLowerCase()) ||
                        (admin.department && admin.department.toLowerCase().includes(committeeSearch.toLowerCase()))
                      )
                      .map(admin => {
                        const authorityCount = Object.values(permissions || {}).filter(
                          (arr: any) => Array.isArray(arr) && (arr.includes(admin.id) || arr.includes(admin.raNumber))
                        ).length;

                        return (
                          <tr key={admin.id} className="hover:bg-gray-50/50 dark:hover:bg-[#16223B]/50 transition-colors">
                            <td className="py-3.5 px-4">
                              <div className="flex items-center space-x-3">
                                {admin.avatar ? (
                                  <img src={admin.avatar} alt={admin.firstName} className="w-8 h-8 rounded-full object-cover" />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-bold flex items-center justify-center text-xs">
                                    {admin.firstName.charAt(0)}
                                  </div>
                                )}
                                <div>
                                  <p className="font-bold text-gray-900 dark:text-white text-xs">
                                    {admin.firstName} {admin.middleName ? admin.middleName + ' ' : ''}{admin.lastName}
                                  </p>
                                  <p className="text-[11px] text-gray-400">{admin.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="font-mono text-purple-600 dark:text-purple-400 font-bold bg-purple-50 dark:bg-purple-950/60 px-2 py-0.5 rounded-lg">
                                RA-{admin.raNumber}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-gray-600 dark:text-slate-300">
                              {admin.department || 'General Secretariat'}
                            </td>
                            <td className="py-3.5 px-4">
                              {admin.role === 'ycec' ? (
    <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300">
      <Award className="w-3 h-3" />
      <span>YCEC Commissioner</span>
    </span>
  ) : (
    <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300">
      <Shield className="w-3 h-3" />
      <span>Committee Admin</span>
    </span>
  )}
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="text-[11px] font-semibold text-gray-700 dark:text-slate-300">
                                {authorityCount} mandate{authorityCount !== 1 ? 's' : ''} allocated
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <button
                                type="button"
                                onClick={() => handleRemoveCommitteeAdmin(admin.id)}
                                className="px-2.5 py-1 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition-colors"
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Modal: Appoint Committee Administrators (Select multiple from registered voters) */}
          {showAddCommitteeModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
              <div className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#1E2E4E] rounded-3xl p-6 max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl animate-fadeIn space-y-4">
                {/* Modal Header */}
                <div className="flex items-center justify-between border-b border-gray-100 dark:border-[#1E2E4E] pb-3">
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white text-base flex items-center gap-2">
                      {appointmentRole === 'ycec' ? <Award className="w-5 h-5 text-teal-600" /> : <UserPlus className="w-5 h-5 text-purple-600" />}
                      <span>{appointmentRole === 'ycec' ? 'Appoint YCEC Commissioner(s)' : 'Appoint Committee Administrator(s)'}</span>
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                      {appointmentRole === 'ycec'
                        ? 'Select registered voters to appoint as Youth & Community Executive Commission Commissioners (directory roster).'
                        : 'Select registered voters from the register to appoint as Electoral Committee Officers.'}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="flex rounded-xl overflow-hidden border border-gray-200 dark:border-[#1E2E4E] text-xs font-bold">
                      <button
                        type="button"
                        onClick={() => setAppointmentRole('committee')}
                        className={`px-3 py-1.5 transition-colors ${appointmentRole === 'committee' ? 'bg-purple-600 text-white' : 'bg-white dark:bg-[#16223B] text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800'}`}
                      >
                        Committee Admin
                      </button>
                      <button
                        type="button"
                        onClick={() => setAppointmentRole('ycec')}
                        className={`px-3 py-1.5 transition-colors ${appointmentRole === 'ycec' ? 'bg-teal-600 text-white' : 'bg-white dark:bg-[#16223B] text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800'}`}
                      >
                        YCEC Commissioner
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setShowAddCommitteeModal(false); setSelectedVoterIdsForCommittee([]); }}
                      className="p-1.5 text-gray-400 hover:text-gray-600 rounded-xl"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Search & Selection helpers */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Search voters by name, RA, or department..."
                      value={voterSearchForCommittee}
                      onChange={(e) => setVoterSearchForCommittee(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 dark:border-[#1E2E4E] bg-gray-50 dark:bg-[#16223B] text-xs text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <button
                      type="button"
                      onClick={selectAllFilteredVoters}
                      className="px-2.5 py-1.5 bg-gray-100 dark:bg-[#16223B] hover:bg-gray-200 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-300 font-semibold rounded-lg text-xs"
                    >
                      Select All Filtered
                    </button>
                    <button
                      type="button"
                      onClick={clearSelectedVoters}
                      className="px-2.5 py-1.5 text-gray-500 hover:text-gray-700 text-xs"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {/* Selected count banner */}
                <div className="flex items-center justify-between px-3 py-1.5 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-xl text-xs text-purple-800 dark:text-purple-300">
                  <span className="font-semibold">Selected Officers:</span>
                  <span className="font-bold font-mono">{selectedVoterIdsForCommittee.length} voter(s) chosen</span>
                </div>

                {/* Voters List with Checkboxes */}
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-80">
                  {filteredVotersForCommittee.length === 0 ? (
                    <div className="py-10 text-center text-xs text-gray-400">
                      No eligible voters found matching your search.
                    </div>
                  ) : (
                    filteredVotersForCommittee.map(v => {
                      const isSelected = selectedVoterIdsForCommittee.includes(v.id);

                      return (
                        <div
                          key={v.id}
                          onClick={() => toggleVoterSelection(v.id)}
                          className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                            isSelected
                              ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-400 dark:border-purple-600'
                              : 'bg-white dark:bg-[#0F172A] border-gray-200 dark:border-[#1E2E4E] hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center space-x-3 min-w-0">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="w-4 h-4 accent-purple-600 rounded shrink-0"
                            />
                            <div>
                              <p className="font-bold text-gray-900 dark:text-white text-xs">
                                {v.firstName} {v.middleName ? v.middleName + ' ' : ''}{v.lastName}
                              </p>
                              <p className="text-[11px] text-gray-400">{v.email} · {v.department || 'Constituent'}</p>
                            </div>
                          </div>

                          <span className="font-mono font-bold text-xs text-purple-600 dark:text-purple-400 shrink-0">
                            RA-{v.raNumber}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Modal Footer */}
                <div className="flex items-center justify-end space-x-2 pt-3 border-t border-gray-100 dark:border-[#1E2E4E]">
                  <button
                    type="button"
                    onClick={() => { setShowAddCommitteeModal(false); setSelectedVoterIdsForCommittee([]); }}
                    className="px-4 py-2 border rounded-xl text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={selectedVoterIdsForCommittee.length === 0 || addingCommittee}
                    onClick={handleAddCommitteeAdmins}
                    className="px-5 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center space-x-1.5"
                  >
                    <UserCheck className="w-4 h-4" />
                    <span>Appoint Selected ({selectedVoterIdsForCommittee.length}) as {appointmentRole === 'ycec' ? 'YCEC Commissioner' : 'Committee Admin'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: REGISTERED USERS */}
      {/* ========================================================================= */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#1E2E4E] rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  <span>Registered Electorate ({voters.length})</span>
                </h2>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                  Tap any user to inspect registered details, accredit, or delete. Blue checkmark = Accredited, Grey = Pending.
                </p>
              </div>

              <button
                onClick={() => setShowCreateUserModal(true)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center space-x-2 shrink-0"
              >
                <UserPlus className="w-4 h-4" />
                <span>Enrol New User</span>
              </button>
            </div>

            {/* Search */}
            <div className="relative w-full max-w-md">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Search by name, numeric RA number, or department..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 dark:border-[#1E2E4E] bg-gray-50 dark:bg-[#16223B] text-xs text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {/* Table */}
            <div className="overflow-x-auto max-h-[600px]">
              <table className="w-full text-left text-xs">
                <thead className="text-gray-400 uppercase bg-gray-50 dark:bg-[#16223B]/60 sticky top-0 font-bold">
                  <tr>
                    <th className="py-3 px-4">RA Number</th>
                    <th className="py-3 px-4">Voter Name</th>
                    <th className="py-3 px-4">Status / Role</th>
                    <th className="py-3 px-4 text-center">Accreditation</th>
                    <th className="py-3 px-4 text-center">Screened Badge</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-[#1E2E4E]">
                  {voters
                    .filter(v => 
                      v.firstName.toLowerCase().includes(userSearch.toLowerCase()) ||
                      v.lastName.toLowerCase().includes(userSearch.toLowerCase()) ||
                      v.raNumber.includes(userSearch) ||
                      (v.department && v.department.toLowerCase().includes(userSearch.toLowerCase()))
                    )
                    .map(v => {
                      const isContestant = v.role === 'contestant' || Boolean(v.assignedOfficeId);

                      return (
                        <tr 
                          key={v.id} 
                          onClick={() => setSelectedUserForDetail(v)}
                          className="hover:bg-gray-50 dark:hover:bg-[#16223B]/40 cursor-pointer transition-colors"
                        >
                          <td className="py-3 px-4 font-mono font-bold text-blue-600 dark:text-blue-400">
                            RA-{v.raNumber}
                          </td>
                          <td className="py-3 px-4 font-bold text-gray-900 dark:text-white">
                            {v.firstName} {v.middleName ? v.middleName + ' ' : ''}{v.lastName}
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300">
                              {v.isAgent ? 'Agent' : isContestant ? 'Contestant' : v.role}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            {/* Circular check mark: Grey when pending, Blue when accredited */}
                            <button
                              onClick={(e) => handleToggleAccreditation(v, e)}
                              title={v.isAccredited ? "Accredited (Click to revoke)" : "Not accredited (Click to accredit)"}
                              className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
                            >
                              <CheckCircle2
                                className={`w-5 h-5 transition-colors ${
                                  v.isAccredited
                                    ? 'text-blue-600 dark:text-blue-400 fill-blue-50 dark:fill-blue-950'
                                    : 'text-gray-400 dark:text-slate-600'
                                }`}
                              />
                            </button>
                          </td>
                          <td className="py-3 px-4 text-center">
                            {/* Contestant screened badge: Green if screened, Grey if not screened */}
                            {isContestant ? (
                              <span
                                className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  v.isScreened
                                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                                    : 'bg-gray-100 dark:bg-slate-800 text-gray-400 border border-gray-300 dark:border-slate-700'
                                }`}
                                title={v.isScreened ? "Contestant Screened (Pass)" : "Contestant Not Screened (Pending)"}
                              >
                                <Award className="w-3 h-3" />
                                <span>{v.isScreened ? 'Screened' : 'Unscreened'}</span>
                              </span>
                            ) : (
                              <span className="text-gray-300 dark:text-slate-600 text-[10px]">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={(e) => { e.stopPropagation(); setSelectedUserForDetail(v); }}
                              className="px-2.5 py-1 bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 rounded-lg font-semibold hover:bg-purple-100 text-[11px]"
                            >
                              Tap for Details
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>

          {/* User Registration Modal */}
          {showCreateUserModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
              <div className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#1E2E4E] rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 dark:border-[#1E2E4E] pb-3">
                  <h3 className="font-bold text-base text-gray-900 dark:text-white">Enrol New User</h3>
                  <button onClick={() => setShowCreateUserModal(false)} className="text-gray-400 hover:text-gray-600">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {regError && (
                  <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs border border-red-200">
                    {regError}
                  </div>
                )}

                <form onSubmit={handleCreateUser} className="space-y-3 text-xs">
                  <div>
                    <label className="block font-semibold mb-1">First Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. John"
                      value={regFirstName}
                      onChange={(e) => setRegFirstName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-[#1E2E4E] bg-gray-50 dark:bg-[#16223B] outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold mb-1">Middle Name</label>
                    <input
                      type="text"
                      placeholder="e.g. David"
                      value={regMiddleName}
                      onChange={(e) => setRegMiddleName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-[#1E2E4E] bg-gray-50 dark:bg-[#16223B] outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold mb-1">Last Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Smith"
                      value={regLastName}
                      onChange={(e) => setRegLastName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-[#1E2E4E] bg-gray-50 dark:bg-[#16223B] outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold mb-1">Email Address *</label>
                    <input
                      type="email"
                      required
                      placeholder="voter@domain.com"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-[#1E2E4E] bg-gray-50 dark:bg-[#16223B] outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold mb-1">RA Number (Numerical Only) *</label>
                    <div className="flex items-center rounded-xl border border-gray-300 dark:border-[#1E2E4E] bg-gray-50 dark:bg-[#16223B] overflow-hidden">
                      <span className="px-3 py-2 bg-gray-200 dark:bg-slate-800 font-mono font-bold">RA-</span>
                      <input
                        type="number"
                        required
                        placeholder="e.g. 5001"
                        value={regRaNumber}
                        onChange={(e) => setRegRaNumber(e.target.value)}
                        className="flex-1 px-3 py-2 bg-transparent outline-none font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold mb-1">Department / Faculty</label>
                    <input
                      type="text"
                      placeholder="e.g. Faculty of Arts"
                      value={regDepartment}
                      onChange={(e) => setRegDepartment(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-[#1E2E4E] bg-gray-50 dark:bg-[#16223B] outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold mb-1">Initial Password (min. 6 characters) *</label>
                    <input
                      type="text"
                      required
                      placeholder="Share securely with the voter"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-[#1E2E4E] bg-gray-50 dark:bg-[#16223B] outline-none font-mono"
                    />
                  </div>

                  <p className="text-[11px] text-gray-400 italic">
                    Note: Users are not accredited during registration. Accreditation is granted separately.
                    The voter signs in with their RA Number and this password — give it to them securely.
                  </p>

                  <div className="flex justify-end space-x-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowCreateUserModal(false)}
                      className="px-4 py-2 rounded-xl border border-gray-300 text-gray-600 hover:bg-gray-100"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submittingUser}
                      className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold"
                    >
                      {submittingUser ? 'Enrolling...' : 'Enrol User'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* User Details & Management Modal */}
          {selectedUserForDetail && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
              <div className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#1E2E4E] rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 dark:border-[#1E2E4E] pb-3">
                  <div className="flex items-center space-x-2">
                    <h3 className="font-extrabold text-base text-gray-900 dark:text-white">User Registry Credentials</h3>
                    <span className="font-mono text-xs text-blue-600 dark:text-blue-400">RA-{selectedUserForDetail.raNumber}</span>
                  </div>
                  <button onClick={() => { setSelectedUserForDetail(null); setIsEditingUser(false); setResetPassword(''); setResetFeedback(null); }} className="text-gray-400 hover:text-gray-600">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  {isEditingUser ? (
                    <div className="p-3 bg-gray-50 dark:bg-[#16223B] rounded-2xl space-y-2.5">
                      {editError && (
                        <div className="p-2.5 rounded-xl bg-red-50 text-red-700 text-xs border border-red-200">
                          {editError}
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block font-semibold mb-1">First Name *</label>
                          <input type="text" value={editFirstName} onChange={(e) => setEditFirstName(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-[#1E2E4E] bg-white dark:bg-[#0F172A] outline-none" />
                        </div>
                        <div>
                          <label className="block font-semibold mb-1">Last Name *</label>
                          <input type="text" value={editLastName} onChange={(e) => setEditLastName(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-[#1E2E4E] bg-white dark:bg-[#0F172A] outline-none" />
                        </div>
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">Middle Name</label>
                        <input type="text" value={editMiddleName} onChange={(e) => setEditMiddleName(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-[#1E2E4E] bg-white dark:bg-[#0F172A] outline-none" />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">Email Address *</label>
                        <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-[#1E2E4E] bg-white dark:bg-[#0F172A] outline-none" />
                        <p className="text-[10px] text-gray-400 mt-1">Sign-in links are emailed here — use a real inbox.</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block font-semibold mb-1">Department</label>
                          <input type="text" value={editDepartment} onChange={(e) => setEditDepartment(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-[#1E2E4E] bg-white dark:bg-[#0F172A] outline-none" />
                        </div>
                        <div>
                          <label className="block font-semibold mb-1">Phone</label>
                          <input type="text" value={editPhone} onChange={(e) => setEditPhone(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-[#1E2E4E] bg-white dark:bg-[#0F172A] outline-none" />
                        </div>
                      </div>
                      <div className="flex justify-end space-x-2 pt-1">
                        <button onClick={() => setIsEditingUser(false)}
                          className="px-4 py-2 rounded-xl border border-gray-300 text-gray-600 hover:bg-gray-100 font-semibold">
                          Cancel
                        </button>
                        <button onClick={handleSaveUserEdit} disabled={savingUserEdit}
                          className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold disabled:opacity-60">
                          {savingUserEdit ? 'Saving...' : 'Save Changes'}
                        </button>
                      </div>
                    </div>
                  ) : (
                  <div className="grid grid-cols-2 gap-2 p-3 bg-gray-50 dark:bg-[#16223B] rounded-2xl">
                    <div>
                      <span className="text-gray-400 block text-[10px]">Full Legal Name</span>
                      <span className="font-bold text-gray-900 dark:text-white">
                        {selectedUserForDetail.firstName} {selectedUserForDetail.middleName} {selectedUserForDetail.lastName}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[10px]">Email Address</span>
                      <span className="font-medium text-gray-800 dark:text-gray-200">{selectedUserForDetail.email}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[10px]">Department</span>
                      <span className="font-medium text-gray-800 dark:text-gray-200">{selectedUserForDetail.department || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[10px]">Electoral Role</span>
                      <span className="font-bold uppercase text-purple-600">{selectedUserForDetail.role}</span>
                    </div>
                    <div className="col-span-2 pt-1">
                      <button
                        onClick={() => startEditingUser(selectedUserForDetail)}
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 rounded-xl font-bold hover:bg-purple-100 text-xs"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit Details</span>
                      </button>
                    </div>
                  </div>
                  )}

                  {/* Accreditation control */}
                  <div className="p-3 bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <CheckCircle2 className={`w-5 h-5 ${selectedUserForDetail.isAccredited ? 'text-blue-600' : 'text-gray-400'}`} />
                      <div>
                        <span className="font-bold text-gray-900 dark:text-white block">Accreditation Authorization</span>
                        <span className="text-[10px] text-gray-500">
                          {selectedUserForDetail.isAccredited ? 'Voter is accredited and authorized to vote.' : 'Voter is pending accreditation.'}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleToggleAccreditation(selectedUserForDetail)}
                      className={`px-3 py-1.5 rounded-xl font-bold text-xs ${
                        selectedUserForDetail.isAccredited
                          ? 'bg-gray-200 hover:bg-gray-300 text-gray-800'
                          : 'bg-blue-600 hover:bg-blue-700 text-white'
                      }`}
                    >
                      {selectedUserForDetail.isAccredited ? 'Revoke' : 'Accredit'}
                    </button>
                  </div>

                  {/* Password reset control */}
                  <div className="p-3 bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-2xl space-y-2">
                    <div className="flex items-center space-x-2">
                      <KeyRound className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                      <div>
                        <span className="font-bold text-gray-900 dark:text-white block">Password Reset (Self-Service)</span>
                        <span className="text-[10px] text-gray-500">
                          A reset link will be sent to the voter's registered email address. They set their own new password.
                        </span>
                      </div>
                    </div>
                    {resetFeedback && (
                      <p className="text-[11px] font-semibold text-gray-700 dark:text-slate-300">{resetFeedback}</p>
                    )}
                    <button
                      onClick={handleResetPassword}
                      disabled={resettingPassword}
                      className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold disabled:opacity-60"
                    >
                      {resettingPassword ? 'Sending...' : 'Send Reset Email'}
                    </button>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-gray-100 dark:border-[#1E2E4E]">
                  <button
                    onClick={() => handleDeleteVoter(selectedUserForDetail.id)}
                    className="text-red-600 hover:text-red-700 text-xs font-semibold flex items-center space-x-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete User</span>
                  </button>

                  <button
                    onClick={() => { setSelectedUserForDetail(null); setIsEditingUser(false); setResetPassword(''); setResetFeedback(null); }}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-[#16223B] text-gray-700 dark:text-slate-300 rounded-xl font-semibold text-xs"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: OFFICES & SCREENING CRITERIA */}
      {/* ========================================================================= */}
      {activeTab === 'offices' && (
        <div className="space-y-8">
          {/* Section A: Offices List & Add */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Create Office */}
            <div className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#1E2E4E] rounded-3xl p-6 shadow-sm space-y-4">
              <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-purple-600" />
                <span>Add Contested Office</span>
              </h2>

              <form onSubmit={handleCreateOffice} className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold mb-1">Office Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Director of Information"
                    value={newOfficeTitle}
                    onChange={(e) => setNewOfficeTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-[#1E2E4E] bg-gray-50 dark:bg-[#16223B] outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">Scope of Authority</label>
                  <textarea
                    rows={2}
                    placeholder="Constitutional responsibilities"
                    value={newOfficeDesc}
                    onChange={(e) => setNewOfficeDesc(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-[#1E2E4E] bg-gray-50 dark:bg-[#16223B] outline-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl"
                >
                  Create Position
                </button>
              </form>
            </div>

            {/* List Offices */}
            <div className="lg:col-span-2 bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#1E2E4E] rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-gray-900 dark:text-white">
                  Contested Offices Registry ({offices.length})
                </h2>
                <div className="relative w-48">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search offices..."
                    value={officeSearch}
                    onChange={(e) => setOfficeSearch(e.target.value)}
                    className="w-full pl-8 pr-2 py-1.5 text-xs rounded-xl border border-gray-200 dark:border-[#1E2E4E] bg-gray-50 dark:bg-[#16223B]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {offices
                  .filter(o => o.title.toLowerCase().includes(officeSearch.toLowerCase()))
                  .map(o => {
                    const cands = candidates.filter(c => c.officeId === o.id);
                    return (
                      <div key={o.id} className="p-3.5 rounded-2xl bg-gray-50 dark:bg-[#16223B] border border-gray-200 dark:border-[#1E2E4E] flex flex-col justify-between space-y-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="font-extrabold text-sm text-gray-900 dark:text-white">{o.title}</span>
                            <p className="text-[11px] text-gray-500 line-clamp-2 mt-0.5">{o.description}</p>
                          </div>
                          <button
                            onClick={() => handleDeleteOffice(o.id)}
                            className="text-gray-400 hover:text-red-600 p-1"
                            title="Delete Office"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-gray-200/60 dark:border-slate-800">
                          <span className="font-mono text-gray-400">Order: {o.order}</span>
                          <span className="font-bold text-blue-600">{cands.length} Contestants</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>

          {/* Section B: Assign Offices to Users (Single Office Rule) */}
          <div className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#1E2E4E] rounded-3xl p-6 shadow-sm space-y-4">
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-purple-600" />
                <span>Assign Office to User (Contestant Declaration)</span>
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Rule: A user cannot be assigned more than one office. Assigned users automatically become contestants.
              </p>
            </div>

            {assignOfficeError && (
              <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs border border-red-200">
                {assignOfficeError}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Select Office */}
              <div>
                <label className="block text-xs font-semibold mb-1">1. Select Target Office</label>
                <select
                  value={selectedOfficeForAssign}
                  onChange={(e) => setSelectedOfficeForAssign(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-[#1E2E4E] bg-gray-50 dark:bg-[#16223B] text-xs font-semibold"
                >
                  <option value="">-- Choose an Office --</option>
                  {offices.map(o => (
                    <option key={o.id} value={o.id}>{o.title}</option>
                  ))}
                </select>
              </div>

              {/* Search User to Assign */}
              <div>
                <label className="block text-xs font-semibold mb-1">2. Search Eligible Constituent</label>
                <input
                  type="text"
                  placeholder="Type name or RA number..."
                  value={assignUserSearch}
                  onChange={(e) => setAssignUserSearch(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-[#1E2E4E] bg-gray-50 dark:bg-[#16223B] text-xs"
                />
              </div>
            </div>

            {/* User List for Assignment */}
            {selectedOfficeForAssign && (
              <div className="border border-gray-200 dark:border-[#1E2E4E] rounded-2xl p-3 max-h-56 overflow-y-auto space-y-1.5">
                <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Click a user to assign:</span>
                {voters
                  .filter(v => 
                    v.firstName.toLowerCase().includes(assignUserSearch.toLowerCase()) ||
                    v.lastName.toLowerCase().includes(assignUserSearch.toLowerCase()) ||
                    v.raNumber.includes(assignUserSearch)
                  )
                  .map(v => {
                    const isAlreadyAssigned = Boolean(v.assignedOfficeId);
                    const isAssignedToThisOffice = v.assignedOfficeId === selectedOfficeForAssign;
                    const assignedOfficeTitle = offices.find(o => o.id === v.assignedOfficeId)?.title;

                    return (
                      <div
                        key={v.id}
                        className={`p-2.5 rounded-xl text-xs flex items-center justify-between transition-colors ${
                          isAssignedToThisOffice
                            ? 'bg-blue-50 dark:bg-blue-950/60 border border-blue-300'
                            : isAlreadyAssigned
                            ? 'bg-gray-100 dark:bg-slate-800 opacity-60'
                            : 'bg-gray-50 dark:bg-[#16223B] hover:bg-purple-50 hover:border-purple-300 cursor-pointer border border-transparent'
                        }`}
                        onClick={() => {
                          if (!isAlreadyAssigned) {
                            handleAssignOffice(v.id, selectedOfficeForAssign);
                          }
                        }}
                      >
                        <div>
                          <span className="font-bold text-gray-900 dark:text-white">
                            {v.firstName} {v.lastName}
                          </span>
                          <span className="font-mono text-gray-400 ml-2">RA-{v.raNumber}</span>
                        </div>

                        <div>
                          {isAssignedToThisOffice ? (
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-blue-600">Assigned Here</span>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleUnassignOffice(v.id); }}
                                className="text-red-500 hover:text-red-700 font-semibold"
                              >
                                Undo
                              </button>
                            </div>
                          ) : isAlreadyAssigned ? (
                            <span className="text-gray-400 italic text-[11px]">Contesting for {assignedOfficeTitle}</span>
                          ) : (
                            <span className="text-purple-600 font-bold hover:underline">Assign to Office</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          {/* Section C: Screening Criteria & Screening Tool */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Criteria Builder */}
            <div className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#1E2E4E] rounded-3xl p-6 shadow-sm space-y-4">
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Award className="w-4 h-4 text-purple-600" />
                  <span>Screening Criteria Builder</span>
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Select office and use the plus button to add criteria textboxes.
                </p>
              </div>

              <form onSubmit={handleSaveCriteria} className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold mb-1">Select Office</label>
                  <select
                    value={selectedOfficeForCriteria}
                    onChange={(e) => {
                      const offId = e.target.value;
                      setSelectedOfficeForCriteria(offId);
                      const existing = screeningCriteria.find(sc => sc.officeId === offId);
                      if (existing) {
                        setCriteriaTitle(existing.title);
                        setCriteriaItems(existing.criteria);
                      } else {
                        setCriteriaTitle('');
                        setCriteriaItems(['']);
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-[#1E2E4E] bg-gray-50 dark:bg-[#16223B]"
                  >
                    <option value="">-- Choose Office --</option>
                    {offices.map(o => (
                      <option key={o.id} value={o.id}>{o.title}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1">Criteria Benchmark Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Constitutional Clearance Benchmark"
                    value={criteriaTitle}
                    onChange={(e) => setCriteriaTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-[#1E2E4E] bg-gray-50 dark:bg-[#16223B]"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-semibold">Screening Criteria Items ({criteriaItems.length})</label>
                    <button
                      type="button"
                      onClick={() => setCriteriaItems([...criteriaItems, ''])}
                      className="px-2 py-1 bg-purple-50 text-purple-600 font-bold rounded-lg hover:bg-purple-100 flex items-center space-x-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Textbox</span>
                    </button>
                  </div>

                  {criteriaItems.map((item, idx) => (
                    <div key={idx} className="flex items-center space-x-2">
                      <span className="font-mono text-gray-400 w-4">{idx + 1}.</span>
                      <input
                        type="text"
                        required
                        placeholder={`Criterion ${idx + 1}`}
                        value={item}
                        onChange={(e) => {
                          const updated = [...criteriaItems];
                          updated[idx] = e.target.value;
                          setCriteriaItems(updated);
                        }}
                        className="flex-1 px-3 py-1.5 rounded-xl border border-gray-300 dark:border-[#1E2E4E] bg-gray-50 dark:bg-[#16223B]"
                      />
                      {criteriaItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setCriteriaItems(criteriaItems.filter((_, i) => i !== idx))}
                          className="text-gray-400 hover:text-red-500"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  type="submit"
                  disabled={savingCriteria || !selectedOfficeForCriteria}
                  className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl"
                >
                  {savingCriteria ? 'Saving...' : 'Save Screening Criteria'}
                </button>
              </form>
            </div>

            {/* Candidate Screening Evaluation Tool */}
            <div className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#1E2E4E] rounded-3xl p-6 shadow-sm space-y-4">
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Screen Contestant (Pass / Fail Evaluation)</span>
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Requirement: Total must be 50% or more to be declared screened.
                </p>
              </div>

              {screeningFeedback && (
                <div className="p-3 rounded-xl bg-purple-50 text-purple-800 text-xs font-semibold border border-purple-200">
                  {screeningFeedback}
                </div>
              )}

              <form onSubmit={handleSubmitScreening} className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold mb-1">Select Contestant to Screen</label>
                  <select
                    value={screeningCandidateId}
                    onChange={(e) => {
                      const candId = e.target.value;
                      setScreeningCandidateId(candId);
                      const cand = candidates.find(c => c.id === candId);
                      if (cand) {
                        const crit = screeningCriteria.find(sc => sc.officeId === cand.officeId);
                        if (crit) {
                          setEvalResults(crit.criteria.map(c => ({ criterion: c, passed: true })));
                        } else {
                          setEvalResults([]);
                        }
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-[#1E2E4E] bg-gray-50 dark:bg-[#16223B]"
                  >
                    <option value="">-- Choose Contestant --</option>
                    {candidates.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({offices.find(o => o.id === c.officeId)?.title})
                      </option>
                    ))}
                  </select>
                </div>

                {evalResults.length === 0 && screeningCandidateId && (
                  <p className="text-amber-600 italic">No screening criteria configured for this office yet.</p>
                )}

                {evalResults.length > 0 && (
                  <div className="space-y-2 border border-gray-200 dark:border-[#1E2E4E] p-3 rounded-2xl max-h-56 overflow-y-auto">
                    {evalResults.map((r, i) => (
                      <div key={i} className="flex items-center justify-between p-2 rounded-xl bg-gray-50 dark:bg-[#16223B]">
                        <span className="font-medium text-[11px] max-w-xs">{r.criterion}</span>
                        <div className="flex items-center space-x-3 shrink-0">
                          <label className="flex items-center space-x-1 text-emerald-600 font-bold cursor-pointer">
                            <input
                              type="radio"
                              name={`crit-${i}`}
                              checked={r.passed === true}
                              onChange={() => {
                                const updated = [...evalResults];
                                updated[i].passed = true;
                                setEvalResults(updated);
                              }}
                            />
                            <span>Pass</span>
                          </label>
                          <label className="flex items-center space-x-1 text-red-600 font-bold cursor-pointer">
                            <input
                              type="radio"
                              name={`crit-${i}`}
                              checked={r.passed === false}
                              onChange={() => {
                                const updated = [...evalResults];
                                updated[i].passed = false;
                                setEvalResults(updated);
                              }}
                            />
                            <span>Fail</span>
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {evalResults.length > 0 && (
                  <button
                    type="submit"
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl"
                  >
                    Save & Declare Screening Result
                  </button>
                )}
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: AGENTS */}
      {/* ========================================================================= */}
      {activeTab === 'agents' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#1E2E4E] rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  <span>Candidate Agents Directory ({agents.length})</span>
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Agents can monitor general logs of their contestants through the special Agent Monitor tab under Log.
                </p>
              </div>

              <button
                onClick={() => setShowAddAgentModal(true)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-sm flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>Assign New Agent</span>
              </button>
            </div>

            {/* Search */}
            <div className="relative w-full max-w-md">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Search agents or contestants..."
                value={agentSearch}
                onChange={(e) => setAgentSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 dark:border-[#1E2E4E] bg-gray-50 dark:bg-[#16223B] text-xs"
              />
            </div>

            {/* Agents Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-gray-400 uppercase bg-gray-50 dark:bg-[#16223B]/60 font-bold">
                  <tr>
                    <th className="py-3 px-4">Agent Name & RA</th>
                    <th className="py-3 px-4">Contested Office</th>
                    <th className="py-3 px-4">Contestant Represented</th>
                    <th className="py-3 px-4">Assigned Date</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-[#1E2E4E]">
                  {agents
                    .filter(a => 
                      a.voterName.toLowerCase().includes(agentSearch.toLowerCase()) ||
                      a.candidateName.toLowerCase().includes(agentSearch.toLowerCase()) ||
                      a.voterRaNumber.includes(agentSearch)
                    )
                    .map(agent => (
                      <tr key={agent.id} className="hover:bg-gray-50 dark:hover:bg-[#16223B]/40">
                        <td className="py-3 px-4">
                          <span className="font-bold text-gray-900 dark:text-white block">{agent.voterName}</span>
                          <span className="font-mono text-blue-600 text-[11px]">RA-{agent.voterRaNumber}</span>
                        </td>
                        <td className="py-3 px-4 font-semibold text-gray-700 dark:text-slate-300">
                          {offices.find(o => o.id === agent.officeId)?.title}
                        </td>
                        <td className="py-3 px-4 font-bold text-purple-600">
                          {agent.candidateName}
                        </td>
                        <td className="py-3 px-4 text-gray-400 font-mono">
                          {new Date(agent.assignedAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleDeleteAgent(agent.id)}
                            className="text-red-500 hover:text-red-700 font-semibold"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Add Agent Modal */}
          {showAddAgentModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
              <div className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#1E2E4E] rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 dark:border-[#1E2E4E] pb-3">
                  <h3 className="font-bold text-base text-gray-900 dark:text-white">Assign Candidate Agent</h3>
                  <button onClick={() => setShowAddAgentModal(false)} className="text-gray-400 hover:text-gray-600">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {agentError && (
                  <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs border border-red-200">
                    {agentError}
                  </div>
                )}

                <form onSubmit={handleAssignAgent} className="space-y-3 text-xs">
                  <div>
                    <label className="block font-semibold mb-1">Select Office</label>
                    <select
                      value={agentOfficeId}
                      onChange={(e) => {
                        setAgentOfficeId(e.target.value);
                        setAgentCandidateId('');
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-[#1E2E4E] bg-gray-50 dark:bg-[#16223B]"
                    >
                      <option value="">-- Select Office --</option>
                      {offices.map(o => (
                        <option key={o.id} value={o.id}>{o.title}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold mb-1">Select Registered Voter as Agent</label>
                    <select
                      value={agentVoterId}
                      onChange={(e) => setAgentVoterId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-[#1E2E4E] bg-gray-50 dark:bg-[#16223B]"
                    >
                      <option value="">-- Choose Voter --</option>
                      {voters.map(v => (
                        <option key={v.id} value={v.id}>{v.firstName} {v.lastName} (RA-{v.raNumber})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold mb-1">Select Candidate They Represent</label>
                    <select
                      value={agentCandidateId}
                      onChange={(e) => setAgentCandidateId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-[#1E2E4E] bg-gray-50 dark:bg-[#16223B]"
                    >
                      <option value="">-- Choose Candidate --</option>
                      {candidates
                        .filter(c => !agentOfficeId || c.officeId === agentOfficeId)
                        .map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                  </div>

                  <div className="flex justify-end space-x-2 pt-3">
                    <button
                      type="button"
                      onClick={() => setShowAddAgentModal(false)}
                      className="px-4 py-2 border rounded-xl"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl"
                    >
                      Assign Agent
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: OBSERVERS */}
      {/* ========================================================================= */}
      {activeTab === 'observers' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#1E2E4E] rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Eye className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  <span>Accredited Observers Directory ({observers.length})</span>
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Observers do not log in. A unique read-only link is generated (enforced on max 1 device at a time).
                </p>
              </div>

              <button
                onClick={() => setShowAddObserverModal(true)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-sm flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>Create Observer</span>
              </button>
            </div>

            {/* Search */}
            <div className="relative w-full max-w-md">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Search observers by name, rank, or office..."
                value={observerSearch}
                onChange={(e) => setObserverSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 dark:border-[#1E2E4E] bg-gray-50 dark:bg-[#16223B] text-xs"
              />
            </div>

            {/* Observers Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-gray-400 uppercase bg-gray-50 dark:bg-[#16223B]/60 font-bold">
                  <tr>
                    <th className="py-3 px-4">Observer Name</th>
                    <th className="py-3 px-4">Rank / Portfolio</th>
                    <th className="py-3 px-4">Institution / Office</th>
                    <th className="py-3 px-4">Phone</th>
                    <th className="py-3 px-4">Unique Read-Only Link</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-[#1E2E4E]">
                  {observers
                    .filter(o => 
                      o.name.toLowerCase().includes(observerSearch.toLowerCase()) ||
                      o.rank.toLowerCase().includes(observerSearch.toLowerCase()) ||
                      (o.office && o.office.toLowerCase().includes(observerSearch.toLowerCase()))
                    )
                    .map(obs => {
                      const isCopied = copiedToken === obs.token;

                      return (
                        <tr key={obs.id} className="hover:bg-gray-50 dark:hover:bg-[#16223B]/40">
                          <td className="py-3 px-4 font-bold text-gray-900 dark:text-white">
                            {obs.name}
                          </td>
                          <td className="py-3 px-4 font-semibold text-purple-600">
                            {obs.rank}
                          </td>
                          <td className="py-3 px-4 text-gray-600 dark:text-slate-300">
                            {obs.office || 'Independent'}
                          </td>
                          <td className="py-3 px-4 font-mono text-gray-500">
                            {obs.phone}
                          </td>
                          <td className="py-3 px-4">
                            <button
                              onClick={() => copyObserverUrl(obs.token)}
                              className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 rounded-lg font-mono text-[11px] font-bold flex items-center space-x-1.5 hover:bg-blue-100"
                              title="Copy Observer Link (Max 1 Device)"
                            >
                              <Copy className="w-3.5 h-3.5" />
                              <span>{isCopied ? 'Copied Link! ✓' : 'Copy Observer Link'}</span>
                            </button>
                          </td>
                          <td className="py-3 px-4 text-right space-x-2">
                            <button
                              onClick={() => handleRegenerateObserverLink(obs.id)}
                              className="text-purple-600 hover:text-purple-800 font-semibold"
                              title="Regenerate link to revoke older access"
                            >
                              Regenerate
                            </button>
                            <button
                              onClick={() => handleDeleteObserver(obs.id)}
                              className="text-red-500 hover:text-red-700 font-semibold"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Add Observer Modal */}
          {showAddObserverModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
              <div className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#1E2E4E] rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 dark:border-[#1E2E4E] pb-3">
                  <h3 className="font-bold text-base text-gray-900 dark:text-white">Accredit Election Observer</h3>
                  <button onClick={() => setShowAddObserverModal(false)} className="text-gray-400 hover:text-gray-600">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleAddObserver} className="space-y-3 text-xs">
                  <div>
                    <label className="block font-semibold mb-1">Full Legal Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Dr. Emily Johnson"
                      value={obsName}
                      onChange={(e) => setObsName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-[#1E2E4E] bg-gray-50 dark:bg-[#16223B]"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold mb-1">Rank / Designation *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Senior Mission Observer"
                      value={obsRank}
                      onChange={(e) => setObsRank(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-[#1E2E4E] bg-gray-50 dark:bg-[#16223B]"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold mb-1">Office / Monitoring Organization</label>
                    <input
                      type="text"
                      placeholder="e.g. Electoral Integrity Coalition"
                      value={obsOffice}
                      onChange={(e) => setObsOffice(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-[#1E2E4E] bg-gray-50 dark:bg-[#16223B]"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold mb-1">Contact Phone *</label>
                    <input
                      type="text"
                      required
                      placeholder="+234 800 000 0000"
                      value={obsPhone}
                      onChange={(e) => setObsPhone(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-[#1E2E4E] bg-gray-50 dark:bg-[#16223B]"
                    />
                  </div>

                  <p className="text-[11px] text-gray-400 italic">
                    A unique link will be generated. Observers can view everything in read-only mode without logging in.
                  </p>

                  <div className="flex justify-end space-x-2 pt-3">
                    <button
                      type="button"
                      onClick={() => setShowAddObserverModal(false)}
                      className="px-4 py-2 border rounded-xl"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl"
                    >
                      Issue Observer Pass
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: TIMELINE & PROCEDURAL MILESTONES (AS DISPLAYED IN DASHBOARD) */}
      {/* ========================================================================= */}
      {activeTab === 'timeline' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#1E2E4E] rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 dark:border-[#1E2E4E] pb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Clock className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  <span>Election Timeline & Milestones Management</span>
                </h2>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                  Configure procedural phases, dates, titles, descriptions, and statuses matching the live public Dashboard
                </p>
              </div>

              {timelineFeedback && (
                <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-xs font-semibold rounded-xl border border-emerald-300">
                  <Check className="w-3.5 h-3.5" />
                  <span>{timelineFeedback}</span>
                </div>
              )}
            </div>

            {/* Add / Edit Milestone Form */}
            <form onSubmit={handleSaveMilestone} className="space-y-4 bg-gray-50 dark:bg-[#16223B] p-5 rounded-2xl border border-gray-200 dark:border-[#1E2E4E]">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-gray-900 dark:text-white text-xs flex items-center gap-2 uppercase tracking-wider">
                  <Plus className="w-4 h-4 text-purple-600" />
                  <span>{editingMilestoneId ? 'Edit Milestone Phase' : 'Add New Election Milestone Phase'}</span>
                </h3>
                {editingMilestoneId && (
                  <button
                    type="button"
                    onClick={resetMilestoneForm}
                    className="text-xs text-red-500 hover:underline font-semibold"
                  >
                    Cancel Editing
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Milestone Title */}
                <div>
                  <label className="block font-semibold mb-1 text-gray-700 dark:text-slate-200">
                    Milestone Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Voter Registration & Database Publication"
                    value={milestoneTitle}
                    onChange={(e) => setMilestoneTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-[#1E2E4E] bg-white dark:bg-[#0F172A] text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                {/* Date / Period */}
                <div>
                  <label className="block font-semibold mb-1 text-gray-700 dark:text-slate-200">
                    Date / Schedule Period *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Aug 01 - Aug 20, 2026"
                    value={milestoneDate}
                    onChange={(e) => setMilestoneDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-[#1E2E4E] bg-white dark:bg-[#0F172A] text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="text-xs">
                <label className="block font-semibold mb-1 text-gray-700 dark:text-slate-200">
                  Milestone Description / Procedural Details
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Publishing of eligible electorate voter lists, RA assignments, and institutional directory cross-matching."
                  value={milestoneDesc}
                  onChange={(e) => setMilestoneDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-[#1E2E4E] bg-white dark:bg-[#0F172A] text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* 3 Columns: Status, Order, Icon */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                {/* Status */}
                <div>
                  <label className="block font-semibold mb-1 text-gray-700 dark:text-slate-200">
                    Current Status
                  </label>
                  <select
                    value={milestoneStatus}
                    onChange={(e) => setMilestoneStatus(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-[#1E2E4E] bg-white dark:bg-[#0F172A] text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500 font-semibold"
                  >
                    <option value="upcoming">Upcoming (Pending Phase)</option>
                    <option value="active">Active (Current In-Progress Phase)</option>
                    <option value="completed">Completed (Archived Phase)</option>
                  </select>
                </div>

                {/* Sequence Order */}
                <div>
                  <label className="block font-semibold mb-1 text-gray-700 dark:text-slate-200">
                    Sequence Order Number
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={milestoneOrder}
                    onChange={(e) => setMilestoneOrder(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-[#1E2E4E] bg-white dark:bg-[#0F172A] text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                {/* Icon Selection */}
                <div>
                  <label className="block font-semibold mb-1 text-gray-700 dark:text-slate-200">
                    Visual Icon
                  </label>
                  <select
                    value={milestoneIcon}
                    onChange={(e) => setMilestoneIcon(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-[#1E2E4E] bg-white dark:bg-[#0F172A] text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="UserCheck">UserCheck (Registration / Voters)</option>
                    <option value="FileCheck">FileCheck (Nomination / Screening)</option>
                    <option value="Radio">Radio (Debate / Broadcast)</option>
                    <option value="BadgeCheck">BadgeCheck (Accreditation)</option>
                    <option value="Vote">Vote (E-Ballot Chamber)</option>
                    <option value="Award">Award (Results Declaration)</option>
                    <option value="Clock">Clock (General Procedural Milestone)</option>
                  </select>
                </div>
              </div>

              {/* Submit button */}
              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={timelineLoading}
                  className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-xs transition-all flex items-center space-x-2 text-xs"
                >
                  <Save className="w-4 h-4" />
                  <span>{editingMilestoneId ? 'Update Milestone' : 'Save Milestone'}</span>
                </button>
              </div>
            </form>

            {/* Filter / Search Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter milestones by title or description..."
                  value={timelineSearch}
                  onChange={(e) => setTimelineSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 dark:border-[#1E2E4E] bg-white dark:bg-[#0F172A] text-xs text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <span className="text-xs text-gray-500">
                Total Milestones: <strong>{timelineItems.length}</strong>
              </span>
            </div>

            {/* List of Milestones */}
            <div className="space-y-3">
              {timelineItems
                .filter(t =>
                  t.title.toLowerCase().includes(timelineSearch.toLowerCase()) ||
                  t.description.toLowerCase().includes(timelineSearch.toLowerCase())
                )
                .map((item, idx) => {
                  const isDone = item.status === 'completed';
                  const isActive = item.status === 'active';

                  return (
                    <div
                      key={item.id}
                      className="p-4 rounded-2xl bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-[#1E2E4E] hover:border-purple-300 dark:hover:border-purple-600 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs"
                    >
                      <div className="flex items-start space-x-3.5 flex-1 min-w-0">
                        {/* Circular node */}
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 shadow-xs ${
                            isDone
                              ? 'bg-emerald-500 text-white'
                              : isActive
                              ? 'bg-blue-600 text-white ring-2 ring-blue-300 animate-pulse'
                              : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400'
                          }`}
                        >
                          {isDone ? '✓' : item.order || idx + 1}
                        </div>

                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-gray-900 dark:text-white text-xs md:text-sm">
                              {item.title}
                            </span>
                            <span
                              className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                                isDone
                                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                                  : isActive
                                  ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                                  : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400'
                              }`}
                            >
                              {item.status}
                            </span>
                            <span className="text-xs font-mono text-purple-600 dark:text-purple-400 font-semibold">
                              {item.date}
                            </span>
                          </div>

                          <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed">
                            {item.description}
                          </p>
                        </div>
                      </div>

                      {/* Quick Status Toggles & Actions */}
                      <div className="flex flex-wrap items-center gap-2 self-end md:self-center shrink-0 text-xs">
                        <div className="flex bg-gray-100 dark:bg-[#16223B] p-1 rounded-xl">
                          <button
                            type="button"
                            onClick={() => handleQuickStatusToggle(item.id, 'completed')}
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                              item.status === 'completed'
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'text-gray-500 hover:text-gray-900'
                            }`}
                            title="Mark as Completed"
                          >
                            Completed
                          </button>
                          <button
                            type="button"
                            onClick={() => handleQuickStatusToggle(item.id, 'active')}
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                              item.status === 'active'
                                ? 'bg-blue-600 text-white shadow-xs'
                                : 'text-gray-500 hover:text-gray-900'
                            }`}
                            title="Mark as Active"
                          >
                            Active
                          </button>
                          <button
                            type="button"
                            onClick={() => handleQuickStatusToggle(item.id, 'upcoming')}
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                              item.status === 'upcoming'
                                ? 'bg-gray-700 text-white shadow-xs'
                                : 'text-gray-500 hover:text-gray-900'
                            }`}
                            title="Mark as Upcoming"
                          >
                            Upcoming
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleEditMilestone(item)}
                          className="p-1.5 rounded-xl border border-gray-200 dark:border-[#1E2E4E] hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-600 dark:text-slate-300"
                          title="Edit Milestone"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteMilestone(item.id)}
                          className="p-1.5 rounded-xl border border-red-200 dark:border-red-900/60 hover:bg-red-50 dark:hover:bg-red-950/50 text-red-600 dark:text-red-400"
                          title="Delete Milestone"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
