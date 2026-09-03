'use strict';

var AppState = {
  user: null,
  view: 'dashboard',
  courses: [],
  lessons: [],
  adminData: null,
  selectedCourse: null,
  selectedLesson: null,
  recapData: null,
  recapTab: 'course',
  analyticsData: null
};

var courseModal, lessonModal, signupModal, profileModal;
var bootstrapReady = false;
var LMS_CLASSES = ['10-A','10-B','10-C','10-D','10-E','10-F','10-G','11-A','11-B','11-C','11-D'];

function populateClassSelects(){
  var ids = ['signupKelas','profileKelas'];
  for(var i=0;i<ids.length;i++){
    var el=document.getElementById(ids[i]);
    if(!el) continue;
    var current=el.value;
    var html='<option value="">Pilih Kelas...</option>';
    for(var j=0;j<LMS_CLASSES.length;j++) html+='<option value="'+escAttr(LMS_CLASSES[j])+'">'+esc(LMS_CLASSES[j])+'</option>';
    el.innerHTML=html;
    if(current) el.value=current;
  }
}

document.addEventListener('DOMContentLoaded', function(){
  courseModal = new bootstrap.Modal(document.getElementById('courseModal'));
  lessonModal = new bootstrap.Modal(document.getElementById('lessonModal'));
  signupModal = new bootstrap.Modal(document.getElementById('signupModal'));
  profileModal = new bootstrap.Modal(document.getElementById('profileModal'));
  bootstrapReady = true;
  populateClassSelects();
  populateCourseClassSelect([]);
  populateClassSelects();

  document.getElementById('loginForm').addEventListener('submit', handleLogin);
  document.getElementById('signupForm').addEventListener('submit', handleSignup);
  document.getElementById('profileForm').addEventListener('submit', handleProfileUpdate);
  document.getElementById('courseForm').addEventListener('submit', handleSaveCourse);
  document.getElementById('lessonForm').addEventListener('submit', handleSaveLesson);

  document.getElementById('navLessons').classList.add('hidden');
  document.getElementById('navStudents').classList.add('hidden');
  document.getElementById('navRecap').classList.add('hidden');
    document.getElementById('navAnalytics').classList.add('hidden');

  var savedUser = safeJsonParse(localStorage.getItem('lms_smansev_user'));
  if (savedUser && savedUser.id && LMSApi.hasToken()) {
    serverCall('getCurrentUser', [savedUser.id], {
      silent: true,
      success: function(res){
        if (res && res.success && res.data) {
          enterApp(res.data, true);
        } else {
          LMSApi.clearSession();
          localStorage.removeItem('lms_smansev_user');
        }
      },
      failure: function(){
        LMSApi.clearSession();
        localStorage.removeItem('lms_smansev_user');
      }
    });
  }
});

function safeJsonParse(value){
  try { return value ? JSON.parse(value) : null; } catch(e){ return null; }
}

function serverCall(fn, args, handlers){
  handlers = handlers || {};
  var silent = !!handlers.silent;
  if(!silent) showLoader(handlers.loading ? handlers.loading : 'Memproses...');

  LMSApi.call(fn, args || [])
    .then(function(res){
      if(!silent) hideLoader();
      if (res === null || typeof res === 'undefined') {
        var fakeErr = { message: 'Respons kosong dari server. Coba muat ulang halaman.' };
        if (handlers.failure) handlers.failure(fakeErr);
        else showToast(errorMessage(fakeErr), 'danger');
        return;
      }
      if (res.clearSession) {
        LMSApi.clearSession();
        localStorage.removeItem('lms_smansev_user');
      }
      if (handlers.success) handlers.success(res);
    })
    .catch(function(err){
      if(!silent) hideLoader();
      if (handlers.failure) handlers.failure(err);
      else showToast(errorMessage(err), 'danger');
    });
}

function errorMessage(err){
  return err && err.message ? err.message : 'Terjadi kesalahan koneksi ke server.';
}

var loadingCount = 0;
function showLoader(message){
  loadingCount++;
  var el = document.getElementById('globalLoader');
  document.getElementById('loaderText').textContent = message || 'Memproses...';
  el.classList.add('show');
}
function hideLoader(){
  loadingCount = Math.max(0, loadingCount - 1);
  if(loadingCount === 0) document.getElementById('globalLoader').classList.remove('show');
}

function openSignup(){
  document.getElementById('signupForm').reset();
  document.getElementById('signupAlert').innerHTML = '';
  signupModal.show();
}

function handleSignup(e){
  e.preventDefault();
  var name = document.getElementById('signupName').value.trim();
  var email = document.getElementById('signupEmail').value.trim();
  var password = document.getElementById('signupPassword').value;
  var confirm = document.getElementById('signupConfirm').value;
  
  var kelas = document.getElementById('signupKelas').value;

  if(password !== confirm){
    showAlert('signupAlert','Konfirmasi kata sandi tidak sama.','danger');
    return;
  }

  if(!kelas) {
    showAlert('signupAlert','Harap pilih kelas terlebih dahulu.','danger');
    return;
  }

  // Course/mapel tidak dipilih siswa. Backend menentukan Course
  // berdasarkan CourseClasses untuk kelas siswa.
  serverCall('signupUser',[{name: name, email: email, password: password, kelas: kelas}],{
    loading:'Membuat akun...',
    success:function(res){
      if(!res || !res.success){
        showAlert('signupAlert',res && res.message ? res.message : 'Pendaftaran gagal.','danger');
        return;
      }
      signupModal.hide();
      enterApp(res.data, false);
      showToast('Akun siswa berhasil dibuat.','success');
    },
    failure:function(err){ showAlert('signupAlert',errorMessage(err),'danger'); }
  });
}

function handleLogin(e){
  e.preventDefault();
  var email = document.getElementById('loginEmail').value.trim();
  var password = document.getElementById('loginPassword').value;

  serverCall('loginUser',[email,password],{
    loading:'Memverifikasi login...',
    success:function(res){
      if(!res || !res.success){
        showAlert('loginAlert',res && res.message ? res.message : 'Login gagal.','danger');
        return;
      }
      enterApp(res.data,false);
    },
    failure:function(err){ showAlert('loginAlert',errorMessage(err),'danger'); }
  });
}

function openProfileModal(){
  document.getElementById('profileAlert').innerHTML = '';
  document.getElementById('profileName').value = AppState.user.name || '';
  document.getElementById('profilePassword').value = '';
  
  if (AppState.user.role === 'admin' || AppState.user.role === 'teacher') {
    document.getElementById('profileStudentSection').classList.add('hidden');
  } else {
    document.getElementById('profileStudentSection').classList.remove('hidden');
    document.getElementById('profileKelas').value = AppState.user.kelas || '';
    document.getElementById('profileMapel').value = AppState.user.mapel || '';
  }
  profileModal.show();
}

function handleProfileUpdate(e) {
  e.preventDefault();
  var payload = {
    id: AppState.user.id,
    name: document.getElementById('profileName').value.trim(),
    password: document.getElementById('profilePassword').value,
    kelas: document.getElementById('profileKelas').value,
    mapel: document.getElementById('profileMapel').value
  };

  serverCall('updateProfile', [payload], {
    loading: 'Menyimpan profil...',
    success: function(res) {
      if(!res.success) { showAlert('profileAlert', res.message, 'danger'); return; }
      profileModal.hide();
      showToast(res.data.message, 'success');
      AppState.user = res.data.user;
      localStorage.setItem('lms_smansev_user', JSON.stringify(AppState.user));
      document.getElementById('sidebarUserName').textContent = AppState.user.name;
    },
    failure:function(err){ showAlert('profileAlert',errorMessage(err),'danger'); }
  });
}

function enterApp(user, silent){
  AppState.user = user;
  localStorage.setItem('lms_smansev_user',JSON.stringify(user));

  document.getElementById('loginPage').classList.add('hidden');
  document.getElementById('appPage').classList.remove('hidden');
  document.getElementById('sidebarUserName').textContent = user.name || user.email;
  document.getElementById('topRole').textContent = user.role === 'admin' ? 'ADMIN' : (user.role === 'teacher' ? 'GURU' : 'SISWA');

  var isAdmin = user.role === 'admin';
  var isTeacher = user.role === 'teacher';
  document.getElementById('navLessons').classList.toggle('hidden', !(isAdmin || isTeacher));
  document.getElementById('navLessons').innerHTML = isTeacher
    ? '<i class="bi bi-journal-richtext"></i>Teacher Course Workspace'
    : '<i class="bi bi-journal-text"></i>Manajemen Materi';
  document.getElementById('navStudents').classList.toggle('hidden', !(isAdmin || isTeacher));
  document.getElementById('navRecap').classList.toggle('hidden', !(isAdmin || isTeacher));
  document.getElementById('navAnalytics').classList.toggle('hidden', !(isAdmin || isTeacher));
  document.getElementById('navTeachers').classList.toggle('hidden', !isAdmin);
  document.getElementById('navGrades').classList.toggle('hidden', !isTeacher);
  document.getElementById('navGradebook').classList.toggle('hidden', !isTeacher);

  navigate('dashboard');
}

function logout(){
  AppState.user = null;
  LMSApi.clearSession();
  localStorage.removeItem('lms_smansev_user');
  document.getElementById('appPage').classList.add('hidden');
  document.getElementById('loginPage').classList.remove('hidden');
  document.getElementById('loginForm').reset();
  document.getElementById('loginAlert').innerHTML='';
  closeSidebar();
}

function navigate(view){
  if(!AppState.user) return;
  if(view === 'lessons' && AppState.user.role !== 'admin' && AppState.user.role !== 'teacher') return;
  if((view === 'students' || view === 'recap' || view === 'analytics') && AppState.user.role !== 'admin' && AppState.user.role !== 'teacher') return;
  if(view === 'teachers' && AppState.user.role !== 'admin') return;
  if(view === 'grades' && AppState.user.role !== 'teacher') return;
  if(view === 'gradebook' && AppState.user.role !== 'teacher') return;

  AppState.view = view;
  closeSidebar();
  var btns = document.querySelectorAll('.nav-btn');
  for(var i=0; i<btns.length; i++) {
    if(btns[i].getAttribute('data-view') === view) {
      btns[i].classList.add('active');
    } else {
      btns[i].classList.remove('active');
    }
  }

  var titles = {
    dashboard:['Dashboard','Ringkasan pembelajaran'],
    courses:['Katalog Kursus','Kursus yang tersedia dan yang Anda ikuti'],
    lessons:[AppState.user.role === 'teacher' ? 'Teacher Course Workspace' : 'Manajemen Materi', AppState.user.role === 'teacher' ? 'Tambah dan kelola Lesson, Video, Quiz, dan Tugas pada Course yang ditugaskan' : 'Kelola materi pembelajaran'],
    students:['Monitoring Siswa','Pantau siswa dan ekspor data nilai'],
    recap:['Rekap Nilai','Rekap nilai Course dan statistik per kelas'],
     analytics:['Analitik Guru','Insight pembelajaran untuk membantu pengambilan keputusan'],
    teachers:['Manajemen Guru','Kelola akun Guru dan penugasan Kelas + Course'],
    grades:['Penilaian Tugas','Periksa dan berikan nilai tugas siswa'],
    gradebook:['Gradebook Guru','Buku nilai Course berdasarkan Kelas, Quiz, Tugas, dan Nilai Akhir']
  };
  document.getElementById('pageTitle').textContent = titles[view][0];
  document.getElementById('pageSubtitle').textContent = titles[view][1];

  if(view === 'dashboard') loadDashboard();
  if(view === 'courses') loadCoursesPage();
  if(view === 'lessons') loadLessonsPage();
  if(view === 'students') loadStudentsPage();
  if(view === 'recap') loadRecapPage();
  if(view === 'analytics') loadAnalyticsPage();
  if(view === 'teachers') loadTeachersPage();
  if(view === 'grades') loadTeacherGradesPage();
  if(view === 'gradebook') loadTeacherGradebookPage();
}

function loadDashboard(){
  if(AppState.user.role === 'admin'){
    loadAdminDashboard();
  }else if(AppState.user.role === 'teacher'){
    loadTeacherDashboard();
  }else{
    loadStudentDashboard();
  }
}


function loadTeacherDashboard(){
  serverCall('getTeacherAnalyticsData',[AppState.user.id,{kelas:'',courseId:''}],{
    loading:'Memuat dashboard guru...',
    success:function(res){
      if(!res.success){showToast(res.message,'danger');return;}
      var d=res.data||{}, s=d.summary||{};
      var html='<div class="mb-4"><h3 class="fw-bold">Selamat datang, '+esc(AppState.user.name||'Guru')+' 👋</h3><p class="text-secondary">Berikut ringkasan kelas dan Course yang menjadi tanggung jawab Anda.</p></div>'+
        '<div class="row g-3 mb-4">'+
        statCard('Kelas', Array.isArray(d.classes) ? d.classes.length : 0,'bi-people')+
        statCard('Course', s.courses||0,'bi-collection-play')+
        statCard('Siswa', s.students||0,'bi-person')+
        statCard('Rata-rata', (s.average_score||0)+'','bi-bar-chart-line')+
        '</div>'+
        '<div class="panel mb-4"><div class="d-flex justify-content-between align-items-center mb-3"><div><h5 class="mb-1">Performa Kelas</h5><div class="text-secondary small">Ringkasan nilai Course per kelas.</div></div><button class="btn btn-sm btn-outline-primary" onclick="navigate(\'analytics\')">Buka Analitik</button></div>'+renderTeacherClassMini(d.class_performance||[])+'</div>'+
        '<div class="panel"><h5 class="mb-3">Siswa yang Perlu Perhatian</h5>'+renderTeacherAttentionMini(d.at_risk||[])+'</div>';
      document.getElementById('content').innerHTML=html;
    },failure:function(err){showToast(errorMessage(err),'danger');}
  });
}
function statCard(label,value,icon){return '<div class="col-6 col-xl-3"><div class="stat-card h-100"><div class="d-flex justify-content-between"><div><div class="text-secondary small">'+esc(label)+'</div><div class="display-6 fw-bold mt-1">'+esc(value)+'</div></div><i class="bi '+icon+' fs-2 text-primary"></i></div></div></div>';}
function renderTeacherClassMini(rows){if(!rows.length)return '<div class="text-secondary">Belum ada data kelas.</div>';return '<div class="table-responsive"><table class="table align-middle mb-0"><thead><tr><th>Kelas</th><th>Course</th><th>Rata-rata</th><th>Ketuntasan</th></tr></thead><tbody>'+rows.slice(0,8).map(function(r){return '<tr><td><strong>'+esc(r.kelas)+'</strong></td><td>'+esc(r.course_title)+'</td><td><strong>'+Number(r.average_score||0)+'</strong></td><td>'+Number(r.pass_percent||0)+'%</td></tr>';}).join('')+'</tbody></table></div>';}
function renderTeacherAttentionMini(rows){if(!rows.length)return '<div class="alert alert-success mb-0">Tidak ada siswa yang masuk daftar perhatian. 👍</div>';return '<div class="table-responsive"><table class="table align-middle mb-0"><thead><tr><th>Siswa</th><th>Kelas</th><th>Course</th><th>Nilai</th><th>Progress</th><th>Alasan</th></tr></thead><tbody>'+rows.slice(0,10).map(function(r){return '<tr><td>'+esc(r.name)+'</td><td>'+esc(r.kelas)+'</td><td>'+esc(r.course_title)+'</td><td>'+Number(r.final_score||0)+'</td><td>'+Number(r.progress_percent||0)+'%</td><td><span class="badge text-bg-warning">'+esc(r.reason||'Perlu perhatian')+'</span></td></tr>';}).join('')+'</tbody></table></div>';}

function loadTeachersPage(){
  if(AppState.user.role!=='admin') return;
  serverCall('getTeachers',[AppState.user.id],{
    loading:'Memuat daftar guru...',
    success:function(res){if(!res.success){showToast(res.message,'danger');return;}renderTeachersPage(res.data||[]);},
    failure:function(err){showToast(errorMessage(err),'danger');}
  });
}
function renderTeachersPage(rows){
  var html='<div class="d-flex justify-content-between align-items-center mb-4"><div><h4 class="fw-bold mb-1">Manajemen Guru</h4><div class="text-secondary">Buat akun Guru dan tentukan Kelas serta Course yang menjadi tanggung jawabnya.</div></div><button class="btn btn-primary" onclick="openTeacherModal()"><i class="bi bi-person-plus me-1"></i>Tambah Guru</button></div>';
  html+='<div class="panel"><div class="table-responsive"><table class="table align-middle"><thead><tr><th>Guru</th><th>Email</th><th>Kelas</th><th>Course</th><th>Aksi</th></tr></thead><tbody>';
  if(!rows.length) html+='<tr><td colspan="5" class="text-center text-secondary py-4">Belum ada akun Guru.</td></tr>';
  rows.forEach(function(r){html+='<tr><td><strong>'+esc(r.name)+'</strong></td><td>'+esc(r.email)+'</td><td>'+esc((r.classes||[]).join(', ')||'-')+'</td><td>'+esc((r.courseTitles||[]).join(', ')||'-')+'</td><td><button class="btn btn-sm btn-outline-primary me-1" onclick="openTeacherModal(\''+escAttr(r.id)+'\')"><i class="bi bi-pencil"></i></button><button class="btn btn-sm btn-outline-danger" onclick="deleteTeacherAccount(\''+escAttr(r.id)+'\')"><i class="bi bi-trash"></i></button></td></tr>';});
  html+='</tbody></table></div></div>';document.getElementById('content').innerHTML=html;
}
function openTeacherModal(id){
  serverCall('getTeachers',[AppState.user.id],{loading:'Memuat akun Guru...',success:function(res){if(!res.success){showToast(res.message,'danger');return;}var rows=res.data||[], t=null;rows.forEach(function(x){if(String(x.id)===String(id))t=x;});
    var courses=AppState.courses||[]; if(!courses.length){serverCall('getAdminCourses',[AppState.user.id],{success:function(r){if(r.success){AppState.courses=r.data||[];}buildTeacherModal(t,AppState.courses||[]);}});}else buildTeacherModal(t,courses);}});
}
function buildTeacherModal(t,courses){
  var id=t?t.id:'', html='<div class="modal fade" id="teacherModalDynamic" tabindex="-1"><div class="modal-dialog modal-lg modal-dialog-centered"><div class="modal-content"><div class="modal-header"><h5 class="modal-title">'+(t?'Edit Akun Guru':'Tambah Akun Guru')+'</h5><button class="btn-close" data-bs-dismiss="modal"></button></div><form id="teacherFormDynamic"><div class="modal-body"><div id="teacherDynamicAlert"></div><input type="hidden" id="teacherIdDynamic" value="'+escAttr(id)+'"><div class="row g-3"><div class="col-md-6"><label class="form-label">Nama Guru</label><input id="teacherNameDynamic" class="form-control" value="'+escAttr(t?t.name:'')+'" required></div><div class="col-md-6"><label class="form-label">Email</label><input id="teacherEmailDynamic" type="email" class="form-control" value="'+escAttr(t?t.email:'')+'" required></div><div class="col-md-6"><label class="form-label">Password '+(t?'(kosongkan jika tidak diubah)':'')+'</label><input id="teacherPasswordDynamic" type="password" class="form-control" '+(t?'':'required')+'></div><div class="col-12"><label class="form-label">Kelas yang diajar</label><div class="row g-2">';
  var selectedClasses=t?t.classes||[]:[]; CONFIG_CLASSES.forEach(function(k){html+='<div class="col-6 col-md-3"><label class="border rounded p-2 w-100"><input type="checkbox" class="teacher-class-check me-1" value="'+k+'" '+(selectedClasses.indexOf(k)>=0?'checked':'')+'> '+k+'</label></div>';});
  html+='</div></div><div class="col-12"><label class="form-label">Course yang diajar</label><div class="row g-2">';var selectedCourses=t?t.courseIds||[]:[];courses.forEach(function(c){html+='<div class="col-12 col-md-6"><label class="border rounded p-2 w-100"><input type="checkbox" class="teacher-course-check me-1" value="'+escAttr(c.id)+'" '+(selectedCourses.indexOf(String(c.id))>=0?'checked':'')+'> '+esc(c.title)+'</label></div>';});
  html+='</div></div></div></div><div class="modal-footer"><button type="button" class="btn btn-light" data-bs-dismiss="modal">Batal</button><button class="btn btn-primary">Simpan Guru</button></div></form></div></div></div>';
  var wrap=document.createElement('div');wrap.innerHTML=html;document.body.appendChild(wrap.firstElementChild);var modalEl=document.getElementById('teacherModalDynamic');var modal=new bootstrap.Modal(modalEl);modalEl.addEventListener('hidden.bs.modal',function(){modalEl.remove();});
  document.getElementById('teacherFormDynamic').addEventListener('submit',function(e){e.preventDefault();var classes=[].slice.call(document.querySelectorAll('.teacher-class-check:checked')).map(function(x){return x.value;});var courseIds=[].slice.call(document.querySelectorAll('.teacher-course-check:checked')).map(function(x){return x.value;});serverCall('saveTeacher',[{id:document.getElementById('teacherIdDynamic').value,name:document.getElementById('teacherNameDynamic').value.trim(),email:document.getElementById('teacherEmailDynamic').value.trim(),password:document.getElementById('teacherPasswordDynamic').value,classes:classes,courseIds:courseIds,adminUserId:AppState.user.id}],{loading:'Menyimpan akun Guru...',success:function(res){if(!res.success){document.getElementById('teacherDynamicAlert').innerHTML='<div class="alert alert-danger">'+esc(res.message)+'</div>';return;}modal.hide();showToast(res.data.message,'success');loadTeachersPage();}});});
  modal.show();
}
function deleteTeacherAccount(id){if(!confirm('Hapus akun Guru ini beserta penugasan Kelas dan Course?'))return;serverCall('deleteTeacher',[id,AppState.user.id],{loading:'Menghapus akun Guru...',success:function(res){if(!res.success){showToast(res.message,'danger');return;}showToast(res.data.message,'success');loadTeachersPage();}});}
var CONFIG_CLASSES=['10-A','10-B','10-C','10-D','10-E','10-F','10-G','11-A','11-B','11-C','11-D'];


function loadTeacherGradesPage(filters){
  if(AppState.user.role!=='teacher') return;
  filters=filters||{};
  serverCall('getTeacherAssignmentData',[AppState.user.id,filters],{
    loading:'Memuat penilaian siswa...',
    success:function(res){if(!res.success){showToast(res.message,'danger');return;}renderTeacherGradesPage(res.data||{});},
    failure:function(err){showToast(errorMessage(err),'danger');}
  });
}
function teacherGradeFiltersFromUI(){
  return {
    kelas:(document.getElementById('teacherGradeClassFilter')||{}).value||'',
    courseId:(document.getElementById('teacherGradeCourseFilter')||{}).value||'',
    lessonId:(document.getElementById('teacherGradeLessonFilter')||{}).value||'',
    status:(document.getElementById('teacherGradeStatusFilter')||{}).value||'',
    search:(document.getElementById('teacherGradeSearch')||{}).value||''
  };
}
function refreshTeacherGradesWithFilters(){ loadTeacherGradesPage(teacherGradeFiltersFromUI()); }
function teacherGradeFilterChange(type){
  var f=teacherGradeFiltersFromUI();
  if(type==='class') { f.courseId=''; f.lessonId=''; }
  if(type==='course') { f.lessonId=''; }
  loadTeacherGradesPage(f);
}
function teacherDraftStorageKey(submissionId){
  var f=teacherGradeFiltersFromUI();
  return 'LMS_TEACHER_GRADE_DRAFT_V1::'+String(AppState.user&&AppState.user.id||'')+'::'+String(submissionId)+'::'+String(f.kelas||'')+'::'+String(f.courseId||'')+'::'+String(f.lessonId||'');
}
function getTeacherGradeDrafts(){
  var drafts={};
  try{
    var prefix='LMS_TEACHER_GRADE_DRAFT_V1::'+String(AppState.user&&AppState.user.id||'')+'::';
    for(var i=0;i<localStorage.length;i++){
      var key=localStorage.key(i);
      if(key && key.indexOf(prefix)===0){
        var raw=localStorage.getItem(key);
        if(raw){
          var item=JSON.parse(raw);
          if(item && item.submissionId!==undefined) drafts[String(item.submissionId)]=item;
        }
      }
    }
  }catch(e){}
  return drafts;
}
function saveTeacherGradeDraft(submissionId,value){
  var raw=String(value===null||value===undefined?'':value).trim();
  var key=teacherDraftStorageKey(submissionId);
  try{
    if(raw===''){
      localStorage.removeItem(key);
      updateTeacherDraftIndicator();
      return;
    }
    var score=Number(raw);
    if(!isFinite(score) || score<0 || score>100) return;
    localStorage.setItem(key,JSON.stringify({submissionId:String(submissionId),score:score,savedAt:new Date().toISOString()}));
    updateTeacherDraftIndicator();
  }catch(e){
    // localStorage dapat dibatasi oleh browser/private mode; nilai tetap bisa disimpan manual.
  }
}
function clearTeacherGradeDraft(submissionId){
  try{localStorage.removeItem(teacherDraftStorageKey(submissionId));}catch(e){}
  updateTeacherDraftIndicator();
}
function clearVisibleTeacherGradeDrafts(){
  var ids=[].slice.call(document.querySelectorAll('[data-grade-submission-id]')).map(function(el){return el.getAttribute('data-grade-submission-id');});
  ids.forEach(function(id){try{localStorage.removeItem(teacherDraftStorageKey(id));}catch(e){}});
  updateTeacherDraftIndicator();
}
function updateTeacherDraftIndicator(){
  var el=document.getElementById('teacherDraftIndicator');
  if(!el) return;
  var drafts=getTeacherGradeDrafts(), count=Object.keys(drafts).length;
  el.innerHTML=count ? '<span class="badge rounded-pill text-bg-warning"><i class="bi bi-save2 me-1"></i>'+count+' draft tersimpan</span>' : '<span class="text-secondary small"><i class="bi bi-cloud-check me-1"></i>Tidak ada draft</span>';
}
function restoreTeacherGradeDraft(submissionId,serverScore){
  var drafts=getTeacherGradeDrafts(), d=drafts[String(submissionId)];
  if(!d) return {value:serverScore,hasDraft:false,savedAt:''};
  return {value:d.score,hasDraft:true,savedAt:d.savedAt||''};
}
function formatDraftTime(iso){
  if(!iso) return '';
  try{return new Date(iso).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'});}catch(e){return '';}
}
function attachTeacherDraftListeners(){
  [].slice.call(document.querySelectorAll('.teacher-grade-input')).forEach(function(el){
    el.addEventListener('input',function(){
      saveTeacherGradeDraft(el.getAttribute('data-grade-submission-id'),el.value);
      var badge=document.getElementById('draft_'+el.getAttribute('data-grade-submission-id'));
      if(badge){badge.innerHTML='<span class="badge text-bg-warning"><i class="bi bi-pencil me-1"></i>Draft</span>';} 
    });
    el.addEventListener('blur',function(){
      var raw=String(el.value||'').trim();
      if(raw!=='' && (Number(raw)<0 || Number(raw)>100 || !isFinite(Number(raw)))){
        el.classList.add('is-invalid');
      }else{
        el.classList.remove('is-invalid');
      }
    });
  });
  updateTeacherDraftIndicator();
}
function renderTeacherGradesPage(data){
  var rows=data.rows||[], classes=data.classes||[], courses=data.courses||[], lessons=data.lessons||[], f=data.filters||{};
  var drafts=getTeacherGradeDrafts();
  var html='<div class="d-flex justify-content-between align-items-center mb-4"><div><h4 class="fw-bold mb-1">Penilaian Tugas</h4><div class="text-secondary">Filter berdasarkan Kelas, Course, dan Lesson untuk mempercepat penilaian.</div></div><div class="d-flex align-items-center gap-2"><span id="teacherDraftIndicator"></span><button class="btn btn-outline-primary btn-sm" onclick="refreshTeacherGradesWithFilters()"><i class="bi bi-arrow-clockwise me-1"></i>Refresh</button></div></div>';
  html+='<div class="alert alert-info py-2 small"><i class="bi bi-shield-check me-1"></i>Nilai yang sedang Anda ketik disimpan otomatis sebagai <strong>draft di browser ini</strong>. Draft tidak masuk Google Sheet sampai Anda menekan <strong>Simpan</strong>.</div>';
  html+='<div class="panel mb-4"><div class="row g-3 align-items-end">';
  html+='<div class="col-md-3"><label class="form-label fw-semibold">Kelas</label><select id="teacherGradeClassFilter" class="form-select" onchange="teacherGradeFilterChange(\'class\')"><option value="">Semua Kelas Saya</option>';
  classes.forEach(function(k){html+='<option value="'+escAttr(k)+'" '+(String(f.kelas||'')===String(k)?'selected':'')+'>'+esc(k)+'</option>';});
  html+='</select></div>';
  html+='<div class="col-md-3"><label class="form-label fw-semibold">Course</label><select id="teacherGradeCourseFilter" class="form-select" onchange="teacherGradeFilterChange(\'course\')"><option value="">Semua Course Saya</option>';
  courses.forEach(function(c){html+='<option value="'+escAttr(c.id)+'" '+(String(f.courseId||'')===String(c.id)?'selected':'')+'>'+esc(c.title)+'</option>';});
  html+='</select></div>';
  html+='<div class="col-md-3"><label class="form-label fw-semibold">Lesson</label><select id="teacherGradeLessonFilter" class="form-select" onchange="teacherGradeFilterChange(\'lesson\')"><option value="">Semua Lesson</option>';
  lessons.forEach(function(l){html+='<option value="'+escAttr(l.id)+'" '+(String(f.lessonId||'')===String(l.id)?'selected':'')+'>'+esc(l.title)+(l.course_title?' — '+esc(l.course_title):'')+'</option>';});
  html+='</select></div>';
  html+='<div class="col-md-3"><label class="form-label fw-semibold">Status Nilai</label><select id="teacherGradeStatusFilter" class="form-select" onchange="refreshTeacherGradesWithFilters()"><option value="" '+(!f.status?'selected':'')+'>Semua</option><option value="ungraded" '+(f.status==='ungraded'?'selected':'')+'>Belum Dinilai</option><option value="graded" '+(f.status==='graded'?'selected':'')+'>Sudah Dinilai</option></select></div>';
  html+='<div class="col-md-8"><label class="form-label fw-semibold">Cari Siswa</label><input id="teacherGradeSearch" class="form-control" value="'+escAttr(f.search||'')+'" placeholder="Nama atau email siswa" onkeydown="if(event.key===\'Enter\') refreshTeacherGradesWithFilters()"></div>';
  html+='<div class="col-md-4 d-flex gap-2"><button class="btn btn-primary flex-fill" onclick="refreshTeacherGradesWithFilters()"><i class="bi bi-funnel me-1"></i>Terapkan Filter</button><button class="btn btn-light" onclick="loadTeacherGradesPage({})">Reset</button></div>';
  html+='</div></div>';
  html+='<div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2"><div class="small text-secondary">Menampilkan <strong>'+rows.length+'</strong> pengumpulan tugas yang sesuai filter.</div><div class="d-flex align-items-center gap-2"><span class="small text-secondary"><i class="bi bi-info-circle me-1"></i>Draft tersimpan hanya pada browser/perangkat ini.</span><button id="saveAllTeacherGradesBtn" class="btn btn-success btn-sm" onclick="saveAllTeacherGrades()" '+(rows.length?'':'disabled')+'><i class="bi bi-cloud-arrow-up me-1"></i>Simpan Semua Nilai</button></div></div>';
  html+='<div class="panel"><div class="table-responsive"><table class="table align-middle"><thead><tr><th>Siswa</th><th>Kelas</th><th>Course</th><th>Lesson</th><th>Tugas</th><th>Dikumpulkan</th><th>Nilai</th><th>Status Draft</th><th>Aksi</th></tr></thead><tbody>';
  if(!rows.length) html+='<tr><td colspan="9" class="text-center text-secondary py-5"><i class="bi bi-inbox fs-2 d-block mb-2"></i>Tidak ada pengumpulan yang sesuai filter.</td></tr>';
  rows.forEach(function(r){
    var score=(r.score===null||r.score===undefined||r.score==='')?'':Number(r.score);
    var draft=restoreTeacherGradeDraft(r.submission_id,score);
    var displayValue=draft.value===null||draft.value===undefined?'':draft.value;
    var draftBadge=draft.hasDraft?'<span class="badge text-bg-warning"><i class="bi bi-pencil me-1"></i>Draft</span>':'<span class="text-secondary small">—</span>';
    var draftTime=draft.hasDraft?'<div class="small text-secondary mt-1">'+esc(formatDraftTime(draft.savedAt))+'</div>':'';
    html+='<tr><td><strong>'+esc(r.student_name)+'</strong><div class="small text-secondary">'+esc(r.student_id)+'</div></td><td>'+esc(r.kelas)+'</td><td>'+esc(r.course_title)+'</td><td>'+esc(r.lesson_title)+'</td><td>'+esc(r.assignment_title)+'</td><td>'+esc(formatDateTime(r.submitted_at))+'</td><td style="min-width:100px"><input id="grade_'+escAttr(r.submission_id)+'" data-grade-submission-id="'+escAttr(r.submission_id)+'" type="number" min="0" max="100" class="form-control form-control-sm teacher-grade-input" value="'+escAttr(displayValue)+'"></td><td id="draft_'+escAttr(r.submission_id)+'">'+draftBadge+draftTime+'</td><td><button class="btn btn-sm btn-primary" onclick="saveTeacherGrade(\''+escAttr(r.submission_id)+'\')">Simpan</button></td></tr>';
  });
  html+='</tbody></table></div></div>';
  document.getElementById('content').innerHTML=html;
  attachTeacherDraftListeners();
}
function saveTeacherGrade(submissionId){
  var el=document.getElementById('grade_'+submissionId);
  var raw=el?String(el.value||'').trim():'';
  if(raw==='' || !isFinite(Number(raw)) || Number(raw)<0 || Number(raw)>100){showToast('Nilai harus diisi antara 0-100.','danger');if(el)el.classList.add('is-invalid');return;}
  var score=Number(raw);
  if(el)el.classList.remove('is-invalid');
  serverCall('gradeAssignmentSubmit',[submissionId,score,AppState.user.id],{
    loading:'Menyimpan nilai tugas...',
    success:function(res){
      if(!res.success){showToast(res.message,'danger');return;}
      clearTeacherGradeDraft(submissionId);
      showToast(res.data.message||'Nilai tersimpan.','success');
      refreshTeacherGradesWithFilters();
    },
    failure:function(err){showToast(errorMessage(err),'danger');}
  });
}

function collectVisibleTeacherGrades(){
  var inputs=[].slice.call(document.querySelectorAll('.teacher-grade-input'));
  var items=[];
  var invalid=[];
  inputs.forEach(function(el){
    var submissionId=el.getAttribute('data-grade-submission-id');
    var raw=String(el.value||'').trim();
    if(raw==='') return; // Tidak menimpa nilai lama dengan kosong.
    var score=Number(raw);
    if(!isFinite(score) || score<0 || score>100){
      invalid.push({submissionId:submissionId, element:el});
      return;
    }
    items.push({submissionId:String(submissionId),score:score});
  });
  return {items:items,invalid:invalid};
}

function saveAllTeacherGrades(){
  var collected=collectVisibleTeacherGrades();
  if(collected.invalid.length){
    collected.invalid.forEach(function(x){if(x.element)x.element.classList.add('is-invalid');});
    showToast('Ada nilai yang tidak valid. Pastikan semua nilai berada di antara 0-100.','danger');
    return;
  }
  if(!collected.items.length){
    showToast('Belum ada nilai yang diisi pada daftar ini.','warning');
    return;
  }

  var confirmed=true;
  if(typeof window.confirm==='function'){
    confirmed=window.confirm('Simpan '+collected.items.length+' nilai sekaligus ke Google Sheet?');
  }
  if(!confirmed) return;

  var btn=document.getElementById('saveAllTeacherGradesBtn');
  if(btn){btn.disabled=true;btn.innerHTML='<span class="spinner-border spinner-border-sm me-1"></span>Menyimpan...';}

  serverCall('gradeAssignmentSubmitsBulk',[collected.items,AppState.user.id],{
    loading:'Menyimpan '+collected.items.length+' nilai sekaligus...',
    success:function(res){
      if(!res || !res.success){
        if(btn){btn.disabled=false;btn.innerHTML='<i class="bi bi-cloud-arrow-up me-1"></i>Simpan Semua Nilai';}
        showToast(res && res.message ? res.message : 'Gagal menyimpan nilai.','danger');
        return;
      }
      collected.items.forEach(function(item){clearTeacherGradeDraft(item.submissionId);});
      showToast((res.data&&res.data.message)||'Semua nilai berhasil disimpan.','success');
      refreshTeacherGradesWithFilters();
    },
    failure:function(err){
      if(btn){btn.disabled=false;btn.innerHTML='<i class="bi bi-cloud-arrow-up me-1"></i>Simpan Semua Nilai';}
      showToast(errorMessage(err),'danger');
    }
  });
}

function loadStudentDashboard(){
  serverCall('getCourses',[AppState.user.id],{
    loading:'Memuat dashboard...',
    success:function(res){
      if(AppState.view!=='dashboard') return;
      if(!res.success){ showToast(res.message,'danger'); return; }
      AppState.courses = res.data || [];
      var enrolled = [];
      for(var x = 0; x < AppState.courses.length; x++) {
        if(AppState.courses[x].enrolled) enrolled.push(AppState.courses[x]);
      }
      var totalProgress = 0;
      for(var i=0; i<enrolled.length; i++){
        totalProgress += Number(enrolled[i].enrollment.progress_percent || 0);
      }
      var avgProgress = enrolled.length ? Math.round(totalProgress / enrolled.length) : 0;

      var enrolledHtml = '';
      for(var j=0; j<Math.min(enrolled.length, 6); j++){
        enrolledHtml += courseCardHtml(enrolled[j]);
      }
      if(!enrolledHtml) enrolledHtml = emptyState('Belum ada kursus yang diikuti.','Buka katalog kursus untuk mulai belajar.','courses');

      document.getElementById('content').innerHTML = 
        '<div class="row g-3 mb-4">' +
          statCard('Kursus Diikuti', enrolled.length, 'bi-collection-play') +
          statCard('Kursus Tersedia', AppState.courses.length, 'bi-grid') +
          statCard('Rata-rata Progres', avgProgress+'%', 'bi-graph-up') +
        '</div>' +
        '<div class="panel">' +
          '<div class="d-flex justify-content-between align-items-center mb-3">' +
            '<div><h5 class="mb-1">Mulai Belajar</h5><div class="text-secondary small">Lanjutkan kursus yang sedang Anda ikuti.</div></div>' +
            '<button class="btn btn-outline-primary" onclick="navigate(\'courses\')">Lihat Semua</button>' +
          '</div>' +
          '<div class="row g-3 align-items-stretch">' + enrolledHtml + '</div>' +
        '</div>';
    }
  });
}

function loadAdminDashboard(){
  serverCall('getAdminData',[AppState.user.id],{
    loading:'Memuat dashboard admin...',
    success:function(res){
      if(AppState.view!=='dashboard') return;
      if(!res.success){ showToast(res.message,'danger'); return; }
      AppState.adminData = res.data;
      AppState.courses = res.data.courses || [];
      AppState.lessons = res.data.lessons || [];
      var s = res.data.stats;
      
      var tableBody = '';
      if(AppState.courses.length > 0) {
        var trs = [];
        for(var i = 0; i < AppState.courses.length; i++) {
          var c = AppState.courses[i];
          var n = 0;
          for(var j = 0; j < AppState.lessons.length; j++){
             if(lessonBelongsToCourse(AppState.lessons[j], c.id)) n++;
          }
          trs.push('<tr><td><div class="fw-semibold">' + esc(c.title) + '</div><div class="small text-secondary">' + esc(c.description).slice(0,80) + '</div></td><td>' + esc(c.category) + '</td><td>' + esc(c.instructor) + '</td><td>' + courseClassBadges(c.assigned_classes) + '</td><td>' + n + '</td><td><button class="btn btn-sm btn-outline-primary me-1" title="Edit Kursus" onclick="openCourseModal(\'' + c.id + '\')"><i class="bi bi-pencil"></i></button><button class="btn btn-sm btn-outline-danger" title="Hapus Kursus" onclick="removeCourse(\'' + c.id + '\')"><i class="bi bi-trash"></i></button></td></tr>');
        }
        tableBody = trs.join('');
      } else {
        tableBody = '<tr><td colspan="6" class="text-center text-secondary py-4">Belum ada kursus.</td></tr>';
      }

      document.getElementById('content').innerHTML =
        '<div class="row g-3 mb-4">' +
          statCard('Siswa', s.students, 'bi-people') +
          statCard('Kursus', s.courses, 'bi-collection') +
          statCard('Materi', s.lessons, 'bi-journal-text') +
          statCard('Rata-rata Nilai', s.average_score, 'bi-bar-chart') +
        '</div>' +
        '<div class="panel">' +
          '<div class="d-flex flex-wrap gap-2 justify-content-between align-items-center mb-3">' +
            '<div><h5 class="mb-1">Kursus</h5><div class="text-secondary small">Kelola katalog pembelajaran. Tambah, edit, atau hapus kursus.</div></div>' +
            '<button class="btn btn-primary" onclick="openCourseModal()"><i class="bi bi-plus-lg me-2"></i>Tambah Kursus</button>' +
          '</div>' +
          '<div class="table-responsive">' +
            '<table class="table align-middle mb-0">' +
              '<thead><tr><th>Kursus</th><th>Kategori</th><th>Instruktur</th><th>Kelas</th><th>Materi</th><th>Aksi</th></tr></thead>' +
              '<tbody>' + tableBody + '</tbody>' +
            '</table>' +
          '</div>' +
        '</div>';
    }
  });
}

function loadCoursesPage(){
  serverCall('getCourses',[AppState.user.id],{
    loading:'Memuat kursus...',
    success:function(res){
      if(AppState.view!=='courses') return;
      if(!res.success){showToast(res.message,'danger');return;}
      AppState.courses=res.data||[];
      var coursesHtml = '';
      for(var i=0; i<AppState.courses.length; i++) {
        coursesHtml += courseCardHtml(AppState.courses[i]);
      }
      if(!coursesHtml) coursesHtml = emptyState('Belum ada kursus.','Admin belum menambahkan kursus.','dashboard');
      document.getElementById('content').innerHTML='<div class="row g-3 align-items-stretch">' + coursesHtml + '</div>';
    }
  });
}

function loadLessonsPage(){
  var isTeacher = AppState.user && AppState.user.role === 'teacher';
  var method = isTeacher ? 'getTeacherCourseWorkspace' : 'getAdminCourses';
  var args = [AppState.user.id];

  serverCall(method,args,{
    loading:isTeacher ? 'Memuat Teacher Course Workspace...' : 'Memuat daftar kursus...',
    success:function(res){
      if(AppState.view!=='lessons') return;
      if(!res.success){showToast(res.message,'danger');return;}

      if(isTeacher){
        AppState.courses = res.data.courses || [];
        AppState.lessons = res.data.lessons || [];
        renderLessonsPage();
      }else{
        AppState.courses = res.data || [];
        serverCall('getAllLessonsAdmin',[AppState.user.id],{
          loading:'Memuat materi...',
          success:function(lessonRes){
            if(AppState.view!=='lessons') return;
            if(!lessonRes.success){showToast(lessonRes.message,'danger');return;}
            AppState.lessons=lessonRes.data||[];
            renderLessonsPage();
          }
        });
      }
    },
    failure:function(err){showToast(errorMessage(err),'danger');}
  });
}

function renderLessonsPage(){
  var tbody = '';
  if(AppState.lessons.length > 0) {
    var trs = [];
    for(var i=0; i<AppState.lessons.length; i++){
      var l = AppState.lessons[i];
      var titles = Array.isArray(l.course_titles) && l.course_titles.length ? l.course_titles : [l.course_title || courseName(l.course_id)];
      var badges = '';
      for(var b=0; b<titles.length; b++) { badges += '<span class="badge text-bg-light me-1 mb-1">' + esc(titles[b]) + '</span>'; }
      var quizCount = Array.isArray(l.quiz_questions) ? l.quiz_questions.length : 0;
      var videoIcon = l.video_url ? '<i class="bi bi-check-circle-fill text-success"></i>' : '-';
      
      trs.push('<tr>' +
        '<td>' + badges + '</td>' +
        '<td>' + Number(l.order||1) + '</td>' +
        '<td><div class="fw-semibold">' + esc(l.title) + '</div><div class="small text-secondary">' + esc(l.description||'').slice(0,80) + '</div></td>' +
        '<td>' + videoIcon + '</td>' +
        '<td>' + quizCount + '</td>' +
        '<td>' + Number(l.assignment_count||0) + '</td>' +
        '<td class="text-nowrap"><button class="btn btn-sm btn-outline-primary me-1" onclick="openLessonModal(\'' + l.id + '\')"><i class="bi bi-pencil"></i></button><button class="btn btn-sm btn-outline-danger" onclick="removeLesson(\'' + l.id + '\')"><i class="bi bi-trash"></i></button></td>' +
      '</tr>');
    }
    tbody = trs.join('');
  } else {
    tbody = '<tr><td colspan="7" class="text-center text-secondary py-4">Belum ada materi.</td></tr>';
  }

  var teacherMode = AppState.user && AppState.user.role === 'teacher';
  var courseFilter = '<select id="workspaceCourseFilter" class="form-select form-select-sm" style="min-width:220px" onchange="filterWorkspaceLessons()"><option value="">Semua Course Saya</option>';
  for(var cf=0; cf<AppState.courses.length; cf++){
    courseFilter += '<option value="' + escAttr(AppState.courses[cf].id) + '">' + esc(AppState.courses[cf].title) + '</option>';
  }
  courseFilter += '</select>';

  document.getElementById('content').innerHTML=
    '<div class="panel">' +
      '<div class="d-flex flex-wrap gap-2 justify-content-between align-items-center mb-3">' +
        '<div><h5 class="mb-1">' + (teacherMode ? 'Teacher Course Workspace' : 'Daftar Materi') + '</h5><div class="text-secondary small">' + AppState.lessons.length + ' materi · ' + (teacherMode ? 'Hanya Course yang ditugaskan kepada Anda.' : 'Kelola seluruh materi.') + '</div></div>' +
        '<div class="d-flex flex-wrap gap-2">' +
          (teacherMode ? courseFilter : '') +
          '<button class="btn btn-primary" onclick="openLessonModal()"><i class="bi bi-plus-lg me-2"></i>Tambah Lesson</button>' +
        '</div>' +
      '</div>' +
      '<div class="table-responsive">' +
        '<table class="table align-middle mb-0">' +
          '<thead><tr><th>Kursus</th><th>Urutan</th><th>Materi</th><th>Video</th><th>Quiz</th><th>Tugas</th><th>Aksi</th></tr></thead>' +
          '<tbody>' + tbody + '</tbody>' +
        '</table>' +
      '</div>' +
    '</div>';
}


function filterWorkspaceLessons(){
  var filter = document.getElementById('workspaceCourseFilter');
  var cid = filter ? filter.value : '';
  var rows = AppState.lessons || [];
  if(cid){
    rows = rows.filter(function(l){
      var ids = Array.isArray(l.course_ids) && l.course_ids.length ? l.course_ids : [l.course_id];
      return ids.map(String).indexOf(String(cid)) !== -1;
    });
  }

  var tbody = '';
  for(var i=0;i<rows.length;i++){
    var l=rows[i];
    var titles=Array.isArray(l.course_titles)&&l.course_titles.length?l.course_titles:[l.course_title||courseName(l.course_id)];
    var badges='';
    for(var b=0;b<titles.length;b++) badges+='<span class="badge text-bg-light me-1 mb-1">'+esc(titles[b])+'</span>';
    var quizCount=Array.isArray(l.quiz_questions)?l.quiz_questions.length:0;
    var videoIcon=l.video_url?'<i class="bi bi-check-circle-fill text-success"></i>':'-';
    tbody+='<tr>'+
      '<td>'+badges+'</td>'+
      '<td>'+Number(l.order||1)+'</td>'+
      '<td><div class="fw-semibold">'+esc(l.title)+'</div><div class="small text-secondary">'+esc(l.description||'').slice(0,80)+'</div></td>'+
      '<td>'+videoIcon+'</td>'+
      '<td>'+quizCount+'</td>'+
      '<td>'+Number(l.assignment_count||0)+'</td>'+
      '<td class="text-nowrap"><button class="btn btn-sm btn-outline-primary me-1" onclick="openLessonModal(\''+escAttr(l.id)+'\')"><i class="bi bi-pencil"></i></button>'+
      '<button class="btn btn-sm btn-outline-danger" onclick="removeLesson(\''+escAttr(l.id)+'\')"><i class="bi bi-trash"></i></button></td>'+
    '</tr>';
  }
  if(!tbody) tbody='<tr><td colspan="7" class="text-center text-secondary py-4">Belum ada Lesson untuk filter ini.</td></tr>';
  var table=document.querySelector('#content tbody');
  if(table) table.innerHTML=tbody;
  var countNode=document.querySelector('#content .panel .text-secondary.small');
  if(countNode && countNode.textContent.indexOf('materi')!==-1) countNode.textContent=rows.length+' materi · Hanya Course yang ditugaskan kepada Anda.';
}

function loadStudentsPage(){
  serverCall('getAdminData',[AppState.user.id],{
    loading:'Memuat monitoring siswa...',
    success:function(res){
      if(AppState.view!=='students') return;
      if(!res.success){showToast(res.message,'danger');return;}
      AppState.adminData=res.data;
      AppState.courses=res.data.courses||[];
      AppState.lessons=res.data.lessons||[];
      renderStudentsPage();
    }
  });
}

function renderStudentsPage(){
  var courseOptions = '';
  for(var c=0; c<AppState.courses.length; c++) {
    courseOptions += '<option value="' + escAttr(AppState.courses[c].id) + '">' + esc(AppState.courses[c].title) + '</option>';
  }

  var rawStudents = (AppState.adminData && AppState.adminData.students) ? AppState.adminData.students : [];
  var uniqueKelas = [];
  for(var i=0; i<rawStudents.length; i++){
    var k = rawStudents[i].kelas;
    if(k && uniqueKelas.indexOf(k) === -1){
      uniqueKelas.push(k);
    }
  }
  uniqueKelas.sort();
  var kelasOptions = '';
  for(var uk=0; uk<uniqueKelas.length; uk++){
    kelasOptions += '<option value="' + escAttr(uniqueKelas[uk]) + '">' + esc(uniqueKelas[uk]) + '</option>';
  }

  document.getElementById('content').innerHTML=
    '<div class="panel">' +
      '<div class="d-flex flex-wrap gap-2 justify-content-between align-items-center mb-3">' +
        '<h5 class="mb-0">Data Siswa</h5>' +
        '<div class="d-flex gap-2">' +
          '<button class="btn btn-outline-success btn-sm" onclick="exportToCSV()"><i class="bi bi-file-earmark-spreadsheet me-1"></i> CSV</button>' +
          '<button class="btn btn-success btn-sm" onclick="exportGradesToGoogleSheet()"><i class="bi bi-google me-1"></i> Export Nilai ke Google Sheet</button>' +
        '</div>' +
      '</div>' +
      '<div class="row g-3 mb-3">' +
        '<div class="col-md-3"><input id="studentSearch" class="form-control" placeholder="Cari nama atau email..." oninput="filterStudents()"></div>' +
        '<div class="col-md-3">' +
          '<select id="studentClassFilter" class="form-select" onchange="filterStudents()">' +
            '<option value="">Semua Kelas</option>' + kelasOptions +
          '</select>' +
        '</div>' +
        '<div class="col-md-3">' +
          '<select id="studentCourseFilter" class="form-select" onchange="onStudentCourseFilterChange()">' +
            '<option value="">Semua Kursus</option>' + courseOptions +
          '</select>' +
        '</div>' +
        '<div class="col-md-3">' +
          '<select id="studentLessonFilter" class="form-select" onchange="filterStudents()">' +
            '<option value="">Semua Materi</option>' +
          '</select>' +
        '</div>' +
      '</div>' +
      '<div class="table-responsive">' +
        '<table class="table align-middle mb-0" id="monitoringTable">' +
          '<thead><tr><th>Siswa</th><th>Email</th><th>Kelas</th><th>Mapel</th><th>Kursus</th><th>Progres</th><th id="lessonStatusHeader" class="hidden">Status Materi</th><th id="avgScoreHeader">Rata-rata Quiz Terbaik</th><th id="lessonQuizScoreHeader" class="hidden">Nilai Kuis</th><th id="lessonTaskScoreHeader" class="hidden">Nilai Tugas</th><th id="lessonFinalScoreHeader" class="hidden">Nilai Akhir</th></tr></thead>' +
          '<tbody id="studentTableBody"></tbody>' +
        '</table>' +
      '</div>' +
    '</div>';
  populateLessonFilterOptions();
  filterStudents();
}

function exportGradesToGoogleSheet(){
  if(!AppState.user || (AppState.user.role!=='admin' && AppState.user.role!=='teacher')) return;
  var classEl=document.getElementById('studentClassFilter');
  var courseEl=document.getElementById('studentCourseFilter');
  var lessonEl=document.getElementById('studentLessonFilter');
  var searchEl=document.getElementById('studentSearch');
  var filters={
    kelas: classEl ? classEl.value : '',
    courseId: courseEl ? courseEl.value : '',
    lessonId: lessonEl ? lessonEl.value : '',
    search: searchEl ? searchEl.value : ''
  };
  serverCall('exportGradesToSheet',[AppState.user.id,filters],{
    loading:'Membuat Google Sheet rekap nilai...',
    success:function(res){
      if(!res || !res.success){ showToast(res && res.message ? res.message : 'Export gagal.','danger'); return; }
      showToast(res.data.message+' '+res.data.rows+' baris diekspor.','success');
      var url=res.data.url;
      if(url) window.open(url,'_blank');
    },
    failure:function(err){ showToast(errorMessage(err),'danger'); }
  });
}

function exportToCSV() {
  var table = document.getElementById('monitoringTable');
  var rows = table.querySelectorAll('tr');
  var csv = [];
  
  for (var i = 0; i < rows.length; i++) {
    var row = [];
    var cols = rows[i].querySelectorAll('td, th');
    
    if (cols.length === 1 && cols[0].innerText.indexOf('Tidak ada data') !== -1) continue;

    for (var j = 0; j < cols.length; j++) {
      var data = cols[j].innerText.replace(/(\r\n|\n|\r)/gm, " ").replace(/"/g, '""');
      row.push('"' + data + '"');
    }
    csv.push(row.join(','));
  }
  
  var csvString = csv.join('\n');
  var blob = new Blob(["\uFEFF" + csvString], { type: 'text/csv;charset=utf-8;' });
  
  if (navigator.msSaveBlob) { 
    navigator.msSaveBlob(blob, 'Data_Monitoring_Siswa.csv');
  } else {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'Data_Monitoring_Siswa.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

function lessonBelongsToCourse(lesson,courseId){
  if(!courseId) return true;
  var ids = Array.isArray(lesson.course_ids) && lesson.course_ids.length ? lesson.course_ids : [lesson.course_id];
  var matches = false;
  for(var i=0; i<ids.length; i++) { if(String(ids[i])===String(courseId)) {matches = true; break;} }
  return matches;
}

function onStudentCourseFilterChange(){
  populateLessonFilterOptions();
  filterStudents();
}

function populateLessonFilterOptions(){
  var courseEl = document.getElementById('studentCourseFilter');
  var courseId = courseEl ? courseEl.value : '';
  var lessonSelect=document.getElementById('studentLessonFilter');
  
  var relevant = [];
  for(var i=0; i<AppState.lessons.length; i++){
    if(lessonBelongsToCourse(AppState.lessons[i], courseId)) relevant.push(AppState.lessons[i]);
  }
  
  var previous=lessonSelect.value;
  var lessonOptions = '';
  for(var j=0; j<relevant.length; j++){
    var l = relevant[j];
    var title = esc(l.title) + (courseId ? '' : ' &mdash; ' + esc(l.course_title || courseName(l.course_id)));
    lessonOptions += '<option value="' + escAttr(l.id) + '">' + title + '</option>';
  }
  
  lessonSelect.innerHTML='<option value="">Semua Materi</option>' + lessonOptions;
  
  if(previous){
    for(var k=0; k<relevant.length; k++){
      if(String(relevant[k].id)===String(previous)) { lessonSelect.value=previous; break; }
    }
  }
}

function filterStudents(){
  var searchEl = document.getElementById('studentSearch');
  var q = searchEl ? searchEl.value.toLowerCase() : '';
  
  var classEl = document.getElementById('studentClassFilter');
  var classFilter = classEl ? classEl.value : '';
  
  var courseEl = document.getElementById('studentCourseFilter');
  var courseId = courseEl ? courseEl.value : '';
  
  var lessonEl = document.getElementById('studentLessonFilter');
  var lessonId = lessonEl ? lessonEl.value : '';
  
  var lesson = null;
  if(lessonId) {
    for(var i=0; i<AppState.lessons.length; i++) {
      if(String(AppState.lessons[i].id)===String(lessonId)) { lesson = AppState.lessons[i]; break; }
    }
  }

  var statusHeader = document.getElementById('lessonStatusHeader');
  var avgHeader = document.getElementById('avgScoreHeader');
  var lessonQuizHeader = document.getElementById('lessonQuizScoreHeader');
  var lessonTaskHeader = document.getElementById('lessonTaskScoreHeader');
  var lessonFinalHeader = document.getElementById('lessonFinalScoreHeader');
  if (statusHeader) statusHeader.classList.toggle('hidden', !lesson);
  if (avgHeader) avgHeader.classList.toggle('hidden', !!lesson);
  if (lessonQuizHeader) lessonQuizHeader.classList.toggle('hidden', !lesson);
  if (lessonTaskHeader) lessonTaskHeader.classList.toggle('hidden', !lesson);
  if (lessonFinalHeader) lessonFinalHeader.classList.toggle('hidden', !lesson);

  var quizSubs = (AppState.adminData && AppState.adminData.submissions) ? AppState.adminData.submissions : [];
  var assignSubs = (AppState.adminData && AppState.adminData.assignment_submissions) ? AppState.adminData.assignment_submissions : [];
  var rawAssignments = (AppState.adminData && AppState.adminData.assignments) ? AppState.adminData.assignments : [];

  var rawStudents = (AppState.adminData && AppState.adminData.students) ? AppState.adminData.students : [];
  var students = [];
  
  for(var sIdx=0; sIdx<rawStudents.length; sIdx++) {
    var s = rawStudents[sIdx];
    var text=(s.name+' '+s.email).toLowerCase();
    var matchesText = !q || text.indexOf(q) !== -1;
    
    var matchesClass = true;
    if (classFilter) {
      if (s.kelas) {
        matchesClass = String(s.kelas).trim() === classFilter.trim();
      } else {
        matchesClass = false; 
      }
    }
    
    var matchesCourse = !courseId;
    if(courseId) {
      var enrs = s.enrollments||[];
      for(var eIdx=0; eIdx<enrs.length; eIdx++){
        if(String(enrs[eIdx].course_id)===String(courseId)) { matchesCourse=true; break; }
      }
    }

    var matchesLesson = !lessonId;
    if(lessonId) {
      for(var qIdx=0; qIdx<quizSubs.length; qIdx++){
        if(String(quizSubs[qIdx].user_id)===String(s.id) && String(quizSubs[qIdx].lesson_id)===String(lessonId)) { matchesLesson=true; break; }
      }
      if(!matchesLesson){
        for(var asIdx=0; asIdx<assignSubs.length; asIdx++){
          if(String(assignSubs[asIdx].user_id)!==String(s.id)) continue;
          for(var laIdx=0; laIdx<rawAssignments.length; laIdx++){
            if(String(rawAssignments[laIdx].id)===String(assignSubs[asIdx].assignment_id) && String(rawAssignments[laIdx].lesson_id)===String(lessonId)){ matchesLesson=true; break; }
          }
          if(matchesLesson) break;
        }
      }
    }
    
    if(matchesText && matchesClass && matchesCourse && matchesLesson) students.push(s);
  }

  var lessonAssignments = [];
  if(lesson) {
    for(var aIdx=0; aIdx<rawAssignments.length; aIdx++){
      if(String(rawAssignments[aIdx].lesson_id)===String(lesson.id)) lessonAssignments.push(rawAssignments[aIdx]);
    }
  }

  var tbody = '';
  if (students.length > 0) {
    var trs = [];
    for(var st=0; st<students.length; st++) {
      var sObj = students[st];
      var enrollments = [];
      if(courseId){
        for(var e=0; e<(sObj.enrollments||[]).length; e++){
          if(String(sObj.enrollments[e].course_id)===String(courseId)) enrollments.push(sObj.enrollments[e]);
        }
      } else {
        enrollments = sObj.enrollments||[];
      }
      
      var coursesCellHtml = '';
      for(var c1=0; c1<enrollments.length; c1++){ coursesCellHtml += '<div>' + esc(enrollments[c1].course_title) + '</div>'; }
      if(!coursesCellHtml) coursesCellHtml = '<span class="text-secondary">-</span>';
      
      var progressCellHtml = '';
      for(var p1=0; p1<enrollments.length; p1++){
        var prog = Number(enrollments[p1].progress_percent||0);
        progressCellHtml += '<div class="mb-1"><div class="d-flex justify-content-between small"><span>' + esc(enrollments[p1].course_title) + '</span><span>' + prog + '%</span></div><div class="progress"><div class="progress-bar" style="width:' + prog + '%"></div></div></div>';
      }
      if(!progressCellHtml) progressCellHtml = '-';

      var lessonCell = '';
      if(lesson){
        var quizDone = false;
        for(var qz=0; qz<quizSubs.length; qz++) {
          if(String(quizSubs[qz].user_id)===String(sObj.id) && String(quizSubs[qz].lesson_id)===String(lesson.id)) { quizDone=true; break; }
        }
        var quizBadge = Number(lesson.quiz_question_count||0) > 0
          ? '<span class="badge ' + (quizDone?'text-bg-success':'text-bg-light') + ' me-1">Kuis: ' + (quizDone?'Selesai':'Belum') + '</span>' : '';
          
        var assignBadges = '';
        for(var ab=0; ab<lessonAssignments.length; ab++){
          var la = lessonAssignments[ab];
          var done = false;
          for(var as=0; as<assignSubs.length; as++){
            if(String(assignSubs[as].user_id)===String(sObj.id) && String(assignSubs[as].assignment_id)===String(la.id)) { done=true; break; }
          }
          assignBadges += '<span class="badge ' + (done?'text-bg-success':'text-bg-light') + ' me-1 mb-1">' + esc(la.title) + ': ' + (done?'Dikumpulkan':'Belum') + '</span>';
        }
        lessonCell = '<td>' + quizBadge + assignBadges + (!quizBadge && !assignBadges ? '<span class="text-secondary">-</span>' : '') + '</td>';
      }

      var kelasCell = sObj.kelas ? esc(sObj.kelas) : '-';
      var mapelCell = sObj.mapel ? esc(sObj.mapel) : '-';

      var lessonQuizScore = '';
      var lessonTaskScore = '';
      var lessonFinalScore = '';
      if (lesson) {
        // Nilai Monitoring diambil dari mesin nilai backend yang sama dengan Export.
        var gradeMap = (AppState.adminData && AppState.adminData.lesson_grades) ? AppState.adminData.lesson_grades : {};
        var grade = gradeMap[String(sObj.id) + '|' + String(lesson.id)];

        if (grade) {
          lessonQuizScore = grade.quiz_score;
          lessonTaskScore = grade.task_score;
          lessonFinalScore = Number(grade.final_score || 0);
        } else {
          // Fallback untuk kompatibilitas versi lama.
          var quizScoresForLesson = [];
          for (var qsi=0; qsi<quizSubs.length; qsi++) {
            var qs=quizSubs[qsi];
            if(String(qs.user_id)===String(sObj.id) && String(qs.lesson_id)===String(lesson.id) && qs.is_quiz_attempt && qs.score!==null && qs.score!=='' && !isNaN(Number(qs.score))) {
              quizScoresForLesson.push(Number(qs.score));
            }
          }
          var hasQuiz = Number(lesson.quiz_question_count||0) > 0;
          if (hasQuiz) lessonQuizScore = quizScoresForLesson.length ? Math.max.apply(null, quizScoresForLesson) : '';

          var taskScoresForLesson = [];
          var hasTask = lessonAssignments.length > 0;
          for (var asi=0; asi<assignSubs.length; asi++) {
            var assub=assignSubs[asi];
            if(String(assub.user_id)!==String(sObj.id) || assub.score===null || assub.score==='' || isNaN(Number(assub.score))) continue;
            for (var lai=0; lai<lessonAssignments.length; lai++) {
              if(String(lessonAssignments[lai].id)===String(assub.assignment_id)) { taskScoresForLesson.push(Number(assub.score)); break; }
            }
          }
          if (hasTask) lessonTaskScore = taskScoresForLesson.length ? Math.round(taskScoresForLesson.reduce(function(a,b){return a+b;},0)/taskScoresForLesson.length) : '';

          var vScore = 0;
          for (var vdi=0; vdi<quizSubs.length; vdi++) {
            if(String(quizSubs[vdi].user_id)===String(sObj.id) && String(quizSubs[vdi].lesson_id)===String(lesson.id) && quizSubs[vdi].score === 'VIDEO_WATCHED') { vScore=100; break; }
          }
          var qScore = hasQuiz ? (lessonQuizScore === '' ? 0 : Number(lessonQuizScore)) : 100;
          var tScore = hasTask ? (lessonTaskScore === '' ? 0 : Number(lessonTaskScore)) : 100;
          lessonFinalScore = Math.round((vScore*0.30)+(qScore*0.30)+(tScore*0.40));
        }
      }

      var scoreCells = lesson
        ? '<td>' + (lessonQuizScore === '' ? '-' : Number(lessonQuizScore)) + '</td><td>' + (lessonTaskScore === '' ? '-' : Number(lessonTaskScore)) + '</td><td><strong>' + Number(lessonFinalScore) + '</strong></td>'
        : '<td>' + Number(sObj.average_score||0) + '</td>';

      trs.push('<tr>' +
        '<td><div class="fw-semibold">' + esc(sObj.name) + '</div></td>' +
        '<td>' + esc(sObj.email) + '</td>' +
        '<td>' + kelasCell + '</td>' +
        '<td>' + mapelCell + '</td>' +
        '<td>' + coursesCellHtml + '</td>' +
        '<td>' + progressCellHtml + '</td>' +
        lessonCell +
        (lesson ? '<td class="hidden">' + Number(sObj.average_score||0) + '</td>' + scoreCells : scoreCells) +
      '</tr>');
    }
    tbody = trs.join('');
  } else {
    tbody = '<tr><td colspan="' + (lesson ? 11 : 7) + '" class="text-center text-secondary py-4">Tidak ada data siswa.</td></tr>';
  }

  document.getElementById('studentTableBody').innerHTML = tbody;
}



/* ============================================================
   ANALITIK GURU
   ============================================================ */
function loadAnalyticsPage(){
  serverCall('getTeacherAnalyticsData',[AppState.user.id,{}],{
    loading:'Memuat analitik guru...',
    success:function(res){
      if(AppState.view!=='analytics') return;
      if(!res || !res.success){showToast(res && res.message ? res.message : 'Gagal memuat analitik.','danger');return;}
      AppState.analyticsData=res.data||null;
      renderAnalyticsPage();
    },
    failure:function(err){showToast(errorMessage(err),'danger');}
  });
}

function renderAnalyticsPage(){
  var data=AppState.analyticsData||{};
  var courses=Array.isArray(data.courses)?data.courses:[];
  var classes=Array.isArray(data.classes)?data.classes:[];
  var s=data.summary||{};

  var classOptions='<option value="">Semua Kelas</option>';
  for(var i=0;i<classes.length;i++) classOptions+='<option value="'+escAttr(classes[i])+'">'+esc(classes[i])+'</option>';
  var courseOptions='<option value="">Semua Course</option>';
  for(var j=0;j<courses.length;j++) courseOptions+='<option value="'+escAttr(courses[j].id)+'">'+esc(courses[j].title)+'</option>';

  document.getElementById('content').innerHTML=
    '<div class="panel mb-3">'+
      '<div class="d-flex flex-wrap justify-content-between align-items-center gap-2">'+
        '<div><h5 class="mb-1"><i class="bi bi-graph-up-arrow me-2"></i>Analitik Guru</h5><div class="text-secondary small">Pantau performa kelas, Course, Lesson, progres, dan siswa yang perlu perhatian.</div></div>'+
        '<button class="btn btn-outline-primary btn-sm" onclick="loadAnalyticsPage()"><i class="bi bi-arrow-clockwise me-1"></i>Refresh</button>'+
      '</div>'+
      '<div class="row g-3 mt-1">'+
        '<div class="col-md-6"><label class="form-label small">Kelas</label><select id="analyticsClassFilter" class="form-select" onchange="applyAnalyticsFilters()">'+classOptions+'</select></div>'+
        '<div class="col-md-6"><label class="form-label small">Course</label><select id="analyticsCourseFilter" class="form-select" onchange="applyAnalyticsFilters()">'+courseOptions+'</select></div>'+
      '</div>'+
    '</div>'+
    '<div id="analyticsContent"></div>';
  renderAnalyticsContent(data);
}

function applyAnalyticsFilters(){
  var classEl=document.getElementById('analyticsClassFilter');
  var courseEl=document.getElementById('analyticsCourseFilter');
  serverCall('getTeacherAnalyticsData',[AppState.user.id,{
    kelas:classEl?classEl.value:'',
    courseId:courseEl?courseEl.value:''
  }],{
    loading:'Memperbarui analitik...',
    success:function(res){
      if(AppState.view!=='analytics') return;
      if(!res || !res.success){showToast(res && res.message ? res.message : 'Gagal memperbarui analitik.','danger');return;}
      AppState.analyticsData=res.data||null;
      // Pertahankan filter yang dipilih.
      renderAnalyticsContent(res.data||{});
    },
    failure:function(err){showToast(errorMessage(err),'danger');}
  });
}

function analyticsBar(label,value,meta){
  var v=Math.max(0,Math.min(100,Number(value||0)));
  return '<div class="mb-3">'+
    '<div class="d-flex justify-content-between align-items-center small mb-1"><span class="fw-semibold">'+esc(label)+'</span><span>'+v+'%'+(meta?' · '+esc(meta):'')+'</span></div>'+
    '<div class="progress" style="height:9px"><div class="progress-bar" style="width:'+v+'%"></div></div>'+
  '</div>';
}

function renderAnalyticsContent(data){
  var s=data.summary||{};
  var courses=Array.isArray(data.course_performance)?data.course_performance:[];
  var classes=Array.isArray(data.class_performance)?data.class_performance:[];
  var lessons=Array.isArray(data.lesson_attention)?data.lesson_attention:[];
  var atRisk=Array.isArray(data.at_risk)?data.at_risk:[];

  var courseHtml='';
  for(var i=0;i<courses.length;i++){
    var c=courses[i];
    courseHtml+=analyticsBar(c.course_title,c.average_score,'Progres '+Number(c.average_progress||0)+'% · Tuntas '+Number(c.pass_percent||0)+'%');
  }
  if(!courseHtml) courseHtml='<div class="text-secondary">Belum ada data Course.</div>';

  var classHtml='';
  for(var j=0;j<classes.length;j++){
    var cl=classes[j];
    classHtml+='<tr>'+
      '<td><strong>'+esc(cl.kelas||'-')+'</strong></td>'+
      '<td>'+esc(cl.course_title||'Semua Course')+'</td>'+
      '<td>'+Number(cl.students||0)+'</td>'+
      '<td><strong>'+Number(cl.average_score||0)+'</strong></td>'+
      '<td>'+Number(cl.highest_score||0)+'</td>'+
      '<td>'+Number(cl.lowest_score||0)+'</td>'+
      '<td>'+Number(cl.pass_percent||0)+'%</td>'+
    '</tr>';
  }
  if(!classHtml) classHtml='<tr><td colspan="7" class="text-center text-secondary py-4">Belum ada data kelas.</td></tr>';

  var lessonHtml='';
  for(var k=0;k<lessons.length;k++){
    var l=lessons[k];
    var concern=l.average_score<75 || l.pass_percent<75;
    lessonHtml+='<tr>'+
      '<td><div class="fw-semibold">'+esc(l.lesson_title)+'</div><div class="small text-secondary">'+esc(l.course_title)+'</div></td>'+
      '<td><strong>'+Number(l.average_score||0)+'</strong></td>'+
      '<td>'+Number(l.lowest_score||0)+'</td>'+
      '<td>'+Number(l.pass_percent||0)+'%</td>'+
      '<td>'+Number(l.video_completion||0)+'%</td>'+
      '<td>'+Number(l.quiz_completion||0)+'%</td>'+
      '<td>'+Number(l.task_completion||0)+'%</td>'+
      '<td>'+(concern?'<span class="badge text-bg-warning">Perlu perhatian</span>':'<span class="badge text-bg-success">Baik</span>')+'</td>'+
    '</tr>';
  }
  if(!lessonHtml) lessonHtml='<tr><td colspan="8" class="text-center text-secondary py-4">Belum ada data Lesson.</td></tr>';

  var riskHtml='';
  for(var r=0;r<atRisk.length;r++){
    var x=atRisk[r];
    riskHtml+='<tr>'+
      '<td><div class="fw-semibold">'+esc(x.name)+'</div><div class="small text-secondary">'+esc(x.kelas)+'</div></td>'+
      '<td>'+esc(x.course_title)+'</td>'+
      '<td>'+Number(x.final_score||0)+'</td>'+
      '<td>'+Number(x.progress_percent||0)+'%</td>'+
      '<td><span class="badge text-bg-warning">'+esc(x.reason)+'</span></td>'+
    '</tr>';
  }
  if(!riskHtml) riskHtml='<tr><td colspan="5" class="text-center text-success py-4"><i class="bi bi-check-circle me-1"></i>Tidak ada siswa yang memenuhi kriteria perhatian.</td></tr>';

  document.getElementById('analyticsContent').innerHTML=
    '<div class="row g-3 mb-3">'+
      statCard('Siswa',s.students||0,'bi-people')+
      statCard('Rata-rata Nilai',s.average_score||0,'bi-bar-chart')+
      statCard('Rata-rata Progres',(s.average_progress||0)+'%','bi-graph-up')+
      statCard('Ketuntasan',(s.pass_percent||0)+'%','bi-check-circle')+
      statCard('Perlu Perhatian',s.at_risk||0,'bi-exclamation-triangle')+
    '</div>'+
    '<div class="row g-3 mb-3">'+
      '<div class="col-lg-6"><div class="panel h-100"><h6 class="mb-3">Performa Course</h6>'+courseHtml+'</div></div>'+
      '<div class="col-lg-6"><div class="panel h-100"><h6 class="mb-3">Interpretasi Cepat</h6>'+
        '<div class="d-flex justify-content-between border-bottom py-2"><span>Nilai rata-rata</span><strong>'+Number(s.average_score||0)+'</strong></div>'+
        '<div class="d-flex justify-content-between border-bottom py-2"><span>Progres rata-rata</span><strong>'+Number(s.average_progress||0)+'%</strong></div>'+
        '<div class="d-flex justify-content-between border-bottom py-2"><span>Persentase tuntas</span><strong>'+Number(s.pass_percent||0)+'%</strong></div>'+
        '<div class="d-flex justify-content-between py-2"><span>Siswa perlu perhatian</span><strong>'+Number(s.at_risk||0)+'</strong></div>'+
        '<div class="small text-secondary mt-3">Kriteria perhatian: nilai Course &lt; 75 atau progres &lt; 60%.</div>'+
      '</div></div>'+
    '</div>'+
    '<div class="panel mb-3"><div class="d-flex justify-content-between align-items-center mb-3"><div><h6 class="mb-1">Performa per Kelas</h6><div class="small text-secondary">Rata-rata dan ketuntasan berdasarkan Kelas + Course.</div></div></div>'+
      '<div class="table-responsive"><table class="table align-middle mb-0"><thead><tr><th>Kelas</th><th>Course</th><th>Siswa</th><th>Rata-rata</th><th>Tertinggi</th><th>Terendah</th><th>% Tuntas</th></tr></thead><tbody>'+classHtml+'</tbody></table></div>'+
    '</div>'+
    '<div class="panel mb-3"><div class="mb-3"><h6 class="mb-1">Lesson yang Perlu Perhatian</h6><div class="small text-secondary">Diurutkan dari nilai rata-rata terendah.</div></div>'+
      '<div class="table-responsive"><table class="table align-middle mb-0"><thead><tr><th>Lesson</th><th>Rata-rata</th><th>Terendah</th><th>% Tuntas</th><th>Video</th><th>Quiz</th><th>Tugas</th><th>Status</th></tr></thead><tbody>'+lessonHtml+'</tbody></table></div>'+
    '</div>'+
    '<div class="panel"><div class="mb-3"><h6 class="mb-1">Siswa yang Perlu Perhatian</h6><div class="small text-secondary">Prioritas follow-up berdasarkan nilai Course dan progres.</div></div>'+
      '<div class="table-responsive"><table class="table align-middle mb-0"><thead><tr><th>Siswa</th><th>Course</th><th>Nilai</th><th>Progres</th><th>Alasan</th></tr></thead><tbody>'+riskHtml+'</tbody></table></div>'+
    '</div>';
}


/* REKAP NILAI COURSE + REKAP PER KELAS */
function loadRecapPage(){
  serverCall('getRecapData',[AppState.user.id,{}],{
    loading:'Memuat rekap nilai Course dan kelas...',
    success:function(res){
      if(AppState.view!=='recap') return;
      if(!res || !res.success){showToast(res && res.message ? res.message : 'Gagal memuat rekap.','danger');return;}
      AppState.recapData=res.data||null;
      AppState.recapTab='course';
      renderRecapPage();
    },
    failure:function(err){showToast(errorMessage(err),'danger');}
  });
}

function renderRecapPage(){
  var data=AppState.recapData||{};
  var courses=Array.isArray(data.courses)?data.courses:[];
  var classes=Array.isArray(data.classes)?data.classes:[];
  var courseRows=Array.isArray(data.course_recap)?data.course_recap:[];
  var classRows=Array.isArray(data.class_recap)?data.class_recap:[];

  var courseOptions='<option value="">Semua Course</option>';
  for(var i=0;i<courses.length;i++) courseOptions+='<option value="'+escAttr(courses[i].id)+'">'+esc(courses[i].title)+'</option>';
  var classOptions='<option value="">Semua Kelas</option>';
  for(var j=0;j<classes.length;j++) classOptions+='<option value="'+escAttr(classes[j])+'">'+esc(classes[j])+'</option>';

  document.getElementById('content').innerHTML=
    '<div class="row g-3 mb-4">'+
      statCard('Rekaman Course',data.summary ? data.summary.records : 0,'bi-journal-check')+
      statCard('Siswa',data.summary ? data.summary.students : 0,'bi-people')+
      statCard('Rata-rata Nilai',data.summary ? data.summary.average_score : 0,'bi-bar-chart')+
      statCard('Tuntas',data.summary ? data.summary.passed : 0,'bi-check-circle')+
    '</div>'+
    '<div class="panel mb-4">'+
      '<div class="d-flex flex-wrap gap-2 justify-content-between align-items-center mb-3">'+
        '<div><h5 class="mb-1">Rekap Nilai</h5><div class="text-secondary small">Nilai Course dihitung dari rata-rata Nilai Akhir seluruh Lesson. Batas tuntas: '+(data.summary ? data.summary.passing_score : 75)+'</div></div>'+ 
        '<div class="d-flex gap-2">'+
          '<button class="btn btn-outline-primary btn-sm" onclick="refreshRecap()"><i class="bi bi-arrow-clockwise me-1"></i>Refresh</button>'+ 
          '<button class="btn btn-success btn-sm" onclick="exportRecapToGoogleSheet()"><i class="bi bi-google me-1"></i>Export Rekap ke Google Sheet</button>'+ 
        '</div>'+ 
      '</div>'+ 
      '<div class="row g-3 mb-3">'+
        '<div class="col-md-4"><input id="recapSearch" class="form-control" placeholder="Cari nama atau email..." oninput="filterRecap()"></div>'+ 
        '<div class="col-md-4"><select id="recapClassFilter" class="form-select" onchange="filterRecap()">'+classOptions+'</select></div>'+ 
        '<div class="col-md-4"><select id="recapCourseFilter" class="form-select" onchange="filterRecap()">'+courseOptions+'</select></div>'+ 
      '</div>'+ 
      '<div class="btn-group mb-3" role="group">'+
        '<button id="recapTabCourse" class="btn btn-primary" onclick="setRecapTab(\'course\')"><i class="bi bi-person-lines-fill me-1"></i>Rekap per Siswa & Course</button>'+ 
        '<button id="recapTabClass" class="btn btn-outline-primary" onclick="setRecapTab(\'class\')"><i class="bi bi-people-fill me-1"></i>Rekap per Kelas</button>'+ 
      '</div>'+ 
      '<div id="recapTableWrap"></div>'+ 
    '</div>';

  filterRecap();
}

function setRecapTab(tab){
  AppState.recapTab=tab==='class'?'class':'course';
  var a=document.getElementById('recapTabCourse');
  var b=document.getElementById('recapTabClass');
  if(a){a.className=AppState.recapTab==='course'?'btn btn-primary':'btn btn-outline-primary';}
  if(b){b.className=AppState.recapTab==='class'?'btn btn-primary':'btn btn-outline-primary';}
  filterRecap();
}

function filterRecap(){
  var data=AppState.recapData||{};
  var q=(document.getElementById('recapSearch')||{}).value||'';
  var classFilter=(document.getElementById('recapClassFilter')||{}).value||'';
  var courseFilter=(document.getElementById('recapCourseFilter')||{}).value||'';
  q=String(q).toLowerCase().trim();

  if(AppState.recapTab==='class'){
    var classes=Array.isArray(data.class_recap)?data.class_recap:[];
    // Untuk tab kelas, search diterapkan pada nama kelas/course.
    classes=classes.filter(function(r){
      if(classFilter && String(r.kelas)!==String(classFilter)) return false;
      if(courseFilter){
        var selectedCourseTitle='';
        var cs=Array.isArray(data.courses)?data.courses:[];
        for(var i=0;i<cs.length;i++) if(String(cs[i].id)===String(courseFilter)){selectedCourseTitle=String(cs[i].title||'');break;}
        if(selectedCourseTitle && String(r.course_title)!==selectedCourseTitle) return false;
      }
      if(q && (String(r.kelas)+' '+String(r.course_title)).toLowerCase().indexOf(q)===-1) return false;
      return true;
    });
    renderClassRecapTable(classes);
  }else{
    var rows=Array.isArray(data.course_recap)?data.course_recap:[];
    rows=rows.filter(function(r){
      if(classFilter && String(r.kelas)!==String(classFilter)) return false;
      if(courseFilter && String(r.course_id)!==String(courseFilter)) return false;
      if(q && (String(r.name)+' '+String(r.email)+' '+String(r.course_title)).toLowerCase().indexOf(q)===-1) return false;
      return true;
    });
    renderCourseRecapTable(rows);
  }
}

function renderCourseRecapTable(rows){
  var html='<div class="table-responsive"><table class="table align-middle mb-0"><thead><tr>'+ 
    '<th>No</th><th>Siswa</th><th>Email</th><th>Kelas</th><th>Course</th><th>Lesson</th><th>Progress</th><th>Video</th><th>Quiz</th><th>Tugas</th><th>Nilai Akhir</th><th>Status</th>'+ 
    '</tr></thead><tbody>';
  if(!rows.length){html+='<tr><td colspan="12" class="text-center text-secondary py-4">Tidak ada data rekap.</td></tr>';}else{
    for(var i=0;i<rows.length;i++){
      var r=rows[i];
      var status=r.status==='Tuntas'?'<span class="badge text-bg-success">Tuntas</span>':'<span class="badge text-bg-warning">Belum Tuntas</span>';
      html+='<tr>'+ 
        '<td>'+(i+1)+'</td>'+ 
        '<td><div class="fw-semibold">'+esc(r.name)+'</div></td>'+ 
        '<td>'+esc(r.email)+'</td>'+ 
        '<td>'+esc(r.kelas||'-')+'</td>'+ 
        '<td><div class="fw-semibold">'+esc(r.course_title)+'</div></td>'+ 
        '<td>'+Number(r.lesson_count||0)+'</td>'+ 
        '<td><div class="small">'+Number(r.progress_percent||0)+'%</div><div class="progress" style="height:6px"><div class="progress-bar" style="width:'+Number(r.progress_percent||0)+'%"></div></div></td>'+ 
        '<td>'+Number(r.avg_video||0)+'</td>'+ 
        '<td>'+(r.avg_quiz===null||r.avg_quiz===undefined?'-':Number(r.avg_quiz))+'</td>'+ 
        '<td>'+(r.avg_task===null||r.avg_task===undefined?'-':Number(r.avg_task))+'</td>'+ 
        '<td><strong class="fs-6">'+Number(r.final_score||0)+'</strong></td>'+ 
        '<td>'+status+'</td>'+ 
      '</tr>';
    }
  }
  html+='</tbody></table></div>';
  document.getElementById('recapTableWrap').innerHTML=html;
}

function renderClassRecapTable(rows){
  var html='<div class="table-responsive"><table class="table align-middle mb-0"><thead><tr>'+ 
    '<th>No</th><th>Kelas</th><th>Course</th><th>Siswa</th><th>Rekaman</th><th>Rata-rata</th><th>Tertinggi</th><th>Terendah</th><th>Tuntas</th><th>Belum Tuntas</th><th>% Tuntas</th>'+ 
    '</tr></thead><tbody>';
  if(!rows.length){html+='<tr><td colspan="11" class="text-center text-secondary py-4">Tidak ada data rekap kelas.</td></tr>';}else{
    for(var i=0;i<rows.length;i++){
      var r=rows[i];
      var avg=Number(r.average_score||0);
      html+='<tr>'+ 
        '<td>'+(i+1)+'</td>'+ 
        '<td><span class="badge text-bg-light border">'+esc(r.kelas)+'</span></td>'+ 
        '<td>'+esc(r.course_title||'Semua Course')+'</td>'+ 
        '<td>'+Number(r.students||0)+'</td>'+ 
        '<td>'+Number(r.records||0)+'</td>'+ 
        '<td><strong>'+avg+'</strong></td>'+ 
        '<td>'+Number(r.highest_score||0)+'</td>'+ 
        '<td>'+Number(r.lowest_score||0)+'</td>'+ 
        '<td><span class="badge text-bg-success">'+Number(r.passed||0)+'</span></td>'+ 
        '<td><span class="badge text-bg-warning">'+Number(r.not_passed||0)+'</span></td>'+ 
        '<td>'+Number(r.pass_percent||0)+'%</td>'+ 
      '</tr>';
    }
  }
  html+='</tbody></table></div>';
  document.getElementById('recapTableWrap').innerHTML=html;
}

function refreshRecap(){
  loadRecapPage();
}

function exportRecapToGoogleSheet(){
  if(!AppState.user || (AppState.user.role!=='admin' && AppState.user.role!=='teacher')) return;
  var classEl=document.getElementById('recapClassFilter');
  var courseEl=document.getElementById('recapCourseFilter');
  var searchEl=document.getElementById('recapSearch');
  var filters={
    kelas:classEl?classEl.value:'',
    courseId:courseEl?courseEl.value:'',
    search:searchEl?searchEl.value:''
  };
  serverCall('exportRecapToSheet',[AppState.user.id,filters],{
    loading:'Membuat Google Sheet Rekap Course & Kelas...',
    success:function(res){
      if(!res || !res.success){showToast(res && res.message ? res.message : 'Export rekap gagal.','danger');return;}
      showToast(res.data.message+' '+res.data.course_rows+' baris Course, '+res.data.class_rows+' baris Kelas.','success');
      if(res.data.url) window.open(res.data.url,'_blank');
    },
    failure:function(err){showToast(errorMessage(err),'danger');}
  });
}

/* COURSE MODAL */
function openCourseModal(id){
  if(!AppState.user || AppState.user.role!=='admin') return;
  document.getElementById('courseForm').reset();
  document.getElementById('courseId').value='';
  document.getElementById('courseModalTitle').textContent='Tambah Kursus';
  populateCourseClassSelect([]);
  if(id){
    var c = null;
    for(var i=0; i<AppState.courses.length; i++) {
      if(String(AppState.courses[i].id)===String(id)) { c = AppState.courses[i]; break; }
    }
    if(c){
      document.getElementById('courseId').value=c.id;
      document.getElementById('courseTitle').value=c.title;
      document.getElementById('courseCategory').value=c.category;
      document.getElementById('courseInstructor').value=c.instructor;
      document.getElementById('courseDescription').value=c.description;
      populateCourseClassSelect(c.assigned_classes || []);
      document.getElementById('courseModalTitle').textContent='Edit Kursus';
    }
  }
  courseModal.show();
}

function handleSaveCourse(e){
  if(!AppState.user || AppState.user.role!=='admin') return;
  e.preventDefault();
  serverCall('saveCourse',[{
    id:document.getElementById('courseId').value,
    title:document.getElementById('courseTitle').value,
    category:document.getElementById('courseCategory').value,
    instructor:document.getElementById('courseInstructor').value,
    description:document.getElementById('courseDescription').value,
    assigned_classes:getSelectedCourseClasses(),
    adminUserId:AppState.user.id
  }],{
    loading:'Menyimpan kursus...',
    success:function(res){
      if(!res.success){showToast(res.message,'danger');return;}
      courseModal.hide(); showToast(res.data.message,'success'); loadAdminDashboard();
    }
  });
}

function removeCourse(id){
  if(!AppState.user || AppState.user.role!=='admin') return;
  if(!confirm('Hapus kursus ini beserta materi dan semua pendaftaran siswa terkait?')) return;
  serverCall('deleteCourse',[id,AppState.user.id],{
    loading:'Menghapus kursus...',
    success:function(res){
      if(!res.success){showToast(res.message,'danger');return;}
      showToast(res.data.message,'success'); loadAdminDashboard();
    }
  });
}

/* LESSON MODAL */
function openLessonModal(id){
  if(!AppState.user || (AppState.user.role!=='admin' && AppState.user.role!=='teacher')) return;

  document.getElementById('lessonForm').reset();
  document.getElementById('lessonId').value='';
  document.getElementById('lessonOrder').value=1;
  document.getElementById('lessonModalTitle').textContent='Tambah Materi';
  document.getElementById('lessonAlert').innerHTML='';
  setCourseSelectLoading();
  resetAssignmentForm();
  document.getElementById('assignmentManager').classList.add('hidden');
  document.getElementById('assignmentUnsavedNote').classList.remove('hidden');
  document.getElementById('assignmentList').innerHTML='';

  var workspaceTeacher = AppState.user && AppState.user.role === 'teacher';
  var courseMethod = workspaceTeacher ? 'getTeacherCourseWorkspace' : 'getAdminCourses';
  serverCall(courseMethod,[AppState.user.id],{
    loading:workspaceTeacher ? 'Memuat Course yang ditugaskan...' : 'Memuat pilihan kursus...',
    success:function(res){
      if(!res.success){
        showAlert('lessonAlert',res.message,'danger');
        return;
      }

      AppState.courses = workspaceTeacher ? (res.data.courses || []) : (res.data || []);
      if(workspaceTeacher && res.data.lessons){
        AppState.lessons = res.data.lessons || [];
      }
      populateLessonCourseSelect();

      if(id){
        var lesson = null;
        for(var i=0; i<AppState.lessons.length; i++){
          if(String(AppState.lessons[i].id)===String(id)) { lesson = AppState.lessons[i]; break; }
        }
        if(lesson){
          document.getElementById('lessonId').value=lesson.id;
          document.getElementById('lessonTitle').value=lesson.title;
          document.getElementById('lessonDescription').value=lesson.description||'';
          document.getElementById('lessonVideo').value=lesson.video_url||'';
          document.getElementById('lessonContent').value=lesson.content||'';
          document.getElementById('lessonQuiz').value = Array.isArray(lesson.quiz_questions) && lesson.quiz_questions.length ? JSON.stringify(lesson.quiz_questions,null,2) : '';
          document.getElementById('lessonOrder').value=lesson.order||1;
          
          var ids = Array.isArray(lesson.course_ids) && lesson.course_ids.length ? lesson.course_ids : [lesson.course_id];
          var selectOpts = document.getElementById('lessonCourseId').options;
          for(var j=0; j<selectOpts.length; j++) {
            var val = selectOpts[j].value;
            var isSel = false;
            for(var k=0; k<ids.length; k++){ if(String(ids[k])===String(val)){ isSel=true; break; } }
            selectOpts[j].selected = isSel;
          }
          
          document.getElementById('lessonModalTitle').textContent='Edit Materi';
          document.getElementById('assignmentUnsavedNote').classList.add('hidden');
          document.getElementById('assignmentManager').classList.remove('hidden');
          loadAssignmentList(lesson.id);
        }
      }

      document.getElementById('courseSelectStatus').textContent=AppState.courses.length+' '+(workspaceTeacher?'Course ditugaskan':'kursus')+' tersedia.';
      if(workspaceTeacher){
        document.getElementById('lessonCourseId').removeAttribute('multiple');
        document.getElementById('lessonCourseId').setAttribute('size','5');
        document.querySelector('#lessonModal .form-text').textContent='Guru hanya dapat menambahkan Lesson pada Course yang ditugaskan. Lesson yang sudah memiliki data siswa tetap harus diedit dengan hati-hati.';
      }
      lessonModal.show();
    },
    failure:function(err){
      showAlert('lessonAlert',errorMessage(err),'danger');
    }
  });
}

function setCourseSelectLoading(){
  var select=document.getElementById('lessonCourseId');
  select.innerHTML='<option value="">Memuat daftar kursus...</option>';
  select.disabled=true;
  document.getElementById('courseSelectStatus').textContent='';
}
function populateLessonCourseSelect(){
  var select=document.getElementById('lessonCourseId');
  var opts = '';
  for(var i=0; i<AppState.courses.length; i++) { opts += '<option value="' + escAttr(AppState.courses[i].id) + '">' + esc(AppState.courses[i].title) + '</option>'; }
  select.innerHTML = opts;
  select.disabled=AppState.courses.length===0;
  if(!AppState.courses.length){
    select.innerHTML='<option value="">Belum ada kursus. Buat kursus terlebih dahulu.</option>';
  }
}

function handleSaveLesson(e){
  e.preventDefault();
  
  var select = document.getElementById('lessonCourseId');
  var courseIds = [];
  if (select && select.options) {
    for(var i=0; i<select.options.length; i++){
      if(select.options[i].selected && select.options[i].value) {
        courseIds.push(select.options[i].value);
      }
    }
  }
  
  if(!courseIds.length){
    showAlert('lessonAlert','Silakan pilih minimal satu kursus.','danger');
    return;
  }

  var quiz=[];
  var raw=document.getElementById('lessonQuiz').value.trim();
  if(raw){
    try{
      quiz=JSON.parse(raw);
      if(!Array.isArray(quiz)) throw new Error('Quiz harus berupa array JSON.');
    }catch(err){
      showAlert('lessonAlert','Format Quiz JSON tidak valid: '+err.message,'danger');
      return;
    }
  }

  serverCall('saveLesson',[{
    id:document.getElementById('lessonId').value,
    course_ids:courseIds,
    title:document.getElementById('lessonTitle').value,
    description:document.getElementById('lessonDescription').value,
    video_url:document.getElementById('lessonVideo').value,
    content:document.getElementById('lessonContent').value,
    quiz_questions:quiz,
    order:Number(document.getElementById('lessonOrder').value||1),
    adminUserId:AppState.user.id
  }],{
    loading:'Menyimpan materi...',
    success:function(res){
      if(!res.success){showAlert('lessonAlert',res.message,'danger');return;}
      var savedId=res.data.id;
      document.getElementById('lessonId').value=savedId;
      showToast(res.data.message,'success');
      document.getElementById('assignmentUnsavedNote').classList.add('hidden');
      document.getElementById('assignmentManager').classList.remove('hidden');
      loadAssignmentList(savedId);
      loadLessonsPage();
    }
  });
}

function resetAssignmentForm(){
  document.getElementById('assignmentId').value='';
  document.getElementById('assignmentTitle').value='';
  document.getElementById('assignmentDescription').value='';
}

function loadAssignmentList(lessonId){
  serverCall('getAssignmentsByLesson',[lessonId,AppState.user.id],{
    loading:'Memuat daftar tugas...',
    success:function(res){
      if(!res.success){showToast(res.message,'danger');return;}
      AppState.currentLessonAssignments=res.data||[];
      renderAssignmentList();
    }
  });
}

function renderAssignmentList(){
  var items = AppState.currentLessonAssignments || [];
  var html = '';
  
  if (items.length > 0) {
    var itemHtmlArr = [];
    for(var i=0; i<items.length; i++) {
      var a = items[i];
      var subsHtml = '';
      if(a.submissions && a.submissions.length > 0) {
        var subHtmlArr = [];
        for(var j=0; j<a.submissions.length; j++) {
          var sub = a.submissions[j];
          subHtmlArr.push('<div class="d-flex align-items-center justify-content-between bg-light p-2 rounded mb-1">' +
             '<div class="small text-truncate me-2" style="max-width:200px;" title="'+escAttr(sub.user_name)+'">' +
               '<b>' + esc(sub.user_name) + '</b> <a href="' + escAttr(sub.file_url) + '" target="_blank">[Lihat]</a>' +
             '</div>' +
             '<div class="d-flex align-items-center gap-2">' +
               '<input type="number" id="grade_' + escAttr(sub.id) + '" class="form-control form-control-sm" style="width:70px" placeholder="0-100" value="' + (sub.score||'') + '">' +
               '<button type="button" class="btn btn-sm btn-success" onclick="gradeStudent(\'' + sub.id + '\')">Nilai</button>' +
             '</div>' +
          '</div>');
        }
        subsHtml = subHtmlArr.join('');
      } else {
        subsHtml = '<div class="small text-secondary">Belum ada siswa yang mengumpulkan.</div>';
      }

      itemHtmlArr.push('<div class="border rounded-3 p-3 mb-2">' +
        '<div class="d-flex justify-content-between align-items-start gap-2">' +
          '<div>' +
            '<div class="fw-semibold">' + esc(a.title) + '</div>' +
            (a.description ? '<div class="small text-secondary">' + esc(a.description) + '</div>' : '') +
          '</div>' +
          '<div class="text-nowrap">' +
            '<button type="button" class="btn btn-sm btn-outline-primary me-1" onclick="editAssignmentItem(\'' + a.id + '\')"><i class="bi bi-pencil"></i></button>' +
            '<button type="button" class="btn btn-sm btn-outline-danger" onclick="removeAssignmentItem(\'' + a.id + '\')"><i class="bi bi-trash"></i></button>' +
          '</div>' +
        '</div>' +
        '<div class="mt-3 border-top pt-2">' +
          '<div class="small fw-bold mb-2">Pengumpulan Siswa:</div>' +
          subsHtml +
        '</div>' +
      '</div>');
    }
    html = itemHtmlArr.join('');
  } else {
    html = '<div class="text-secondary small mb-2">Belum ada tugas untuk materi ini.</div>';
  }
  
  document.getElementById('assignmentList').innerHTML = html;
}

function gradeStudent(subId){
  var gradeInput = document.getElementById('grade_'+subId);
  var score = gradeInput ? gradeInput.value : '';
  serverCall('gradeAssignmentSubmit', [subId, score, AppState.user.id], {
    loading: 'Menyimpan nilai...',
    success: function(res) {
      if(!res.success) { showToast(res.message, 'danger'); return; }
      showToast(res.data.message, 'success');
      loadAssignmentList(document.getElementById('lessonId').value);
    }
  });
}

function editAssignmentItem(id){
  var a = null;
  for(var i=0; i<(AppState.currentLessonAssignments||[]).length; i++){
    if(String(AppState.currentLessonAssignments[i].id)===String(id)) { a = AppState.currentLessonAssignments[i]; break; }
  }
  if(!a) return;
  document.getElementById('assignmentId').value=a.id;
  document.getElementById('assignmentTitle').value=a.title;
  document.getElementById('assignmentDescription').value=a.description||'';
}

function removeAssignmentItem(id){
  if(!confirm('Hapus tugas ini beserta seluruh pengumpulan siswa?')) return;
  serverCall('deleteAssignment',[id,AppState.user.id],{
    loading:'Menghapus tugas...',
    success:function(res){
      if(!res.success){showToast(res.message,'danger');return;}
      showToast(res.data.message,'success');
      loadAssignmentList(document.getElementById('lessonId').value);
    }
  });
}

function saveAssignmentItem(){
  var lessonId=document.getElementById('lessonId').value;
  if(!lessonId){
    showToast('Simpan materi terlebih dahulu sebelum menambahkan tugas.','danger');
    return;
  }
  var title=document.getElementById('assignmentTitle').value.trim();
  if(!title){ showToast('Judul tugas wajib diisi.','danger'); return; }

  var payload={
    id:document.getElementById('assignmentId').value,
    lesson_id:lessonId,
    title:title,
    description:document.getElementById('assignmentDescription').value,
    adminUserId:AppState.user.id
  };

  serverCall('saveAssignment',[payload],{
    loading:'Menyimpan tugas...',
    success:function(res){
      if(!res.success){showToast(res.message,'danger');return;}
      showToast(res.data.message,'success');
      resetAssignmentForm();
      loadAssignmentList(payload.lesson_id);
    }
  });
}

function removeLesson(id){
  if(!confirm('Hapus materi ini?')) return;
  serverCall('deleteLesson',[id,AppState.user.id],{
    loading:'Menghapus materi...',
    success:function(res){
      if(!res.success){showToast(res.message,'danger');return;}
      showToast(res.data.message,'success'); loadLessonsPage();
    }
  });
}

/* STUDENT COURSE CARD / CLASSROOM */
function openCourse(id){
  serverCall('getCourseDetails',[id,AppState.user.id],{
    loading:'Membuka kelas...',
    success:function(res){
      if(!res.success){showToast(res.message,'danger');return;}
      AppState.selectedCourse=res.data;
      renderClassroom();
    }
  });
}

function renderClassroom(){
  var data=AppState.selectedCourse;
  var lessons=data.lessons||[];
  var stillExists = false;
  var foundLesson = null;
  if (AppState.selectedLesson) {
    for(var i=0; i<lessons.length; i++) {
      if(String(lessons[i].id)===String(AppState.selectedLesson.id)) { stillExists = true; foundLesson = lessons[i]; break; }
    }
  }
  AppState.selectedLesson = stillExists ? foundLesson : (lessons[0]||null);

  document.getElementById('pageTitle').textContent=data.course.title;
  document.getElementById('pageSubtitle').textContent='Ruang Belajar';

  var lessonListHtml = '';
  if(lessons.length > 0) {
    var larr = [];
    for(var j=0; j<lessons.length; j++) {
      var l = lessons[j];
      var activeClass = (AppState.selectedLesson && String(l.id)===String(AppState.selectedLesson.id)) ? 'active' : '';
      var checkIcon = l.completed ? '<i class="bi bi-check-circle-fill text-success"></i>' : '';
      larr.push('<button class="lesson-item ' + activeClass + '" onclick="selectLesson(\'' + l.id + '\',this)">' +
        '<div class="d-flex justify-content-between align-items-center"><div class="small text-secondary">Materi ' + (j+1) + '</div>' + checkIcon + '</div>' +
        '<div class="fw-semibold">' + esc(l.title) + '</div>' +
      '</button>');
    }
    lessonListHtml = larr.join('');
  } else {
    lessonListHtml = '<div class="p-4 text-secondary">Belum ada materi.</div>';
  }

  document.getElementById('content').innerHTML=
    '<div class="mb-3"><button class="btn btn-outline-secondary" onclick="navigate(\'courses\')"><i class="bi bi-arrow-left me-2"></i>Kembali ke Katalog</button></div>' +
    '<div class="classroom">' +
      '<aside class="lesson-sidebar">' +
        '<div class="p-3 border-bottom"><div class="fw-bold">' + esc(data.course.title) + '</div><div class="small text-secondary">' + lessons.length + ' materi</div></div>' +
        '<div class="lesson-list">' + lessonListHtml + '</div>' +
      '</aside>' +
      '<article id="lessonViewer" class="lesson-content"></article>' +
    '</div>';
  
  renderLessonViewer();
}

function selectLesson(id,button){
  var found = null;
  for(var i=0; i<(AppState.selectedCourse.lessons||[]).length; i++){
    if(String(AppState.selectedCourse.lessons[i].id)===String(id)) { found = AppState.selectedCourse.lessons[i]; break; }
  }
  AppState.selectedLesson = found;
  var items = document.querySelectorAll('.lesson-item');
  for(var j=0; j<items.length; j++){
    items[j].classList.remove('active');
  }
  button.classList.add('active');
  renderLessonViewer();
}

function renderLessonViewer(){
  var l=AppState.selectedLesson;
  if(!l){
    document.getElementById('lessonViewer').innerHTML='<div class="text-center text-secondary py-5">Pilih materi untuk mulai belajar.</div>';
    return;
  }

  var video='';
  var yt=toYoutubeEmbed(l.video_url);
  if(yt) video='<div class="video-wrap mb-4"><iframe src="' + escAttr(yt) + '" allowfullscreen></iframe></div>';
  else if(l.video_url) video='<div class="alert alert-info"><a target="_blank" href="' + escAttr(l.video_url) + '">Buka video pembelajaran</a></div>';

  var videoProgress = '';
  if(l.video_url) {
    videoProgress = '<div class="mt-3">' +
      (l.video_watched ? 
        '<span class="badge text-bg-success p-2"><i class="bi bi-check-circle me-1"></i> Anda telah menyelesaikan Video Materi (30%)</span>' : 
        '<button class="btn btn-primary btn-sm" onclick="markVideoComplete()"><i class="bi bi-play-circle me-1"></i>Tandai Selesai Menonton (30%)</button>') +
    '</div>';
  }

  var hasQuiz = Array.isArray(l.quiz_questions) && l.quiz_questions.length > 0;
  var quiz = '';
  if (hasQuiz) {
    var quizAlert = l.my_quiz_score !== null ? '<div class="alert alert-success py-2">Anda sudah mengerjakan kuis ini. Nilai: ' + Number(l.my_quiz_score||0) + '.</div>' : '';
    
    var quizListArr = [];
    for(var q=0; q<l.quiz_questions.length; q++) {
      var qq = l.quiz_questions[q];
      var optsArr = [];
      for(var o=0; o<(qq.options||[]).length; o++){
        optsArr.push('<label class="d-block border rounded-3 p-2 mb-2"><input type="radio" name="q' + q + '" value="' + o + '" class="me-2"> ' + esc(qq.options[o]) + '</label>');
      }
      quizListArr.push('<div class="mb-4"><div class="fw-semibold mb-2">' + (q+1) + '. ' + esc(qq.question||'Pertanyaan') + '</div>' + optsArr.join('') + '</div>');
    }
    var quizList = quizListArr.join('');

    quiz = '<div class="border rounded-4 p-4 mt-4">' +
      '<h5><i class="bi bi-patch-question me-2"></i>Kuis (Maks 30%)</h5>' +
      quizAlert +
      '<div id="quizBox">' + quizList +
        '<button class="btn btn-primary" onclick="submitCurrentQuiz()">' + (l.my_quiz_score !== null ? 'Kerjakan Ulang' : 'Kirim Jawaban') + '</button>' +
      '</div>' +
    '</div>';
  }

  var assignments = Array.isArray(l.assignments) ? l.assignments : [];
  var tugas = '';
  if (assignments.length > 0) {
    var asgArr = [];
    for(var a=0; a<assignments.length; a++){ asgArr.push(renderAssignmentBlock(assignments[a])); }
    tugas = '<div class="border rounded-4 p-4 mt-4">' +
      '<h5><i class="bi bi-clipboard-check me-2"></i>Tugas (Maks 40%)</h5>' +
      asgArr.join('') +
    '</div>';
  }

  var header = '<div class="d-flex justify-content-between gap-3 mb-3"><div><div class="small text-primary fw-semibold">MATERI</div><h2 class="fw-bold">' + esc(l.title) + '</h2></div><span class="badge text-bg-light align-self-start">#' + Number(l.order||1) + '</span></div>';
  var desc = l.description ? '<p class="text-secondary">' + esc(l.description) + '</p>' : '';
  
  document.getElementById('lessonViewer').innerHTML = header + desc + video + videoProgress +
    '<div class="lesson-text mt-4">' + safeContent(l.content) + '</div>' +
    quiz + tugas;
}

function markVideoComplete(){
  var l=AppState.selectedLesson;
  if(!l)return;
  serverCall('markVideoComplete',[AppState.user.id,l.id],{
    loading:'Menandai video...',
    success:function(res){
      if(!res.success){showToast(res.message,'danger');return;}
      l.video_watched=true;
      applyProgressUpdate(res.data.progress_by_course);
      showToast('Video ditandai. Progres: '+res.data.progress_percent+'%','success');
      renderClassroom();
    }
  });
}

function renderAssignmentBlock(a){
  var sub=a.my_submission;
  var statusBadge = sub ? '<span class="badge text-bg-success ms-2">Sudah dikumpulkan</span>' : '<span class="badge text-bg-light ms-2">Belum dikumpulkan</span>';
  var gradeBadge = sub && sub.score !== null && sub.score !== '' && sub.score !== undefined ? '<span class="badge text-bg-primary ms-2">Nilai: ' + sub.score + '</span>' : '<span class="badge text-bg-secondary ms-2">Belum dinilai</span>';

  var desc = a.description ? '<div class="small text-secondary mt-1">' + esc(a.description) + '</div>' : '';
  var submittedPreview = sub ? '<div class="small text-secondary mt-3 p-2 bg-light rounded">Terkumpul: <a href="' + escAttr(sub.file_url) + '" target="_blank">Lihat Tugas Saya</a> &mdash; ' + esc(formatDateTime(sub.submitted_at)) + '</div>' : '';

  return '<div class="border rounded-3 p-3 mb-3" id="assignBlock_' + escAttr(a.id) + '">' +
      '<div class="fw-semibold">' + esc(a.title) + statusBadge + gradeBadge + '</div>' +
      desc + submittedPreview +
      '<div class="row g-2 mt-3">' +
        '<div class="col-12 col-md-10">' +
          '<label class="small text-secondary">Link Tugas (G-Drive / YouTube / dll)</label>' +
          '<input type="url" class="form-control form-control-sm" id="assignSubmitLink_' + escAttr(a.id) + '" placeholder="https://..." value="' + (sub ? escAttr(sub.file_url) : '') + '">' +
        '</div>' +
        '<div class="col-12 col-md-2 d-flex align-items-end">' +
          '<button type="button" class="btn btn-sm btn-primary w-100" onclick="submitAssignmentAnswer(\'' + escAttr(a.id) + '\')">' + (sub ? 'Kumpul Ulang' : 'Kumpulkan') + '</button>' +
        '</div>' +
      '</div>' +
    '</div>';
}

function submitAssignmentAnswer(assignmentId){
  var linkInput=document.getElementById('assignSubmitLink_'+assignmentId);
  var link=(linkInput&&linkInput.value||'').trim();

  if(!link){
    showToast('Isi tautan / link tugas terlebih dahulu.','danger');
    return;
  }

  var payload={
    userId: AppState.user.id, 
    assignmentId: assignmentId,
    drive_link: link
  };

  serverCall('submitAssignment',[payload],{
    loading:'Mengumpulkan tugas...',
    success:function(res){
      if(!res.success){showToast(res.message,'danger');return;}
      showToast(res.data.message,'success');
      openCourse(AppState.selectedCourse.course.id);
    }
  });
}

function formatDateTime(value){
  try{
    var d=new Date(value);
    if(isNaN(d.getTime())) return String(value||'');
    var yyyy = d.getFullYear();
    var mm = String(d.getMonth() + 1); if (mm.length < 2) mm = '0' + mm;
    var dd = String(d.getDate()); if (dd.length < 2) dd = '0' + dd;
    var hh = String(d.getHours()); if (hh.length < 2) hh = '0' + hh;
    var min = String(d.getMinutes()); if (min.length < 2) min = '0' + min;
    return dd + '/' + mm + '/' + yyyy + ' ' + hh + ':' + min;
  }catch(e){ return String(value||''); }
}

function submitCurrentQuiz(){
  var l=AppState.selectedLesson;
  if(!l)return;
  var answers={};
  var qList = l.quiz_questions||[];
  var unanswered = 0;
  for(var i=0; i<qList.length; i++) {
    var selected = document.querySelector('input[name="q' + i + '"]:checked');
    answers[i] = selected ? Number(selected.value) : null;
    if(!selected) unanswered++;
  }
  if(unanswered > 0) {
    if(!confirm('Masih ada '+unanswered+' soal yang belum dijawab. Tetap kirim?')) return;
  }

  // Nilai dihitung ulang di server agar konsisten dengan kunci jawaban dan format answer 0-based/1-based/A-D.
  serverCall('submitQuiz',[AppState.user.id,l.id,answers],{
    loading:'Menghitung dan menyimpan hasil kuis...',
    success:function(res){
      if(!res.success){showToast(res.message,'danger');return;}
      var score = Number(res.data.score || 0);
      l.completed=true;
      l.my_quiz_score=score;
      applyProgressUpdate(res.data.progress_by_course);
      showToast('Nilai kuis: '+score+'. Progres: '+res.data.progress_percent+'%','success');
      renderClassroom();
    }
  });
}

function applyProgressUpdate(progressByCourse){
  if(!progressByCourse) return;
  var keys = Object.keys(progressByCourse);
  for(var i=0; i<keys.length; i++) {
    var courseId = keys[i];
    var percent = Number(progressByCourse[courseId]||0);
    var cached = null;
    for(var c=0; c<AppState.courses.length; c++){
      if(String(AppState.courses[c].id) === String(courseId)) { cached = AppState.courses[c]; break; }
    }
    if(cached && cached.enrollment){
      cached.enrollment.progress_percent = percent;
      cached.enrollment.status = percent >= 100 ? 'completed' : 'active';
    }
  }
}

/* HELPERS / UI */
function statCard(label,value,icon){
  return '<div class="col-6 col-xl-3"><div class="stat-card h-100"><div class="d-flex justify-content-between"><div><div class="small text-secondary">' + label + '</div><div class="fs-3 fw-bold mt-1">' + value + '</div></div><i class="bi ' + icon + ' fs-3 text-primary"></i></div></div></div>';
}

function populateCourseClassSelect(selected){
  var el=document.getElementById('courseClasses');
  if(!el) return;
  selected=Array.isArray(selected)?selected:[];
  var html='';
  for(var i=0;i<LMS_CLASSES.length;i++){
    var k=LMS_CLASSES[i];
    var id='courseClass_'+k.replace(/[^A-Za-z0-9]/g,'_');
    var isSel=selected.indexOf(k)!==-1;
    html += '<div class="col-6 col-md-4 col-lg-3">' +
      '<div class="form-check border rounded-3 p-2 bg-white">' +
        '<input class="form-check-input course-class-check ms-0 me-2" type="checkbox" id="'+escAttr(id)+'" value="'+escAttr(k)+'" '+(isSel?'checked':'')+' onchange="updateCourseClassStatus()">' +
        '<label class="form-check-label" for="'+escAttr(id)+'">'+esc(k)+'</label>' +
      '</div>' +
    '</div>';
  }
  el.innerHTML=html;
  updateCourseClassStatus();
}
function getSelectedCourseClasses(){
  var checks=document.querySelectorAll('#courseClasses .course-class-check');
  var out=[];
  for(var i=0;i<checks.length;i++) if(checks[i].checked) out.push(checks[i].value);
  return out;
}
function selectAllCourseClasses(flag){
  var checks=document.querySelectorAll('#courseClasses .course-class-check');
  for(var i=0;i<checks.length;i++) checks[i].checked=!!flag;
  updateCourseClassStatus();
}
function updateCourseClassStatus(){
  var status=document.getElementById('courseClassStatus');
  if(!status) return;
  var selected=getSelectedCourseClasses();
  status.innerHTML=selected.length ? '<i class="bi bi-check-circle text-success me-1"></i>'+selected.length+' kelas dipilih.' : '<i class="bi bi-globe2 text-primary me-1"></i>Terbuka untuk semua kelas.';
}
function courseClassBadges(classes){
  classes=Array.isArray(classes)?classes:[];
  if(!classes.length) return '<span class="badge text-bg-success">Semua Kelas</span>';
  var out='';
  for(var i=0;i<classes.length;i++) out+='<span class="badge text-bg-light border me-1 mb-1">'+esc(classes[i])+'</span>';
  return out;
}

function courseCardHtml(c){
  var enrolled=c.enrolled;
  var classInfo = Array.isArray(c.assigned_classes) && c.assigned_classes.length ? '<div class="small text-secondary mb-2"><i class="bi bi-people me-1"></i>Kelas: ' + courseClassBadges(c.assigned_classes) + '</div>' : '<div class="small text-secondary mb-2"><i class="bi bi-globe2 me-1"></i>Semua kelas</div>';
  var progress = c.enrollment ? Number(c.enrollment.progress_percent||0) : 0;
  var enrollHtml;
  if(AppState.user && AppState.user.role==='teacher') {
    enrollHtml = '<button class="btn btn-primary w-100 mt-3" onclick="openCourse(\'' + c.id + '\')"><i class="bi bi-folder2-open me-1"></i>Buka Course</button>';
  } else if(enrolled) {
    enrollHtml = '<div class="mt-3"><div class="d-flex justify-content-between small mb-1"><span>Progres</span><span>' + progress + '%</span></div><div class="progress mb-3"><div class="progress-bar" style="width:' + progress + '%"></div></div><div class="d-flex gap-2"><button class="btn btn-primary w-100" onclick="openCourse(\'' + c.id + '\')">Lanjut Belajar</button><button class="btn btn-outline-danger" title="Batalkan Pendaftaran" onclick="cancelEnrollment(\'' + c.id + '\')"><i class="bi bi-x-circle"></i></button></div></div>';
  } else {
    enrollHtml = '<button class="btn btn-outline-primary w-100 mt-3" onclick="enrollCourse(\'' + c.id + '\')">Daftar Kursus</button>';
  }
  
  return '<div class="col-md-6 col-xl-4"><div class="course-card"><div class="d-flex justify-content-between mb-3"><span class="badge text-bg-light">' + esc(c.category||'Informatika') + '</span><i class="bi bi-book text-primary"></i></div><h5>' + esc(c.title) + '</h5><p class="text-secondary small flex-grow-1">' + esc(c.description||'').slice(0,140) + '</p><div class="small text-secondary mb-1 mt-auto">Instruktur: ' + esc(c.instructor||'-') + '</div>' + enrollHtml + '</div></div>';
}

function enrollCourse(id){
  serverCall('enrollInCourse',[AppState.user.id,id],{
    loading:'Mendaftarkan kursus...',
    success:function(res){
      if(!res.success){showToast(res.message,'danger');return;}
      showToast(res.data.message,'success'); loadCoursesPage();
    }
  });
}

function cancelEnrollment(courseId){
  if(!confirm('Anda yakin ingin membatalkan pendaftaran dari kursus ini? Semua progres akan hilang dari layar Anda.')) return;
  serverCall('unenrollCourse',[AppState.user.id, courseId],{
    loading:'Membatalkan...',
    success:function(res){
      if(!res.success){showToast(res.message,'danger');return;}
      showToast(res.data.message,'success'); 
      if(AppState.view === 'dashboard') loadDashboard();
      else loadCoursesPage();
    }
  });
}

function emptyState(title,text,view){
  return '<div class="col-12"><div class="panel text-center py-5"><h5>' + esc(title) + '</h5><p class="text-secondary">' + esc(text) + '</p><button class="btn btn-primary" onclick="navigate(\'' + view + '\')">Buka</button></div></div>';
}
function courseName(id){
  var c = null;
  for(var i=0; i<AppState.courses.length; i++) {
    if(String(AppState.courses[i].id)===String(id)){ c = AppState.courses[i]; break; }
  }
  return c ? c.title : '-';
}
function showAlert(id,message,type){
  document.getElementById(id).innerHTML='<div class="alert alert-' + type + ' py-2">' + esc(message) + '</div>';
}
function showToast(message,type){
  var toastEl = document.getElementById('appToast');
  toastEl.className='toast text-bg-'+(type||'primary');
  document.getElementById('toastBody').textContent=message;
  bootstrap.Toast.getOrCreateInstance(toastEl,{delay:3000}).show();
}
function toggleSidebar(){document.getElementById('sidebar').classList.toggle('open');document.getElementById('mobileOverlay').classList.toggle('show');}
function closeSidebar(){document.getElementById('sidebar').classList.remove('open');document.getElementById('mobileOverlay').classList.remove('show');}

function esc(v){
  if (v === null || typeof v === 'undefined') return '';
  return String(v).replace(/[&<>"']/g, function(m){ 
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]; 
  });
}
function escAttr(v){return esc(v);}
function safeContent(v){return '<div style="white-space:pre-wrap;line-height:1.8">' + esc(v||'') + '</div>';}



/* ============================================================
   GRADEBOOK GURU V5 - READ ONLY
   ============================================================ */
function loadTeacherGradebookPage(filters){
  if(!AppState.user || AppState.user.role!=='teacher') return;
  filters=filters||{};
  serverCall('getTeacherGradebookData',[AppState.user.id,filters],{
    loading:'Memuat Gradebook Guru...',
    success:function(res){
      if(AppState.view!=='gradebook') return;
      if(!res || !res.success){showToast(res&&res.message?res.message:'Gagal memuat Gradebook.','danger');return;}
      renderTeacherGradebookPage(res.data||{});
    },
    failure:function(err){showToast(errorMessage(err),'danger');}
  });
}
function teacherGradebookFiltersFromUI(){
  return {
    kelas:(document.getElementById('teacherGradebookClass')||{}).value||'',
    courseId:(document.getElementById('teacherGradebookCourse')||{}).value||'',
    search:(document.getElementById('teacherGradebookSearch')||{}).value||''
  };
}
function refreshTeacherGradebook(){loadTeacherGradebookPage(teacherGradebookFiltersFromUI());}
function gradebookFilterChange(type){
  var f=teacherGradebookFiltersFromUI();
  if(type==='class'){f.courseId='';}
  loadTeacherGradebookPage(f);
}
function gradebookScoreBadge(score){
  var n=Number(score||0), cls=n>=85?'success':(n>=75?'primary':(n>=60?'warning':'danger'));
  return '<span class="badge text-bg-'+cls+'">'+n+'</span>';
}
function gradebookStatusBadge(status){
  return status==='Tuntas' ? '<span class="badge text-bg-success">Tuntas</span>' : '<span class="badge text-bg-danger">Belum Tuntas</span>';
}
function renderTeacherGradebookPage(data){
  var classes=Array.isArray(data.classes)?data.classes:[];
  var courses=Array.isArray(data.courses)?data.courses:[];
  var rows=Array.isArray(data.rows)?data.rows:[];
  var lessons=Array.isArray(data.lessons)?data.lessons:[];
  var f=data.filters||{};
  var summary=data.summary||{};
  var classOpts='<option value="">Semua Kelas</option>';
  classes.forEach(function(k){classOpts+='<option value="'+escAttr(k)+'" '+(String(f.kelas)===String(k)?'selected':'')+'>'+esc(k)+'</option>';});
  var courseOpts='<option value="">Pilih Course</option>';
  courses.forEach(function(c){courseOpts+='<option value="'+escAttr(c.id)+'" '+(String(f.courseId)===String(c.id)?'selected':'')+'>'+esc(c.title)+'</option>';});

  var header='<div class="panel mb-4">'+
    '<div class="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">'+
      '<div><h5 class="mb-1">📊 Gradebook Guru</h5><div class="small text-secondary">Read-only. Nilai diambil dari mesin nilai LMS yang sama dengan Rekap.</div></div>'+ 
      '<button class="btn btn-outline-success btn-sm" onclick="exportTeacherGradebookCSV()"><i class="bi bi-download"></i> Export CSV</button>'+ 
    '</div>'+ 
    '<div class="row g-3">'+
      '<div class="col-md-3"><label class="form-label small fw-semibold">Kelas</label><select id="teacherGradebookClass" class="form-select" onchange="gradebookFilterChange(\'class\')">'+classOpts+'</select></div>'+ 
      '<div class="col-md-4"><label class="form-label small fw-semibold">Course</label><select id="teacherGradebookCourse" class="form-select" onchange="gradebookFilterChange(\'course\')">'+courseOpts+'</select></div>'+ 
      '<div class="col-md-5"><label class="form-label small fw-semibold">Cari Siswa</label><div class="input-group"><input id="teacherGradebookSearch" class="form-control" value="'+escAttr(f.search||'')+'" placeholder="Nama atau email..." onkeydown="if(event.key===\'Enter\')refreshTeacherGradebook()"><button class="btn btn-primary" onclick="refreshTeacherGradebook()"><i class="bi bi-search"></i></button></div></div>'+ 
    '</div>'+ 
  '</div>';

  if(!f.courseId){
    document.getElementById('content').innerHTML=header+'<div class="panel text-center py-5"><div style="font-size:48px">📊</div><h5 class="mt-3">Pilih Course</h5><p class="text-secondary mb-0">Pilih Course untuk membuka buku nilai Guru.</p></div>';
    return;
  }

  var cards='<div class="row g-3 mb-4">'+
    statCard('Siswa',summary.students||0,'bi-people')+
    statCard('Lesson',summary.lessons||0,'bi-journal-check')+
    statCard('Rata-rata',summary.average_score||0,'bi-bar-chart-line')+
    statCard('Tuntas',summary.passed||0,'bi-check-circle')+
  '</div>';

  var thead='<tr><th style="min-width:190px">Siswa</th><th>Kelas</th><th>Progress</th>';
  lessons.forEach(function(l){thead+='<th class="text-center" style="min-width:105px">'+esc(l.title)+'</th>';});
  thead+='<th class="text-center" style="min-width:110px">Nilai Akhir</th><th>Status</th><th>Aksi</th></tr>';
  var tbody='';
  if(!rows.length){
    tbody='<tr><td colspan="'+(8+lessons.length)+'" class="text-center text-secondary py-5">Tidak ada siswa/enrollment yang sesuai filter.</td></tr>';
  }else{
    rows.forEach(function(r){
      var detailJson=encodeURIComponent(JSON.stringify(r.lessons||[]));
      var map={}; (r.lessons||[]).forEach(function(d){map[String(d.lesson_id)]=d;});
      var tr='<tr><td><div class="fw-semibold">'+esc(r.name)+'</div><div class="small text-secondary">'+esc(r.email)+'</div></td><td>'+esc(r.kelas)+'</td><td>'+Number(r.progress_percent||0)+'%</td>';
      lessons.forEach(function(l){var d=map[String(l.id)]; tr+='<td class="text-center">'+(d?gradebookScoreBadge(d.final_score):'<span class="text-secondary">—</span>')+'</td>';});
      tr+='<td class="text-center fw-bold">'+gradebookScoreBadge(r.final_score)+'</td><td>'+gradebookStatusBadge(r.status)+'</td><td><button class="btn btn-sm btn-outline-primary" onclick="showTeacherGradebookDetail('+JSON.stringify(r.name)+','+JSON.stringify(r.kelas)+','+JSON.stringify(r.course_title)+',\''+detailJson+'\')"><i class="bi bi-eye"></i> Detail</button></td></tr>';
      tbody+=tr;
    });
  }
  var table='<div class="panel">'+
    '<div class="d-flex justify-content-between align-items-center mb-3"><div><h6 class="mb-1">Buku Nilai: '+esc((data.selectedCourse&&data.selectedCourse.title)||'')+'</h6><div class="small text-secondary">Nilai Akhir Course = rata-rata Nilai Akhir seluruh Lesson.</div></div><span class="badge text-bg-light">'+rows.length+' siswa</span></div>'+ 
    '<div class="table-responsive"><table class="table table-hover align-middle mb-0"><thead>'+thead+'</thead><tbody>'+tbody+'</tbody></table></div>'+ 
  '</div>';
  window.__teacherGradebookRows=rows; window.__teacherGradebookLessons=lessons; window.__teacherGradebookCourse=data.selectedCourse||null;
  document.getElementById('content').innerHTML=header+cards+table;
}
function showTeacherGradebookDetail(name,kelas,courseTitle,encoded){
  var details=[]; try{details=JSON.parse(decodeURIComponent(encoded)||'[]');}catch(e){}
  var rows='';
  details.forEach(function(d){
    rows+='<tr><td>'+esc(d.lesson_title)+'</td><td class="text-center">'+(d.video_score!==undefined?d.video_score:'-')+'</td><td class="text-center">'+(d.quiz_score===''?'<span class="text-secondary">—</span>':d.quiz_score)+'</td><td class="text-center">'+(d.task_score===''?'<span class="text-secondary">—</span>':d.task_score)+'</td><td class="text-center fw-bold">'+gradebookScoreBadge(d.final_score)+'</td></tr>';
  });
  if(!rows) rows='<tr><td colspan="5" class="text-center text-secondary">Belum ada Lesson.</td></tr>';
  var html='<div class="modal fade" id="teacherGradebookDetailModal" tabindex="-1"><div class="modal-dialog modal-xl modal-dialog-scrollable"><div class="modal-content"><div class="modal-header"><div><h5 class="modal-title">Detail Gradebook</h5><div class="small text-secondary">'+esc(name)+' • '+esc(kelas)+' • '+esc(courseTitle)+'</div></div><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body"><div class="table-responsive"><table class="table align-middle"><thead><tr><th>Lesson</th><th class="text-center">Video</th><th class="text-center">Quiz Terbaik</th><th class="text-center">Tugas</th><th class="text-center">Nilai Akhir</th></tr></thead><tbody>'+rows+'</tbody></table></div><div class="small text-secondary mt-2">Bobot: Video 30% + Quiz 30% + Tugas 40%.</div></div></div></div></div>';
  var old=document.getElementById('teacherGradebookDetailModal'); if(old) old.remove();
  document.body.insertAdjacentHTML('beforeend',html);
  bootstrap.Modal.getOrCreateInstance(document.getElementById('teacherGradebookDetailModal')).show();
}
function exportTeacherGradebookCSV(){
  var f=teacherGradebookFiltersFromUI();
  var rows=(window.__teacherGradebookRows||[]);
  if(!rows.length){
    // Data terbaru belum disimpan global; reload agar export konsisten dengan layar.
    serverCall('getTeacherGradebookData',[AppState.user.id,f],{loading:'Menyiapkan export...',success:function(res){if(res&&res.success){window.__teacherGradebookRows=res.data.rows||[]; downloadTeacherGradebookCSV(res.data);}else showToast(res.message||'Export gagal.','danger');},failure:function(err){showToast(errorMessage(err),'danger');}});
    return;
  }
  downloadTeacherGradebookCSV({rows:rows,lessons:(window.__teacherGradebookLessons||[]),selectedCourse:window.__teacherGradebookCourse||null});
}
function downloadTeacherGradebookCSV(data){
  var rows=data.rows||[], lessons=data.lessons||[];
  var csv=[];
  var head=['Nama','Email','Kelas','Progress']; lessons.forEach(function(l){head.push(l.title);}); head.push('Nilai Akhir','Status'); csv.push(head.map(function(x){return '"'+String(x).replace(/"/g,'""')+'"';}).join(','));
  rows.forEach(function(r){var map={};(r.lessons||[]).forEach(function(d){map[String(d.lesson_id)]=d.final_score;});var a=[r.name,r.email,r.kelas,r.progress_percent];lessons.forEach(function(l){a.push(map[String(l.id)]!==undefined?map[String(l.id)]:'');});a.push(r.final_score,r.status);csv.push(a.map(function(x){return '"'+String(x==null?'':x).replace(/"/g,'""')+'"';}).join(','));});
  var blob=new Blob(['\uFEFF'+csv.join('\n')],{type:'text/csv;charset=utf-8;'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Gradebook_'+(data.selectedCourse&&data.selectedCourse.title?String(data.selectedCourse.title).replace(/[^a-z0-9]+/gi,'_'):'Course')+'.csv';document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
}

function toYoutubeEmbed(url){
  try{
    if(url.indexOf('youtube.com') !== -1){
      var vIndex = url.indexOf('v=');
      if(vIndex !== -1) {
        var id = url.substring(vIndex + 2, vIndex + 13);
        return 'https://www.youtube.com/embed/' + encodeURIComponent(id);
      }
    }
    if(url.indexOf('youtu.be/') !== -1){
      var parts = url.split('youtu.be/');
      return 'https://www.youtube.com/embed/' + encodeURIComponent(parts[1].substring(0, 11));
    }
  }catch(e){}
  return null;
}
