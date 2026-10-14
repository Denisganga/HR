const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const context=vm.createContext({document:{addEventListener(){}},window:{},console,setTimeout});
vm.runInContext(fs.readFileSync('hr-app/app.js','utf8'),context);
vm.runInContext(fs.readFileSync('hr-app/lifecycle.js','utf8'),context);
const seed=JSON.parse(fs.readFileSync('hr-app/server_seed.json','utf8'));
const state={...seed,settings:{name:'Test Organisation',sector:'Restaurant',features:['recruitment','onboarding','performance','engagement','analytics','growth','attendance','exits'],promotionThreshold:100},users:seed.users.map(({hash,salt,...u})=>u),logs:[],certificates:[],shifts:[],exits:[],tests:[],verifications:[],registrars:[]};
context.testState=state;
vm.runInContext('applyWork(testState); currentUser={name:"Peter Kamau",email:"admin@university.edu",role:"admin"}',context);
for(const fn of ['renderRecruitment','renderAdministration','renderAudit','renderGrowth','renderAttendance','renderExits']){
 const html=vm.runInContext(fn+'()',context);assert.ok(html.includes('card'),fn);assert.ok(!html.includes('undefined'),fn);assert.ok(!html.includes('TestPassword'),fn);
}
assert.ok(vm.runInContext('renderRecruitment()',context).includes('/careers'));
assert.ok(vm.runInContext('renderAdministration()',context).includes('Configure pay arrangement'));
assert.ok(!fs.readFileSync('hr-app/app.js','utf8').includes('const USERS'));
console.log('Lifecycle UI rendering checks passed for recruitment, administration, audit, growth, attendance and exits.');
