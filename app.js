/* ===== GEMINI AI ===== */
const GEMINI_URL = '/api/gemini';

// Cache so same prompt isn't re-fetched on repeat page visits
const _aiCache = {};

// Queue to avoid firing multiple requests simultaneously (rate limit = 5 rpm, 20 rpd)
let _aiQueue = [];
let _aiRunning = false;

function _processQueue() {
  if (_aiRunning || _aiQueue.length === 0) return;
  _aiRunning = true;
  const { prompt, resolve, reject } = _aiQueue.shift();
  console.log('[Gemini] Processing queued request. Remaining:', _aiQueue.length);
  fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 100, temperature: 0.7 }
    })
  })
  .then(r => r.json())
  .then(data => {
    if (data.error) {
      console.error('[Gemini] Queue error:', data.error.code, data.error.status, '|', data.error.message);
      throw new Error(data.error?.message || 'AI request failed. Please retry.');
    }
    const text = (data.candidates?.[0]?.content?.parts || []).filter(p => !p.thought).map(p => p.text || '').join('').trim();
    console.log('[Gemini] Queue success:', text.slice(0, 60));
    resolve(text);
  })
  .catch(err => { console.error('[Gemini] Queue fetch failed:', err.message); reject(err); })
  .finally(() => {
    setTimeout(() => { _aiRunning = false; _processQueue(); }, 13000);
  });
}

async function geminiAI(prompt) {
  if (_aiCache[prompt]) {
    console.log('[Gemini] Cache hit');
    return _aiCache[prompt];
  }
  return new Promise((resolve, reject) => {
    console.log('[Gemini] Queued. Queue length:', _aiQueue.length + 1);
    _aiQueue.push({ prompt, resolve: (t) => { _aiCache[prompt] = t; resolve(t); }, reject });
    _processQueue();
  });
}

// Fill an element with Gemini response; shows fallback immediately, replaces when ready
// Only calls API if not already cached — preserves the 20 RPD limit
function geminiInsight(elementId, prompt, fallback) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.innerHTML = fallback;
  if (_aiCache[prompt]) { el.innerHTML = _aiCache[prompt]; return; }
  geminiAI(prompt)
    .then(t => { if (t) { const e2 = document.getElementById(elementId); if (e2) e2.innerHTML = t; } })
    .catch(() => {});
}

// Direct Gemini call — bypasses queue, used for user-triggered actions like chat
async function geminiDirect(prompt) {
  if (_aiCache[prompt]) {
    console.log('[Gemini] Cache hit for direct call');
    return _aiCache[prompt];
  }
  console.log('[Gemini] Direct call to:', GEMINI_URL.split('?')[0]);
  try {
    const res = await fetch(GEMINI_URL, {
      signal: AbortSignal.timeout(30000),
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 768, temperature: 0.7 }
      })
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      console.error('[Gemini] API Error:', res.status, data.error?.message);
      throw new Error(data.error?.message || 'AI request failed. Please retry.');
    }
    const text = (data.candidates?.[0]?.content?.parts || []).filter(p => !p.thought).map(p => p.text || '').join('').trim();
    if (!text) throw new Error('Gemini returned no text. Please retry.');
    console.log('[Gemini] Success:', text.slice(0, 80));
    _aiCache[prompt] = text;
    return text;
  } catch(e) {
    console.error('[Gemini] Fetch failed:', e.message);
    if (e.name === 'TimeoutError') throw new Error('The AI request timed out. Please retry.');
    throw e;
  }
}

/* ===== SAMPLE DATA ===== */ /* v2 */
const DATA = {
  employees: [
    {id:1,name:"Dr. Grace Wanjiku",role:"Associate Professor",dept:"Computer Science",email:"s.chen@uni.edu",status:"Active",performance:92,engagement:88,risk:"Low",joined:"2019-03-15",avatar:"GW"},
    {id:2,name:"Prof. James Otieno",role:"Senior Lecturer",dept:"Engineering",email:"j.okafor@uni.edu",status:"Active",performance:85,engagement:72,risk:"Medium",joined:"2017-08-01",avatar:"JO"},
    {id:3,name:"Dr. Amina Hassan",role:"Lecturer",dept:"Business",email:"a.rahman@uni.edu",status:"Active",performance:78,engagement:65,risk:"High",joined:"2021-01-10",avatar:"AH"},
    {id:4,name:"Mr. David Mwangi",role:"Admin Officer",dept:"HR",email:"d.park@uni.edu",status:"Active",performance:90,engagement:91,risk:"Low",joined:"2018-06-20",avatar:"DM"},
    {id:5,name:"Dr. Faith Chebet",role:"Research Fellow",dept:"Sciences",email:"f.alzahra@uni.edu",status:"On Leave",performance:88,engagement:80,risk:"Low",joined:"2020-09-05",avatar:"FC"},
    {id:6,name:"Mr. Kevin Mutua",role:"IT Specialist",dept:"ICT",email:"k.mensah@uni.edu",status:"Active",performance:76,engagement:60,risk:"High",joined:"2022-02-14",avatar:"KM"},
  ],
  jobs: [
    {id:1,title:"Senior Lecturer – Data Science",dept:"Computer Science",type:"Full-time",posted:"2026-03-01",applicants:24,status:"Open"},
    {id:2,title:"HR Business Partner",dept:"Human Resources",type:"Full-time",posted:"2026-03-10",applicants:18,status:"Open"},
    {id:3,title:"Research Assistant",dept:"Sciences",type:"Part-time",posted:"2026-02-20",applicants:31,status:"Screening"},
    {id:4,title:"Finance Officer",dept:"Finance",type:"Full-time",posted:"2026-03-15",applicants:12,status:"Open"},
  ],
  applicants: [
    {name:"Mary Achieng",score:94,exp:"8 yrs",edu:"PhD",status:"Shortlisted"},
    {name:"Ahmed Abdullahi",score:89,exp:"6 yrs",edu:"MSc",status:"Shortlisted"},
    {name:"Purity Njeri",score:82,exp:"5 yrs",edu:"PhD",status:"Review"},
    {name:"Tom Kiptoo",score:75,exp:"4 yrs",edu:"MSc",status:"Review"},
    {name:"Lilian Wambui",score:68,exp:"3 yrs",edu:"BSc",status:"Pending"},
  ],
  surveys: [
    {month:"Oct",positive:62,neutral:25,negative:13},
    {month:"Nov",positive:58,neutral:28,negative:14},
    {month:"Dec",positive:65,neutral:22,negative:13},
    {month:"Jan",positive:70,neutral:20,negative:10},
    {month:"Feb",positive:68,neutral:24,negative:8},
    {month:"Mar",positive:74,neutral:18,negative:8},
  ],
  performance: [
    {month:"Oct",avg:76},{month:"Nov",avg:78},{month:"Dec",avg:75},
    {month:"Jan",avg:80},{month:"Feb",avg:83},{month:"Mar",avg:85},
  ],
  turnoverRisk: [
    {dept:"Computer Science",risk:12},{dept:"Engineering",risk:18},
    {dept:"Business",risk:28},{dept:"Sciences",risk:9},
    {dept:"HR",risk:7},{dept:"ICT",risk:35},
  ],
  leaveRequests: [
    {id:1,emp:"Dr. Grace Wanjiku",type:"Annual Leave",from:"2026-04-01",to:"2026-04-05",days:5,status:"Approved"},
    {id:2,emp:"Mr. Kevin Mutua",type:"Sick Leave",from:"2026-03-20",to:"2026-03-22",days:3,status:"Pending"},
    {id:3,emp:"Dr. Amina Hassan",type:"Study Leave",from:"2026-05-10",to:"2026-05-20",days:10,status:"Pending"},
  ],
  onboarding: [
    {
      id:1, empId:5, name:"Dr. Faith Chebet", role:"Research Fellow", dept:"Sciences",
      startDate:"2026-03-10", buddy:"Dr. Grace Wanjiku", status:"In Progress",
      steps:[
        {id:1,title:"Offer Letter & Contract Signed",     category:"Documentation", done:true,  doneDate:"2026-03-08"},
        {id:2,title:"ID & Credentials Verified",          category:"Documentation", done:true,  doneDate:"2026-03-09"},
        {id:3,title:"IT Account & Email Setup",           category:"IT Setup",      done:true,  doneDate:"2026-03-10"},
        {id:4,title:"VPN & System Access Granted",        category:"IT Setup",      done:true,  doneDate:"2026-03-10"},
        {id:5,title:"HR Orientation Session",             category:"Orientation",   done:true,  doneDate:"2026-03-11"},
        {id:6,title:"University Policies Briefing",       category:"Orientation",   done:true,  doneDate:"2026-03-11"},
        {id:7,title:"Department Induction Meeting",       category:"Induction",     done:true,  doneDate:"2026-03-13"},
        {id:8,title:"Meet Buddy / Mentor Assigned",       category:"Induction",     done:false, doneDate:null},
        {id:9,title:"Mandatory Training Enrolled",        category:"Training",      done:false, doneDate:null},
        {id:10,title:"Health & Safety Training",          category:"Training",      done:false, doneDate:null},
        {id:11,title:"30-Day Check-in with Manager",      category:"Review",        done:false, doneDate:null},
        {id:12,title:"90-Day Performance Review",         category:"Review",        done:false, doneDate:null},
      ]
    },
    {
      id:2, empId:6, name:"Mr. Kevin Mutua", role:"IT Specialist", dept:"ICT",
      startDate:"2026-02-14", buddy:"Mr. David Mwangi", status:"In Progress",
      steps:[
        {id:1,title:"Offer Letter & Contract Signed",     category:"Documentation", done:true,  doneDate:"2026-02-12"},
        {id:2,title:"ID & Credentials Verified",          category:"Documentation", done:true,  doneDate:"2026-02-13"},
        {id:3,title:"IT Account & Email Setup",           category:"IT Setup",      done:true,  doneDate:"2026-02-14"},
        {id:4,title:"VPN & System Access Granted",        category:"IT Setup",      done:true,  doneDate:"2026-02-14"},
        {id:5,title:"HR Orientation Session",             category:"Orientation",   done:true,  doneDate:"2026-02-15"},
        {id:6,title:"University Policies Briefing",       category:"Orientation",   done:true,  doneDate:"2026-02-15"},
        {id:7,title:"Department Induction Meeting",       category:"Induction",     done:true,  doneDate:"2026-02-17"},
        {id:8,title:"Meet Buddy / Mentor Assigned",       category:"Induction",     done:true,  doneDate:"2026-02-17"},
        {id:9,title:"Mandatory Training Enrolled",        category:"Training",      done:true,  doneDate:"2026-02-20"},
        {id:10,title:"Health & Safety Training",          category:"Training",      done:true,  doneDate:"2026-02-21"},
        {id:11,title:"30-Day Check-in with Manager",      category:"Review",        done:true,  doneDate:"2026-03-14"},
        {id:12,title:"90-Day Performance Review",         category:"Review",        done:false, doneDate:null},
      ]
    },
    {
      id:3, empId:3, name:"Dr. Amina Hassan", role:"Lecturer", dept:"Business",
      startDate:"2026-01-10", buddy:"Prof. James Otieno", status:"Completed",
      steps:[
        {id:1,title:"Offer Letter & Contract Signed",     category:"Documentation", done:true,  doneDate:"2026-01-08"},
        {id:2,title:"ID & Credentials Verified",          category:"Documentation", done:true,  doneDate:"2026-01-09"},
        {id:3,title:"IT Account & Email Setup",           category:"IT Setup",      done:true,  doneDate:"2026-01-10"},
        {id:4,title:"VPN & System Access Granted",        category:"IT Setup",      done:true,  doneDate:"2026-01-10"},
        {id:5,title:"HR Orientation Session",             category:"Orientation",   done:true,  doneDate:"2026-01-11"},
        {id:6,title:"University Policies Briefing",       category:"Orientation",   done:true,  doneDate:"2026-01-11"},
        {id:7,title:"Department Induction Meeting",       category:"Induction",     done:true,  doneDate:"2026-01-13"},
        {id:8,title:"Meet Buddy / Mentor Assigned",       category:"Induction",     done:true,  doneDate:"2026-01-13"},
        {id:9,title:"Mandatory Training Enrolled",        category:"Training",      done:true,  doneDate:"2026-01-15"},
        {id:10,title:"Health & Safety Training",          category:"Training",      done:true,  doneDate:"2026-01-16"},
        {id:11,title:"30-Day Check-in with Manager",      category:"Review",        done:true,  doneDate:"2026-02-10"},
        {id:12,title:"90-Day Performance Review",         category:"Review",        done:true,  doneDate:"2026-04-10"},
      ]
    },
  ]
};

let currentUser = null;
let currentPage = 'dashboard';
let charts = {};
let sidebarCollapsed = false;

/* ===== CREDENTIALS STORE ===== */
// User accounts and password hashes are managed by the backend.

/* ===== AUTH ===== */
async function doLogin() {
  const email    = document.getElementById('loginEmail').value.trim().toLowerCase();
  const password = document.getElementById('loginPassword').value;
  const role     = document.getElementById('loginRole').value;

  clearLoginError();

  if (!email || !password) {
    showLoginError('Please enter your email and password.');
    return;
  }

  let match;
  try { const response = await workAPI('login', {email,password,role}); applyWork(response); match = response.user; }
  catch (error) { showLoginError(error.message); shakeLoginCard(); return; }

  if (!match) {
    showLoginError('Invalid credentials. Check your email, password, and role.');
    shakeLoginCard();
    return;
  }

  currentUser = { email: match.email, role: match.role, name: match.name, avatar: match.avatar };
  document.getElementById('loginScreen').style.animation = 'fadeIn .3s ease reverse';
  setTimeout(() => {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    document.getElementById('app').style.animation = 'fadeIn .5s ease';
    const initials = currentUser.name.split(' ').map(w=>w[0]).join('').toUpperCase();
    document.getElementById('sidebarAvatar').textContent = initials;
    document.getElementById('topbarAvatar').textContent = initials;
    document.getElementById('sidebarName').textContent = currentUser.name;
    document.getElementById('sidebarRole').textContent = currentUser.role.charAt(0).toUpperCase()+currentUser.role.slice(1);
    buildSidebar();
    navigate('dashboard');
  }, 300);
}

function showLoginError(msg) {
  let el = document.getElementById('loginError');
  if (!el) {
    el = document.createElement('div');
    el.id = 'loginError';
    el.style.cssText = 'background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.4);color:#fca5a5;padding:10px 14px;border-radius:8px;font-size:13px;font-weight:500;margin-bottom:16px;text-align:center;animation:fadeIn .3s ease;';
    const form = document.querySelector('.login-form');
    form.insertBefore(el, form.firstChild);
  }
  el.textContent = '⚠️  ' + msg;
}

function clearLoginError() {
  const el = document.getElementById('loginError');
  if (el) el.remove();
}

function shakeLoginCard() {
  const card = document.querySelector('.login-card');
  card.style.animation = 'shake .4s ease';
  setTimeout(() => { card.style.animation = ''; }, 400);
}

function doLogout() {
  document.getElementById('app').classList.add('hidden');
  document.getElementById('loginScreen').classList.remove('hidden');
  document.getElementById('loginScreen').style.animation = 'fadeIn .5s ease';
  // Reset login form
  document.getElementById('loginEmail').value = '';
  document.getElementById('loginPassword').value = '';
  clearLoginError();
  Object.values(charts).forEach(c => { try { c.destroy(); } catch(e){} });
  charts = {};
}

/* ===== ROLE-BASED NAV ===== */
const NAV_CONFIG = {
  admin: [
    { section: 'Main' },
    { page: 'dashboard',   icon: '📊', label: 'Dashboard' },
    { page: 'employees',   icon: '👥', label: 'Employees' },
    { page: 'recruitment', icon: '📋', label: 'Recruitment' },
    { page: 'onboarding',  icon: '🚀', label: 'Onboarding' },
    { section: 'Performance' },
    { page: 'performance', icon: '📈', label: 'Performance' },
    { page: 'engagement',  icon: '💬', label: 'Engagement' },
    { section: 'AI & Analytics' },
    { page: 'analytics',   icon: '🧠', label: 'AI Analytics', badge: 'AI' },
    { page: 'selfservice', icon: '🧾', label: 'Self-Service' },
  ],
  hr: [
    { section: 'Main' },
    { page: 'dashboard',   icon: '📊', label: 'Dashboard' },
    { page: 'employees',   icon: '👥', label: 'Employees' },
    { page: 'recruitment', icon: '📋', label: 'Recruitment' },
    { page: 'onboarding',  icon: '🚀', label: 'Onboarding' },
    { section: 'Performance' },
    { page: 'performance', icon: '📈', label: 'Performance' },
    { page: 'engagement',  icon: '💬', label: 'Engagement' },
    { section: 'AI & Analytics' },
    { page: 'analytics',   icon: '🧠', label: 'AI Analytics', badge: 'AI' },
    { page: 'selfservice', icon: '🧾', label: 'Self-Service' },
  ],
  employee: [
    { section: 'My Workspace' },
    { page: 'dashboard',   icon: '🏠', label: 'My Dashboard' },
    { page: 'selfservice', icon: '🧾', label: 'Self-Service' },
    { section: 'My Work' },
    { page: 'performance', icon: '📈', label: 'My Performance' },
    { page: 'engagement',  icon: '💬', label: 'Surveys & Feedback' },
  ],
};

// Pages employees are blocked from accessing directly via URL
const EMPLOYEE_BLOCKED = ['employees', 'recruitment', 'onboarding', 'analytics'];

function buildSidebar() {
  const items = NAV_CONFIG[currentUser.role] || NAV_CONFIG.employee;
  const html = items.map(item => {
    if (item.section) return `<div class="nav-section-label">${item.section}</div>`;
    return `<a class="nav-item" onclick="navigate('${item.page}')" data-page="${item.page}">
      <span class="nav-icon">${item.icon}</span>
      <span class="nav-label">${item.label}</span>
      ${item.badge ? `<span class="nav-badge">${item.badge}</span>` : ''}
    </a>`;
  }).join('');
  document.getElementById('sidebarNav').innerHTML = html;
}


function navigate(page) {
  // Route guard — employees cannot access HR-only pages
  if (currentUser && currentUser.role === 'employee' && EMPLOYEE_BLOCKED.includes(page)) {
    showToast('Access restricted. Contact HR for assistance.', 'error');
    return;
  }
  currentPage = page;
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });
  const titles = {
    dashboard:'Dashboard', employees:'Employee Management', recruitment:'Recruitment',
    onboarding:'Onboarding', performance:'Performance Management',
    engagement:'Employee Engagement', analytics:'AI Analytics Engine', selfservice:'Self-Service Portal'
  };
  document.getElementById('pageTitle').textContent = titles[page] || page;
  document.getElementById('breadcrumb').textContent = `Home / ${titles[page] || page}`;
  const container = document.getElementById('pagesContainer');
  container.innerHTML = '';
  const pageEl = document.createElement('div');
  pageEl.className = 'animate-in';
  pageEl.innerHTML = renderPage(page);
  container.appendChild(pageEl);
  setTimeout(() => initPageCharts(page), 100);
}

function toggleSidebar() {
  sidebarCollapsed = !sidebarCollapsed;
  document.getElementById('sidebar').classList.toggle('collapsed', sidebarCollapsed);
  document.querySelector('.main-content').classList.toggle('expanded', sidebarCollapsed);
}

function toggleTheme() {
  const html = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  html.setAttribute('data-theme', isDark ? 'light' : 'dark');
  document.querySelector('.icon-btn[onclick="toggleTheme()"]').textContent = isDark ? '🌙' : '☀️';
}

function toggleNotifications() {
  document.getElementById('notifPanel').classList.toggle('hidden');
}

/* ===== PAGE RENDERERS ===== */
function renderPage(page) {
  switch(page) {
    case 'dashboard': return renderDashboard();
    case 'employees': return renderEmployees();
    case 'recruitment': return renderRecruitment();
    case 'onboarding': return renderOnboarding();
    case 'performance': return renderPerformance();
    case 'engagement': return renderEngagement();
    case 'analytics': return renderAnalytics();
    case 'selfservice': return renderSelfService();
    default: return '<p>Page not found</p>';
  }
}

/* ===== COMPUTED STATS (always derived from DATA) ===== */
function computeStats() {
  const emps = DATA.employees;
  const totalEmps = emps.length;
  const openJobs = DATA.jobs.filter(j => j.status === 'Open' || j.status === 'Screening').length;
  const totalApplicants = DATA.jobs.reduce((s, j) => s + j.applicants, 0);
  const avgPerf = totalEmps ? Math.round(emps.reduce((s, e) => s + e.performance, 0) / totalEmps) : 0;
  const highRiskCount = emps.filter(e => e.risk === 'High').length;
  const highRiskDept = DATA.turnoverRisk.reduce((a, b) => b.risk > a.risk ? b : a, {dept:'—', risk:0});
  const latestSurvey = DATA.surveys.length ? DATA.surveys[DATA.surveys.length - 1] : {positive:0,neutral:0,negative:0};
  const prevSurvey = DATA.surveys.length > 1 ? DATA.surveys[DATA.surveys.length - 2] : latestSurvey;
  const sentimentDelta = latestSurvey.positive - prevSurvey.positive;
  const avgEngagement = totalEmps ? Math.round(emps.reduce((s, e) => s + e.engagement, 0) / totalEmps) : 0;
  const promotionCandidates = emps.filter(e => e.performance >= 88).length;
  const topCandidate = emps.reduce((a, b) => b.performance > a.performance ? b : a, emps[0]);
  const pendingLeave = DATA.leaveRequests.filter(l => l.status === 'Pending').length;
  return { totalEmps, openJobs, totalApplicants, avgPerf, highRiskCount, highRiskDept, latestSurvey, sentimentDelta, avgEngagement, promotionCandidates, topCandidate, pendingLeave };
}

/* ===== EMPLOYEE PERSONAL DASHBOARD ===== */
function renderEmployeeDashboard() {
  const me = DATA.employees.find(e => e.email === currentUser.email) || null;
  const myLeave = DATA.leaveRequests.filter(l => l.emp === currentUser.name);
  const pendingLeave = myLeave.filter(l => l.status === 'Pending').length;
  const approvedLeave = myLeave.filter(l => l.status === 'Approved').length;
  const latestSurvey = DATA.surveys.length ? DATA.surveys[DATA.surveys.length - 1] : null;

  const perfVal   = me ? me.performance : '—';
  const engVal    = me ? me.engagement  : '—';
  const perfColor = me ? (me.performance >= 85 ? 'green' : me.performance >= 70 ? 'yellow' : 'red') : 'blue';
  const engColor  = me ? (me.engagement  >= 75 ? 'green' : me.engagement  >= 60 ? 'yellow' : 'red') : 'blue';

  const leaveRowsHtml = myLeave.length
    ? myLeave.slice(-5).reverse().map(l => `
        <tr>
          <td>${l.type}</td>
          <td>${l.from}</td><td>${l.to}</td><td>${l.days} days</td>
          <td><span class="tag ${l.status==='Approved'?'tag-green':l.status==='Rejected'||l.status==='Cancelled'?'tag-red':'tag-yellow'}">${l.status}</span></td>
        </tr>`).join('')
    : `<tr><td colspan="5" style="text-align:center;color:var(--text3);padding:20px">No leave requests yet.</td></tr>`;

  return `
  <div style="margin-bottom:8px">
    <h3 style="font-size:20px;font-weight:700">Welcome back, ${me ? me.name : currentUser.name} 👋</h3>
    <p style="color:var(--text2);font-size:14px">${me ? me.role + ' · ' + me.dept : ''} · ${new Date().toLocaleDateString('en-GB',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</p>
  </div>

  <div class="stats-grid" style="margin-top:20px">
    <div class="stat-card ${perfColor} animate-in" style="animation-delay:.05s">
      <div class="stat-icon ${perfColor}">📈</div>
      <div class="stat-value">${perfVal}${me?'%':''}</div>
      <div class="stat-label">My Performance Score</div>
      <div class="stat-change ${me&&me.performance>=80?'up':'down'}">${me ? (me.performance>=80?'↑ Above target':'↓ Needs improvement') : 'Not available'}</div>
      <div class="stat-bg-icon">📈</div>
    </div>
    <div class="stat-card ${engColor} animate-in" style="animation-delay:.1s">
      <div class="stat-icon ${engColor}">💬</div>
      <div class="stat-value">${engVal}${me?'%':''}</div>
      <div class="stat-label">My Engagement Score</div>
      <div class="stat-change ${me&&me.engagement>=75?'up':'down'}">${me ? (me.engagement>=75?'↑ Healthy':'↓ Let us know how you feel') : 'Not available'}</div>
      <div class="stat-bg-icon">💬</div>
    </div>
    <div class="stat-card yellow animate-in" style="animation-delay:.15s">
      <div class="stat-icon yellow">⏳</div>
      <div class="stat-value">${pendingLeave}</div>
      <div class="stat-label">Pending Leave Requests</div>
      <div class="stat-change ${pendingLeave===0?'up':'down'}">${pendingLeave===0?'No pending requests':pendingLeave+' awaiting approval'}</div>
      <div class="stat-bg-icon">⏳</div>
    </div>
    <div class="stat-card green animate-in" style="animation-delay:.2s">
      <div class="stat-icon green">✅</div>
      <div class="stat-value">${approvedLeave}</div>
      <div class="stat-label">Approved Leave Days</div>
      <div class="stat-change up">${myLeave.length} total request${myLeave.length!==1?'s':''}</div>
      <div class="stat-bg-icon">✅</div>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px">
    <div class="card animate-in" style="animation-delay:.25s">
      <div class="card-header"><div class="card-title">My Profile</div><button class="btn-secondary btn-sm" onclick="showToast('Profile editor opened!')">Edit</button></div>
      ${me ? `
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px">
        <div class="emp-avatar" style="width:64px;height:64px;font-size:24px">${me.avatar}</div>
        <div>
          <div style="font-size:16px;font-weight:700">${me.name}</div>
          <div style="font-size:13px;color:var(--text2)">${me.role}</div>
          <div style="font-size:13px;color:var(--text2)">${me.dept} · Joined ${me.joined}</div>
        </div>
      </div>
      <div style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="font-size:13px;color:var(--text2)">Performance</span><strong>${me.performance}%</strong></div>
        <div class="progress-bar"><div class="progress-fill ${perfColor}" style="width:${me.performance}%"></div></div>
      </div>
      <div>
        <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="font-size:13px;color:var(--text2)">Engagement</span><strong>${me.engagement}%</strong></div>
        <div class="progress-bar"><div class="progress-fill ${engColor}" style="width:${me.engagement}%"></div></div>
      </div>` : `<p style="color:var(--text3);text-align:center;padding:20px">Profile not linked. Contact HR.</p>`}
    </div>

    <div class="card animate-in" style="animation-delay:.3s">
      <div class="card-header"><div class="card-title">Quick Actions</div></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        ${[
          {icon:'🏖️', label:'Apply for Leave',   action:"navigate('selfservice')"},
          {icon:'📊', label:'My Performance',    action:"navigate('performance')"},
          {icon:'💬', label:'Take Survey',        action:"navigate('engagement')"},
          {icon:'📄', label:'View Payslip',       action:"showToast('Payslip downloaded!')"},
          {icon:'🎓', label:'Training Catalog',   action:"showTraining()"},
          {icon:'📞', label:'Contact HR',         action:"showToast('HR: hr@university.edu')"},
        ].map(a=>`
          <div style="display:flex;align-items:center;gap:10px;padding:12px;background:var(--surface2);border-radius:var(--radius-sm);cursor:pointer;transition:all .2s" onclick="${a.action}" onmouseover="this.style.background='rgba(26,86,219,0.08)'" onmouseout="this.style.background='var(--surface2)'">
            <span style="font-size:20px">${a.icon}</span>
            <span style="font-size:13px;font-weight:500">${a.label}</span>
          </div>`).join('')}
      </div>
    </div>
  </div>

  <div class="card animate-in" style="animation-delay:.35s">
    <div class="card-header">
      <div><div class="card-title">My Leave History</div><div class="card-subtitle">${myLeave.length} total request${myLeave.length!==1?'s':''}</div></div>
      <button class="btn-primary btn-sm" onclick="navigate('selfservice')">+ New Request</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Type</th><th>From</th><th>To</th><th>Duration</th><th>Status</th></tr></thead>
        <tbody>${leaveRowsHtml}</tbody>
      </table>
    </div>
  </div>

  ${latestSurvey ? `
  <div class="ai-insight animate-in" style="animation-delay:.4s;margin-top:0">
    <div class="ai-insight-label">💬 Latest Pulse Survey — ${latestSurvey.month}</div>
    <div class="ai-insight-text">Organisation sentiment: <strong>${latestSurvey.positive}% positive</strong>, ${latestSurvey.neutral}% neutral, ${latestSurvey.negative}% negative. <span style="cursor:pointer;color:var(--primary);text-decoration:underline" onclick="navigate('engagement')">Take the current survey →</span></div>
  </div>` : ''}`;
}

/* ===== DASHBOARD PAGE ===== */
function renderDashboard() {
  if (currentUser.role === 'employee') return renderEmployeeDashboard();
  const s = computeStats();
  const sentimentSign = s.sentimentDelta >= 0 ? '↑' : '↓';
  const sentimentClass = s.sentimentDelta >= 0 ? 'up' : 'down';

  // Build recent activity from actual leave requests + employees
  const recentRows = [
    ...DATA.leaveRequests.map(l => ({
      name: l.emp,
      action: `${l.type} Request`,
      dept: (DATA.employees.find(e => e.name === l.emp) || {dept:'—'}).dept,
      date: l.from,
      status: l.status,
      tagClass: l.status === 'Approved' ? 'tag-green' : l.status === 'Rejected' || l.status === 'Cancelled' ? 'tag-red' : 'tag-yellow'
    }))
  ];
  const recentRowsHtml = recentRows.length
    ? recentRows.map(r => `<tr><td>${r.name}</td><td>${r.action}</td><td>${r.dept}</td><td>${r.date}</td><td><span class="tag ${r.tagClass}">${r.status}</span></td></tr>`).join('')
    : `<tr><td colspan="5" style="text-align:center;color:var(--text3);padding:24px">No recent activity</td></tr>`;

  return `
  <div class="stats-grid">
    <div class="stat-card blue animate-in" style="animation-delay:.05s">
      <div class="stat-icon blue">👥</div>
      <div class="stat-value">${s.totalEmps}</div>
      <div class="stat-label">Total Employees</div>
      <div class="stat-change up">${s.totalEmps} in system</div>
      <div class="stat-bg-icon">👥</div>
    </div>
    <div class="stat-card yellow animate-in" style="animation-delay:.1s">
      <div class="stat-icon yellow">📋</div>
      <div class="stat-value">${s.openJobs}</div>
      <div class="stat-label">Open Positions</div>
      <div class="stat-change up">${s.totalApplicants} total applicants</div>
      <div class="stat-bg-icon">📋</div>
    </div>
    <div class="stat-card green animate-in" style="animation-delay:.15s">
      <div class="stat-icon green">📈</div>
      <div class="stat-value">${s.avgPerf}%</div>
      <div class="stat-label">Avg Performance Score</div>
      <div class="stat-change up">Across ${s.totalEmps} employees</div>
      <div class="stat-bg-icon">📈</div>
    </div>
    <div class="stat-card red animate-in" style="animation-delay:.2s">
      <div class="stat-icon red">⚠️</div>
      <div class="stat-value">${s.highRiskCount}</div>
      <div class="stat-label">High Turnover Risk</div>
      <div class="stat-change down">${s.highRiskCount > 0 ? s.highRiskCount + ' flagged by AI' : 'None flagged'}</div>
      <div class="stat-bg-icon">⚠️</div>
    </div>
  </div>

  <div class="ai-insights-grid">
    <div class="ai-insight animate-in" style="animation-delay:.25s">
      <div class="ai-insight-label">🧠 AI Prediction</div>
      <div class="ai-insight-text" id="dash-ai-prediction">⏳ Loading...</div>
    </div>
    <div class="ai-insight animate-in" style="animation-delay:.3s">
      <div class="ai-insight-label">💬 Sentiment Alert</div>
      <div class="ai-insight-text" id="dash-ai-sentiment">⏳ Loading...</div>
    </div>
    <div class="ai-insight animate-in" style="animation-delay:.35s">
      <div class="ai-insight-label">🎯 Recommendation</div>
      <div class="ai-insight-text" id="dash-ai-recommendation">⏳ Loading...</div>
    </div>
  </div>

  <div class="charts-grid">
    <div class="card animate-in" style="animation-delay:.4s">
      <div class="card-header">
        <div><div class="card-title">Engagement Score Trend</div><div class="card-subtitle">${DATA.surveys.length}-month overview</div></div>
        <span class="tag tag-green">Live</span>
      </div>
      <div class="chart-container"><canvas id="engagementChart"></canvas></div>
    </div>
    <div class="card animate-in" style="animation-delay:.45s">
      <div class="card-header">
        <div><div class="card-title">Sentiment Distribution</div><div class="card-subtitle">Latest month: ${DATA.surveys.length ? DATA.surveys[DATA.surveys.length-1].month : '—'}</div></div>
      </div>
      <div class="chart-container"><canvas id="sentimentPieChart"></canvas></div>
    </div>
    <div class="card animate-in" style="animation-delay:.5s">
      <div class="card-header">
        <div><div class="card-title">Turnover Risk by Department</div><div class="card-subtitle">AI-predicted %</div></div>
        <span class="tag tag-red">AI</span>
      </div>
      <div class="chart-container"><canvas id="turnoverChart"></canvas></div>
    </div>
    <div class="card animate-in" style="animation-delay:.55s">
      <div class="card-header">
        <div><div class="card-title">HR Effectiveness Model</div><div class="card-subtitle">PEOU → PU → Actual Use</div></div>
      </div>
      <div class="chart-container"><canvas id="effectivenessChart"></canvas></div>
    </div>
  </div>

  <div class="card animate-in" style="animation-delay:.6s">
    <div class="card-header">
      <div class="card-title">Recent Activity</div>
      <button class="btn-secondary btn-sm" onclick="navigate('employees')">View All</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Employee</th><th>Action</th><th>Department</th><th>Date</th><th>Status</th></tr></thead>
        <tbody>${recentRowsHtml}</tbody>
      </table>
    </div>
  </div>`;
}

/* ===== EMPLOYEES PAGE ===== */
function renderEmployees() {
  const cards = DATA.employees.map(e => `
    <div class="employee-card animate-in" data-department="${leaveEscape(e.dept)}">
      <div class="emp-avatar">${e.avatar}</div>
      <div class="emp-name">${e.name}</div>
      <div class="emp-role">${leaveEscape(e.role)} · ${leaveEscape(e.dept)}</div>
      <div style="margin-bottom:12px"><span class="tag ${e.status==='Active'?'tag-green':'tag-yellow'}">${e.status}</span></div>
      <div class="emp-stats">
        <div class="emp-stat"><div class="emp-stat-val">${e.performance}%</div><div class="emp-stat-lbl">Performance</div></div>
        <div class="emp-stat"><div class="emp-stat-val">${e.engagement}%</div><div class="emp-stat-lbl">Engagement</div></div>
        <div class="emp-stat"><div class="emp-stat-val"><span class="tag ${e.risk==='Low'?'tag-green':e.risk==='Medium'?'tag-yellow':'tag-red'}">${e.risk}</span></div><div class="emp-stat-lbl">Risk</div></div>
      </div>
      <div class="emp-actions">
        <button class="btn-secondary btn-sm" onclick="viewEmployee(${e.id})">View Profile</button>
        <button class="btn-primary btn-sm" onclick="showAIInsight('${e.name}')">AI Insight</button>
      </div>
    </div>`).join('');

  return `
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;flex-wrap:wrap;gap:12px;">
    <div>
      <h3 style="font-size:18px;font-weight:700;">All Employees</h3>
      <p style="color:var(--text2);font-size:13px;">${DATA.employees.length} employee${DATA.employees.length !== 1 ? 's' : ''} in system</p>
    </div>
    <div style="display:flex;gap:12px;flex-wrap:wrap;">
      <select style="padding:8px 14px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-size:13px;" onchange="filterEmployees(this.value)">
        <option value="">All Departments</option>
        ${[...new Set(DATA.employees.map(e=>e.dept))].map(d=>`<option>${leaveEscape(d)}</option>`).join('')}
      </select>
      <button class="btn-primary" onclick="showAddEmployee()">+ Add Employee</button>
    </div>
  </div>
  <div class="employees-grid">${cards}</div>`;
}

function viewEmployee(id) {
  const e = DATA.employees.find(x=>x.id===id);
  if(!e) return;
  showModal(`
    <div class="modal-header"><h3 class="modal-title">Employee Profile</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div style="text-align:center;margin-bottom:24px;">
      <div class="emp-avatar" style="width:80px;height:80px;font-size:32px;margin:0 auto 12px;">${e.avatar}</div>
      <h3>${e.name}</h3><p style="color:var(--text2)">${leaveEscape(e.role)} · ${leaveEscape(e.dept)}</p>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;">
      <div><label style="font-size:12px;color:var(--text3)">Email</label><p style="font-size:14px">${leaveEscape(e.email)}</p></div>
      <div><label style="font-size:12px;color:var(--text3)">Joined</label><p style="font-size:14px">${e.joined}</p></div>
      <div><label style="font-size:12px;color:var(--text3)">Status</label><p><span class="tag ${e.status==='Active'?'tag-green':'tag-yellow'}">${e.status}</span></p></div>
      <div><label style="font-size:12px;color:var(--text3)">Turnover Risk</label><p><span class="tag ${e.risk==='Low'?'tag-green':e.risk==='Medium'?'tag-yellow':'tag-red'}">${e.risk}</span></p></div>
    </div>
    <div style="margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="font-size:13px">Performance</span><strong>${e.performance}%</strong></div>
      <div class="progress-bar"><div class="progress-fill" style="width:${e.performance}%"></div></div>
    </div>
    <div style="margin-bottom:24px">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="font-size:13px">Engagement</span><strong>${e.engagement}%</strong></div>
      <div class="progress-bar"><div class="progress-fill yellow" style="width:${e.engagement}%"></div></div>
    </div>
    <div class="modal-actions"><button class="btn-secondary" onclick="closeModal()">Close</button><button class="btn-primary">Edit Profile</button></div>
  `);
}

function showAIInsight(name) {
  const emp = DATA.employees.find(e => e.name === name);
  const perfVal  = emp ? emp.performance  : '—';
  const engVal   = emp ? emp.engagement   : '—';
  const riskVal  = emp ? emp.risk         : '—';
  const roleVal  = emp ? emp.role         : '—';
  const deptVal  = emp ? emp.dept         : '—';

  showModal(`
    <div class="modal-header"><h3 class="modal-title">🧠 AI Insight — ${name}</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="ai-insight" style="margin-bottom:20px">
      <div class="ai-insight-label">AI Analysis</div>
      <div class="ai-insight-text" id="aiInsightText"><span style="color:var(--text3)">⏳ Generating insight from Gemini AI...</span></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:20px">
      <div style="text-align:center;padding:16px;background:var(--surface2);border-radius:var(--radius-sm)">
        <div style="font-size:24px;font-weight:800;color:var(--primary)">${perfVal}${emp?'%':''}</div>
        <div style="font-size:12px;color:var(--text2)">KPI Score</div>
      </div>
      <div style="text-align:center;padding:16px;background:var(--surface2);border-radius:var(--radius-sm)">
        <div style="font-size:24px;font-weight:800;color:var(--success)">${engVal}${emp?'%':''}</div>
        <div style="font-size:12px;color:var(--text2)">Engagement</div>
      </div>
      <div style="text-align:center;padding:16px;background:var(--surface2);border-radius:var(--radius-sm)">
        <div style="font-size:24px;font-weight:800;color:var(--accent)">${riskVal}</div>
        <div style="font-size:12px;color:var(--text2)">Turnover Risk</div>
      </div>
    </div>
    <div class="modal-actions"><button class="btn-secondary" onclick="closeModal()">Close</button><button class="btn-primary" onclick="closeModal();showToast('Report generated!')">Generate Report</button></div>
  `);

  const prompt = `You are an HR analytics AI for a university. Provide a concise 2-3 sentence professional insight for this employee:
Name: ${name}, Role: ${roleVal}, Department: ${deptVal}, KPI Score: ${perfVal}%, Engagement: ${engVal}%, Turnover Risk: ${riskVal}.
Focus on actionable HR recommendations. Be specific and professional.`;

  geminiDirect(prompt).then(text => {
    const el = document.getElementById('aiInsightText');
    if (el) el.innerHTML = text || 'No insight available.';
  }).catch(() => {
    const el = document.getElementById('aiInsightText');
    if (el) el.innerHTML = emp
      ? `${emp.name} has a KPI score of <strong>${emp.performance}%</strong> and engagement of <strong>${emp.engagement}%</strong> with <strong>${emp.risk}</strong> turnover risk. ${emp.risk === 'High' ? 'Immediate 1-on-1 check-in and retention plan recommended.' : emp.risk === 'Medium' ? 'A development plan and regular check-ins are advised.' : 'Performance is strong — consider for mentorship or promotion opportunities.'}`
      : 'Insight unavailable. Please check employee records.';
  });
}

function showEmployeeReviewDetails(empId) {
  const e = DATA.employees.find(emp => emp.id === empId);
  if (!e) return;
  const status = e.performance > 80 ? 'Completed' : 'In Review';
  const statusColor = e.performance > 80 ? 'var(--success)' : 'var(--accent)';
  const perfColor = e.performance >= 85 ? 'green' : e.performance >= 70 ? 'yellow' : 'red';
  const riskColor = e.risk === 'Low' ? 'var(--success)' : e.risk === 'Medium' ? 'var(--accent)' : 'var(--danger)';
  const goals = [
    { goal: 'Complete annual KPI targets', progress: e.performance, done: e.performance >= 80 },
    { goal: 'Attend mandatory training sessions', progress: Math.min(100, e.engagement + 10), done: e.engagement >= 75 },
    { goal: 'Submit quarterly self-assessment', progress: e.performance > 80 ? 100 : 50, done: e.performance > 80 },
    { goal: 'Peer review participation', progress: Math.round(e.engagement * 0.9), done: e.engagement >= 80 },
  ];
  showModal(`
    <div class="modal-header">
      <h3 class="modal-title">📋 Performance Review — ${e.name}</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;padding:16px;background:var(--surface2);border-radius:var(--radius-sm)">
      <div class="emp-avatar" style="width:52px;height:52px;font-size:18px;flex-shrink:0">${e.avatar}</div>
      <div style="flex:1">
        <div style="font-weight:700;font-size:15px">${e.name}</div>
        <div style="font-size:13px;color:var(--text2)">${leaveEscape(e.role)} · ${leaveEscape(e.dept)}</div>
        <div style="font-size:12px;color:var(--text3)">Joined ${e.joined} · ${leaveEscape(e.email)}</div>
      </div>
      <span style="padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;background:${statusColor}22;color:${statusColor}">${status}</span>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:20px">
      <div style="text-align:center;padding:14px;background:var(--surface2);border-radius:var(--radius-sm)">
        <div style="font-size:26px;font-weight:800;color:var(--primary)">${e.performance}%</div>
        <div style="font-size:12px;color:var(--text2)">KPI Score</div>
      </div>
      <div style="text-align:center;padding:14px;background:var(--surface2);border-radius:var(--radius-sm)">
        <div style="font-size:26px;font-weight:800;color:var(--success)">${e.engagement}%</div>
        <div style="font-size:12px;color:var(--text2)">Engagement</div>
      </div>
      <div style="text-align:center;padding:14px;background:var(--surface2);border-radius:var(--radius-sm)">
        <div style="font-size:26px;font-weight:800;color:${riskColor}">${e.risk}</div>
        <div style="font-size:12px;color:var(--text2)">Turnover Risk</div>
      </div>
    </div>

    <div style="margin-bottom:20px">
      <div style="font-size:13px;font-weight:600;margin-bottom:10px">Review Goals & Progress</div>
      ${goals.map(g => `
        <div style="margin-bottom:10px">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px">
            <span style="font-size:13px;color:var(--text2)">${g.done ? '✅' : '🔄'} ${g.goal}</span>
            <span style="font-size:12px;font-weight:600">${g.progress}%</span>
          </div>
          <div class="progress-bar"><div class="progress-fill ${perfColor}" style="width:${g.progress}%"></div></div>
        </div>`).join('')}
    </div>

    <div style="margin-bottom:20px">
      <div style="font-size:13px;font-weight:600;margin-bottom:8px">Reviewer Notes</div>
      <textarea placeholder="Add review notes for this employee..." style="width:100%;min-height:80px;padding:10px 12px;border-radius:var(--radius-sm);border:1px solid var(--border);background:var(--surface2);color:var(--text1);font-size:13px;font-family:inherit;resize:vertical;box-sizing:border-box;outline:none;transition:border .2s" onfocus="this.style.borderColor='var(--primary)'" onblur="this.style.borderColor='var(--border)'"></textarea>
    </div>

    <div class="modal-actions">
      <button class="btn-secondary" onclick="closeModal()">Close</button>
      <button class="btn-accent btn-sm" onclick="showAIInsight('${e.name}');closeModal()">🧠 AI Insight</button>
      <button class="btn-primary" onclick="closeModal();showToast('Review saved for ${e.name}!')">Save Review</button>
    </div>
  `);
}

function showStartReviewCycle() {
  const today = new Date().toISOString().split('T')[0];
  showModal(`
    <div class="modal-header">
      <h3 class="modal-title">🚀 Start Review Cycle</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-form">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div class="form-group">
          <label>Cycle Name</label>
          <input type="text" id="rcName" placeholder="e.g. Q2 2026 Review" value="Q2 2026 Performance Review"/>
        </div>
        <div class="form-group">
          <label>Review Type</label>
          <select id="rcType">
            <option>Annual Review</option>
            <option>Quarterly Review</option>
            <option>Mid-Year Review</option>
            <option>Probation Review</option>
          </select>
        </div>
        <div class="form-group">
          <label>Start Date</label>
          <input type="date" id="rcStart" value="${today}"/>
        </div>
        <div class="form-group">
          <label>End Date</label>
          <input type="date" id="rcEnd" value="${today.slice(0,8)}${String(parseInt(today.slice(8))+14).padStart(2,'0')}"/>
        </div>
      </div>
      <div class="form-group">
        <label>Include Departments</label>
        <select id="rcDept">
          <option value="all">All Departments</option>
          ${[...new Set(DATA.employees.map(e=>e.dept))].map(d=>`<option>${d}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Notify Employees</label>
        <div style="display:flex;gap:16px;margin-top:6px">
          ${['Email Notification','In-App Alert','Manager Reminder'].map(opt=>`
            <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer">
              <input type="checkbox" checked style="accent-color:var(--primary)"/> ${opt}
            </label>`).join('')}
        </div>
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn-primary" onclick="launchReviewCycle()">Launch Cycle</button>
    </div>
  `);
}

function launchReviewCycle() {
  const name = (document.getElementById('rcName') || {}).value || 'Review Cycle';
  closeModal();
  showToast(`"${name}" launched — all employees notified!`);
}

function exportPerformancePDF() {
  const emps = DATA.employees;
  const avgPerf = emps.length ? Math.round(emps.reduce((s,e)=>s+e.performance,0)/emps.length) : 0;
  const rows = emps.map(e => `
    <tr>
      <td>${e.name}</td><td>${leaveEscape(e.role)}</td><td>${leaveEscape(e.dept)}</td>
      <td>${e.performance}%</td><td>${e.engagement}%</td>
      <td>${e.risk}</td><td>${e.performance>80?'Completed':'In Review'}</td>
    </tr>`).join('');

  const win = window.open('', '_blank');
  win.document.write(`
    <!DOCTYPE html><html><head><title>Performance Review Report</title>
    <style>
      body{font-family:Inter,sans-serif;padding:32px;color:#1e293b;font-size:13px}
      h1{font-size:22px;margin-bottom:4px}
      .meta{color:#64748b;margin-bottom:24px;font-size:12px}
      .summary{display:flex;gap:24px;margin-bottom:28px}
      .summary-box{padding:14px 20px;border:1px solid #e2e8f0;border-radius:8px;text-align:center}
      .summary-box .val{font-size:24px;font-weight:800;color:#1a56db}
      .summary-box .lbl{font-size:11px;color:#64748b;margin-top:2px}
      table{width:100%;border-collapse:collapse}
      th{background:#f1f5f9;padding:10px 12px;text-align:left;font-size:12px;color:#475569;border-bottom:2px solid #e2e8f0}
      td{padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:13px}
      tr:last-child td{border-bottom:none}
      .footer{margin-top:32px;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:12px}
      @media print{body{padding:16px}}
    </style></head><body>
    <h1>📊 Performance Review Report</h1>
    <div class="meta">HRImara · Generated ${new Date().toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})} · ${currentUser.name}</div>
    <div class="summary">
      <div class="summary-box"><div class="val">${emps.length}</div><div class="lbl">Total Employees</div></div>
      <div class="summary-box"><div class="val">${avgPerf}%</div><div class="lbl">Avg KPI Score</div></div>
      <div class="summary-box"><div class="val">${emps.filter(e=>e.performance>80).length}</div><div class="lbl">Reviews Completed</div></div>
      <div class="summary-box"><div class="val">${emps.filter(e=>e.risk==='High').length}</div><div class="lbl">High Risk</div></div>
    </div>
    <table>
      <thead><tr><th>Name</th><th>Role</th><th>Department</th><th>KPI Score</th><th>Engagement</th><th>Risk</th><th>Status</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="footer">Confidential — HRImara AI-Powered HR Platform · University HR Department</div>
    <script>window.onload=()=>{window.print()}<\/script>
    </body></html>
  `);
  win.document.close();
}

function showAddEmployee() {
  showModal(`
    <div class="modal-header"><h3 class="modal-title">Add New Employee</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="modal-form">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div class="form-group"><label>First Name</label><input type="text" placeholder="John"/></div>
        <div class="form-group"><label>Last Name</label><input type="text" placeholder="Doe"/></div>
        <div class="form-group"><label>Email</label><input type="email" placeholder="john.doe@uni.edu"/></div>
        <div class="form-group"><label>Department</label><select><option>Computer Science</option><option>Engineering</option><option>Business</option><option>HR</option><option>ICT</option></select></div>
        <div class="form-group"><label>Role</label><input type="text" placeholder="Lecturer"/></div>
        <div class="form-group"><label>Start Date</label><input type="date"/></div>
      </div>
    </div>
    <div class="modal-actions"><button class="btn-secondary" onclick="closeModal()">Cancel</button><button class="btn-primary" onclick="closeModal();showToast('Employee added successfully!')">Add Employee</button></div>
  `);
}

/* ===== RECRUITMENT PAGE ===== */
function renderRecruitment() {
  const jobs = DATA.jobs.map(j => `
    <div class="job-card animate-in">
      <div class="job-header">
        <div><div class="job-title">${j.title}</div><div class="job-dept">${j.dept}</div></div>
        <span class="tag ${j.status==='Open'?'tag-green':'tag-yellow'}">${j.status}</span>
      </div>
      <div class="job-meta">
        <span>📅 Posted ${j.posted}</span>
        <span>👤 ${j.applicants} applicants</span>
        <span>⏰ ${j.type}</span>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn-primary btn-sm" onclick="viewApplicants(${j.id})">View Applicants</button>
        <button class="btn-secondary btn-sm">Edit</button>
      </div>
    </div>`).join('');

  return `
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;flex-wrap:wrap;gap:12px;">
    <div><h3 style="font-size:18px;font-weight:700;">Job Postings</h3><p style="color:var(--text2);font-size:13px;">${DATA.jobs.length} position${DATA.jobs.length !== 1 ? 's' : ''} · ${DATA.jobs.reduce((s,j)=>s+j.applicants,0)} total applicants</p></div>
    <button class="btn-primary" onclick="showPostJob()">+ Post New Job</button>
  </div>
  <div class="tabs">
    <button class="tab active">All Jobs</button>
    <button class="tab">Open</button>
    <button class="tab">Screening</button>
    <button class="tab">Closed</button>
  </div>
  ${jobs}
  <div class="card animate-in" style="margin-top:24px">
    <div class="card-header">
      <div class="card-title">🤖 AI Candidate Ranking — Senior Lecturer – Data Science</div>
      <span class="tag tag-blue">AI Screened</span>
    </div>
    <p style="font-size:13px;color:var(--text2);margin-bottom:16px">Assessment scores support manual review. Scores out of 100.</p>
    ${DATA.applicants.map((a,i) => `
      <div class="applicant-row animate-in" style="animation-delay:${i*.08}s">
        <div class="applicant-score">${a.score}</div>
        <div class="applicant-info">
          <div class="applicant-name">${a.name}</div>
          <div class="applicant-detail">${a.exp} experience · ${a.edu}</div>
        </div>
        <div class="progress-bar" style="width:120px"><div class="progress-fill ${a.score>85?'':'yellow'}" style="width:${a.score}%"></div></div>
        <span class="tag ${a.status==='Shortlisted'?'tag-green':a.status==='Review'?'tag-yellow':'tag-gray'}">${a.status}</span>
      </div>`).join('')}
  </div>`;
}

function viewApplicants(id) {
  const job = DATA.jobs.find(j=>j.id===id);
  showModal(`
    <div class="modal-header"><h3 class="modal-title">Applicants — ${job.title}</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <p style="color:var(--text2);font-size:13px;margin-bottom:16px">${job.applicants} total applicants · AI-ranked</p>
    ${DATA.applicants.map(a=>`
      <div class="applicant-row">
        <div class="applicant-score">${a.score}</div>
        <div class="applicant-info"><div class="applicant-name">${a.name}</div><div class="applicant-detail">${a.exp} · ${a.edu}</div></div>
        <span class="tag ${a.status==='Shortlisted'?'tag-green':a.status==='Review'?'tag-yellow':'tag-gray'}">${a.status}</span>
      </div>`).join('')}
    <div class="modal-actions"><button class="btn-secondary" onclick="closeModal()">Close</button><button class="btn-primary">Export Shortlist</button></div>
  `);
}

function showPostJob() {
  showModal(`
    <div class="modal-header"><h3 class="modal-title">Post New Job</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="modal-form">
      <div class="form-group"><label>Job Title</label><input type="text" placeholder="e.g. Senior Lecturer"/></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div class="form-group"><label>Department</label><select><option>Computer Science</option><option>Engineering</option><option>Business</option><option>HR</option></select></div>
        <div class="form-group"><label>Type</label><select><option>Full-time</option><option>Part-time</option><option>Contract</option></select></div>
      </div>
      <div class="form-group"><label>Description</label><textarea placeholder="Job description..."></textarea></div>
      <div class="form-group"><label>Requirements</label><textarea placeholder="Required qualifications..."></textarea></div>
    </div>
    <div class="modal-actions"><button class="btn-secondary" onclick="closeModal()">Cancel</button><button class="btn-primary" onclick="closeModal();showToast('Job posted successfully!')">Post Job</button></div>
  `);
}

/* ===== ONBOARDING PAGE ===== */
function renderOnboarding() {
  const active    = DATA.onboarding.filter(o => o.status === 'In Progress');
  const completed = DATA.onboarding.filter(o => o.status === 'Completed');
  const allCount  = DATA.onboarding.length;

  const listRows = DATA.onboarding.map(o => {
    const done  = o.steps.filter(s => s.done).length;
    const total = o.steps.length;
    const pct   = Math.round((done / total) * 100);
    const catGroups = [...new Set(o.steps.map(s => s.category))];
    const catDone   = catGroups.filter(cat => o.steps.filter(s=>s.category===cat).every(s=>s.done)).length;
    return `
    <div class="card animate-in" style="margin-bottom:16px;cursor:default">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
        <div style="display:flex;align-items:center;gap:14px">
          <div class="emp-avatar" style="width:48px;height:48px;font-size:18px;flex-shrink:0">${o.name.split(' ').map(w=>w[0]).join('').slice(0,2)}</div>
          <div>
            <div style="font-weight:700;font-size:15px">${o.name}</div>
            <div style="font-size:12px;color:var(--text2)">${o.role} · ${o.dept}</div>
            <div style="font-size:12px;color:var(--text3);margin-top:2px">Started: ${o.startDate} · Buddy: ${o.buddy}</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
          <span class="tag ${o.status==='Completed'?'tag-green':'tag-blue'}">${o.status}</span>
          <span style="font-size:13px;font-weight:700;color:var(--primary)">${pct}%</span>
          <button class="btn-primary btn-sm" onclick="viewOnboarding(${o.id})">Manage</button>
        </div>
      </div>
      <div style="margin-top:14px">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px">
          <span style="font-size:12px;color:var(--text2)">${done} of ${total} tasks complete · ${catDone} of ${catGroups.length} phases done</span>
        </div>
        <div class="progress-bar" style="height:10px">
          <div class="progress-fill ${o.status==='Completed'?'green':pct>=50?'':'yellow'}" style="width:${pct}%"></div>
        </div>
      </div>
    </div>`;
  }).join('');

  return `
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;flex-wrap:wrap;gap:12px">
    <div>
      <h3 style="font-size:18px;font-weight:700">Onboarding Management</h3>
      <p style="color:var(--text2);font-size:13px">${allCount} total · ${active.length} in progress · ${completed.length} completed</p>
    </div>
    <button class="btn-primary" onclick="startNewOnboarding()">+ Start New Onboarding</button>
  </div>

  <div class="stats-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:24px">
    <div class="stat-card blue"><div class="stat-icon blue">🚀</div><div class="stat-value">${active.length}</div><div class="stat-label">In Progress</div></div>
    <div class="stat-card green"><div class="stat-icon green">✅</div><div class="stat-value">${completed.length}</div><div class="stat-label">Completed</div></div>
    <div class="stat-card yellow"><div class="stat-icon yellow">📋</div>
      <div class="stat-value">${DATA.onboarding.reduce((s,o)=>s+o.steps.filter(st=>!st.done).length,0)}</div>
      <div class="stat-label">Pending Tasks</div>
    </div>
    <div class="stat-card red"><div class="stat-icon red">⏳</div>
      <div class="stat-value">${active.filter(o=>{const d=new Date(o.startDate);return (new Date()-d)/(1000*60*60*24)>30;}).length}</div>
      <div class="stat-label">Overdue (&gt;30 days)</div>
    </div>
  </div>

  <div class="tabs" id="onboardTabs">
    <button class="tab active" onclick="filterOnboard('all',this)">All (${allCount})</button>
    <button class="tab" onclick="filterOnboard('In Progress',this)">In Progress (${active.length})</button>
    <button class="tab" onclick="filterOnboard('Completed',this)">Completed (${completed.length})</button>
  </div>

  <div id="onboardList">${listRows}</div>`;
}

function filterOnboard(filter, btn) {
  document.querySelectorAll('#onboardTabs .tab').forEach(t=>t.classList.remove('active'));
  btn.classList.add('active');
  const items = filter === 'all' ? DATA.onboarding : DATA.onboarding.filter(o=>o.status===filter);
  document.getElementById('onboardList').innerHTML = items.length
    ? items.map(o => {
        const done = o.steps.filter(s=>s.done).length;
        const pct  = Math.round((done/o.steps.length)*100);
        return `
        <div class="card animate-in" style="margin-bottom:16px">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
            <div style="display:flex;align-items:center;gap:14px">
              <div class="emp-avatar" style="width:48px;height:48px;font-size:18px">${o.name.split(' ').map(w=>w[0]).join('').slice(0,2)}</div>
              <div>
                <div style="font-weight:700">${o.name}</div>
                <div style="font-size:12px;color:var(--text2)">${o.role} · ${o.dept} · Started ${o.startDate}</div>
              </div>
            </div>
            <div style="display:flex;gap:8px;align-items:center">
              <span class="tag ${o.status==='Completed'?'tag-green':'tag-blue'}">${o.status}</span>
              <button class="btn-primary btn-sm" onclick="viewOnboarding(${o.id})">Manage</button>
            </div>
          </div>
          <div style="margin-top:12px">
            <div class="progress-bar"><div class="progress-fill ${o.status==='Completed'?'green':''}" style="width:${pct}%"></div></div>
            <div style="font-size:12px;color:var(--text2);margin-top:4px">${done}/${o.steps.length} tasks · ${pct}%</div>
          </div>
        </div>`;
      }).join('')
    : `<div class="card" style="text-align:center;padding:40px;color:var(--text3)">No onboarding records found.</div>`;
}

function viewOnboarding(id) {
  const o = DATA.onboarding.find(x=>x.id===id);
  if(!o) return;
  const categories = [...new Set(o.steps.map(s=>s.category))];
  const done = o.steps.filter(s=>s.done).length;
  const pct  = Math.round((done/o.steps.length)*100);

  const stepsHtml = categories.map(cat => {
    const catSteps = o.steps.filter(s=>s.category===cat);
    const catDone  = catSteps.every(s=>s.done);
    return `
    <div style="margin-bottom:20px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
        <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--text3)">${cat}</span>
        ${catDone ? '<span class="tag tag-green" style="font-size:10px">Complete</span>' : ''}
      </div>
      ${catSteps.map(step => `
        <div style="display:flex;align-items:center;gap:12px;padding:10px 12px;background:var(--surface2);border-radius:var(--radius-sm);margin-bottom:6px;transition:all .2s" id="step-${o.id}-${step.id}">
          <input type="checkbox" ${step.done?'checked':''} onchange="toggleStep(${o.id},${step.id},this)"
            style="width:16px;height:16px;accent-color:var(--primary);cursor:pointer;flex-shrink:0"/>
          <div style="flex:1">
            <div style="font-size:13px;font-weight:${step.done?'400':'600'};color:${step.done?'var(--text3)':'var(--text)'};text-decoration:${step.done?'line-through':'none'}">${step.title}</div>
            ${step.doneDate?`<div style="font-size:11px;color:var(--success)">✓ Completed ${step.doneDate}</div>`:''}
          </div>
          <span class="tag ${step.done?'tag-green':'tag-gray'}">${step.done?'Done':'Pending'}</span>
        </div>`).join('')}
    </div>`;
  }).join('');

  showModal(`
    <div class="modal-header">
      <h3 class="modal-title">Onboarding — ${o.name}</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div style="display:flex;align-items:center;gap:14px;padding:16px;background:var(--surface2);border-radius:var(--radius-sm);margin-bottom:20px">
      <div class="emp-avatar" style="width:52px;height:52px;font-size:20px">${o.name.split(' ').map(w=>w[0]).join('').slice(0,2)}</div>
      <div style="flex:1">
        <div style="font-weight:700">${o.name} · ${o.role}</div>
        <div style="font-size:12px;color:var(--text2)">${o.dept} · Started ${o.startDate} · Buddy: ${o.buddy}</div>
        <div style="margin-top:8px">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px">
            <span style="font-size:12px;color:var(--text2)">Overall Progress</span>
            <strong style="font-size:12px">${done}/${o.steps.length} tasks · ${pct}%</strong>
          </div>
          <div class="progress-bar" style="height:8px"><div class="progress-fill ${o.status==='Completed'?'green':''}" style="width:${pct}%"></div></div>
        </div>
      </div>
      <span class="tag ${o.status==='Completed'?'tag-green':'tag-blue'}">${o.status}</span>
    </div>
    <div style="max-height:420px;overflow-y:auto;padding-right:4px">${stepsHtml}</div>
    <div class="modal-actions">
      <button class="btn-secondary" onclick="closeModal()">Close</button>
      ${o.status!=='Completed'?`<button class="btn-primary" onclick="markOnboardingComplete(${o.id})">Mark as Completed</button>`:''}
    </div>
  `);
}

function toggleStep(onboardId, stepId, checkbox) {
  const o    = DATA.onboarding.find(x=>x.id===onboardId);
  const step = o && o.steps.find(s=>s.id===stepId);
  if(!step) return;
  step.done     = checkbox.checked;
  step.doneDate = checkbox.checked ? new Date().toISOString().split('T')[0] : null;
  // Refresh the step row visually without closing modal
  const row = document.getElementById(`step-${onboardId}-${stepId}`);
  if(row) {
    const label = row.querySelector('div > div:first-child');
    const tag   = row.querySelector('.tag');
    const dateEl = row.querySelector('div > div:last-child');
    if(label) { label.style.textDecoration = step.done?'line-through':'none'; label.style.color = step.done?'var(--text3)':'var(--text)'; label.style.fontWeight = step.done?'400':'600'; }
    if(tag)   { tag.className = `tag ${step.done?'tag-green':'tag-gray'}`; tag.textContent = step.done?'Done':'Pending'; }
    if(dateEl && step.done) dateEl.innerHTML = `<div style="font-size:11px;color:var(--success)">✓ Completed ${step.doneDate}</div>`;
  }
  // Auto-complete if all steps done
  const allDone = o.steps.every(s=>s.done);
  if(allDone && o.status !== 'Completed') {
    o.status = 'Completed';
    showToast(`🎉 Onboarding completed for ${o.name}!`);
  }
}

function markOnboardingComplete(id) {
  const o = DATA.onboarding.find(x=>x.id===id);
  if(!o) return;
  o.steps.forEach(s=>{ s.done=true; if(!s.doneDate) s.doneDate=new Date().toISOString().split('T')[0]; });
  o.status = 'Completed';
  closeModal();
  navigate('onboarding');
  showToast(`✅ Onboarding marked complete for ${o.name}`);
}

function startNewOnboarding() {
  const unboarded = DATA.employees.filter(e => !DATA.onboarding.find(o=>o.empId===e.id));
  const options   = unboarded.length
    ? unboarded.map(e=>`<option value="${e.id}">${e.name} — ${leaveEscape(e.role)}, ${leaveEscape(e.dept)}</option>`).join('')
    : `<option disabled>All employees have onboarding records</option>`;

  showModal(`
    <div class="modal-header"><h3 class="modal-title">Start New Onboarding</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="modal-form">
      <div class="form-group"><label>Select Employee</label>
        <select id="obEmployee">${options}</select>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div class="form-group"><label>Start Date</label><input type="date" id="obStartDate" value="${new Date().toISOString().split('T')[0]}"/></div>
        <div class="form-group"><label>Assign Buddy</label>
          <select id="obBuddy">
            ${DATA.employees.map(e=>`<option>${e.name}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group"><label>Notes (optional)</label><textarea id="obNotes" placeholder="Any special instructions or notes..."></textarea></div>
    </div>
    <div class="modal-actions">
      <button class="btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn-primary" onclick="createOnboarding()">Start Onboarding</button>
    </div>
  `);
}

function createOnboarding() {
  const empId    = parseInt(document.getElementById('obEmployee').value);
  const startDate= document.getElementById('obStartDate').value;
  const buddy    = document.getElementById('obBuddy').value;
  if(!empId || !startDate) { showToast('Please fill in all required fields.','error'); return; }
  const emp = DATA.employees.find(e=>e.id===empId);
  if(!emp) return;
  const newId = DATA.onboarding.length ? Math.max(...DATA.onboarding.map(o=>o.id))+1 : 1;
  DATA.onboarding.push({
    id: newId, empId, name: emp.name, role: emp.role, dept: emp.dept,
    startDate, buddy, status: 'In Progress',
    steps:[
      {id:1, title:"Offer Letter & Contract Signed",  category:"Documentation", done:false, doneDate:null},
      {id:2, title:"ID & Credentials Verified",       category:"Documentation", done:false, doneDate:null},
      {id:3, title:"IT Account & Email Setup",        category:"IT Setup",      done:false, doneDate:null},
      {id:4, title:"VPN & System Access Granted",     category:"IT Setup",      done:false, doneDate:null},
      {id:5, title:"HR Orientation Session",          category:"Orientation",   done:false, doneDate:null},
      {id:6, title:"University Policies Briefing",    category:"Orientation",   done:false, doneDate:null},
      {id:7, title:"Department Induction Meeting",    category:"Induction",     done:false, doneDate:null},
      {id:8, title:"Meet Buddy / Mentor Assigned",    category:"Induction",     done:false, doneDate:null},
      {id:9, title:"Mandatory Training Enrolled",     category:"Training",      done:false, doneDate:null},
      {id:10,title:"Health & Safety Training",        category:"Training",      done:false, doneDate:null},
      {id:11,title:"30-Day Check-in with Manager",    category:"Review",        done:false, doneDate:null},
      {id:12,title:"90-Day Performance Review",       category:"Review",        done:false, doneDate:null},
    ]
  });
  closeModal();
  navigate('onboarding');
  showToast(`🚀 Onboarding started for ${emp.name}`);
}

/* ===== MY PERFORMANCE (Employee view) ===== */
function renderMyPerformance() {
  const me = DATA.employees.find(e => e.email === currentUser.email);
  if (!me) return `<div class="card"><p style="text-align:center;padding:40px;color:var(--text3)">Your performance record is not yet set up. Contact HR.</p></div>`;

  const perfColor = me.performance >= 85 ? 'green' : me.performance >= 70 ? 'yellow' : 'red';
  const engColor  = me.engagement  >= 75 ? 'green' : me.engagement  >= 60 ? 'yellow' : 'red';

  return `
  <div class="kpi-grid">
    <div class="kpi-card animate-in">
      <div class="kpi-score" style="color:var(--${perfColor==='green'?'success':perfColor==='yellow'?'accent':'danger'})">${me.performance}%</div>
      <div class="kpi-label">My Performance Score</div>
      <div class="kpi-trend ${me.performance>=80?'up':'down'}">${me.performance>=80?'↑ Above target':'↓ Below target'}</div>
    </div>
    <div class="kpi-card animate-in" style="animation-delay:.05s">
      <div class="kpi-score" style="color:var(--${engColor==='green'?'success':engColor==='yellow'?'accent':'danger'})">${me.engagement}%</div>
      <div class="kpi-label">My Engagement Score</div>
      <div class="kpi-trend ${me.engagement>=75?'up':'down'}">${me.engagement>=75?'↑ Healthy':'↓ Needs attention'}</div>
    </div>
    <div class="kpi-card animate-in" style="animation-delay:.1s">
      <div class="kpi-score">${me.status}</div>
      <div class="kpi-label">Employment Status</div>
      <div class="kpi-trend up">${me.dept}</div>
    </div>
    <div class="kpi-card animate-in" style="animation-delay:.15s">
      <div class="kpi-score">${me.joined}</div>
      <div class="kpi-label">Date Joined</div>
      <div class="kpi-trend up">${me.role}</div>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
    <div class="card animate-in" style="animation-delay:.2s">
      <div class="card-header"><div class="card-title">My Scores</div></div>
      <div style="margin-bottom:20px">
        <div style="display:flex;justify-content:space-between;margin-bottom:8px"><span style="font-size:14px">Performance</span><strong>${me.performance}%</strong></div>
        <div class="progress-bar" style="height:12px"><div class="progress-fill ${perfColor}" style="width:${me.performance}%"></div></div>
      </div>
      <div>
        <div style="display:flex;justify-content:space-between;margin-bottom:8px"><span style="font-size:14px">Engagement</span><strong>${me.engagement}%</strong></div>
        <div class="progress-bar" style="height:12px"><div class="progress-fill ${engColor}" style="width:${me.engagement}%"></div></div>
      </div>
    </div>
    <div class="card animate-in" style="animation-delay:.25s">
      <div class="card-header"><div class="card-title">Performance Trend</div><div class="card-subtitle">Organisation average over time</div></div>
      <div class="chart-container"><canvas id="perfTrendChart"></canvas></div>
    </div>
  </div>

  <div class="ai-insight animate-in" style="animation-delay:.3s;margin-top:0">
    <div class="ai-insight-label">💡 Your Performance Summary</div>
    <div class="ai-insight-text" id="emp-perf-summary">⏳ Loading your AI summary...</div>
  </div>`;

  const perfFallback = me.performance >= 88
    ? `Excellent work! Your score of <strong>${me.performance}%</strong> places you among the top performers.`
    : me.performance >= 75
    ? `Good performance at <strong>${me.performance}%</strong>. Focus on your development goals to reach the top tier.`
    : `Your current score is <strong>${me.performance}%</strong>. We recommend speaking with your line manager about a development plan.`;

  setTimeout(() => { const el = document.getElementById('emp-perf-summary'); if(el) el.innerHTML = perfFallback; }, 50);
}

/* ===== PERFORMANCE PAGE ===== */
function renderPerformance() {
  if (currentUser.role === 'employee') return renderMyPerformance();
  const emps = DATA.employees;
  const avgPerf = emps.length ? Math.round(emps.reduce((s,e)=>s+e.performance,0)/emps.length) : 0;
  const avgEng  = emps.length ? Math.round(emps.reduce((s,e)=>s+e.engagement,0)/emps.length) : 0;
  const reviewsDone = emps.filter(e=>e.performance>80).length;
  const reviewsPct  = emps.length ? Math.round((reviewsDone/emps.length)*100) : 0;

  // Dept averages from employees
  const deptMap = {};
  emps.forEach(e => {
    if(!deptMap[e.dept]) deptMap[e.dept] = [];
    deptMap[e.dept].push(e.performance);
  });
  const deptLabels = Object.keys(deptMap);
  const deptScores = deptLabels.map(d => Math.round(deptMap[d].reduce((a,b)=>a+b,0)/deptMap[d].length));

  return `
  <div class="kpi-grid">
    ${[
      {label:'Avg KPI Score',    val:avgPerf+'%',    trend: avgPerf >= 80 ? '↑ Above target' : '↓ Below target', up: avgPerf >= 80},
      {label:'Reviews Completed',val:reviewsPct+'%', trend: reviewsDone+' of '+emps.length+' employees',         up: reviewsPct >= 70},
      {label:'Avg Engagement',   val:avgEng+'%',     trend: avgEng >= 75 ? '↑ Healthy' : '↓ Needs attention',   up: avgEng >= 75},
      {label:'High Performers',  val:emps.filter(e=>e.performance>=85).length, trend:'Score ≥ 85%', up:true},
    ].map(k=>`
      <div class="kpi-card animate-in">
        <div class="kpi-score">${k.val}</div>
        <div class="kpi-label">${k.label}</div>
        <div class="kpi-trend ${k.up?'up':'down'}">${k.trend}</div>
      </div>`).join('')}
  </div>

  <div class="charts-grid">
    <div class="card animate-in">
      <div class="card-header"><div class="card-title">Performance Trend</div><div class="card-subtitle">Average score over ${DATA.performance.length} months</div></div>
      <div class="chart-container"><canvas id="perfTrendChart"></canvas></div>
    </div>
    <div class="card animate-in" style="animation-delay:.1s">
      <div class="card-header"><div class="card-title">Department Performance</div><div class="card-subtitle">Computed from employee records</div></div>
      <div class="chart-container"><canvas id="deptPerfChart" data-labels='${JSON.stringify(deptLabels)}' data-scores='${JSON.stringify(deptScores)}'></canvas></div>
    </div>
  </div>

  <div class="card animate-in" style="animation-delay:.2s">
    <div class="card-header">
      <div class="card-title">Performance Reviews</div>
      <div style="display:flex;gap:8px">
        <button class="btn-secondary btn-sm" onclick="exportPerformancePDF()">Export PDF</button>
        <button class="btn-primary btn-sm" onclick="showStartReviewCycle()">Start Review Cycle</button>
      </div>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Employee</th><th>Department</th><th>KPI Score</th><th>Review Status</th><th>AI Insight</th><th>Action</th></tr></thead>
        <tbody>
          ${DATA.employees.map(e=>`
            <tr>
              <td><div style="font-weight:600">${e.name}</div><div style="font-size:12px;color:var(--text2)">${leaveEscape(e.role)}</div></td>
              <td>${leaveEscape(e.dept)}</td>
              <td>
                <div style="display:flex;align-items:center;gap:8px">
                  <span style="font-weight:700;color:var(--primary)">${e.performance}%</span>
                  <div class="progress-bar" style="width:80px"><div class="progress-fill ${e.performance>85?'green':e.performance>70?'':'red'}" style="width:${e.performance}%"></div></div>
                </div>
              </td>
              <td><span class="tag ${e.performance>80?'tag-green':'tag-yellow'}">${e.performance>80?'Completed':'In Review'}</span></td>
              <td><span class="tag tag-blue" style="cursor:pointer" onclick="showAIInsight('${e.name}')">View AI</span></td>
              <td><button class="btn-secondary btn-sm" onclick="showEmployeeReviewDetails(${e.id})">Details</button></td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>`;
}

/* ===== ENGAGEMENT PAGE ===== */
function renderEngagement() {
  const latest = DATA.surveys.length ? DATA.surveys[DATA.surveys.length-1] : {positive:0,neutral:0,negative:0,month:'—'};
  const prev   = DATA.surveys.length > 1 ? DATA.surveys[DATA.surveys.length-2] : latest;
  const posDelta = latest.positive - prev.positive;
  const negDelta = latest.negative - prev.negative;

  // Dept engagement from employees
  const deptEngMap = {};
  DATA.employees.forEach(e => {
    if(!deptEngMap[e.dept]) deptEngMap[e.dept] = [];
    deptEngMap[e.dept].push(e.engagement);
  });
  const deptEngLabels = Object.keys(deptEngMap);
  const deptEngScores = deptEngLabels.map(d => Math.round(deptEngMap[d].reduce((a,b)=>a+b,0)/deptEngMap[d].length));

  // ── Employee view: show the survey form ──────────────────────────────────
  if (currentUser.role === 'employee') {
    return `
    <div class="stats-grid" style="grid-template-columns:repeat(4,1fr)">
      <div class="stat-card green"><div class="stat-icon green">😊</div><div class="stat-value">${latest.positive}%</div><div class="stat-label">Positive Sentiment</div><div class="stat-change ${posDelta>=0?'up':'down'}">${posDelta>=0?'↑':'↓'} ${Math.abs(posDelta)}% vs prev month</div></div>
      <div class="stat-card yellow"><div class="stat-icon yellow">😐</div><div class="stat-value">${latest.neutral}%</div><div class="stat-label">Neutral Sentiment</div></div>
      <div class="stat-card red"><div class="stat-icon red">😟</div><div class="stat-value">${latest.negative}%</div><div class="stat-label">Negative Sentiment</div><div class="stat-change ${negDelta<=0?'up':'down'}">${negDelta<=0?'↓ Improved':'↑ Increased'} ${Math.abs(negDelta)}%</div></div>
      <div class="stat-card blue"><div class="stat-icon blue">📊</div><div class="stat-value">${DATA.surveys.length}</div><div class="stat-label">Survey Months Recorded</div></div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:4px">
      <div class="card animate-in" style="animation-delay:.1s">
        <div class="card-header"><div class="card-title">💬 Pulse Survey</div><span class="tag tag-green">Active</span></div>
        <div class="survey-card" style="border:none;padding:0">
          <div class="survey-question">How satisfied are you with your work environment?</div>
          <div class="mood-grid">
            ${[['😞','Very Low'],['😕','Low'],['😐','Neutral'],['🙂','Good'],['😄','Excellent']].map(([e,l])=>`
              <div class="mood-btn" onclick="selectMood(this)"><span class="mood-emoji">${e}</span><span class="mood-label">${l}</span></div>`).join('')}
          </div>
          <div class="survey-question" style="margin-top:16px">Rate your team collaboration:</div>
          <div class="rating-stars" id="ratingStars">
            ${[1,2,3,4,5].map(i=>`<span class="star" onclick="rateStar(${i})">⭐</span>`).join('')}
          </div>
          <div class="survey-question" style="margin-top:16px">Any additional comments? <span style="color:var(--text3);font-weight:400">(optional)</span></div>
          <textarea id="surveyComment" placeholder="Share your thoughts, suggestions, or concerns..." style="width:100%;min-height:90px;padding:10px 12px;border-radius:var(--radius-sm);border:1px solid var(--border);background:var(--surface2);color:var(--text1);font-size:13px;font-family:inherit;resize:vertical;margin-top:6px;box-sizing:border-box;outline:none;transition:border .2s" onfocus="this.style.borderColor='var(--primary)'" onblur="this.style.borderColor='var(--border)'"></textarea>
          <button class="btn-primary btn-full" style="margin-top:12px" onclick="submitSurveyResponse()">Submit Response</button>
        </div>
      </div>

      <div class="card animate-in" style="animation-delay:.2s">
        <div class="card-header"><div class="card-title">📊 Sentiment Analysis</div><span class="tag tag-blue">AI Powered</span></div>
        ${DATA.surveys.length ? `
        <div style="margin-bottom:20px">
          <div class="sentiment-row"><span class="sentiment-label">Positive</span><div class="sentiment-bar"><div class="sentiment-fill positive" style="width:${latest.positive}%"></div></div><span class="sentiment-pct" style="color:var(--success)">${latest.positive}%</span></div>
          <div class="sentiment-row"><span class="sentiment-label">Neutral</span><div class="sentiment-bar"><div class="sentiment-fill neutral" style="width:${latest.neutral}%"></div></div><span class="sentiment-pct" style="color:var(--accent)">${latest.neutral}%</span></div>
          <div class="sentiment-row"><span class="sentiment-label">Negative</span><div class="sentiment-bar"><div class="sentiment-fill negative" style="width:${latest.negative}%"></div></div><span class="sentiment-pct" style="color:var(--danger)">${latest.negative}%</span></div>
        </div>
        <div class="ai-insight">
          <div class="ai-insight-label">AI Sentiment Summary</div>
          <div class="ai-insight-text" id="emp-sentiment-summary">⏳ Loading AI summary...</div>
        </div>` : `<div style="text-align:center;padding:40px;color:var(--text3)">No survey data recorded yet.</div>`}
      </div>
    </div>`;
  }

  // ── HR / Admin view: show survey results & history ───────────────────────
  const surveyHistoryRows = DATA.surveys.map(s => `
    <tr>
      <td><strong>${s.month}</strong></td>
      <td><span style="color:var(--success);font-weight:600">${s.positive}%</span></td>
      <td><span style="color:var(--accent);font-weight:600">${s.neutral}%</span></td>
      <td><span style="color:var(--danger);font-weight:600">${s.negative}%</span></td>
      <td>
        <div style="display:flex;align-items:center;gap:6px">
          <div style="flex:1;height:6px;background:var(--surface2);border-radius:3px;overflow:hidden">
            <div style="height:100%;width:${s.positive}%;background:var(--success);border-radius:3px"></div>
          </div>
          <span style="font-size:11px;color:var(--text3)">${s.positive}% pos</span>
        </div>
      </td>
    </tr>`).join('');

  return `
  <div class="stats-grid" style="grid-template-columns:repeat(4,1fr)">
    <div class="stat-card green"><div class="stat-icon green">😊</div><div class="stat-value">${latest.positive}%</div><div class="stat-label">Positive Sentiment</div><div class="stat-change ${posDelta>=0?'up':'down'}">${posDelta>=0?'↑':'↓'} ${Math.abs(posDelta)}% vs prev month</div></div>
    <div class="stat-card yellow"><div class="stat-icon yellow">😐</div><div class="stat-value">${latest.neutral}%</div><div class="stat-label">Neutral Sentiment</div></div>
    <div class="stat-card red"><div class="stat-icon red">😟</div><div class="stat-value">${latest.negative}%</div><div class="stat-label">Negative Sentiment</div><div class="stat-change ${negDelta<=0?'up':'down'}">${negDelta<=0?'↓ Improved':'↑ Increased'} ${Math.abs(negDelta)}%</div></div>
    <div class="stat-card blue"><div class="stat-icon blue">📊</div><div class="stat-value">${DATA.surveys.length}</div><div class="stat-label">Survey Months Recorded</div></div>
  </div>

  <div class="charts-grid">
    <div class="card animate-in">
      <div class="card-header"><div class="card-title">Sentiment Trend</div><div class="card-subtitle">${DATA.surveys.length}-month analysis</div></div>
      <div class="chart-container"><canvas id="sentimentTrendChart"></canvas></div>
    </div>
    <div class="card animate-in" style="animation-delay:.1s">
      <div class="card-header"><div class="card-title">Engagement by Department</div><div class="card-subtitle">Avg from employee records</div></div>
      <div class="chart-container"><canvas id="engDeptChart" data-labels='${JSON.stringify(deptEngLabels)}' data-scores='${JSON.stringify(deptEngScores)}'></canvas></div>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1.4fr 1fr;gap:20px">
    <div class="card animate-in" style="animation-delay:.2s">
      <div class="card-header">
        <div><div class="card-title">📋 Survey Results History</div><div class="card-subtitle">All pulse surveys sent to employees</div></div>
        <button class="btn-primary btn-sm" onclick="showToast('New survey dispatched to all employees!')">+ Send Survey</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Month</th><th>Positive</th><th>Neutral</th><th>Negative</th><th>Trend</th></tr></thead>
          <tbody>${surveyHistoryRows || `<tr><td colspan="5" style="text-align:center;color:var(--text3);padding:24px">No survey data yet.</td></tr>`}</tbody>
        </table>
      </div>
    </div>

    <div class="card animate-in" style="animation-delay:.3s">
      <div class="card-header"><div class="card-title">📊 Latest Sentiment</div><span class="tag tag-blue">AI Powered</span></div>
      ${DATA.surveys.length ? `
      <div style="margin-bottom:20px">
        <div class="sentiment-row"><span class="sentiment-label">Positive</span><div class="sentiment-bar"><div class="sentiment-fill positive" style="width:${latest.positive}%"></div></div><span class="sentiment-pct" style="color:var(--success)">${latest.positive}%</span></div>
        <div class="sentiment-row"><span class="sentiment-label">Neutral</span><div class="sentiment-bar"><div class="sentiment-fill neutral" style="width:${latest.neutral}%"></div></div><span class="sentiment-pct" style="color:var(--accent)">${latest.neutral}%</span></div>
        <div class="sentiment-row"><span class="sentiment-label">Negative</span><div class="sentiment-bar"><div class="sentiment-fill negative" style="width:${latest.negative}%"></div></div><span class="sentiment-pct" style="color:var(--danger)">${latest.negative}%</span></div>
      </div>
      <div class="ai-insight">
        <div class="ai-insight-label">AI Sentiment Summary — ${latest.month}</div>
        <div class="ai-insight-text" id="hr-sentiment-summary">⏳ Loading AI summary...</div>
      </div>` : `<div style="text-align:center;padding:40px;color:var(--text3)">No survey data recorded yet.</div>`}
    </div>
  </div>`;
}

function selectMood(el) {
  document.querySelectorAll('.mood-btn').forEach(b=>b.classList.remove('selected'));
  el.classList.add('selected');
}

function rateStar(n) {
  document.querySelectorAll('.star').forEach((s,i)=>s.classList.toggle('active',i<n));
}

function submitSurveyResponse() {
  const comment = (document.getElementById('surveyComment') || {}).value || '';
  const msg = comment.trim()
    ? 'Survey response submitted! Thanks for your feedback.'
    : 'Survey response submitted!';
  showToast(msg);
}

/* ===== ANALYTICS PAGE ===== */
/* ===== LEAVE INTELLIGENCE ===== */
const LEAVE_DRIVERS = [
  {id:'recovery', label:'Workload & recovery', hypothesis:'Burnout or sustained workload', action:'Run an anonymous workload pulse; review overtime, cover arrangements and recovery time.'},
  {id:'environment', label:'Workplace conditions', hypothesis:'An environment that needs improvement', action:'Offer a confidential listening channel; review equipment, safety, team conflict and manager support.'},
  {id:'health', label:'Health & wellbeing', hypothesis:'Health or wellbeing needs', action:'Improve access to wellbeing support and flexible return-to-work arrangements. Keep medical details confidential.'},
  {id:'family', label:'Family & caring', hypothesis:'Caring commitments', action:'Explore flexible hours, predictable schedules and caring support.'},
  {id:'development', label:'Study & development', hypothesis:'Professional development', action:'Coordinate study cover and protect learning time.'},
  {id:'planned', label:'Planned rest & personal time', hypothesis:'Normal planned time away', action:'Encourage regular leave and plan team cover early.'},
  {id:'undisclosed', label:'Not disclosed', hypothesis:'Cause is unknown', action:'Invite optional, anonymous feedback. Do not treat missing reasons as a risk signal.'}
];

function leaveEscape(value) {
  return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function computeLeaveAnalysis(requests, period = 'all', now = new Date()) {
  const end = new Date(now); end.setUTCHours(23,59,59,999);
  const start = new Date(end); start.setUTCDate(start.getUTCDate() - 89); start.setUTCHours(0,0,0,0);
  const rows = requests.filter(r => !['Rejected','Cancelled'].includes(r.status) && (period === 'all' ||
    (new Date(r.from + 'T00:00:00Z') <= end && new Date(r.to + 'T00:00:00Z') >= start)));
  const counts = Object.fromEntries(LEAVE_DRIVERS.map(d => [d.id, 0]));
  const types = {};
  const people = new Map();
  let days = 0;
  rows.forEach(r => {
    counts[Object.hasOwn(counts, r.driver) ? r.driver : 'undisclosed']++;
    types[r.type] = (types[r.type] || 0) + 1;
    people.set(r.emp, (people.get(r.emp) || 0) + 1);
    let a = new Date(r.from + 'T00:00:00Z'), b = new Date(r.to + 'T00:00:00Z');
    if (period !== 'all') { a = new Date(Math.max(a, start)); b = new Date(Math.min(b, end)); }
    if (Number.isFinite(+a) && Number.isFinite(+b) && b >= a) days += Math.floor((b-a)/86400000) + 1;
  });
  return {total: rows.length, days, pending: rows.filter(r=>r.status==='Pending').length,
    coverage: rows.length ? Math.round((rows.length-counts.undisclosed)/rows.length*100) : 0,
    counts, types, repeatPeople: [...people.values()].filter(n=>n>=3).length};
}

function renderLeaveAnalysis(period = 'all') {
  const s = computeLeaveAnalysis(DATA.leaveRequests, period);
  const metrics = [['Requests', s.total], ['Calendar days requested', s.days], ['Awaiting review', s.pending], ['Voluntary reason coverage', s.coverage + '%']];
  return `<div class="card leave-analysis" id="leaveAnalysisPanel">
    <div class="card-header leave-analysis-header"><div><div class="card-title">🌿 Leave & Workplace Intelligence</div><div class="card-subtitle">Understand needs. Improve the experience of work.</div></div>
    <label>Period <select id="leaveAnalysisPeriod" onchange="updateLeaveAnalysis(this.value)"><option value="all" ${period==='all'?'selected':''}>All recorded leave</option><option value="90" ${period==='90'?'selected':''}>Last 90 days</option></select></label></div>
    <div class="leave-metrics">${metrics.map(([label,value])=>`<div><strong>${value}</strong><span>${label}</span></div>`).join('')}</div>
    <p class="leave-evidence-note">${s.total ? `${s.total} approved or pending requests; ${s.counts.undisclosed} have no disclosed driver.` : 'No requests in this period.'} Pending days are requested time, not confirmed absence. Categories come from optional employee selections; leave type alone cannot establish burnout or workplace problems.</p>
    <div class="leave-chart-grid">
      <section class="leave-chart-card"><div class="leave-chart-kicker">01 / LEAVE MIX</div><h3>What kind of time away?</h3><p>Requests by leave type</p><div class="leave-chart-canvas"><canvas id="leaveTypeChart" role="img" aria-label="Leave requests by type"></canvas>${!s.total?'<div class="leave-chart-empty">No leave recorded in this period</div>':''}</div></section>
      <section class="leave-chart-card"><div class="leave-chart-kicker">02 / REPORTED DRIVERS</div><h3>What support is needed?</h3><p>Voluntary categories, including undisclosed reasons</p><div class="leave-chart-canvas"><canvas id="leaveDriverChart" role="img" aria-label="Voluntary leave reason counts"></canvas>${!s.total?'<div class="leave-chart-empty">No reasons to visualize in this period</div>':''}</div></section>
      <section class="leave-chart-card leave-chart-wide"><div class="leave-chart-kicker">03 / REQUEST TIMELINE</div><h3>When is demand building?</h3><p>By leave start month · approved versus pending · ${period==='all'?'six months ending with the latest recorded start date':'current and previous two months'}</p><div class="leave-chart-canvas"><canvas id="leaveTrendChart" role="img" aria-label="Monthly approved and pending leave requests"></canvas></div></section>
    </div>
    <div class="leave-intelligence-grid"><div><h3>Why people request leave</h3>
      ${LEAVE_DRIVERS.map(d=>`<div class="leave-driver"><div><span>${d.label}</span><strong>${s.counts[d.id]}</strong></div><div class="leave-bar"><span style="width:${s.total?s.counts[d.id]/s.total*100:0}%"></span></div></div>`).join('')}
      <p class="card-subtitle">Leave mix: ${Object.entries(s.types).map(([t,n])=>`${leaveEscape(t)} (${n})`).join(' · ') || 'No data'}</p>
    </div><div><h3>What the evidence supports</h3>
      <div class="leave-signal"><strong>Workload & recovery</strong><p>${s.counts.recovery ? `${s.counts.recovery} requests explicitly identify workload or recovery. Explore workload with employees; this is not a burnout diagnosis.` : 'No workload driver disclosed. Burnout cannot be assessed from these records.'}</p></div>
      <div class="leave-signal"><strong>Workplace conditions</strong><p>${s.counts.environment ? `${s.counts.environment} requests explicitly identify workplace conditions. Ask what needs to change through a confidential channel.` : 'No workplace driver disclosed. Conditions remain unassessed; absence of reports does not establish a healthy environment.'}</p></div>
      <div class="leave-signal"><strong>Repeated requests</strong><p>${s.repeatPeople} employees have 3+ requests in this period. This is a scheduling pattern, not evidence of poor commitment or burnout.</p></div>
    </div></div>
    <h3>From signals to supportive action</h3>
    <div class="leave-action-grid">${['recovery','environment','family','planned'].map(id=>{const d=LEAVE_DRIVERS.find(d=>d.id===id);return `<div class="leave-action"><span class="tag tag-blue">${s.counts[id]?'Disclosed need':'Explore with feedback'}</span><h4>${d.hypothesis}</h4><p>${d.action}</p><small>Review after 30 days: anonymous feedback, coverage gaps and leave access.</small></div>`;}).join('')}</div>
    <div class="leave-ai-box"><div class="leave-analysis-header"><h3>AI action brief</h3><button class="btn-accent btn-sm" onclick="generateLeaveBrief(this)">✨ Generate action brief</button></div><p id="leaveAIBrief" aria-live="polite">Generate a plan from the totals above, or use the suggested actions now. Only aggregate counts are sent to AI.</p></div>
  </div>`;
}

function initLeaveCharts() {
  ['leaveTypeChart','leaveDriverChart','leaveTrendChart'].forEach(destroyChart);
  const period = document.getElementById('leaveAnalysisPeriod')?.value || 'all';
  const s = computeLeaveAnalysis(DATA.leaveRequests, period);
  if (typeof Chart === 'undefined') return;
  const colors = ['#2563eb','#14b8a6','#8b5cf6','#f59e0b','#ec4899','#06b6d4','#94a3b8'];
  const base = {responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#64748b',font:{family:'Inter',size:11}}}}};
  const type = document.getElementById('leaveTypeChart');
  if (type && s.total) charts.leaveTypeChart = new Chart(type,{type:'doughnut',data:{labels:Object.keys(s.types),datasets:[{data:Object.values(s.types),backgroundColor:colors,borderWidth:0}]},options:{...base,cutout:'72%',plugins:{...base.plugins,legend:{position:'bottom'}}}});
  const drivers = document.getElementById('leaveDriverChart');
  if (drivers && s.total) charts.leaveDriverChart = new Chart(drivers,{type:'bar',data:{labels:LEAVE_DRIVERS.map(d=>d.label),datasets:[{label:'Requests',data:LEAVE_DRIVERS.map(d=>s.counts[d.id]),backgroundColor:colors,borderRadius:6}]},options:{...base,indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{beginAtZero:true,ticks:{precision:0,color:'#64748b'},grid:{color:'rgba(148,163,184,.12)'}},y:{ticks:{color:'#64748b',font:{size:11}},grid:{display:false}}}}});
  const rows = DATA.leaveRequests.filter(r=>!['Rejected','Cancelled'].includes(r.status));
  const today = new Date();
  const valid = rows.map(r=>r.from).filter(d=>/^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  const end = period === '90' || !valid.length ? today : new Date(valid[valid.length-1]+'T00:00:00Z');
  const months = Array.from({length:period==='90'?3:6},(_,i)=>new Date(Date.UTC(end.getUTCFullYear(),end.getUTCMonth()-(period==='90'?2:5)+i,1)));
  const keys = months.map(d=>d.toISOString().slice(0,7));
  const trend = document.getElementById('leaveTrendChart');
  if (trend) charts.leaveTrendChart = new Chart(trend,{type:'bar',data:{labels:months.map(d=>d.toLocaleDateString('en',{month:'short',year:'2-digit',timeZone:'UTC'})),datasets:['Approved','Pending'].map((status,i)=>({label:status,data:keys.map(k=>rows.filter(r=>r.status===status && r.from.startsWith(k) && (period!=='90' || (new Date(r.from+'T00:00:00Z')<=today && new Date(r.from+'T00:00:00Z')>=new Date(today.getTime()-89*86400000)))).length),backgroundColor:i?'#f59e0b':'#14b8a6',borderRadius:5}))},options:{...base,plugins:{...base.plugins,legend:{position:'bottom'}},scales:{x:{stacked:true,grid:{display:false},ticks:{color:'#64748b'}},y:{stacked:true,beginAtZero:true,ticks:{precision:0,color:'#64748b'},grid:{color:'rgba(148,163,184,.12)'}}}}});
}


function updateLeaveAnalysis(period) {
  const panel = document.getElementById('leaveAnalysisPanel');
  if (panel) { panel.outerHTML = renderLeaveAnalysis(period); initLeaveCharts(); }
}

async function generateLeaveBrief(btn) {
  const period = document.getElementById('leaveAnalysisPeriod').value;
  const s = computeLeaveAnalysis(DATA.leaveRequests, period);
  const target = document.getElementById('leaveAIBrief');
  if (!s.total) { target.textContent = 'No leave records in this period. Gather optional anonymous feedback before forming a plan.'; return; }
  btn.disabled = true; btn.textContent = 'Preparing...';
  const summary = {period, requests:s.total, calendarDaysRequested:s.days, pending:s.pending,
    voluntaryDriverCounts:s.counts, leaveTypeCounts:s.types, reasonCoveragePercent:s.coverage};
  try {
    const text = await geminiDirect(`You are an HR workplace improvement assistant. Aggregate leave data: ${JSON.stringify(summary)}. In 3 short sentences give a 30-day supportive action plan, evidence limitations and a measurement to review. Counts are requests, not people or diagnoses. Never infer burnout, unhealthy workplace or misconduct from leave type, undisclosed reasons or frequency. A disclosed recovery/environment category is a reported need, not proof of causation. Do not recommend penalizing leave or collecting medical details. If no relevant reasons are disclosed say causes cannot be determined. Plain text only.`);
    if (document.getElementById('leaveAIBrief') === target) target.textContent = text || 'No AI text returned. Use the suggested actions above.';
  } catch (err) {
    if (document.getElementById('leaveAIBrief') === target) target.textContent = (err.message || 'Unable to generate the AI brief. Please retry.') + ' Local action plan: invite optional anonymous feedback, review team cover, and reassess after 30 days. Current leave records cannot establish causes.';
  } finally { btn.disabled = false; btn.textContent = '✨ Generate action brief'; }
}


let analyticsTab = 'leave';
const ANALYTICS_TABS = [
  ['leave', '🌿', 'Leave & Workplace Intelligence'],
  ['model', '📊', 'AI-Driven HR Effectiveness Model'],
  ['recommendations', '✨', 'AI Recommendations Engine']
];

function switchAnalyticsTab(id) {
  if (!ANALYTICS_TABS.some(t => t[0] === id)) return;
  analyticsTab = id;
  document.querySelectorAll('.analytics-subtab').forEach(btn => {
    const selected = btn.dataset.analyticsTab === id;
    btn.classList.toggle('active', selected);
    btn.setAttribute('aria-selected', String(selected));
  });
  document.querySelectorAll('.analytics-panel').forEach(panel => { panel.hidden = panel.id !== 'analytics-' + id; });
  initPageCharts('analytics');
}


function renderAnalytics() {
  return `
  <div class="analytics-subtabs" role="tablist" aria-label="AI analytics sections">
    ${ANALYTICS_TABS.map(([id,icon,label])=>`<button type="button" role="tab" id="analytics-tab-${id}" aria-controls="analytics-${id}" aria-selected="${analyticsTab===id}" class="analytics-subtab ${analyticsTab===id?'active':''}" data-analytics-tab="${id}" onclick="switchAnalyticsTab('${id}')"><span>${icon}</span>${label}</button>`).join('')}
  </div>
  <section class="analytics-panel" role="tabpanel" id="analytics-leave" aria-labelledby="analytics-tab-leave" ${analyticsTab==='leave'?'':'hidden'}>${renderLeaveAnalysis()}</section>
  <section class="analytics-panel" role="tabpanel" id="analytics-model" aria-labelledby="analytics-tab-model" ${analyticsTab==='model'?'':'hidden'}>
  <div class="card animate-in" style="margin-bottom:24px">
    <div class="card-header"><div class="card-title">🧠 AI-Driven HR Effectiveness Model</div><div class="card-subtitle">Based on TAM + HR Analytics Framework</div></div>
    <div class="model-flow">
      <div class="model-node"><div class="model-node-label">Digital Literacy</div><div class="model-node-sub">Input Factor</div></div>
      <div class="model-arrow">→</div>
      <div class="model-node"><div class="model-node-label">PEOU</div><div class="model-node-sub">Ease of Use</div></div>
      <div class="model-arrow">→</div>
      <div class="model-node"><div class="model-node-label">PU</div><div class="model-node-sub">Usefulness</div></div>
      <div class="model-arrow">→</div>
      <div class="model-node"><div class="model-node-label">Actual Use</div><div class="model-node-sub">System Usage</div></div>
      <div class="model-arrow">→</div>
      <div class="model-node" style="border-color:var(--accent)"><div class="model-node-label" style="color:var(--accent)">HR Effectiveness</div><div class="model-node-sub">Outcome</div></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:16px">
      <div style="padding:12px;background:rgba(26,86,219,0.05);border-radius:var(--radius-sm);font-size:13px;color:var(--text2)">
        <strong style="color:var(--primary)">ICT Infrastructure</strong> → Ease of Use (PEOU)<br>
        <strong style="color:var(--primary)">Security & Org. Support</strong> → Usefulness (PU)
      </div>
      <div style="padding:12px;background:rgba(245,158,11,0.05);border-radius:var(--radius-sm);font-size:13px;color:var(--text2)">
        <strong style="color:var(--accent)">Actual Use</strong> → HR Effectiveness<br>
        <strong style="color:var(--accent)">Usefulness</strong> → Actual Use
      </div>
    </div>
  </div>

  <div class="charts-grid">
    <div class="card animate-in" style="animation-delay:.1s">
      <div class="card-header"><div class="card-title">Model Factor Scores</div><div class="card-subtitle">Survey-based measurements</div></div>
      <div class="chart-container"><canvas id="modelFactorsChart"></canvas></div>
    </div>
    <div class="card animate-in" style="animation-delay:.15s">
      <div class="card-header"><div class="card-title">Predictive Turnover Risk</div><div class="card-subtitle">AI 90-day forecast</div></div>
      <div class="chart-container"><canvas id="predictiveTurnoverChart"></canvas></div>
    </div>
    <div class="card animate-in" style="animation-delay:.2s">
      <div class="card-header"><div class="card-title">Engagement vs Performance</div><div class="card-subtitle">Correlation scatter</div></div>
      <div class="chart-container"><canvas id="correlationChart"></canvas></div>
    </div>
    <div class="card animate-in" style="animation-delay:.25s">
      <div class="card-header"><div class="card-title">HR System Usage</div><div class="card-subtitle">Monthly active users</div></div>
      <div class="chart-container"><canvas id="usageChart"></canvas></div>
    </div>
  </div>

  <div class="ai-insights-grid">
    <div class="ai-insight animate-in" style="animation-delay:.3s">
      <div class="ai-insight-label">📊 PEOU Score</div>
      <div class="ai-insight-text" id="analytics-peou">⏳ Loading AI analysis...</div>
    </div>
    <div class="ai-insight animate-in" style="animation-delay:.35s">
      <div class="ai-insight-label">🎯 PU Score</div>
      <div class="ai-insight-text" id="analytics-pu">⏳ Loading AI analysis...</div>
    </div>
    <div class="ai-insight animate-in" style="animation-delay:.4s">
      <div class="ai-insight-label">✅ Actual Use</div>
      <div class="ai-insight-text" id="analytics-use">⏳ Loading AI analysis...</div>
    </div>
    <div class="ai-insight animate-in" style="animation-delay:.45s">
      <div class="ai-insight-label">🏆 HR Effectiveness</div>
      <div class="ai-insight-text" id="analytics-effectiveness">⏳ Loading AI analysis...</div>
    </div>
  </div>

  </section>
  <section class="analytics-panel" role="tabpanel" id="analytics-recommendations" aria-labelledby="analytics-tab-recommendations" ${analyticsTab==='recommendations'?'':'hidden'}>
  <div class="card animate-in" style="animation-delay:.5s">
    <div class="card-header">
      <div class="card-title">🤖 AI Recommendations Engine</div>
      <button class="btn-accent btn-sm" onclick="refreshRecommendations()">Refresh AI</button>
    </div>
    <div id="recommendationsGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px">
      ${generateRecommendations()}
    </div>
  </div></section>`;
}

function generateRecommendations() {
  const emps = DATA.employees;
  const fallbacks = {
    'Low':    e => `${e.name} is performing well at ${e.performance}%. Consider for mentorship or promotion opportunities.`,
    'Medium': e => `${e.name} shows medium risk. A 1-on-1 check-in and development plan is recommended.`,
    'High':   e => `${e.name} is high risk with ${e.engagement}% engagement. Immediate intervention and retention plan needed.`,
  };

  return emps.map((e) => `
    <div style="background:var(--surface2);border-radius:var(--radius);padding:16px;border-left:4px solid var(--primary)">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="font-size:20px">🧠</span>
        <div><div style="font-size:13px;font-weight:700">AI Recommendation</div><div style="font-size:11px;color:var(--text3)">${e.name}</div></div>
        <span class="tag tag-blue" style="margin-left:auto">${leaveEscape(e.dept)}</span>
      </div>
      <p style="font-size:13px;color:var(--text2);line-height:1.5">${(fallbacks[e.risk] || fallbacks['Medium'])(e)}</p>
      <button class="btn-primary btn-sm" style="margin-top:12px" onclick="getAIRecommendation(${e.id}, this)">✨ Get AI Insight</button>
    </div>`).join('');
}

function getAIRecommendation(empId) {
  const e = DATA.employees.find(emp => emp.id === empId);
  if (!e) return;
  showModal(`<div role="dialog" aria-modal="true" aria-labelledby="recommendationTitle">
    <div class="modal-header"><h3 class="modal-title" id="recommendationTitle">✨ AI Insight</h3><button class="modal-close" aria-label="Close AI insight" onclick="closeModal()">✕</button></div>
    <div class="recommendation-person"><strong>${leaveEscape(e.name)}</strong><span>${leaveEscape(e.role)} · ${leaveEscape(e.dept)}</span></div>
    <div class="recommendation-metrics"><div><strong>${e.performance}%</strong><span>Performance</span></div><div><strong>${e.engagement}%</strong><span>Engagement</span></div></div>
    <div class="recommendation-result" id="recommendationResult" role="status" aria-live="polite"><span class="tag tag-blue">Preparing AI insight</span><p>Reviewing the available performance and engagement scores...</p></div>
    <p class="recommendation-note">Use this suggestion to support a conversation with the employee. It is not an employment decision.</p>
    <div class="modal-actions"><button class="btn-secondary" onclick="closeModal()">Close</button><button class="btn-primary" onclick="getAIRecommendation(${e.id})">Try again</button></div>
  </div>`);
  const result = document.getElementById('recommendationResult');
  document.querySelector('#modalOverlay .modal-close')?.focus();
  const prompt = `HR coaching assistant: ${leaveEscape(e.role)}, KPI ${e.performance}%, Engagement ${e.engagement}%. Give one supportive actionable suggestion and one question for a check-in in 2-3 short sentences. Do not make promotion, termination or other employment decisions; do not diagnose health conditions. Plain text only.`;
  geminiDirect(prompt).then(text => {
    if (!result.isConnected) return;
    result.innerHTML = '<span class="tag tag-blue">AI suggestion</span><p></p>';
    result.querySelector('p').textContent = text || 'No recommendation was returned. Try again.';
  }).catch(() => {
    if (!result.isConnected) return;
    result.innerHTML = '<span class="tag tag-yellow">AI unavailable · local suggestion</span><p></p>';
    result.querySelector('p').textContent = e.engagement < 70
      ? 'Arrange a supportive check-in to understand workload, resources and team support. Ask what one change would improve the employee’s experience, and agree a follow-up date.'
      : 'Discuss development goals and resources at the next check-in. Ask what support would help the employee sustain their current progress.';
  });
}

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && document.getElementById('modalOverlay')) closeModal();
});

function refreshRecommendations() {
  const grid = document.getElementById('recommendationsGrid');
  if (!grid) return;
  grid.style.opacity = '0.5';
  setTimeout(() => { grid.innerHTML = generateRecommendations(); grid.style.opacity = '1'; }, 300);
}

/* ===== SELF SERVICE PAGE ===== */
function renderSelfService() {
  // Filter leave requests for the logged-in employee; admins/hr see all
  const myLeave = (currentUser.role === 'employee')
    ? DATA.leaveRequests.filter(l => l.emp === currentUser.name)
    : DATA.leaveRequests;

  // unused — table is rendered inline below with role-aware actions

  return `
  <div class="service-grid">
    ${[
      {icon:'🏖️',label:'Apply for Leave',action:"showLeaveForm()"},
      {icon:'👤',label:'Update Profile',action:"editMyProfile()"},
      {icon:'📄',label:'Hours & Earnings Statement',action:"showEarningsStatement()"},
      {icon:'📋',label:'My Requests',action:"showMyRequests()"},
      {icon:'🎓',label:'Training Catalog',action:"showTraining()"},
      {icon:'📊',label:'My Performance',action:"navigate('performance')"},
      {icon:'💬',label:'Submit Feedback',action:"showFeedback()"},
      {icon:'📞',label:'HR Contact',action:"showToast('HR contact: hr@university.edu')"},
    ].map(s=>`
      <div class="service-card animate-in" onclick="${s.action}">
        <span class="service-icon">${s.icon}</span>
        <div class="service-label">${s.label}</div>
      </div>`).join('')}
  </div>

  <div class="card animate-in" style="animation-delay:.2s">
    <div class="card-header">
      <div>
        <div class="card-title">${currentUser.role === 'employee' ? 'My Leave Requests' : 'All Leave Requests'}</div>
        <div class="card-subtitle">${myLeave.length} request${myLeave.length !== 1 ? 's' : ''} · ${myLeave.filter(l=>l.status==='Pending').length} pending</div>
      </div>
      <button class="btn-primary btn-sm" onclick="showLeaveForm()">+ New Request</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr>${currentUser.role !== 'employee' ? '<th>Employee</th>' : ''}<th>Type</th><th>From</th><th>To</th><th>Days</th><th>Status</th><th>Action</th></tr></thead>
        <tbody>
          ${myLeave.length
            ? myLeave.map(l => {
                const statusTag = `<span class="tag ${l.status==='Approved'?'tag-green':l.status==='Rejected'||l.status==='Cancelled'?'tag-red':'tag-yellow'}">${l.status}</span>`;
                let actions = '—';
                if (l.status === 'Pending') {
                  if (currentUser.role === 'admin' || currentUser.role === 'hr') {
                    actions = `
                      <div style="display:flex;gap:6px">
                        <button class="btn-primary btn-sm" onclick="approveLeave(${l.id})">✓ Approve</button>
                        <button class="btn-danger btn-sm" onclick="rejectLeave(${l.id})">✕ Reject</button>
                      </div>`;
                  } else {
                    actions = `<button class="btn-danger btn-sm" onclick="cancelLeave(${l.id})">Cancel</button>`;
                  }
                }
                return `<tr>
                  ${currentUser.role !== 'employee' ? `<td><strong>${l.emp}</strong></td>` : ''}
                  <td>${l.type}</td>
                  <td>${l.from}</td><td>${l.to}</td><td>${l.days}</td>
                  <td>${statusTag}</td>
                  <td>${actions}</td>
                </tr>`;
              }).join('')
            : `<tr><td colspan="${currentUser.role !== 'employee' ? 7 : 6}" style="text-align:center;color:var(--text3);padding:24px">No leave requests found.</td></tr>`}
        </tbody>
      </table>
    </div>
  </div>`;
}

function cancelLeave(id) {
  const req = DATA.leaveRequests.find(l=>l.id===id);
  if(req) { req.status = 'Cancelled'; navigate('selfservice'); showToast('Leave request cancelled.'); }
}

function approveLeave(id) {
  const req = DATA.leaveRequests.find(l=>l.id===id);
  if(!req) return;
  req.status = 'Approved';
  navigate('selfservice');
  showToast(`✓ Leave approved for ${req.emp}`);
}

function rejectLeave(id) {
  const req = DATA.leaveRequests.find(l=>l.id===id);
  if(!req) return;
  showModal(`
    <div class="modal-header"><h3 class="modal-title">Reject Leave Request</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div style="margin-bottom:20px">
      <p style="font-size:14px;color:var(--text2);margin-bottom:16px">Rejecting <strong>${req.type}</strong> for <strong>${req.emp}</strong> (${req.from} → ${req.to}, ${req.days} days).</p>
      <div class="form-group modal-form">
        <label>Reason for Rejection</label>
        <textarea id="rejectReason" placeholder="Provide a reason (optional)..." style="width:100%;padding:10px 14px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-size:14px;min-height:80px;resize:vertical;outline:none;"></textarea>
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn-danger" onclick="confirmReject(${id})">✕ Confirm Rejection</button>
    </div>
  `);
}

function confirmReject(id) {
  const req = DATA.leaveRequests.find(l=>l.id===id);
  if(!req) return;
  req.status = 'Rejected';
  closeModal();
  navigate('selfservice');
  showToast(`Leave request rejected for ${req.emp}`, 'error');
}

function showLeaveForm() {
  showModal(`
    <div class="modal-header"><h3 class="modal-title">Apply for Leave</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="modal-form">
      <div class="form-group"><label>Leave Type</label><select id="leaveType"><option>Annual Leave</option><option>Sick Leave</option><option>Study Leave</option><option>Maternity/Paternity</option><option>Emergency Leave</option></select></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div class="form-group"><label>From Date</label><input type="date" id="leaveFrom"/></div>
        <div class="form-group"><label>To Date</label><input type="date" id="leaveTo"/></div>
      </div>
      <div class="form-group"><label>Reason (optional)</label><textarea id="leaveReason" placeholder="Share only what you are comfortable sharing; avoid medical details."></textarea></div><div class="form-group"><label>What would support you? (optional)</label><select id="leaveDriver"><option value="undisclosed">Prefer not to say</option value="recovery">Workload or recovery time</option><option value="environment">Workplace conditions</option><option value="health">Health or wellbeing</option><option value="family">Family or caring commitments</option><option value="development">Study or development</option><option value="planned">Planned rest or personal time</option></select><small>Used in aggregate workplace analysis. This does not affect approval.</small></div>
    </div>
    <div class="modal-actions"><button class="btn-secondary" onclick="closeModal()">Cancel</button><button class="btn-primary" onclick="submitLeave()">Submit Request</button></div>
  `);
}

function submitLeave() {
  const type   = document.getElementById('leaveType').value;
  const from   = document.getElementById('leaveFrom').value;
  const to     = document.getElementById('leaveTo').value;
  if (!from || !to) { showToast('Please select both dates.', 'error'); return; }
  const d1 = new Date(from), d2 = new Date(to);
  if (d2 < d1) { showToast('End date must be after start date.', 'error'); return; }
  const days = Math.round((d2 - d1) / (1000*60*60*24)) + 1;
  const newId = DATA.leaveRequests.length ? Math.max(...DATA.leaveRequests.map(l=>l.id)) + 1 : 1;
  const reason = document.getElementById('leaveReason').value.trim();
  const driver = document.getElementById('leaveDriver').value;
  DATA.leaveRequests.push({ id: newId, emp: currentUser.name, type, from, to, days, reason, driver, status: 'Pending' });
  closeModal();
  navigate('selfservice');
  showToast('Leave request submitted successfully!');
}

function showMyRequests() {
  const myLeave = (currentUser.role === 'employee')
    ? DATA.leaveRequests.filter(l => l.emp === currentUser.name)
    : DATA.leaveRequests;
  showModal(`
    <div class="modal-header"><h3 class="modal-title">My Requests</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    ${myLeave.length
      ? myLeave.map(l=>`
          <div style="display:flex;align-items:center;justify-content:space-between;padding:14px;background:var(--surface2);border-radius:var(--radius-sm);margin-bottom:8px">
            <div><div style="font-weight:600">${l.type}</div><div style="font-size:12px;color:var(--text2)">${l.from} → ${l.to} (${l.days} days)</div></div>
            <span class="tag ${l.status==='Approved'?'tag-green':l.status==='Cancelled'?'tag-red':'tag-yellow'}">${l.status}</span>
          </div>`).join('')
      : `<div style="text-align:center;padding:32px;color:var(--text3)">No requests found.</div>`}
    <div class="modal-actions"><button class="btn-primary" onclick="closeModal()">Close</button></div>
  `);
}

function showTraining() {
  showModal(`
    <div class="modal-header"><h3 class="modal-title">Training Catalog</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    ${[
      {name:'Digital Skills Bootcamp',dur:'3 days',type:'Mandatory',status:'Available'},
      {name:'Leadership Development',dur:'2 weeks',type:'Optional',status:'Available'},
      {name:'Research Methodology',dur:'1 week',type:'Optional',status:'Enrolled'},
      {name:'Data Privacy & Security',dur:'1 day',type:'Mandatory',status:'Completed'},
    ].map(t=>`
      <div style="display:flex;align-items:center;justify-content:space-between;padding:14px;background:var(--surface2);border-radius:var(--radius-sm);margin-bottom:8px">
        <div><div style="font-weight:600">${t.name}</div><div style="font-size:12px;color:var(--text2)">${t.dur} · <span class="tag ${t.type==='Mandatory'?'tag-red':'tag-blue'}">${t.type}</span></div></div>
        <span class="tag ${t.status==='Completed'?'tag-green':t.status==='Enrolled'?'tag-yellow':'tag-gray'}">${t.status}</span>
      </div>`).join('')}
    <div class="modal-actions"><button class="btn-secondary" onclick="closeModal()">Close</button></div>
  `);
}

function showFeedback() {
  showModal(`
    <div class="modal-header"><h3 class="modal-title">Submit Feedback</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="modal-form">
      <div class="form-group"><label>Category</label><select><option>Work Environment</option><option>Management</option><option>HR Services</option><option>System Feedback</option><option>Other</option></select></div>
      <div class="form-group"><label>Feedback</label><textarea placeholder="Share your thoughts..." style="min-height:120px"></textarea></div>
      <div class="form-group"><label>Anonymous?</label><select><option>Yes, keep anonymous</option><option>No, include my name</option></select></div>
    </div>
    <div class="modal-actions"><button class="btn-secondary" onclick="closeModal()">Cancel</button><button class="btn-primary" onclick="closeModal();showToast('Feedback submitted anonymously!')">Submit</button></div>
  `);
}

/* ===== CHART INITIALIZATION ===== */
const CHART_COLORS = {
  blue: '#1a56db', blueLight: '#3b82f6', blueFade: 'rgba(26,86,219,0.15)',
  yellow: '#f59e0b', yellowFade: 'rgba(245,158,11,0.15)',
  green: '#10b981', greenFade: 'rgba(16,185,129,0.15)',
  red: '#ef4444', redFade: 'rgba(239,68,68,0.15)',
  purple: '#8b5cf6', purpleFade: 'rgba(139,92,246,0.15)',
};

const months = ['Oct','Nov','Dec','Jan','Feb','Mar'];

function chartDefaults() {
  return {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { labels: { color: getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#1e293b', font: { family: 'Inter', size: 12 } } } },
    scales: {
      x: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { color: '#64748b', font: { family: 'Inter' } } },
      y: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { color: '#64748b', font: { family: 'Inter' } } }
    }
  };
}

function destroyChart(id) { if(charts[id]) { charts[id].destroy(); delete charts[id]; } }

function initPageCharts(page) {
  if (page === 'analytics' && analyticsTab === 'leave') initLeaveCharts();
  if(page === 'dashboard') {
    destroyChart('engagementChart'); destroyChart('sentimentPieChart'); destroyChart('turnoverChart'); destroyChart('effectivenessChart');

    // Load Gemini AI insights for dashboard — non-blocking, static fallback shown immediately
    if (currentUser.role !== 'employee') {
      const s = computeStats();
      const topRisk = DATA.turnoverRisk.reduce((a,b) => b.risk > a.risk ? b : a, DATA.turnoverRisk[0]);
      const latest = DATA.surveys.length ? DATA.surveys[DATA.surveys.length-1] : null;

      const p = document.getElementById('dash-ai-prediction');
      if(p) p.innerHTML = topRisk ? `<strong>${topRisk.dept}</strong> shows the highest turnover risk at <strong>${topRisk.risk}%</strong>. Recommend immediate engagement intervention.` : 'No turnover risk data has been recorded.';
      const s2 = document.getElementById('dash-ai-sentiment');
      if(s2) s2.innerHTML = latest ? `Latest survey: <strong>${latest.positive}% positive</strong>, ${latest.neutral}% neutral, ${latest.negative}% negative.` : 'No survey data available yet.';
      const rec = document.getElementById('dash-ai-recommendation');
      if(rec) rec.innerHTML = s.promotionCandidates > 0
        ? `<strong>${s.promotionCandidates}</strong> employee${s.promotionCandidates>1?'s are':' is'} eligible for promotion. Top candidate: <strong>${s.topCandidate?.name}</strong> (${s.topCandidate?.performance}%).`
        : 'No employees currently meet the promotion threshold. Continue monitoring KPI trends.';
    }
    const engCtx = document.getElementById('engagementChart');
    if(engCtx) charts.engagementChart = new Chart(engCtx, {
      type:'line', data:{
        labels: DATA.surveys.map(s=>s.month),
        datasets:[
          {label:'Positive Sentiment',data:DATA.surveys.map(s=>s.positive),borderColor:CHART_COLORS.blue,backgroundColor:CHART_COLORS.blueFade,fill:true,tension:.4,pointBackgroundColor:CHART_COLORS.blue,pointRadius:5},
          {label:'Negative Sentiment',data:DATA.surveys.map(s=>s.negative),borderColor:CHART_COLORS.red,backgroundColor:CHART_COLORS.redFade,fill:true,tension:.4,pointBackgroundColor:CHART_COLORS.red,pointRadius:5}
        ]
      }, options:{...chartDefaults(),plugins:{...chartDefaults().plugins,legend:{display:true,labels:{color:'#64748b',font:{family:'Inter',size:12}}}}}
    });

    const pieCtx = document.getElementById('sentimentPieChart');
    if(pieCtx) {
      const latest = DATA.surveys.length ? DATA.surveys[DATA.surveys.length-1] : {positive:0,neutral:0,negative:0};
      charts.sentimentPieChart = new Chart(pieCtx, {
        type:'doughnut', data:{
          labels:['Positive','Neutral','Negative'],
          datasets:[{data:[latest.positive,latest.neutral,latest.negative],backgroundColor:[CHART_COLORS.green,CHART_COLORS.yellow,CHART_COLORS.red],borderWidth:0,hoverOffset:8}]
        }, options:{responsive:true,maintainAspectRatio:false,cutout:'65%',plugins:{legend:{position:'bottom',labels:{color:'#64748b',font:{family:'Inter',size:12},padding:16}}}}
      });
    }

    const turnCtx = document.getElementById('turnoverChart');
    if(turnCtx) charts.turnoverChart = new Chart(turnCtx, {
      type:'bar', data:{
        labels: DATA.turnoverRisk.map(d=>d.dept),
        datasets:[{label:'Turnover Risk %',data:DATA.turnoverRisk.map(d=>d.risk),backgroundColor:DATA.turnoverRisk.map(d=>d.risk>25?CHART_COLORS.red:d.risk>15?CHART_COLORS.yellow:CHART_COLORS.green),borderRadius:6}]
      }, options:{...chartDefaults(),plugins:{legend:{display:false}}}
    });

    const effCtx = document.getElementById('effectivenessChart');
    if(effCtx) charts.effectivenessChart = new Chart(effCtx, {
      type:'radar', data:{
        labels:['Digital Literacy','ICT Infrastructure','Security','PEOU','PU','Actual Use','HR Effectiveness'],
        datasets:[{label:'Current Score',data:[78,82,88,84,90,87,82],backgroundColor:'rgba(26,86,219,0.15)',borderColor:CHART_COLORS.blue,pointBackgroundColor:CHART_COLORS.blue,pointRadius:4},{label:'Target',data:[85,90,95,90,95,92,90],backgroundColor:'rgba(245,158,11,0.1)',borderColor:CHART_COLORS.yellow,pointBackgroundColor:CHART_COLORS.yellow,pointRadius:4}]
      }, options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#64748b',font:{family:'Inter',size:12}}}},scales:{r:{grid:{color:'rgba(0,0,0,0.08)'},ticks:{color:'#94a3b8',font:{size:10}},pointLabels:{color:'#64748b',font:{size:11}}}}}
    });
  }

  if(page === 'performance') {
    destroyChart('perfTrendChart'); destroyChart('deptPerfChart');
    const ptCtx = document.getElementById('perfTrendChart');
    if(ptCtx) charts.perfTrendChart = new Chart(ptCtx, {
      type:'line', data:{
        labels: DATA.performance.map(p=>p.month),
        datasets:[{label:'Avg Performance',data:DATA.performance.map(p=>p.avg),borderColor:CHART_COLORS.blue,backgroundColor:CHART_COLORS.blueFade,fill:true,tension:.4,pointBackgroundColor:CHART_COLORS.blue,pointRadius:5}]
      }, options:chartDefaults()
    });
    const dpCtx = document.getElementById('deptPerfChart');
    if(dpCtx) {
      const deptLabels = JSON.parse(dpCtx.dataset.labels || '[]');
      const deptScores = JSON.parse(dpCtx.dataset.scores || '[]');
      const barColors = [CHART_COLORS.blue,CHART_COLORS.blueLight,CHART_COLORS.yellow,CHART_COLORS.green,CHART_COLORS.purple,CHART_COLORS.red];
      charts.deptPerfChart = new Chart(dpCtx, {
        type:'bar', data:{
          labels: deptLabels,
          datasets:[{label:'Performance Score',data:deptScores,backgroundColor:deptLabels.map((_,i)=>barColors[i%barColors.length]),borderRadius:8}]
        }, options:{...chartDefaults(),plugins:{legend:{display:false}}}
      });
    }
  }

  if(page === 'engagement') {
    destroyChart('sentimentTrendChart'); destroyChart('engDeptChart');
    const stCtx = document.getElementById('sentimentTrendChart');
    if(stCtx) charts.sentimentTrendChart = new Chart(stCtx, {
      type:'bar', data:{
        labels: months,
        datasets:[
          {label:'Positive',data:DATA.surveys.map(s=>s.positive),backgroundColor:CHART_COLORS.green,borderRadius:4,stack:'s'},
          {label:'Neutral',data:DATA.surveys.map(s=>s.neutral),backgroundColor:CHART_COLORS.yellow,borderRadius:4,stack:'s'},
          {label:'Negative',data:DATA.surveys.map(s=>s.negative),backgroundColor:CHART_COLORS.red,borderRadius:4,stack:'s'},
        ]
      }, options:{...chartDefaults(),scales:{x:{stacked:true,grid:{display:false},ticks:{color:'#64748b'}},y:{stacked:true,grid:{color:'rgba(0,0,0,0.05)'},ticks:{color:'#64748b'}}}}
    });
    const edCtx = document.getElementById('engDeptChart');
    if(edCtx) {
      const deptEngLabels = JSON.parse(edCtx.dataset.labels || '[]');
      const deptEngScores = JSON.parse(edCtx.dataset.scores || '[]');
      charts.engDeptChart = new Chart(edCtx, {
        type:'polarArea', data:{
          labels: deptEngLabels,
          datasets:[{data:deptEngScores,backgroundColor:['rgba(26,86,219,0.7)','rgba(59,130,246,0.7)','rgba(245,158,11,0.7)','rgba(16,185,129,0.7)','rgba(139,92,246,0.7)','rgba(239,68,68,0.7)']}]
        }, options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'right',labels:{color:'#64748b',font:{family:'Inter',size:11}}}}}
      });
    }

    // Sentiment summaries — static, no API call on page load
    if (DATA.surveys.length) {
      const latest = DATA.surveys[DATA.surveys.length - 1];
      const fallback = latest.positive >= 70
        ? `Morale is strong at <strong>${latest.positive}% positive</strong>. Keep up current engagement practices.`
        : `Positive sentiment at <strong>${latest.positive}%</strong> — below 70% target. Recommend pulse check and targeted interventions.`;
      ['emp-sentiment-summary','hr-sentiment-summary'].forEach(id => {
        const el = document.getElementById(id); if(el) el.innerHTML = fallback;
      });
    }
  }

  if(page === 'analytics' && analyticsTab === 'model') {
    destroyChart('modelFactorsChart'); destroyChart('predictiveTurnoverChart'); destroyChart('correlationChart'); destroyChart('usageChart');
    const mfCtx = document.getElementById('modelFactorsChart');
    if(mfCtx) charts.modelFactorsChart = new Chart(mfCtx, {
      type:'bar', data:{
        labels:['Digital Literacy','ICT Infra','Security','PEOU','PU','Actual Use','HR Effect.'],
        datasets:[{label:'Score (/100)',data:[78,82,88,84,90,87,82],backgroundColor:['rgba(26,86,219,0.8)','rgba(59,130,246,0.8)','rgba(16,185,129,0.8)','rgba(245,158,11,0.8)','rgba(139,92,246,0.8)','rgba(239,68,68,0.8)','rgba(26,86,219,0.9)'],borderRadius:8}]
      }, options:{...chartDefaults(),plugins:{legend:{display:false}}}
    });
    const ptCtx2 = document.getElementById('predictiveTurnoverChart');
    if(ptCtx2) {
      // Build forecast lines from top-3 risk departments
      const sorted = [...DATA.turnoverRisk].sort((a,b)=>b.risk-a.risk).slice(0,3);
      const forecastMonths = ['Apr','May','Jun','Jul','Aug','Sep'];
      const forecastColors = [CHART_COLORS.red, CHART_COLORS.yellow, CHART_COLORS.blue];
      charts.predictiveTurnoverChart = new Chart(ptCtx2, {
        type:'line', data:{
          labels: forecastMonths,
          datasets: sorted.map((d,i)=>({
            label: d.dept,
            data: forecastMonths.map((_,m) => Math.max(0, Math.round(d.risk + (Math.sin(m+i)*3)))),
            borderColor: forecastColors[i], tension:.4, pointRadius:4
          }))
        }, options:chartDefaults()
      });
    }
    const ccCtx = document.getElementById('correlationChart');
    if(ccCtx) charts.correlationChart = new Chart(ccCtx, {
      type:'scatter', data:{
        datasets:[{
          label:'Employees',
          data: DATA.employees.map(e=>({x:e.engagement, y:e.performance, label:e.name})),
          backgroundColor: DATA.employees.map(e => e.risk==='High' ? CHART_COLORS.red : e.risk==='Medium' ? CHART_COLORS.yellow : CHART_COLORS.blue),
          pointRadius:8, pointHoverRadius:10
        }]
      }, options:{...chartDefaults(),
        plugins:{...chartDefaults().plugins,
          tooltip:{callbacks:{label:p=>`${p.raw.label}: Eng ${p.raw.x}% / Perf ${p.raw.y}%`}}
        },
        scales:{
          x:{title:{display:true,text:'Engagement Score',color:'#64748b'},grid:{color:'rgba(0,0,0,0.05)'},ticks:{color:'#64748b'}},
          y:{title:{display:true,text:'Performance Score',color:'#64748b'},grid:{color:'rgba(0,0,0,0.05)'},ticks:{color:'#64748b'}}
        }
      }
    });
    const ucCtx = document.getElementById('usageChart');
    if(ucCtx) charts.usageChart = new Chart(ucCtx, {
      type:'line', data:{
        labels: months,
        datasets:[{label:'Active Users',data:[145,162,158,178,189,215],borderColor:CHART_COLORS.purple,backgroundColor:'rgba(139,92,246,0.1)',fill:true,tension:.4,pointBackgroundColor:CHART_COLORS.purple,pointRadius:5}]
      }, options:chartDefaults()
    });

    // Analytics insights — static, no API call on page load
    const ids = {'analytics-peou': `Perceived Ease of Use: <strong>84/100</strong>. Digital literacy training has significantly improved staff adoption of the HR system.`,
      'analytics-pu': `Perceived Usefulness: <strong>90/100</strong>. HR staff report the system greatly improves decision-making quality and reduces admin burden.`,
      'analytics-use': `System adoption rate: <strong>87%</strong> of eligible staff actively using the platform daily.`,
      'analytics-effectiveness': `Overall HR effectiveness index: <strong>82/100</strong>. Recruitment time reduced by 40%, onboarding satisfaction up 28%.`};
    Object.entries(ids).forEach(([id, text]) => { const el = document.getElementById(id); if(el) el.innerHTML = text; });
  }
}

/* ===== MODAL SYSTEM ===== */
function showModal(html) {
  closeModal();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'modalOverlay';
  overlay.innerHTML = `<div class="modal">${html}</div>`;
  overlay.addEventListener('click', e => { if(e.target === overlay) closeModal(); });
  document.body.appendChild(overlay);
}

function closeModal() {
  const m = document.getElementById('modalOverlay');
  if(m) m.remove();
}

/* ===== TOAST NOTIFICATIONS ===== */
function showToast(msg, type='success') {
  const existing = document.getElementById('toastContainer');
  if(!existing) {
    const tc = document.createElement('div');
    tc.id = 'toastContainer';
    tc.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:500;display:flex;flex-direction:column;gap:8px;align-items:center;';
    document.body.appendChild(tc);
  }
  const toast = document.createElement('div');
  const colors = {success:'#10b981',error:'#ef4444',info:'#1a56db',warning:'#f59e0b'};
  toast.style.cssText = `background:${colors[type]||colors.success};color:#fff;padding:12px 24px;border-radius:24px;font-size:14px;font-weight:600;box-shadow:0 8px 24px rgba(0,0,0,0.2);animation:fadeIn .3s ease;white-space:nowrap;`;
  toast.textContent = msg;
  document.getElementById('toastContainer').appendChild(toast);
  setTimeout(() => { toast.style.animation='fadeIn .3s ease reverse'; setTimeout(()=>toast.remove(),300); }, 3000);
}

/* ===== CHATBOT ===== */

const _chatFallbacks = [
  { match: ['leave','vacation','annual','sick','off'],
    reply: `To apply for leave, go to <strong>Self-Service → Apply for Leave</strong>. You can request Annual, Sick, Study, or Emergency leave. Requests are reviewed within 2 business days. You can track status under "My Requests".` },
  { match: ['performance','kpi','review','score','appraisal'],
    reply: `Performance reviews are conducted quarterly. Your KPI scores are tracked in real-time — visit <strong>Performance Management</strong> to view your scores and review history. Reviews above 80% are marked Completed.` },
  { match: ['onboard','onboarding','new','joining','start'],
    reply: `Our onboarding process covers: Documentation → IT Setup → HR Orientation → Department Induction → Training. It typically takes 2–4 weeks. Track progress under the <strong>Onboarding</strong> module.` },
  { match: ['salary','pay','payslip','payroll','compensation','wage'],
    reply: `For salary or payslip enquiries, go to <strong>Self-Service → View Payslip</strong> or contact HR directly at <strong>hr@university.edu</strong>. Payslips are generated on the last working day of each month.` },
  { match: ['train','course','learning','development','program'],
    reply: `Browse available training programs under <strong>Self-Service → Training Catalog</strong>. Mandatory trainings must be completed within 30 days of enrollment. Contact HR to enroll in leadership or specialist programs.` },
  { match: ['policy','policies','rule','regulation','conduct','code'],
    reply: `Key HR policies include: Leave Policy, Code of Conduct, Remote Work Policy, and Performance Management Guidelines. All policies are available in the document library. Contact HR for clarification.` },
  { match: ['recruit','hiring','job','vacancy','applicant','position'],
    reply: `Open positions are listed under the <strong>Recruitment</strong> module. HR manages job postings, applicant screening, and shortlisting. Contact hr@university.edu to discuss hiring needs.` },
  { match: ['engagement','survey','feedback','pulse','sentiment'],
    reply: `Pulse surveys are sent monthly to all staff. You can submit your response under <strong>Surveys & Feedback</strong>. Your feedback is anonymous and helps HR improve workplace conditions.` },
  { match: ['contact','hr','email','reach','help','support'],
    reply: `You can reach the HR team at <strong>hr@university.edu</strong>. For urgent matters, visit the HR office directly. Self-service requests can be submitted through the <strong>Self-Service Portal</strong>.` },
];

function _chatLocalReply(msg) {
  const lower = msg.toLowerCase();
  for (const fb of _chatFallbacks) {
    if (fb.match.some(k => lower.includes(k))) return fb.reply;
  }
  return `I can help with: <strong>leave, performance, onboarding, payroll, training, HR policies, recruitment,</strong> and <strong>engagement surveys</strong>. What would you like to know?`;
}

function toggleChat() {
  document.getElementById('chatbot').classList.toggle('hidden');
}

function sendChat() {
  const input = document.getElementById('chatInput');
  const msg = input.value.trim();
  if (!msg) return;
  addChatMsg(msg, 'user');
  input.value = '';

  const typingId = 'typing-' + Date.now();
  const msgs = document.getElementById('chatMessages');
  const typing = document.createElement('div');
  typing.className = 'chat-msg bot';
  typing.id = typingId;
  typing.innerHTML = `<div class="msg-bubble" style="color:var(--text3)">⏳ Thinking...</div>`;
  msgs.appendChild(typing);
  msgs.scrollTop = msgs.scrollHeight;

  const empContext = currentUser.role === 'employee'
    ? `The user is ${currentUser.name}, an employee at the university.`
    : `The user is ${currentUser.name}, a ${currentUser.role} at the university.`;

  const prompt = `You are an HR Assistant chatbot for HRImara, an AI-powered HR platform for a public university. ${empContext} Answer this HR question concisely (2-3 sentences): "${msg}". Only answer HR topics: leave, performance, onboarding, payroll, training, policies, recruitment.`;

  geminiDirect(prompt).then(text => {
    const el = document.getElementById(typingId);
    if (el) { el.innerHTML = `<div class="msg-bubble">${text || _chatLocalReply(msg)}</div>`; msgs.scrollTop = msgs.scrollHeight; }
  }).catch(() => {
    // Gemini unavailable — use smart local fallback so user always gets a useful answer
    const el = document.getElementById(typingId);
    if (el) { el.innerHTML = `<div class="msg-bubble">${_chatLocalReply(msg)}</div>`; msgs.scrollTop = msgs.scrollHeight; }
  });
}

function addChatMsg(text, type) {
  const msgs = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = `chat-msg ${type}`;
  div.innerHTML = `<div class="msg-bubble">${text}</div>`;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

/* ===== UTILITY ===== */
function filterEmployees(dept) {
  showToast(dept ? `Filtered by ${dept}` : 'Showing all departments', 'info');
}

/* ===== INIT ===== */
document.addEventListener('DOMContentLoaded', () => {
  // Tab switching
  document.addEventListener('click', e => {
    if(e.target.classList.contains('tab')) {
      const tabs = e.target.closest('.tabs');
      if(tabs) { tabs.querySelectorAll('.tab').forEach(t=>t.classList.remove('active')); e.target.classList.add('active'); }
    }
  });
  // Close notifications on outside click
  document.addEventListener('click', e => {
    const panel = document.getElementById('notifPanel');
    if(panel && !panel.classList.contains('hidden') && !panel.contains(e.target) && !e.target.closest('.notif-btn')) {
      panel.classList.add('hidden');
    }
  });
});
