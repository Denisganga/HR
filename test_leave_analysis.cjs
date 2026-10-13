const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');
const context = vm.createContext({document:{addEventListener(){}},console,setTimeout});
vm.runInContext(fs.readFileSync('hr-app/app.js','utf8'),context);
const analyze = (rows, period='all') => context.computeLeaveAnalysis(rows,period,new Date('2026-10-12T12:00:00Z'));
let result = analyze([]);
assert.equal(result.total,0); assert.equal(result.coverage,0);
const rows = [
 {emp:'A',type:'Sick Leave',from:'2026-10-10',to:'2026-10-12',status:'Pending'},
 {emp:'A',type:'Annual Leave',from:'2026-10-01',to:'2026-10-01',status:'Approved',driver:'recovery'},
 {emp:'A',type:'Study Leave',from:'2026-09-01',to:'2026-09-02',status:'Approved',driver:'development'},
 {emp:'B',type:'Annual Leave',from:'2026-10-01',to:'2026-10-02',status:'Rejected',driver:'environment'},
 {emp:'C',type:'Annual Leave',from:'2026-01-01',to:'2026-01-02',status:'Approved',driver:'unknown'}
];
result=analyze(rows,'90');
assert.equal(result.total,3); assert.equal(result.days,6);assert.equal(result.coverage,67);
assert.equal(result.counts.undisclosed,1);assert.equal(result.counts.environment,0);
assert.equal(result.counts.health,0);assert.equal(result.repeatPeople,1);
result=analyze(rows);assert.equal(result.total,4);assert.equal(result.counts.undisclosed,2);
result=analyze([{emp:'A',type:'Annual Leave',from:'2026-10-11',to:'2026-10-15',status:'Approved'}],'90');
assert.equal(result.days,2);
const html=context.renderLeaveAnalysis();
assert.ok(html.includes('Leave & Workplace Intelligence'));
assert.ok(html.includes('Burnout cannot be assessed'));
assert.equal(context.leaveEscape('<img onerror="x">'),'&lt;img onerror=&quot;x&quot;&gt;');
assert.ok(vm.runInContext('renderAnalytics()',context).includes('leaveAnalysisPanel'));
console.log('Leave analysis checks passed: dates, statuses, categories, evidence coverage, repeats, escaping, integration.');
