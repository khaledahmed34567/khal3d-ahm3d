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

function toast(msg, ms = 2600) {
  const host = document.getElementById("toastHost");
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  host.appendChild(t);
  setTimeout(() => t.remove(), ms);
}
function escapeHtml(s) { return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
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
  populateTrackSelect();
  populateCourseSelect();
  populateLectureSelect();
  populateSurveyTargetSelect();
}

/* ========================================================================
   المسارات (Tracks)
   ======================================================================== */
async function loadTracksAdmin() {
  const box = document.getElementById("tracksListAdmin");
  box.innerHTML = `<div class="sub">جارٍ التحميل...</div>`;
  const snap = await getDocs(query(collection(db, "tracks"), orderBy("order", "asc")));
  box.innerHTML = "";
  snap.forEach((d) => {
    const t = d.data();
    box.insertAdjacentHTML("beforeend", `
      <div class="list-row">
        <div><b>${escapeHtml(t.title)}</b><div class="meta">ترتيب: ${t.order ?? "-"} · id: ${d.id}</div></div>
        <div class="actions"><button class="btn btn-danger btn-sm" data-del-track="${d.id}">حذف</button></div>
      </div>`);
  });
  box.querySelectorAll("[data-del-track]").forEach((b) => b.addEventListener("click", () => deleteTrack(b.dataset.delTrack)));
}
document.getElementById("btnAddTrack").addEventListener("click", async () => {
  const title = document.getElementById("trackTitle").value.trim();
  if (!title) return toast("اكتب عنوان المسار.");
  const image = await resolveImage("trackImage", "trackImageFile");
  const ref = doc(collection(db, "tracks"));
  await setDoc(ref, {
    id: ref.id, title,
    description: document.getElementById("trackDesc").value.trim(),
    image, order: Number(document.getElementById("trackOrder").value || 1),
    createdAt: serverTimestamp(),
  });
  toast("تم حفظ المسار");
  document.getElementById("trackTitle").value = ""; document.getElementById("trackDesc").value = ""; document.getElementById("trackImage").value = "";
  loadTracksAdmin(); populateTrackSelect();
});
async function deleteTrack(id) {
  if (!confirm("حذف المسار؟ (لن يحذف الكورسات التابعة له تلقائيًا)")) return;
  await deleteDoc(doc(db, "tracks", id));
  toast("تم الحذف");
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
async function loadCoursesAdmin() {
  const box = document.getElementById("coursesListAdmin");
  box.innerHTML = `<div class="sub">جارٍ التحميل...</div>`;
  const snap = await getDocs(collectionGroup(db, "courses"));
  box.innerHTML = "";
  snap.forEach((d) => {
    const c = d.data();
    box.insertAdjacentHTML("beforeend", `
      <div class="list-row">
        <div><b>${escapeHtml(c.title)}</b> <span class="badge ${c.courseEnded ? "on" : "off"}">${c.courseEnded ? "منتهٍ" : "مستمر"}</span>
          <div class="meta">${c.price ? c.price + "$" : "مجاني"} · id: ${d.id}</div></div>
        <div class="actions">
          <button class="btn btn-secondary btn-sm" data-toggle-end="${d.id}" data-track="${c.trackId}">${c.courseEnded ? "تعليم كمستمر" : "تعليم كمنتهٍ"}</button>
          <button class="btn btn-danger btn-sm" data-del-course="${d.id}" data-track="${c.trackId}">حذف</button>
        </div>
      </div>`);
  });
  box.querySelectorAll("[data-toggle-end]").forEach((b) => b.addEventListener("click", () => toggleCourseEnded(b.dataset.track, b.dataset.toggleEnd)));
  box.querySelectorAll("[data-del-course]").forEach((b) => b.addEventListener("click", () => deleteCourse(b.dataset.track, b.dataset.delCourse)));
}
document.getElementById("btnAddCourse").addEventListener("click", async () => {
  const trackId = document.getElementById("courseTrackSelect").value;
  const title = document.getElementById("courseTitle").value.trim();
  if (!trackId) return toast("أضف مسارًا أولًا.");
  if (!title) return toast("اكتب عنوان الكورس.");
  const image = await resolveImage("courseImage", "courseImageFile");
  const ref = doc(collection(db, "tracks", trackId, "courses"));
  await setDoc(ref, {
    id: ref.id, trackId, title,
    titleEn: document.getElementById("courseTitleEn").value.trim(),
    description: document.getElementById("courseDesc").value.trim(),
    instructor: document.getElementById("courseInstructor").value.trim(),
    image, price: Number(document.getElementById("coursePrice").value || 0),
    order: Number(document.getElementById("courseOrder").value || 1),
    skills: document.getElementById("courseSkills").value.trim(),
    courseEnded: document.getElementById("courseEnded").checked,
    createdAt: serverTimestamp(),
  });
  toast("تم حفظ الكورس");
  loadCoursesAdmin(); populateCourseSelect();
});
async function toggleCourseEnded(trackId, courseId) {
  const ref = doc(db, "tracks", trackId, "courses", courseId);
  const snap = await getDoc(ref);
  await setDoc(ref, { courseEnded: !(snap.data() || {}).courseEnded }, { merge: true });
  loadCoursesAdmin();
}
async function deleteCourse(trackId, courseId) {
  if (!confirm("حذف الكورس؟")) return;
  await deleteDoc(doc(db, "tracks", trackId, "courses", courseId));
  toast("تم الحذف");
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
async function loadLecturesAdmin() {
  const box = document.getElementById("lecturesListAdmin");
  box.innerHTML = `<div class="sub">جارٍ التحميل...</div>`;
  const snap = await getDocs(collectionGroup(db, "lectures"));
  box.innerHTML = "";
  snap.forEach((d) => {
    const l = d.data();
    box.insertAdjacentHTML("beforeend", `
      <div class="list-row">
        <div><b>${escapeHtml(l.title)}</b><div class="meta">المدة: ${escapeHtml(l.duration || "-")} · id: ${d.id}</div></div>
        <div class="actions"><button class="btn btn-danger btn-sm" data-del-lecture="${d.id}" data-course="${l.courseId}">حذف</button></div>
      </div>`);
  });
  box.querySelectorAll("[data-del-lecture]").forEach((b) => b.addEventListener("click", () => deleteLecture(b.dataset.course, b.dataset.delLecture)));
}
document.getElementById("btnAddLecture").addEventListener("click", async () => {
  const [trackId, courseId] = (document.getElementById("lectureCourseSelect").value || "").split("|");
  const title = document.getElementById("lectureTitle").value.trim();
  if (!courseId) return toast("أضف كورسًا أولًا.");
  if (!title) return toast("اكتب عنوان المحاضرة.");
  const image = await resolveImage("lectureImage", "lectureImageFile");
  const ref = doc(collection(db, "courses", courseId, "lectures"));
  await setDoc(ref, {
    id: ref.id, courseId, trackId, title,
    description: document.getElementById("lectureDesc").value.trim(),
    image, duration: document.getElementById("lectureDuration").value.trim(),
    order: Number(document.getElementById("lectureOrder").value || 1),
    createdAt: serverTimestamp(),
  });
  toast("تم حفظ المحاضرة");
  loadLecturesAdmin(); populateLectureSelect(); populateSurveyTargetSelect();
});
async function deleteLecture(courseId, lectureId) {
  if (!confirm("حذف المحاضرة؟")) return;
  await deleteDoc(doc(db, "courses", courseId, "lectures", lectureId));
  toast("تم الحذف");
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
document.getElementById("taskType").addEventListener("change", renderTaskTypeFields);
renderTaskTypeFields();

function renderTaskTypeFields() {
  const type = document.getElementById("taskType").value;
  const box = document.getElementById("taskTypeFields");
  if (type === "json") {
    box.innerHTML = `<div id="jsonBlocks"></div><button type="button" class="btn btn-secondary btn-sm" id="btnAddBlock">إضافة بند</button>`;
    document.getElementById("btnAddBlock").addEventListener("click", addJsonBlockRow);
    addJsonBlockRow();
  } else if (type === "pdf") {
    box.innerHTML = `<div class="field"><label>رابط ملف PDF</label><input id="pdfUrl" placeholder="https://...pdf" /></div>`;
  } else if (type === "video") {
    box.innerHTML = `
      <div class="field"><label>رابط الفيديو (mp4 أو يوتيوب)</label><input id="videoUrl" /></div>
      <div class="checkbox-row"><input type="checkbox" id="videoIsYoutube" /><label for="videoIsYoutube">رابط يوتيوب</label></div>`;
  } else if (type === "mcq") {
    box.innerHTML = `
      <div class="field"><label>مدة الاختبار (بالثواني)</label><input id="mcqTimeLimit" type="number" value="300" /></div>
      <div id="mcqQuestions"></div>
      <button type="button" class="btn btn-secondary btn-sm" id="btnAddQuestion">إضافة سؤال</button>`;
    document.getElementById("btnAddQuestion").addEventListener("click", addMcqQuestionRow);
    addMcqQuestionRow();
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
      <div class="field"><label>الكود المبدئي (Starter Code)</label><textarea id="codeStarter" rows="5"></textarea></div>`;
  } else if (type === "survey") {
    box.innerHTML = `<div id="taskSurveyQuestions"></div><button type="button" class="btn btn-secondary btn-sm" id="btnAddTaskSurveyQ">إضافة سؤال</button>`;
    document.getElementById("btnAddTaskSurveyQ").addEventListener("click", () => addSurveyQuestionRow("taskSurveyQuestions"));
    addSurveyQuestionRow("taskSurveyQuestions");
  }
}

/* ---- بناء بنود محتوى JSON ---- */
function addJsonBlockRow() {
  const box = document.getElementById("jsonBlocks");
  const row = document.createElement("div");
  row.className = "block-item";
  row.innerHTML = `
    <button type="button" class="remove-x">×</button>
    <div class="field"><label>نوع البند</label>
      <select class="block-type">
        <option value="title">عنوان</option>
        <option value="text">نص ملوّن</option>
        <option value="link">رابط</option>
      </select>
    </div>
    <div class="block-fields"></div>`;
  box.appendChild(row);
  row.querySelector(".remove-x").addEventListener("click", () => row.remove());
  const typeSel = row.querySelector(".block-type");
  const renderFields = () => {
    const fieldsBox = row.querySelector(".block-fields");
    const v = typeSel.value;
    if (v === "link") {
      fieldsBox.innerHTML = `<div class="field"><label>نص الرابط</label><input class="block-label" /></div>
        <div class="field"><label>الرابط (URL)</label><input class="block-url" /></div>`;
    } else if (v === "text") {
      fieldsBox.innerHTML = `<div class="field"><label>النص</label><textarea class="block-text" rows="2"></textarea></div>
        <div class="field"><label>لون النص</label><input type="color" class="block-color" value="#16181c" /></div>`;
    } else {
      fieldsBox.innerHTML = `<div class="field"><label>نص العنوان</label><input class="block-text" /></div>`;
    }
  };
  typeSel.addEventListener("change", renderFields);
  renderFields();
}
function collectJsonBlocks() {
  return Array.from(document.querySelectorAll("#jsonBlocks .block-item")).map((row) => {
    const type = row.querySelector(".block-type").value;
    if (type === "link") return { type, label: row.querySelector(".block-label").value, url: row.querySelector(".block-url").value };
    if (type === "text") return { type, text: row.querySelector(".block-text").value, color: row.querySelector(".block-color").value };
    return { type, text: row.querySelector(".block-text").value };
  });
}

/* ---- بناء أسئلة MCQ ---- */
function addMcqQuestionRow() {
  const box = document.getElementById("mcqQuestions");
  const row = document.createElement("div");
  row.className = "question-item";
  row.innerHTML = `
    <button type="button" class="remove-x">×</button>
    <div class="field"><label>نص السؤال</label><textarea class="q-text" rows="2"></textarea></div>
    <div class="field"><label>نص خاص بالذكاء الاصطناعي (اختياري — يترك افتراضي لو فاضي)</label><textarea class="q-aiguard" rows="1"></textarea></div>
    <div class="options-box"></div>
    <button type="button" class="btn btn-ghost btn-sm add-option">إضافة اختيار</button>`;
  box.appendChild(row);
  row.querySelector(".remove-x").addEventListener("click", () => row.remove());
  row.querySelector(".add-option").addEventListener("click", () => addOptionRow(row));
  addOptionRow(row); addOptionRow(row);
}
function addOptionRow(questionRow) {
  const optBox = questionRow.querySelector(".options-box");
  const qIndex = Array.from(document.querySelectorAll("#mcqQuestions .question-item")).indexOf(questionRow);
  const row = document.createElement("div");
  row.className = "option-item";
  row.style.display = "flex"; row.style.alignItems = "center"; row.style.gap = "8px";
  row.innerHTML = `
    <input type="radio" name="correct-${qIndex}-${Date.now()}" class="opt-correct" />
    <input class="opt-text" placeholder="نص الاختيار" style="flex:1;padding:9px;border-radius:8px;border:1px solid var(--line);" />
    <button type="button" class="remove-x" style="position:static;">×</button>`;
  optBox.appendChild(row);
  row.querySelector(".remove-x").addEventListener("click", () => row.remove());
}
function collectMcqQuestions() {
  return Array.from(document.querySelectorAll("#mcqQuestions .question-item")).map((row) => {
    const options = Array.from(row.querySelectorAll(".option-item")).map((o) => o.querySelector(".opt-text").value);
    let correctIndex = 0;
    Array.from(row.querySelectorAll(".option-item")).forEach((o, i) => { if (o.querySelector(".opt-correct").checked) correctIndex = i; });
    return { text: row.querySelector(".q-text").value, aiGuard: row.querySelector(".q-aiguard").value, options, correctIndex };
  });
}

/* ---- بناء أسئلة الاستبيان (مشتركة بين مهمة الاستبيان والاستبيان المستقل) ---- */
function addSurveyQuestionRow(containerId) {
  const box = document.getElementById(containerId);
  const row = document.createElement("div");
  row.className = "question-item";
  row.innerHTML = `
    <button type="button" class="remove-x">×</button>
    <div class="field"><label>نص السؤال</label><input class="sq-text" /></div>
    <div class="field"><label>نوع الإجابة</label>
      <select class="sq-type">
        <option value="text">نص حر</option>
        <option value="rating">تقييم من 1 إلى 5</option>
        <option value="choice">اختيار من قائمة</option>
      </select>
    </div>
    <div class="field sq-options-field" style="display:none;"><label>الخيارات (مفصولة بفواصل)</label><input class="sq-options" /></div>`;
  box.appendChild(row);
  row.querySelector(".remove-x").addEventListener("click", () => row.remove());
  const typeSel = row.querySelector(".sq-type");
  const optField = row.querySelector(".sq-options-field");
  typeSel.addEventListener("change", () => { optField.style.display = typeSel.value === "choice" ? "block" : "none"; });
}
function collectSurveyQuestions(containerId) {
  return Array.from(document.querySelectorAll(`#${containerId} .question-item`)).map((row) => {
    const type = row.querySelector(".sq-type").value;
    const q = { text: row.querySelector(".sq-text").value, type };
    if (type === "choice") q.options = row.querySelector(".sq-options").value.split(",").map((s) => s.trim()).filter(Boolean);
    return q;
  });
}

/* ---- حفظ المهمة ---- */
document.getElementById("btnAddTask").addEventListener("click", async () => {
  const [trackId, courseId, lectureId] = (document.getElementById("taskLectureSelect").value || "").split("|");
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

  const ref = doc(collection(db, "lectures", lectureId, "tasks"));
  await setDoc(ref, { id: ref.id, lectureId, courseId, trackId, type, title, order, ...extra, createdAt: serverTimestamp() });
  toast("تم حفظ المهمة");
  document.getElementById("taskTitle").value = "";
  loadTasksAdmin();
});

async function loadTasksAdmin() {
  const box = document.getElementById("tasksListAdmin");
  box.innerHTML = `<div class="sub">جارٍ التحميل...</div>`;
  const snap = await getDocs(collectionGroup(db, "tasks"));
  box.innerHTML = "";
  snap.forEach((d) => {
    const t = d.data();
    box.insertAdjacentHTML("beforeend", `
      <div class="list-row">
        <div><b>${escapeHtml(t.title)}</b><div class="meta">${escapeHtml(t.type)} · id: ${d.id}</div></div>
        <div class="actions"><button class="btn btn-danger btn-sm" data-del-task="${d.id}" data-lecture="${t.lectureId}">حذف</button></div>
      </div>`);
  });
  box.querySelectorAll("[data-del-task]").forEach((b) => b.addEventListener("click", () => deleteTask(b.dataset.lecture, b.dataset.delTask)));
}
async function deleteTask(lectureId, taskId) {
  if (!confirm("حذف المهمة؟")) return;
  await deleteDoc(doc(db, "lectures", lectureId, "tasks", taskId));
  toast("تم الحذف");
  loadTasksAdmin();
}

/* ========================================================================
   الاستبيانات المستقلة (courseSurveys / lectureSurveys)
   ======================================================================== */
document.getElementById("btnAddSurveyQuestion").addEventListener("click", () => addSurveyQuestionRow("surveyQuestions"));
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
  await setDoc(doc(db, col, targetId), {
    title: document.getElementById("surveyTitle").value.trim(),
    questions: collectSurveyQuestions("surveyQuestions"),
    updatedAt: serverTimestamp(),
  });
  toast("تم حفظ الاستبيان");
});

/* ========================================================================
   أكواد الخصم (Discount Codes)
   ======================================================================== */
async function loadDiscountsAdmin() {
  const box = document.getElementById("discountsListAdmin");
  box.innerHTML = `<div class="sub">جارٍ التحميل...</div>`;
  const snap = await getDocs(collection(db, "discountCodes"));
  box.innerHTML = "";
  snap.forEach((d) => {
    const c = d.data();
    box.insertAdjacentHTML("beforeend", `
      <div class="list-row">
        <div><b>${escapeHtml(d.id)}</b> <span class="badge ${c.active !== false ? "on" : "off"}">${c.active !== false ? "فعّال" : "متوقف"}</span>
          <div class="meta">${c.percent ? c.percent + "%" : (c.amount ? c.amount + "$" : "-")}</div></div>
        <div class="actions"><button class="btn btn-danger btn-sm" data-del-discount="${d.id}">حذف</button></div>
      </div>`);
  });
  box.querySelectorAll("[data-del-discount]").forEach((b) => b.addEventListener("click", () => deleteDiscount(b.dataset.delDiscount)));
}
document.getElementById("btnAddDiscount").addEventListener("click", async () => {
  const code = document.getElementById("discountCode").value.trim().toUpperCase();
  if (!code) return toast("اكتب الكود.");
  const percent = document.getElementById("discountPercent").value ? Number(document.getElementById("discountPercent").value) : null;
  const amount = document.getElementById("discountAmount").value ? Number(document.getElementById("discountAmount").value) : null;
  await setDoc(doc(db, "discountCodes", code), { percent, amount, active: document.getElementById("discountActive").checked });
  toast("تم حفظ الكود");
  document.getElementById("discountCode").value = "";
  loadDiscountsAdmin();
});
async function deleteDiscount(code) {
  if (!confirm("حذف كود الخصم؟")) return;
  await deleteDoc(doc(db, "discountCodes", code));
  toast("تم الحذف");
  loadDiscountsAdmin();
}
