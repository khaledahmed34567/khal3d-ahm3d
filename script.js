/* =========================================================================
   سرمد — admin.js
   لوحة أدمن مستقلة (تُنشر على دومين منفصل عن التطبيق الرئيسي) تتعامل مع
   نفس مشروع Firebase. حماية الدخول هنا عبارة عن PIN على مستوى الواجهة
   فقط — راجع ملاحظة الأمان الظاهرة أعلى اللوحة.
   ========================================================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import {
  getFirestore, doc, setDoc, getDoc, getDocs, deleteDoc, collection,
  collectionGroup, query, orderBy, where, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDwo9ylUI7cq7DodekA0vM7iMw-6COp3BI",
  authDomain: "saemad-8a204.firebaseapp.com",
  projectId: "saemad-8a204",
  storageBucket: "saemad-8a204.firebasestorage.app",
  messagingSenderId: "676932025599",
  appId: "1:676932025599:web:0076ca1cabc132883a60ca",
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
signInAnonymously(auth).catch(() => {});

const IMGBB_KEY = "36b0e2658ed6fad2ca48081442f1539b";
const ADMIN_PIN = "903327";

function toast(msg, ms = 2800) {
  const host = document.getElementById("toastHost");
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  host.appendChild(t);
  setTimeout(() => t.remove(), ms);
}
function escapeHtml(s) { return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

// نافذة تأكيد مخصصة بدل confirm()/alert() الأصليين في المتصفح — بعض المتصفحات
// المدمجة (WebView) تمنعهم فيسكت الزر يبان وكأنه مش شغال
function confirmModal(message) {
  return new Promise((resolve) => {
    const host = document.createElement("div");
    host.style.cssText = "position:fixed;inset:0;background:rgba(10,10,12,0.45);z-index:400;display:flex;align-items:center;justify-content:center;padding:20px;";
    host.innerHTML = `<div style="background:#fff;border-radius:18px;padding:20px;max-width:320px;width:100%;">
      <p style="margin-bottom:16px;font-size:14px;">${escapeHtml(message)}</p>
      <div style="display:flex;gap:10px;">
        <button id="cmYes" class="btn btn-danger" style="flex:1;">تأكيد</button>
        <button id="cmNo" class="btn btn-ghost" style="flex:1;">إلغاء</button>
      </div></div>`;
    document.body.appendChild(host);
    host.querySelector("#cmYes").addEventListener("click", () => { host.remove(); resolve(true); });
    host.querySelector("#cmNo").addEventListener("click", () => { host.remove(); resolve(false); });
  });
}
// تنفيذ أي عملية فايربيز مع رسالة خطأ واضحة بدل ما الزر "ميعملش حاجة" بصمت
async function runSafely(actionFn, successMsg) {
  try {
    await actionFn();
    if (successMsg) toast(successMsg);
    return true;
  } catch (e) {
    console.error(e);
    toast("حدث خطأ: " + (e.code || e.message || "غير معروف"));
    return false;
  }
}
// يحذف مستندًا، ثم يتأكد فعليًا إنه اتشال من فايربيز. لو لسه موجود (غالبًا Firestore
// Security Rules رافضة عملية الحذف بصمت)، يبلّغ برسالة واضحة بدل ما يدّعي نجاح وهمي
async function deleteAndVerify(ref) {
  await deleteDoc(ref);
  const check = await getDoc(ref);
  if (check.exists()) {
    throw new Error("الحذف مرفوض من قاعدة البيانات — راجع Firestore Security Rules (قاعدة allow delete)");
  }
}

async function uploadToImgbb(file) {
  const fd = new FormData();
  fd.append("image", file);
  const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, { method: "POST", body: fd });
  const data = await res.json();
  if (!data.success) throw new Error("imgbb upload failed");
  return data.data.url;
}
async function resolveImage(urlInputId, fileInputId) {
  const file = document.getElementById(fileInputId).files[0];
  if (file) return uploadToImgbb(file);
  return document.getElementById(urlInputId).value.trim();
}

/* ========================================================================
   شاشة الدخول بالـ PIN
   ======================================================================== */
const pinInputs = Array.from(document.querySelectorAll(".pin-digit"));
pinInputs.forEach((inp, i) => {
  inp.addEventListener("input", () => {
    inp.value = inp.value.replace(/\D/g, "").slice(0, 1);
    if (inp.value && pinInputs[i + 1]) pinInputs[i + 1].focus();
  });
  inp.addEventListener("keydown", (e) => {
    if (e.key === "Backspace" && !inp.value && pinInputs[i - 1]) pinInputs[i - 1].focus();
    if (e.key === "Enter") document.getElementById("btnPinSubmit").click();
  });
});
document.getElementById("btnPinSubmit").addEventListener("click", () => {
  const code = pinInputs.map((i) => i.value).join("");
  if (code === ADMIN_PIN) {
    sessionStorage.setItem("sarmadAdminAuthed", "1");
    enterAdmin();
  } else {
    document.getElementById("pinError").textContent = "الرقم السري غير صحيح.";
    pinInputs.forEach((i) => (i.value = ""));
    pinInputs[0].focus();
  }
});
document.getElementById("btnAdminLogout").addEventListener("click", () => {
  sessionStorage.removeItem("sarmadAdminAuthed");
  location.reload();
});
function enterAdmin() {
  document.getElementById("pinScreen").style.display = "none";
  document.getElementById("adminApp").style.display = "block";
  refreshAll();
}
if (sessionStorage.getItem("sarmadAdminAuthed") === "1") enterAdmin();
else pinInputs[0].focus();

/* ========================================================================
   التبويبات
   ======================================================================== */
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`panel-${btn.dataset.tab}`).classList.add("active");
  });
});

function refreshAll() {
  loadTracksAdmin();
  loadCoursesAdmin();
  loadLecturesAdmin();
  loadTasksAdmin();
  loadDiscountsAdmin();
  loadRetryRequestsAdmin();
  populateTrackSelect();
  populateCourseSelect();
  populateLectureSelect();
  populateSurveyTargetSelect();
}

/* ========================================================================
   المسارات (Tracks)
   ======================================================================== */
let editingTrackId = null;
async function loadTracksAdmin() {
  const box = document.getElementById("tracksListAdmin");
  box.innerHTML = `<div class="sub">جارٍ التحميل...</div>`;
  const snap = await getDocs(query(collection(db, "tracks"), orderBy("order", "asc")));
  box.innerHTML = "";
  if (snap.empty) box.innerHTML = `<div class="sub">لا توجد مسارات بعد.</div>`;
  snap.forEach((d) => {
    const t = d.data();
    box.insertAdjacentHTML("beforeend", `
      <div class="list-row" data-row-track="${d.id}">
        <div><b>${escapeHtml(t.title)}</b><div class="meta">ترتيب: ${t.order ?? "-"} · id: ${d.id}</div></div>
        <div class="actions">
          <button class="btn btn-secondary btn-sm" data-edit-track="${d.id}">تعديل</button>
          <button class="btn btn-danger btn-sm" data-del-track="${d.id}">حذف</button>
        </div>
      </div>`);
  });
}
// تفويض الأحداث على العنصر الثابت بدل ربط كل زر لحاله — أكثر ثباتًا مع أي تحديث للقائمة
document.getElementById("tracksListAdmin").addEventListener("click", async (e) => {
  const editBtn = e.target.closest("[data-edit-track]");
  const delBtn = e.target.closest("[data-del-track]");
  if (editBtn) return startEditTrack(editBtn.dataset.editTrack);
  if (delBtn) return deleteTrack(delBtn.dataset.delTrack);
});
async function startEditTrack(id) {
  const snap = await getDoc(doc(db, "tracks", id));
  if (!snap.exists()) return toast("المسار غير موجود.");
  const t = snap.data();
  document.getElementById("trackTitle").value = t.title || "";
  document.getElementById("trackDesc").value = t.description || "";
  document.getElementById("trackImage").value = t.image || "";
  document.getElementById("trackOrder").value = t.order || 1;
  editingTrackId = id;
  document.getElementById("btnAddTrack").textContent = "تحديث المسار";
  document.getElementById("panel-tracks").scrollIntoView({ behavior: "smooth" });
}
document.getElementById("btnAddTrack").addEventListener("click", async () => {
  const title = document.getElementById("trackTitle").value.trim();
  if (!title) return toast("اكتب عنوان المسار.");
  const image = await resolveImage("trackImage", "trackImageFile");
  await runSafely(async () => {
    const ref = editingTrackId ? doc(db, "tracks", editingTrackId) : doc(collection(db, "tracks"));
    await setDoc(ref, {
      id: ref.id, title,
      description: document.getElementById("trackDesc").value.trim(),
      image, order: Number(document.getElementById("trackOrder").value || 1),
      updatedAt: serverTimestamp(),
    }, { merge: true });
  }, editingTrackId ? "تم تحديث المسار" : "تم حفظ المسار");
  editingTrackId = null;
  document.getElementById("btnAddTrack").textContent = "حفظ المسار";
  document.getElementById("trackTitle").value = ""; document.getElementById("trackDesc").value = ""; document.getElementById("trackImage").value = "";
  loadTracksAdmin(); populateTrackSelect();
});
async function deleteTrack(id) {
  if (!(await confirmModal("حذف المسار؟ (لن يحذف الكورسات التابعة له تلقائيًا)"))) return;
  await runSafely(() => deleteAndVerify(doc(db, "tracks", id)), "تم الحذف");
  loadTracksAdmin(); populateTrackSelect();
}
async function populateTrackSelect() {
  const sel = document.getElementById("courseTrackSelect");
  const snap = await getDocs(query(collection(db, "tracks"), orderBy("order", "asc")));
  sel.innerHTML = "";
  snap.forEach((d) => sel.insertAdjacentHTML("beforeend", `<option value="${d.id}">${escapeHtml(d.data().title)}</option>`));
}

/* ========================================================================
   الكورسات (Courses) — subcollection: tracks/{trackId}/courses/{courseId}
   ======================================================================== */
let editingCourse = null; // { trackId, courseId } أو null
async function loadCoursesAdmin() {
  const box = document.getElementById("coursesListAdmin");
  box.innerHTML = `<div class="sub">جارٍ التحميل...</div>`;
  const snap = await getDocs(collectionGroup(db, "courses"));
  box.innerHTML = "";
  if (snap.empty) box.innerHTML = `<div class="sub">لا توجد كورسات بعد.</div>`;
  snap.forEach((d) => {
    const c = d.data();
    box.insertAdjacentHTML("beforeend", `
      <div class="list-row">
        <div><b>${escapeHtml(c.title)}</b> <span class="badge ${c.courseEnded ? "on" : "off"}">${c.courseEnded ? "منتهٍ" : "مستمر"}</span>
          <div class="meta">${c.price ? c.price + "$" : "مجاني"} · id: ${d.id}</div></div>
        <div class="actions">
          <button class="btn btn-secondary btn-sm" data-toggle-end="${d.id}" data-track="${c.trackId}">${c.courseEnded ? "تعليم كمستمر" : "تعليم كمنتهٍ"}</button>
          <button class="btn btn-secondary btn-sm" data-edit-course="${d.id}" data-track="${c.trackId}">تعديل</button>
          <button class="btn btn-danger btn-sm" data-del-course="${d.id}" data-track="${c.trackId}">حذف</button>
        </div>
      </div>`);
  });
}
document.getElementById("coursesListAdmin").addEventListener("click", (e) => {
  const toggleBtn = e.target.closest("[data-toggle-end]");
  const editBtn = e.target.closest("[data-edit-course]");
  const delBtn = e.target.closest("[data-del-course]");
  if (toggleBtn) return toggleCourseEnded(toggleBtn.dataset.track, toggleBtn.dataset.toggleEnd);
  if (editBtn) return startEditCourse(editBtn.dataset.track, editBtn.dataset.editCourse);
  if (delBtn) return deleteCourse(delBtn.dataset.track, delBtn.dataset.delCourse);
});
/* ---- قائمة المهارات الديناميكية (بدل حقل نص مفصول بفواصل) ---- */
function addSkillRow(text) {
  const box = document.getElementById("courseSkillsList");
  const row = document.createElement("div");
  row.style.cssText = "display:flex;align-items:center;gap:8px;margin-bottom:8px;";
  row.innerHTML = `
    <input class="skill-text" placeholder="مثال: JavaScript" value="${text ? String(text).replace(/"/g, "&quot;") : ""}" style="flex:1;padding:10px;border-radius:8px;border:1px solid var(--line);" />
    <button type="button" class="remove-x" data-remove-skill style="position:static;">×</button>`;
  box.appendChild(row);
}
function populateSkillsList(skills) {
  document.getElementById("courseSkillsList").innerHTML = "";
  const arr = Array.isArray(skills) ? skills : (skills ? String(skills).split(",").map((s) => s.trim()).filter(Boolean) : []);
  (arr.length ? arr : [""]).forEach((s) => addSkillRow(s));
}
function collectSkillsList() {
  return Array.from(document.querySelectorAll("#courseSkillsList .skill-text")).map((i) => i.value.trim()).filter(Boolean);
}
document.getElementById("btnAddSkill").addEventListener("click", () => addSkillRow());
document.getElementById("courseSkillsList").addEventListener("click", (e) => {
  if (e.target.closest("[data-remove-skill]")) e.target.closest("div").remove();
});
populateSkillsList([]);

async function startEditCourse(trackId, courseId) {
  const snap = await getDoc(doc(db, "tracks", trackId, "courses", courseId));
  if (!snap.exists()) return toast("الكورس غير موجود.");
  const c = snap.data();
  document.getElementById("courseTrackSelect").value = trackId;
  document.getElementById("courseTitle").value = c.title || "";
  document.getElementById("courseTitleEn").value = c.titleEn || "";
  document.getElementById("courseDesc").value = c.description || "";
  document.getElementById("courseInstructor").value = c.instructor || "";
  document.getElementById("courseImage").value = c.image || "";
  document.getElementById("coursePrice").value = c.price || 0;
  document.getElementById("courseOrder").value = c.order || 1;
  populateSkillsList(c.skills);
  document.getElementById("courseEnded").checked = !!c.courseEnded;
  editingCourse = { trackId, courseId };
  document.getElementById("btnAddCourse").textContent = "تحديث الكورس";
  document.getElementById("panel-courses").scrollIntoView({ behavior: "smooth" });
}
document.getElementById("btnAddCourse").addEventListener("click", async () => {
  const trackId = editingCourse ? editingCourse.trackId : document.getElementById("courseTrackSelect").value;
  const title = document.getElementById("courseTitle").value.trim();
  if (!trackId) return toast("أضف مسارًا أولًا.");
  if (!title) return toast("اكتب عنوان الكورس.");
  const image = await resolveImage("courseImage", "courseImageFile");
  const ok = await runSafely(async () => {
    const ref = editingCourse ? doc(db, "tracks", trackId, "courses", editingCourse.courseId) : doc(collection(db, "tracks", trackId, "courses"));
    await setDoc(ref, {
      id: ref.id, trackId, title,
      titleEn: document.getElementById("courseTitleEn").value.trim(),
      description: document.getElementById("courseDesc").value.trim(),
      instructor: document.getElementById("courseInstructor").value.trim(),
      image, price: Number(document.getElementById("coursePrice").value || 0),
      order: Number(document.getElementById("courseOrder").value || 1),
      skills: collectSkillsList(),
      courseEnded: document.getElementById("courseEnded").checked,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  }, editingCourse ? "تم تحديث الكورس" : "تم حفظ الكورس");
  if (ok) {
    editingCourse = null;
    document.getElementById("btnAddCourse").textContent = "حفظ الكورس";
    populateSkillsList([]);
    loadCoursesAdmin(); populateCourseSelect();
  }
});
async function toggleCourseEnded(trackId, courseId) {
  await runSafely(async () => {
    const ref = doc(db, "tracks", trackId, "courses", courseId);
    const snap = await getDoc(ref);
    await setDoc(ref, { courseEnded: !(snap.data() || {}).courseEnded }, { merge: true });
  });
  loadCoursesAdmin();
}
async function deleteCourse(trackId, courseId) {
  if (!(await confirmModal("حذف الكورس؟"))) return;
  await runSafely(() => deleteAndVerify(doc(db, "tracks", trackId, "courses", courseId)), "تم الحذف");
  loadCoursesAdmin(); populateCourseSelect();
}
async function populateCourseSelect() {
  const snap = await getDocs(collectionGroup(db, "courses"));
  const options = snap.docs.map((d) => `<option value="${d.data().trackId}|${d.id}">${escapeHtml(d.data().title)}</option>`).join("");
  document.getElementById("lectureCourseSelect").innerHTML = options;
}

/* ========================================================================
   المحاضرات (Lectures) — top-level: courses/{courseId}/lectures/{lectureId}
   ======================================================================== */
let editingLecture = null; // { courseId, lectureId } أو null
async function loadLecturesAdmin() {
  const box = document.getElementById("lecturesListAdmin");
  box.innerHTML = `<div class="sub">جارٍ التحميل...</div>`;
  const snap = await getDocs(collectionGroup(db, "lectures"));
  box.innerHTML = "";
  if (snap.empty) box.innerHTML = `<div class="sub">لا توجد محاضرات بعد.</div>`;
  snap.forEach((d) => {
    const l = d.data();
    box.insertAdjacentHTML("beforeend", `
      <div class="list-row">
        <div><b>${escapeHtml(l.title)}</b><div class="meta">المدة: ${escapeHtml(l.duration || "-")} · id: ${d.id}</div></div>
        <div class="actions">
          <button class="btn btn-secondary btn-sm" data-edit-lecture="${d.id}" data-course="${l.courseId}">تعديل</button>
          <button class="btn btn-danger btn-sm" data-del-lecture="${d.id}" data-course="${l.courseId}">حذف</button>
        </div>
      </div>`);
  });
}
document.getElementById("lecturesListAdmin").addEventListener("click", (e) => {
  const editBtn = e.target.closest("[data-edit-lecture]");
  const delBtn = e.target.closest("[data-del-lecture]");
  if (editBtn) return startEditLecture(editBtn.dataset.course, editBtn.dataset.editLecture);
  if (delBtn) return deleteLecture(delBtn.dataset.course, delBtn.dataset.delLecture);
});
async function startEditLecture(courseId, lectureId) {
  const snap = await getDoc(doc(db, "courses", courseId, "lectures", lectureId));
  if (!snap.exists()) return toast("المحاضرة غير موجودة.");
  const l = snap.data();
  const trackId = l.trackId || "";
  const sel = document.getElementById("lectureCourseSelect");
  sel.value = `${trackId}|${courseId}`;
  document.getElementById("lectureTitle").value = l.title || "";
  document.getElementById("lectureDesc").value = l.description || "";
  document.getElementById("lectureImage").value = l.image || "";
  document.getElementById("lectureDuration").value = l.duration || "";
  document.getElementById("lectureOrder").value = l.order || 1;
  editingLecture = { courseId, lectureId };
  document.getElementById("btnAddLecture").textContent = "تحديث المحاضرة";
  document.getElementById("panel-lectures").scrollIntoView({ behavior: "smooth" });
}
document.getElementById("btnAddLecture").addEventListener("click", async () => {
  let trackId, courseId;
  if (editingLecture) { courseId = editingLecture.courseId; trackId = (document.getElementById("lectureCourseSelect").value || "").split("|")[0]; }
  else [trackId, courseId] = (document.getElementById("lectureCourseSelect").value || "").split("|");
  const title = document.getElementById("lectureTitle").value.trim();
  if (!courseId) return toast("أضف كورسًا أولًا.");
  if (!title) return toast("اكتب عنوان المحاضرة.");
  const image = await resolveImage("lectureImage", "lectureImageFile");
  const ok = await runSafely(async () => {
    const ref = editingLecture ? doc(db, "courses", courseId, "lectures", editingLecture.lectureId) : doc(collection(db, "courses", courseId, "lectures"));
    await setDoc(ref, {
      id: ref.id, courseId, trackId, title,
      description: document.getElementById("lectureDesc").value.trim(),
      image, duration: document.getElementById("lectureDuration").value.trim(),
      order: Number(document.getElementById("lectureOrder").value || 1),
      updatedAt: serverTimestamp(),
    }, { merge: true });
  }, editingLecture ? "تم تحديث المحاضرة" : "تم حفظ المحاضرة");
  if (ok) {
    editingLecture = null;
    document.getElementById("btnAddLecture").textContent = "حفظ المحاضرة";
    loadLecturesAdmin(); populateLectureSelect(); populateSurveyTargetSelect();
  }
});
async function deleteLecture(courseId, lectureId) {
  if (!(await confirmModal("حذف المحاضرة؟"))) return;
  await runSafely(() => deleteAndVerify(doc(db, "courses", courseId, "lectures", lectureId)), "تم الحذف");
  loadLecturesAdmin(); populateLectureSelect();
}
async function populateLectureSelect() {
  const snap = await getDocs(collectionGroup(db, "lectures"));
  const options = snap.docs.map((d) => `<option value="${d.data().trackId}|${d.data().courseId}|${d.id}">${escapeHtml(d.data().title)}</option>`).join("");
  document.getElementById("taskLectureSelect").innerHTML = options;
}

/* ========================================================================
   المهام (Tasks) — top-level: lectures/{lectureId}/tasks/{taskId}
   ======================================================================== */
let editingTask = null; // { lectureId, taskId } أو null
document.getElementById("taskType").addEventListener("change", () => renderTaskTypeFields());
renderTaskTypeFields();

function renderTaskTypeFields(prefill) {
  const type = document.getElementById("taskType").value;
  const box = document.getElementById("taskTypeFields");
  if (type === "json") {
    box.innerHTML = `<div id="jsonBlocks"></div><button type="button" class="btn btn-secondary btn-sm" id="btnAddBlock">إضافة بند</button>`;
    (prefill?.blocks?.length ? prefill.blocks : [null]).forEach((b) => addJsonBlockRow(b));
  } else if (type === "pdf") {
    box.innerHTML = `<div class="field"><label>رابط ملف PDF</label><input id="pdfUrl" placeholder="https://...pdf" value="${escapeHtml(prefill?.url || "")}" /></div>`;
  } else if (type === "video") {
    box.innerHTML = `
      <div class="field"><label>رابط الفيديو (mp4 أو يوتيوب)</label><input id="videoUrl" value="${escapeHtml(prefill?.url || "")}" /></div>
      <div class="checkbox-row"><input type="checkbox" id="videoIsYoutube" ${prefill?.isYoutube ? "checked" : ""} /><label for="videoIsYoutube">رابط يوتيوب</label></div>`;
  } else if (type === "mcq") {
    box.innerHTML = `
      <div class="field"><label>مدة الاختبار (بالثواني)</label><input id="mcqTimeLimit" type="number" value="${prefill?.timeLimitSeconds || 300}" /></div>
      <div id="mcqQuestions"></div>
      <button type="button" class="btn btn-secondary btn-sm" id="btnAddQuestion">إضافة سؤال</button>`;
    (prefill?.questions?.length ? prefill.questions : [null]).forEach((q) => addMcqQuestionRow(q));
  } else if (type === "code") {
    box.innerHTML = `
      <div class="field"><label>اللغة</label>
        <select id="codeLang">
          <option value="javascript">JavaScript</option>
          <option value="python">Python</option>
          <option value="c">C</option>
          <option value="cpp">C++</option>
          <option value="java">Java</option>
          <option value="bash">Bash</option>
        </select>
      </div>
      <div class="field"><label>الكود المبدئي (Starter Code)</label><textarea id="codeStarter" rows="5">${escapeHtml(prefill?.starterCode || "")}</textarea></div>`;
    if (prefill?.language) document.getElementById("codeLang").value = prefill.language;
  } else if (type === "survey") {
    box.innerHTML = `<div id="taskSurveyQuestions"></div><button type="button" class="btn btn-secondary btn-sm" id="btnAddTaskSurveyQ">إضافة سؤال</button>`;
    (prefill?.questions?.length ? prefill.questions : [null]).forEach((q) => addSurveyQuestionRow("taskSurveyQuestions", q));
  }
}

/* ---- بناء بنود محتوى JSON (بتفويض أحداث ثابت على الحاوية) ---- */
function addJsonBlockRow(data) {
  const box = document.getElementById("jsonBlocks");
  const row = document.createElement("div");
  row.className = "block-item";
  const type = data?.type || "title";
  row.innerHTML = `
    <button type="button" class="remove-x" data-remove-block>×</button>
    <div class="field"><label>نوع البند</label>
      <select class="block-type">
        <option value="title" ${type === "title" ? "selected" : ""}>عنوان</option>
        <option value="text" ${type === "text" ? "selected" : ""}>نص ملوّن</option>
        <option value="link" ${type === "link" ? "selected" : ""}>رابط</option>
      </select>
    </div>
    <div class="block-fields"></div>`;
  box.appendChild(row);
  const typeSel = row.querySelector(".block-type");
  const renderFields = () => {
    const fieldsBox = row.querySelector(".block-fields");
    const v = typeSel.value;
    if (v === "link") {
      fieldsBox.innerHTML = `<div class="field"><label>نص الرابط</label><input class="block-label" value="${escapeHtml(data?.label || "")}" /></div>
        <div class="field"><label>الرابط (URL)</label><input class="block-url" value="${escapeHtml(data?.url || "")}" /></div>`;
    } else if (v === "text") {
      fieldsBox.innerHTML = `<div class="field"><label>النص</label><textarea class="block-text" rows="2">${escapeHtml(data?.text || "")}</textarea></div>
        <div class="field"><label>لون النص</label><input type="color" class="block-color" value="${data?.color || "#16181c"}" /></div>`;
    } else {
      fieldsBox.innerHTML = `<div class="field"><label>نص العنوان</label><input class="block-text" value="${escapeHtml(data?.text || "")}" /></div>`;
    }
  };
  typeSel.addEventListener("change", renderFields);
  renderFields();
}
document.getElementById("panel-tasks").addEventListener("click", (e) => {
  if (e.target.closest("[data-remove-block]")) e.target.closest(".block-item").remove();
});
document.getElementById("panel-tasks").addEventListener("click", (e) => {
  if (e.target.id === "btnAddBlock") addJsonBlockRow();
});
function collectJsonBlocks() {
  return Array.from(document.querySelectorAll("#jsonBlocks .block-item")).map((row) => {
    const type = row.querySelector(".block-type").value;
    if (type === "link") return { type, label: row.querySelector(".block-label").value, url: row.querySelector(".block-url").value };
    if (type === "text") return { type, text: row.querySelector(".block-text").value, color: row.querySelector(".block-color").value };
    return { type, text: row.querySelector(".block-text").value };
  });
}

/* ---- بناء أسئلة MCQ (بتفويض أحداث ثابت) ---- */
let mcqQidCounter = 0;
function addMcqQuestionRow(data) {
  const box = document.getElementById("mcqQuestions");
  const row = document.createElement("div");
  row.className = "question-item";
  const qid = "q" + (mcqQidCounter++);
  row.dataset.qid = qid;
  row.innerHTML = `
    <button type="button" class="remove-x" data-remove-question>×</button>
    <div class="field"><label>نص السؤال</label><textarea class="q-text" rows="2">${escapeHtml(data?.text || "")}</textarea></div>
    <div class="field"><label>نص خاص بالذكاء الاصطناعي (اختياري — يترك افتراضي لو فاضي)</label><textarea class="q-aiguard" rows="1">${escapeHtml(data?.aiGuard || "")}</textarea></div>
    <div class="options-box"></div>
    <button type="button" class="btn btn-ghost btn-sm" data-add-option>إضافة اختيار</button>`;
  box.appendChild(row);
  const opts = data?.options?.length ? data.options : ["", ""];
  opts.forEach((optText, i) => addOptionRow(row, qid, optText, i === (data?.correctIndex ?? -1)));
}
function addOptionRow(questionRow, qid, text, isCorrect) {
  const optBox = questionRow.querySelector(".options-box");
  const row = document.createElement("div");
  row.className = "option-item";
  row.style.cssText = "display:flex;align-items:center;gap:8px;";
  row.innerHTML = `
    <input type="radio" name="correct-${qid}" class="opt-correct" ${isCorrect ? "checked" : ""} />
    <input class="opt-text" placeholder="نص الاختيار" value="${escapeHtml(text || "")}" style="flex:1;padding:9px;border-radius:8px;border:1px solid var(--line);" />
    <button type="button" class="remove-x" data-remove-option style="position:static;">×</button>`;
  optBox.appendChild(row);
}
// تفويض أحداث ثابت على تبويب المهام بالكامل: يغطي كل الأزرار الديناميكية
// (إضافة سؤال / إضافة اختيار / حذف سؤال / حذف اختيار) بدون الحاجة لإعادة ربطها كل مرة
document.getElementById("panel-tasks").addEventListener("click", (e) => {
  if (e.target.id === "btnAddQuestion") return addMcqQuestionRow();
  const addOptBtn = e.target.closest("[data-add-option]");
  if (addOptBtn) {
    const qRow = addOptBtn.closest(".question-item");
    return addOptionRow(qRow, qRow.dataset.qid, "", false);
  }
  const remQBtn = e.target.closest("[data-remove-question]");
  if (remQBtn) return remQBtn.closest(".question-item").remove();
  const remOptBtn = e.target.closest("[data-remove-option]");
  if (remOptBtn) return remOptBtn.closest(".option-item").remove();
});
function collectMcqQuestions() {
  return Array.from(document.querySelectorAll("#mcqQuestions .question-item")).map((row) => {
    const optionRows = Array.from(row.querySelectorAll(".option-item"));
    const options = optionRows.map((o) => o.querySelector(".opt-text").value);
    let correctIndex = 0;
    optionRows.forEach((o, i) => { if (o.querySelector(".opt-correct").checked) correctIndex = i; });
    return { text: row.querySelector(".q-text").value, aiGuard: row.querySelector(".q-aiguard").value, options, correctIndex };
  });
}

/* ---- بناء أسئلة الاستبيان (مشتركة بين مهمة الاستبيان والاستبيان المستقل) ---- */
function addSurveyQuestionRow(containerId, data) {
  const box = document.getElementById(containerId);
  const row = document.createElement("div");
  row.className = "question-item";
  const type = data?.type || "text";
  row.innerHTML = `
    <button type="button" class="remove-x" data-remove-survey-q>×</button>
    <div class="field"><label>نص السؤال</label><input class="sq-text" value="${escapeHtml(data?.text || "")}" /></div>
    <div class="field"><label>نوع الإجابة</label>
      <select class="sq-type">
        <option value="text" ${type === "text" ? "selected" : ""}>نص حر</option>
        <option value="rating" ${type === "rating" ? "selected" : ""}>تقييم من 1 إلى 5</option>
        <option value="choice" ${type === "choice" ? "selected" : ""}>اختيار من قائمة</option>
      </select>
    </div>
    <div class="field sq-options-field" style="${type === "choice" ? "" : "display:none;"}"><label>الخيارات (مفصولة بفواصل)</label><input class="sq-options" value="${escapeHtml((data?.options || []).join(", "))}" /></div>`;
  box.appendChild(row);
  const typeSel = row.querySelector(".sq-type");
  const optField = row.querySelector(".sq-options-field");
  typeSel.addEventListener("change", () => { optField.style.display = typeSel.value === "choice" ? "block" : "none"; });
}
document.body.addEventListener("click", (e) => {
  if (e.target.id === "btnAddSurveyQuestion") return addSurveyQuestionRow("surveyQuestions");
  if (e.target.id === "btnAddTaskSurveyQ") return addSurveyQuestionRow("taskSurveyQuestions");
  if (e.target.closest("[data-remove-survey-q]")) return e.target.closest(".question-item").remove();
});
function collectSurveyQuestions(containerId) {
  return Array.from(document.querySelectorAll(`#${containerId} .question-item`)).map((row) => {
    const type = row.querySelector(".sq-type").value;
    const q = { text: row.querySelector(".sq-text").value, type };
    if (type === "choice") q.options = row.querySelector(".sq-options").value.split(",").map((s) => s.trim()).filter(Boolean);
    return q;
  });
}

/* ---- حفظ / تعديل المهمة ---- */
document.getElementById("btnAddTask").addEventListener("click", async () => {
  let trackId, courseId, lectureId;
  if (editingTask) {
    lectureId = editingTask.lectureId;
    trackId = editingTask.trackId; courseId = editingTask.courseId;
  } else {
    [trackId, courseId, lectureId] = (document.getElementById("taskLectureSelect").value || "").split("|");
  }
  if (!lectureId) return toast("أضف محاضرة أولًا.");
  const title = document.getElementById("taskTitle").value.trim();
  if (!title) return toast("اكتب عنوان المهمة.");
  const type = document.getElementById("taskType").value;
  const order = Number(document.getElementById("taskOrder").value || 1);

  let extra = {};
  if (type === "json") extra = { blocks: collectJsonBlocks() };
  else if (type === "pdf") extra = { url: document.getElementById("pdfUrl").value.trim() };
  else if (type === "video") extra = { url: document.getElementById("videoUrl").value.trim(), isYoutube: document.getElementById("videoIsYoutube").checked };
  else if (type === "mcq") extra = { timeLimitSeconds: Number(document.getElementById("mcqTimeLimit").value || 300), questions: collectMcqQuestions() };
  else if (type === "code") extra = { language: document.getElementById("codeLang").value, starterCode: document.getElementById("codeStarter").value };
  else if (type === "survey") extra = { questions: collectSurveyQuestions("taskSurveyQuestions") };

  const ok = await runSafely(async () => {
    const ref = editingTask ? doc(db, "lectures", editingTask.lectureId, "tasks", editingTask.taskId) : doc(collection(db, "lectures", lectureId, "tasks"));
    await setDoc(ref, { id: ref.id, lectureId, courseId, trackId, type, title, order, ...extra, updatedAt: serverTimestamp() }, { merge: true });
  }, editingTask ? "تم تحديث المهمة" : "تم حفظ المهمة");
  if (ok) {
    editingTask = null;
    document.getElementById("btnAddTask").textContent = "حفظ المهمة";
    document.getElementById("taskTitle").value = "";
    loadTasksAdmin();
  }
});

async function loadTasksAdmin() {
  const box = document.getElementById("tasksListAdmin");
  box.innerHTML = `<div class="sub">جارٍ التحميل...</div>`;
  const snap = await getDocs(collectionGroup(db, "tasks"));
  box.innerHTML = "";
  if (snap.empty) box.innerHTML = `<div class="sub">لا توجد مهام بعد.</div>`;
  snap.forEach((d) => {
    const t = d.data();
    box.insertAdjacentHTML("beforeend", `
      <div class="list-row">
        <div><b>${escapeHtml(t.title)}</b><div class="meta">${escapeHtml(t.type)} · id: ${d.id}</div></div>
        <div class="actions">
          <button class="btn btn-secondary btn-sm" data-edit-task="${d.id}" data-lecture="${t.lectureId}">تعديل</button>
          <button class="btn btn-danger btn-sm" data-del-task="${d.id}" data-lecture="${t.lectureId}">حذف</button>
        </div>
      </div>`);
  });
}
document.getElementById("tasksListAdmin").addEventListener("click", (e) => {
  const editBtn = e.target.closest("[data-edit-task]");
  const delBtn = e.target.closest("[data-del-task]");
  if (editBtn) return startEditTask(editBtn.dataset.lecture, editBtn.dataset.editTask);
  if (delBtn) return deleteTask(delBtn.dataset.lecture, delBtn.dataset.delTask);
});
async function startEditTask(lectureId, taskId) {
  const snap = await getDoc(doc(db, "lectures", lectureId, "tasks", taskId));
  if (!snap.exists()) return toast("المهمة غير موجودة.");
  const t = snap.data();
  const sel = document.getElementById("taskLectureSelect");
  sel.value = `${t.trackId || ""}|${t.courseId || ""}|${lectureId}`;
  document.getElementById("taskTitle").value = t.title || "";
  document.getElementById("taskOrder").value = t.order || 1;
  document.getElementById("taskType").value = t.type;
  renderTaskTypeFields(t);
  editingTask = { lectureId, taskId, trackId: t.trackId, courseId: t.courseId };
  document.getElementById("btnAddTask").textContent = "تحديث المهمة";
  document.getElementById("panel-tasks").scrollIntoView({ behavior: "smooth" });
}
async function deleteTask(lectureId, taskId) {
  if (!(await confirmModal("حذف المهمة؟"))) return;
  await runSafely(() => deleteAndVerify(doc(db, "lectures", lectureId, "tasks", taskId)), "تم الحذف");
  loadTasksAdmin();
}

/* ========================================================================
   الاستبيانات المستقلة (courseSurveys / lectureSurveys)
   ======================================================================== */
addSurveyQuestionRow("surveyQuestions");

async function populateSurveyTargetSelect() {
  const kind = document.getElementById("surveyKind").value;
  const sel = document.getElementById("surveyTargetSelect");
  if (kind === "course") {
    const snap = await getDocs(collectionGroup(db, "courses"));
    sel.innerHTML = snap.docs.map((d) => `<option value="${d.id}">${escapeHtml(d.data().title)}</option>`).join("");
  } else {
    const snap = await getDocs(collectionGroup(db, "lectures"));
    sel.innerHTML = snap.docs.map((d) => `<option value="${d.id}">${escapeHtml(d.data().title)}</option>`).join("");
  }
}
document.getElementById("surveyKind").addEventListener("change", populateSurveyTargetSelect);

document.getElementById("btnSaveSurvey").addEventListener("click", async () => {
  const kind = document.getElementById("surveyKind").value;
  const targetId = document.getElementById("surveyTargetSelect").value;
  if (!targetId) return toast("لا يوجد كورس/محاضرة لاختيارها.");
  const col = kind === "course" ? "courseSurveys" : "lectureSurveys";
  await runSafely(async () => {
    await setDoc(doc(db, col, targetId), {
      title: document.getElementById("surveyTitle").value.trim(),
      questions: collectSurveyQuestions("surveyQuestions"),
      updatedAt: serverTimestamp(),
    });
  }, "تم حفظ الاستبيان");
});

/* ========================================================================
   أكواد الخصم (Discount Codes)
   ======================================================================== */
async function loadDiscountsAdmin() {
  const box = document.getElementById("discountsListAdmin");
  box.innerHTML = `<div class="sub">جارٍ التحميل...</div>`;
  const snap = await getDocs(collection(db, "discountCodes"));
  box.innerHTML = "";
  if (snap.empty) box.innerHTML = `<div class="sub">لا توجد أكواد خصم بعد.</div>`;
  snap.forEach((d) => {
    const c = d.data();
    box.insertAdjacentHTML("beforeend", `
      <div class="list-row">
        <div><b>${escapeHtml(d.id)}</b> <span class="badge ${c.active !== false ? "on" : "off"}">${c.active !== false ? "فعّال" : "متوقف"}</span>
          <div class="meta">${c.percent ? c.percent + "%" : (c.amount ? c.amount + "$" : "-")}</div></div>
        <div class="actions">
          <button class="btn btn-secondary btn-sm" data-edit-discount="${d.id}">تعديل</button>
          <button class="btn btn-danger btn-sm" data-del-discount="${d.id}">حذف</button>
        </div>
      </div>`);
  });
}
document.getElementById("discountsListAdmin").addEventListener("click", (e) => {
  const editBtn = e.target.closest("[data-edit-discount]");
  const delBtn = e.target.closest("[data-del-discount]");
  if (editBtn) return startEditDiscount(editBtn.dataset.editDiscount);
  if (delBtn) return deleteDiscount(delBtn.dataset.delDiscount);
});
async function startEditDiscount(code) {
  const snap = await getDoc(doc(db, "discountCodes", code));
  if (!snap.exists()) return toast("الكود غير موجود.");
  const c = snap.data();
  document.getElementById("discountCode").value = code;
  document.getElementById("discountPercent").value = c.percent || "";
  document.getElementById("discountAmount").value = c.amount || "";
  document.getElementById("discountActive").checked = c.active !== false;
  document.getElementById("panel-discounts").scrollIntoView({ behavior: "smooth" });
}
document.getElementById("btnAddDiscount").addEventListener("click", async () => {
  const code = document.getElementById("discountCode").value.trim().toUpperCase();
  if (!code) return toast("اكتب الكود.");
  const percent = document.getElementById("discountPercent").value ? Number(document.getElementById("discountPercent").value) : null;
  const amount = document.getElementById("discountAmount").value ? Number(document.getElementById("discountAmount").value) : null;
  const ok = await runSafely(async () => {
    await setDoc(doc(db, "discountCodes", code), { percent, amount, active: document.getElementById("discountActive").checked });
  }, "تم حفظ الكود");
  if (ok) { document.getElementById("discountCode").value = ""; loadDiscountsAdmin(); }
});
async function deleteDiscount(code) {
  if (!(await confirmModal("حذف كود الخصم؟"))) return;
  await runSafely(() => deleteAndVerify(doc(db, "discountCodes", code)), "تم الحذف");
  loadDiscountsAdmin();
}

/* ========================================================================
   طلبات إعادة الاختبار (retryRequests) — الطالب يفتح طلب لما يستنفد
   محاولات اختبار معيّن، والأدمن هنا يوافق يفتحله محاولة إضافية.
   ======================================================================== */
async function loadRetryRequestsAdmin() {
  const box = document.getElementById("retriesListAdmin");
  box.innerHTML = `<div class="sub">جارٍ التحميل...</div>`;
  const snap = await getDocs(query(collection(db, "retryRequests"), where("status", "==", "pending")));
  box.innerHTML = "";
  if (snap.empty) box.innerHTML = `<div class="sub">لا توجد طلبات إعادة حاليًا.</div>`;
  snap.forEach((d) => {
    const r = d.data();
    box.insertAdjacentHTML("beforeend", `
      <div class="list-row">
        <div><b>${escapeHtml(r.studentName || r.uid)}</b><div class="meta">${escapeHtml(r.taskTitle || r.taskId)}</div></div>
        <div class="actions">
          <button class="btn btn-secondary btn-sm" data-approve-retry="${d.id}" data-uid="${r.uid}" data-task="${r.taskId}">فتح محاولة</button>
          <button class="btn btn-danger btn-sm" data-deny-retry="${d.id}">رفض</button>
        </div>
      </div>`);
  });
}
document.getElementById("retriesListAdmin").addEventListener("click", (e) => {
  const approveBtn = e.target.closest("[data-approve-retry]");
  const denyBtn = e.target.closest("[data-deny-retry]");
  if (approveBtn) return approveRetryRequest(approveBtn.dataset.approveRetry, approveBtn.dataset.uid, approveBtn.dataset.task);
  if (denyBtn) return denyRetryRequest(denyBtn.dataset.denyRetry);
});
async function approveRetryRequest(reqId, uid, taskId) {
  const ok = await runSafely(async () => {
    await setDoc(doc(db, "progress", uid, "tasks", taskId), { locked: false, retryApproved: true }, { merge: true });
    await setDoc(doc(db, "retryRequests", reqId), { status: "approved" }, { merge: true });
  }, "تم فتح محاولة إضافية للطالب");
  if (ok) loadRetryRequestsAdmin();
}
async function denyRetryRequest(reqId) {
  if (!(await confirmModal("رفض الطلب؟"))) return;
  await runSafely(() => setDoc(doc(db, "retryRequests", reqId), { status: "denied" }, { merge: true }), "تم الرفض");
  loadRetryRequestsAdmin();
}
