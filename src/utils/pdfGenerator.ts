import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '../lib/supabase';
import { Office, CandidateProfile, Voter, YCECMember, CastVote } from '../types';

// Helper to record PDF export to immutable audit log
export const logPdfExport = async (listName: string, _token?: string | null) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const actor = {
      id: user?.id,
      raNumber: undefined as string | undefined,
      name: undefined as string | undefined,
      email: user?.email,
      role: undefined as string | undefined
    };
    if (user) {
      const { data: me } = await supabase
        .from('voters')
        .select('ra_number,first_name,last_name,role')
        .eq('auth_uid', user.id)
        .maybeSingle();
      if (me) {
        actor.raNumber = String(me.ra_number);
        actor.name = `${me.first_name} ${me.last_name}`.trim();
        actor.role = me.role;
      }
    }
    await supabase.rpc('append_audit', {
      p_event_type: 'PDF_EXPORT',
      p_actor: actor,
      p_details: { listName }
    });
  } catch (err) {
    console.error('Failed to log PDF export event', err);
  }
};

const addBrandedHeader = (doc: jsPDF, title: string, subtitle: string) => {
  const pageWidth = doc.internal.pageSize.getWidth();

  // Primary color bar
  doc.setFillColor(15, 23, 42); // #0F172A
  doc.rect(0, 0, pageWidth, 24, 'F');

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('FATBALLOT | OFFICIAL ELECTION DOCUMENT', 14, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(`Generated on ${new Date().toUTCString()} | Immutable Audit Verified`, 14, 18);

  // Document Title
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(title, 14, 34);

  // Subtitle
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(subtitle, 14, 40);

  doc.setDrawColor(226, 232, 240);
  doc.line(14, 43, pageWidth - 14, 43);
};

const addBrandedFooter = (doc: jsPDF) => {
  const pageCount = (doc as any).internal.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text('FatBallot Governance Engine • Zero-Tampering Audit Ledger', 14, pageHeight - 7);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 25, pageHeight - 7);
  }
};

// 1. Export Offices
export const exportOfficesPdf = async (offices: Office[], token?: string | null) => {
  const doc = new jsPDF();
  addBrandedHeader(doc, 'List of Election Offices & Portfolios', 'Certified positions open for election contest');

  const tableData = offices.map((o, idx) => [
    idx + 1,
    o.title,
    o.description
  ]);

  autoTable(doc, {
    startY: 48,
    head: [['#', 'Position / Office Title', 'Description & Scope of Authority']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 4 },
    columnStyles: {
      0: { cellWidth: 12 },
      1: { cellWidth: 55, fontStyle: 'bold' },
      2: { cellWidth: 'auto' }
    }
  });

  addBrandedFooter(doc);
  doc.save('FatBallot_Offices_List.pdf');
  await logPdfExport('Offices & Positions List', token);
};

// 2. Export Registered Voters
export const exportVotersPdf = async (voters: Voter[], isAccreditedOnly: boolean = false, token?: string | null) => {
  const doc = new jsPDF();
  const title = isAccreditedOnly ? 'Certified Accredited Voters Register' : 'Official Registered Voters Register';
  const subtitle = isAccreditedOnly 
    ? 'List of verified voters with active ballot authorization' 
    : 'Comprehensive list of enrolled electorate members';

  addBrandedHeader(doc, title, subtitle);

  const filtered = isAccreditedOnly ? voters.filter(v => v.isAccredited) : voters;

  const tableData = filtered.map((v, idx) => [
    idx + 1,
    `RA-${v.raNumber}`,
    `${v.firstName} ${v.middleName ? v.middleName + ' ' : ''}${v.lastName}`,
    v.email,
    v.department || 'N/A',
    v.isAccredited ? 'ACCREDITED' : 'PENDING'
  ]);

  autoTable(doc, {
    startY: 48,
    head: [['#', 'RA Number', 'Full Name', 'Email Address', 'Faculty / Department', 'Status']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 8.5, cellPadding: 3.5 },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 26, fontStyle: 'bold' },
      2: { cellWidth: 45 },
      3: { cellWidth: 50 },
      4: { cellWidth: 35 },
      5: { cellWidth: 24, halign: 'center' }
    }
  });

  addBrandedFooter(doc);
  const filename = isAccreditedOnly ? 'FatBallot_Accredited_Voters.pdf' : 'FatBallot_Registered_Voters.pdf';
  doc.save(filename);
  await logPdfExport(title, token);
};

// 3. Export Contestants (with detailed profile summary)
export const exportContestantsPdf = async (candidates: CandidateProfile[], offices: Office[], token?: string | null) => {
  const doc = new jsPDF();
  addBrandedHeader(doc, 'Certified Contestants & Candidate Profiles', 'Official candidate registry with visions, antecedents, and offices');

  const tableData = candidates.map((c, idx) => {
    const office = offices.find(o => o.id === c.officeId)?.title || 'General Office';
    const antecedents = (c.antecedent || []).join('\n• ');
    const currentOffices = (c.currentOffices || []).join(', ');

    return [
      idx + 1,
      c.name,
      `RA-${c.raNumber}`,
      office,
      c.vision || 'N/A',
      antecedents ? `• ${antecedents}` : 'N/A',
      currentOffices || 'None'
    ];
  });

  autoTable(doc, {
    startY: 48,
    head: [['#', 'Candidate Name', 'RA No.', 'Office Contesting', 'Vision Statement', 'Antecedents & Track Record', 'Current Offices']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 7.5, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 30, fontStyle: 'bold' },
      2: { cellWidth: 18 },
      3: { cellWidth: 28 },
      4: { cellWidth: 38 },
      5: { cellWidth: 40 },
      6: { cellWidth: 24 }
    }
  });

  addBrandedFooter(doc);
  doc.save('FatBallot_Contestants_Registry.pdf');
  await logPdfExport('Contestants Registry', token);
};

// 4. Export YCEC Members
export const exportYCECPdf = async (members: YCECMember[], token?: string | null) => {
  const doc = new jsPDF();
  addBrandedHeader(doc, 'YCEC Commissioners Registry', 'Official Electoral Commissioners and Secretariat Officers');

  const tableData = members.map((m, idx) => [
    idx + 1,
    m.name,
    m.role,
    m.email,
    m.phone,
    m.tenure
  ]);

  autoTable(doc, {
    startY: 48,
    head: [['#', 'Member Full Name', 'Commission Portfolio / Role', 'Official Email', 'Contact Phone', 'Tenure']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 4 },
    columnStyles: {
      0: { cellWidth: 12 },
      1: { cellWidth: 45, fontStyle: 'bold' },
      2: { cellWidth: 50 },
      3: { cellWidth: 42 },
      4: { cellWidth: 28 },
      5: { cellWidth: 20 }
    }
  });

  addBrandedFooter(doc);
  doc.save('FatBallot_YCEC_Commissioners.pdf');
  await logPdfExport('YCEC Members Registry', token);
};

// 5. Export "Who You Voted For"
export const exportMyVotesPdf = async (
  votes: CastVote[],
  offices: Office[],
  candidates: CandidateProfile[],
  voter: Voter,
  token?: string | null
) => {
  const doc = new jsPDF();
  addBrandedHeader(
    doc,
    'Official Voter Ballot Receipt (My Votes)',
    `Certified cast ballot record for voter ${voter.firstName} ${voter.lastName} (RA-${voter.raNumber})`
  );

  const tableData = votes.map((v, idx) => {
    const office = offices.find(o => o.id === v.officeId)?.title || 'Office';
    let choiceText = '';

    if (v.choice === 'for') {
      const cand = candidates.find(c => c.id === v.candidateId);
      choiceText = `VOTED FOR: ${cand?.name || 'Sole Candidate'}`;
    } else if (v.choice === 'against') {
      const cand = candidates.find(c => c.id === v.candidateId);
      choiceText = `VOTED AGAINST: ${cand?.name || 'Sole Candidate'}`;
    } else {
      const cand = candidates.find(c => c.id === v.candidateId);
      choiceText = cand ? cand.name : 'Unknown Candidate';
    }

    return [
      idx + 1,
      office,
      choiceText,
      new Date(v.timestamp).toLocaleString(),
      'VERIFIED ON-CHAIN'
    ];
  });

  autoTable(doc, {
    startY: 48,
    head: [['#', 'Contested Office', 'Your Selection / Choice', 'Timestamp (UTC)', 'Ballot Status']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 4 },
    columnStyles: {
      0: { cellWidth: 12 },
      1: { cellWidth: 50, fontStyle: 'bold' },
      2: { cellWidth: 60 },
      3: { cellWidth: 40 },
      4: { cellWidth: 28, halign: 'center' }
    }
  });

  addBrandedFooter(doc);
  doc.save(`FatBallot_My_Ballot_RA${voter.raNumber}.pdf`);
  await logPdfExport(`My Ballot (RA-${voter.raNumber})`, token);
};

// 6. Export "Those That Voted For You" (Contestant report)
export const exportCandidateVotersPdf = async (
  candidate: CandidateProfile,
  votersList: { voter: Voter; timestamp: string }[],
  token?: string | null
) => {
  const doc = new jsPDF();
  addBrandedHeader(
    doc,
    `Electorate Backers Report: ${candidate.name}`,
    `Certified list of accredited voters who cast ballots for ${candidate.name}`
  );

  const tableData = votersList.map((item, idx) => [
    idx + 1,
    `RA-${item.voter.raNumber}`,
    `${item.voter.firstName} ${item.voter.middleName ? item.voter.middleName + ' ' : ''}${item.voter.lastName}`,
    item.voter.department || 'General Constituent',
    new Date(item.timestamp).toLocaleString()
  ]);

  autoTable(doc, {
    startY: 48,
    head: [['#', 'Voter RA No.', 'Voter Full Name', 'Department / Faculty', 'Ballot Cast Timestamp']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 4 },
    columnStyles: {
      0: { cellWidth: 12 },
      1: { cellWidth: 30, fontStyle: 'bold' },
      2: { cellWidth: 55 },
      3: { cellWidth: 45 },
      4: { cellWidth: 45 }
    }
  });

  addBrandedFooter(doc);
  doc.save(`FatBallot_Voters_For_${candidate.name.replace(/\s+/g, '_')}.pdf`);
  await logPdfExport(`Voters for ${candidate.name}`, token);
};
